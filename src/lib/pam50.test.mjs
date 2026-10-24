import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseNifti1, cropNiftiSelections } from './nifti.js';

function fixture({ units = 2, bigEndian = false } = {}) {
  const data = [1,1,0, 0,2,0, 0,1,0, 2,0,0], buffer = new ArrayBuffer(352 + data.length), view = new DataView(buffer), le = !bigEndian;
  view.setInt32(0, 348, le); view.setInt16(40, 3, le); [3,2,2].forEach((n, axis) => view.setInt16(42 + axis * 2, n, le));
  view.setInt16(70, 2, le); view.setInt16(72, 8, le); view.setFloat32(108, 352, le); view.setFloat32(112, 1, le); view.setUint8(123, units); view.setInt16(254, 2, le);
  [-.5,0,0,35, 0,.5,0,-81.22, 0,0,.5,-561.84].forEach((n, i) => view.setFloat32(280 + i * 4, n, le));
  [110,43,49,0].forEach((n, i) => view.setUint8(344 + i, n)); new Uint8Array(buffer, 352).set(data);
  return buffer;
}

test('NIfTI parsing preserves explicit affine, datatype and label-mask counts', () => {
  for (const bigEndian of [false, true]) {
    const volume = parseNifti1(fixture({ bigEndian }));
    assert.deepEqual(volume.shape, [3,2,2]); assert.equal(volume.affine[0], -.5); assert.equal(volume.units, 'mm');
    const masks = cropNiftiSelections(volume, [{ id: 'C1', selector: 'label', labelValue: 1 }, { id: 'C2', selector: 'label', labelValue: 2 }]);
    assert.deepEqual(masks.map(mask => mask.sourceVoxels), [3,2]);
    assert.equal(masks[0].mask.reduce((a,b) => a+b), 3);
  }
});

test('unspecified units require explicit source metadata and malformed data are rejected', () => {
  assert.throws(() => parseNifti1(fixture({ units: 0 })), /sform-required/);
  assert.match(parseNifti1(fixture({ units: 0 }), { spatialUnitsIfMissing: 'mm' }).unitsProvenance, /source metadata/);
  assert.throws(() => parseNifti1(fixture({ units: 1 }), { spatialUnitsIfMissing: 'mm' }), /sform-required/);
  assert.throws(() => parseNifti1(fixture().slice(0, 354)), /data-length/);
});

test('PAM50 worker verifies source bytes, groups one download, and reports offline/hash failures', async () => {
  const originalFetch = globalThis.fetch, originalSelf = globalThis.self;
  const compressed = gzipSync(new Uint8Array(fixture({ units: 0 })));
  const sha256 = createHash('sha256').update(compressed).digest('hex');
  const url = 'https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/609a18235d9143dad0d6bf5bb35e2bff9e55196f/template/PAM50_spinal_levels.nii.gz';
  let calls = 0, deliver;
  globalThis.fetch = async () => { calls++; return new Response(compressed); };
  globalThis.self = { postMessage(message, transfer) { deliver(structuredClone(message, transfer ? { transfer } : undefined)); } };
  await import('./pam50.worker.js');
  async function request(entries) {
    const messages = [];
    return new Promise(resolve => { deliver = message => { messages.push(message); if (message.type === 'idle') resolve(messages); }; globalThis.self.onmessage({ data: { entries } }); });
  }
  const base = { format: 'nifti1-gzip', url, sha256, selector: 'label', spatialUnitsIfMissing: 'mm', sourceShape: [3,2,2], sourceAffine: parseNifti1(fixture()).affine };
  try {
    const messages = await request([{ ...base, id: 'spinal-C1', labelValue: 1 }, { ...base, id: 'spinal-C2', labelValue: 2 }]);
    assert.equal(calls, 1);
    const results = messages.filter(message => message.type === 'result'); assert.equal(results.length, 2);
    assert.equal(results.find(result => result.id === 'spinal-C1').metadata.sourceMaskVoxels, 3);
    assert.ok(results.every(result => result.data.positions.length > 0 && result.data.positions.every(Number.isFinite)));
    const badHash = await request([{ ...base, id: 'bad', labelValue: 1, sha256: '0'.repeat(64) }]);
    assert.equal(badHash.find(message => message.type === 'error').message, 'source-hash-mismatch');
    globalThis.fetch = async () => { throw new TypeError('Simulated offline source'); };
    const offline = await request([{ ...base, id: 'offline', labelValue: 1 }]);
    assert.match(offline.find(message => message.type === 'error').message, /offline/);
    assert.equal(offline.some(message => message.type === 'result'), false);
  } finally { globalThis.fetch = originalFetch; globalThis.self = originalSelf; }
});
