import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const manifest = await json(path.join(publicRoot, 'data/anatomy/manifest.json'));
const registration = await json(path.join(publicRoot, 'data/space/hcp1065-registration.json'));
const pointReport = await json(path.join(publicRoot, 'data/anatomy/registered-point-validation.json'));
const checkedSources = new Map();
const results = [];
let meshes = 0, bundles = 0, points = 0;
const fail = message => { throw new Error(message); };
function localFile(url) {
  const result = path.resolve(publicRoot, url.replace(/^\//, ''));
  if (!result.startsWith(publicRoot + path.sep)) fail(`Asset path escapes public root: ${url}`);
  return result;
}
async function digest(file) {
  if (checkedSources.has(file)) return checkedSources.get(file);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const value = hash.digest('hex'); checkedSources.set(file, value); return value;
}
async function expectHash(file, expected, id) {
  if (!/^[0-9a-f]{64}$/.test(expected || '') || await digest(file) !== expected) fail(`${id}: hash mismatch`);
}
function inspectPoints(values, id) {
  if (!values.length || values.length % 3 || values.some(v => !Number.isFinite(v))) fail(`${id}: invalid coordinates`);
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i++) { const axis = i % 3; low[axis] = Math.min(low[axis], values[i]); high[axis] = Math.max(high[axis], values[i]); }
  return [low, high];
}
function compareBounds(actual, declared, center, id) {
  if (!declared || !center || center.length !== 3) fail(`${id}: missing geometry bounds/center`);
  for (let axis = 0; axis < 3; axis++) {
    for (let edge = 0; edge < 2; edge++) if (Math.abs(actual[edge][axis] - declared[edge][axis]) > 0.002) fail(`${id}: declared bounds differ from vertices`);
    if (!Number.isFinite(center[axis]) || center[axis] < actual[0][axis] - 0.002 || center[axis] > actual[1][axis] + 0.002) fail(`${id}: center outside geometry`);
  }
}
for (const [id, entry] of Object.entries(manifest.structures)) {
  if (!entry.geometry) { if (entry.representation !== 'schematic') fail(`${id}: absent geometry lacks unavailable/schematic status`); continue; }
  const file = localFile(entry.geometry); await expectHash(file, entry.sha256, id);
  const asset = await json(file);
  if (asset.coordinateSystem !== 'RAS' || asset.units !== 'mm') fail(`${id}: coordinate convention missing`);
  if (!entry.source || !entry.nativeSpace || !entry.coverage || !entry.limitations || !entry.license) fail(`${id}: provenance incomplete`);
  let geometryBounds;
  if (asset.kind === 'mesh') {
    meshes++;
    if (entry.dataset !== 'PAM50' || entry.targetAlignment.verified !== false) fail(`${id}: PAM50 registration must remain unverified`);
    geometryBounds = inspectPoints(asset.positions, id);
    if (asset.positions.length / 3 !== entry.vertices || asset.indices.length / 3 !== entry.triangles || asset.indices.length % 3) fail(`${id}: mesh counts disagree`);
    if (asset.indices.some(index => !Number.isInteger(index) || index < 0 || index >= entry.vertices)) fail(`${id}: invalid triangle index`);
    if (asset.normals.length !== asset.positions.length || asset.normals.some(value => !Number.isFinite(value))) fail(`${id}: invalid normals`);
    if (entry.nativeAffine.length !== 16 || entry.nativeAffine.some(value => !Number.isFinite(value))) fail(`${id}: invalid native affine`);
    const sourceRelative = new URL(entry.source).pathname.split(`/${entry.sourceVersion}/`)[1];
    if (!sourceRelative) fail(`${id}: source is not pinned to the declared version`);
    await expectHash(path.join(root, 'data-sources/anatomy/pam50', sourceRelative), entry.sourceSha256, id + ' NIfTI');
  } else if (asset.kind === 'streamlines') {
    bundles++;
    if (entry.dataset !== 'HCP1065' || entry.displaySpace !== registration.targetSpace || asset.space !== registration.targetSpace || entry.targetAlignment.fieldSha256 !== registration.fieldSha256) fail(`${id}: registered-space provenance mismatch`);
    if (asset.streamlines.length !== entry.renderedStreamlines || asset.streamlines.length > 240 || !asset.streamlines.length || asset.streamlines.some(line => line.length !== 120)) fail(`${id}: display streamline counts invalid`);
    const coordinates = asset.streamlines.flat(); points += coordinates.length / 3; geometryBounds = inspectPoints(coordinates, id);
    const nativeFile = localFile(entry.nativeGeometry); await expectHash(nativeFile, entry.nativeGeometrySha256, id + ' native');
    const native = await json(nativeFile);
    if (native.streamlines.length !== asset.streamlines.length) fail(`${id}: registration changes bundle cardinality`);
    compareBounds(inspectPoints(native.streamlines.flat(), id + ' native'), entry.nativeBounds, entry.nativeCenter, id + ' native');
    if (entry.sourceParts.reduce((n, part) => n + part.sourceStreamlines, 0) !== entry.sourceStreamlines || entry.sourceParts.reduce((n, part) => n + part.renderedStreamlines, 0) !== entry.renderedStreamlines) fail(`${id}: source/display counts disagree`);
    for (const part of entry.sourceParts) {
      await expectHash(path.join(root, 'data-sources/anatomy/hcp1065-trk', part.archiveMember), part.sourceSha256, id + ' TRK');
      if (part.sourceVoxelToRAS.length !== 16 || part.sourceVoxelOrder !== 'LPS') fail(`${id}: source header convention changed`);
    }
    if (entry.targetAlignment.pointRoundTripMm.percentile95 > 0.25 || entry.targetAlignment.pointRoundTripMm.max > 1) fail(`${id}: registration roundtrip QA fails`);
  } else fail(`${id}: unknown geometry type`);
  compareBounds(geometryBounds, entry.bounds, entry.center, id);
  results.push({ id, kind: asset.kind, geometry: entry.geometry, sha256: entry.sha256 });
}
const levels = [...Array.from({ length: 8 }, (_, i) => `C${i + 1}`), ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `S${i + 1}`)];
for (let i = 0; i < levels.length; i++) {
  const entry = manifest.structures['spinal-' + levels[i]];
  if (entry.nativeLabel !== i + 1 || (i && entry.center[2] >= manifest.structures['spinal-' + levels[i - 1]].center[2])) fail('Spinal segment labels or superior-to-inferior order are invalid');
}
for (const kind of ['anterior', 'posterior']) {
  if (manifest.structures[`spinal-${kind}-horn-l`].center[0] >= 0 || manifest.structures[`spinal-${kind}-horn-r`].center[0] <= 0) fail(`${kind} horn laterality is invalid in RAS`);
}
const realNerves = Object.entries(manifest.structures).filter(([id, value]) => id.startsWith('cn-') && value.geometry).length;
if (meshes !== 36 || bundles !== 31 || realNerves !== 10 || points !== pointReport.points || pointReport.structureCount !== bundles || manifest.structures['spinal-Co1'].geometry || manifest.structures['spinal-lateral-horn'].geometry) fail('Declared anatomical coverage changed');
await expectHash(path.join(root, 'data-sources/anatomy/hcp1065_avg_tracts_trk.zip'), manifest.datasets.HCP1065.archiveSha256, 'HCP1065 archive');
await expectHash(path.join(root, 'data-sources/space/MNI152NLin2009aAsym_to_MNI152NLin6Asym_dipy.npz'), registration.fieldSha256, 'registration field');
const report = { passed: true, checkedAt: new Date().toISOString(), realStructureCount: results.length, pam50Meshes: meshes, hcp1065Bundles: bundles, cranialNerveBundles: realNerves, spinalLevels: levels.length, transformedStreamlinePoints: points, checkedFiles: checkedSources.size, roundTripMm: pointReport.roundTripMm, scope: 'File integrity, finite and consistent geometry, source hashes, coordinate metadata, laterality, coverage and recorded registration QA. This is not individual anatomical validation.', structures: results };
await writeFile(path.join(publicRoot, 'data/anatomy/validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, structures: undefined }, null, 2));
