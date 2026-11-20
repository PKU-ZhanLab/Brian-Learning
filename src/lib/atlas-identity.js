/** @typedef {import('./research-contracts.js').AtlasRegionRef} AtlasRegionRef */

const hemispheres = new Set(['L', 'R', 'M', 'B', 'U']);
const relationTypes = new Set(['exact-source', 'overlaps', 'contained-by', 'contains', 'approximate']);
const tissues = new Set(['gray-matter', 'white-matter', 'csf', 'mixed', 'unknown']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sourced = value => nonempty(value?.sourceUrl) && nonempty(value?.sourceLocator);

/** Stable source identity. Names, coordinates and property insertion order play no part. */
export function atlasRegionKey(ref) {
  if (!nonempty(ref?.atlasId)) throw Error('Atlas ID is required');
  if (!nonempty(ref.atlasVersion)) throw Error('Atlas version is required');
  if (!Number.isSafeInteger(ref.labelId) || ref.labelId <= 0) throw Error('Positive original label ID is required');
  if (!hemispheres.has(ref.hemisphere)) throw Error('Source label hemisphere is required');
  if (!nonempty(ref.spaceId)) throw Error('Source space identity is required');
  return JSON.stringify([ref.atlasId, ref.atlasVersion, ref.labelId, ref.hemisphere, ref.spaceId]);
}

/** Resolve only a recorded dictionary entry; caller-supplied names and sides are ignored.
 * @returns {AtlasRegionRef}
 */
export function makeAtlasRegionRef(atlasId, metadata, label) {
  if (!metadata || (metadata.atlasId && metadata.atlasId !== atlasId)) throw Error('Atlas metadata identity does not match');
  const labelId = typeof label === 'number' ? label : label?.id ?? label?.labelId ?? label?.value ?? label?.index;
  if (!Number.isSafeInteger(labelId) || labelId <= 0) throw Error('Positive original label ID is required');
  const entry = Array.isArray(metadata.labels)
    ? metadata.labels.find(row => row.id === labelId)
    : metadata.labels?.[labelId];
  if (!entry || typeof entry !== 'object') throw Error(`Source label ${labelId} is unavailable`);
  if (!sourced(entry.labelMetadataSource)) throw Error(`Label ${labelId} has no source metadata`);
  if (!sourced(metadata.spaceIdentitySource) || metadata.spaceIdentitySource.spaceId !== metadata.spaceId) throw Error('Source space identity has no matching provenance');
  const ref = { atlasId, atlasVersion: metadata.atlasVersion, labelId, hemisphere: entry.hemisphere, spaceId: metadata.spaceId };
  atlasRegionKey(ref);
  return ref;
}

/** Unknown relationships are empty, never guessed from names or catalog position. */
export function relationsForRegion(ref, relations) {
  const key = atlasRegionKey(ref);
  return (relations?.relations ?? relations ?? []).filter(relation => atlasRegionKey(relation.region) === key);
}

const lookup = (index, key) => index instanceof Map ? index.get(key) : Object.hasOwn(index ?? {}, key) ? index[key] : undefined;
const categoryTissue = concept => concept?.tissue ?? ({ cortex:'gray-matter', subcortical:'gray-matter', tract:'white-matter', ventricle:'csf' }[concept?.category] ?? 'unknown');
const conflicts = (a, b) => a !== 'unknown' && b !== 'unknown' && a !== 'mixed' && b !== 'mixed' && a !== b;

/** Validate explicit claims against independently indexed source labels and concepts.
 * Exact-source requires the original extraction's recorded concept mapping, not an
 * anatomical similarity assertion or a cross-atlas overlap.
 */
export function validateRegionRelations(relations, regionIndex, conceptIndex) {
  const errors = [];
  const rows = relations?.relations ?? relations;
  if (!Array.isArray(rows)) return { valid:false, errors:['Relations must be an array'] };
  const seen = new Set();
  rows.forEach((relation, i) => {
    const fail = message => errors.push(`Relation ${i}: ${message}`);
    let key;
    try { key = atlasRegionKey(relation?.region); } catch (error) { fail(error.message); return; }
    const region = lookup(regionIndex, key), concept = lookup(conceptIndex, relation.conceptId);
    if (!region) fail('source region identity is not indexed');
    if (!concept) fail('target concept is not indexed');
    if (!relationTypes.has(relation.type)) fail('unsupported relationship type');
    if (!sourced(relation) || !/^https?:\/\//.test(relation.sourceUrl)) fail('source URL and locator are required');
    if (!tissues.has(relation.sourceTissue) || !tissues.has(relation.targetTissue)) fail('explicit source and target tissue categories are required');
    if (!region || !concept) return;
    const sourceTissue = region.tissue ?? 'unknown', targetTissue = categoryTissue(concept);
    if (conflicts(sourceTissue, relation.sourceTissue) || conflicts(targetTissue, relation.targetTissue) || conflicts(sourceTissue, targetTissue) || conflicts(relation.sourceTissue, relation.targetTissue)) fail('tissue categories contradict source or target');
    const sourceSide = relation.region.hemisphere, targetSide = concept.hemisphere ?? 'U';
    if ((sourceSide === 'L' && targetSide === 'R') || (sourceSide === 'R' && targetSide === 'L') || (relation.type === 'exact-source' && sourceSide !== targetSide)) fail('hemisphere contradicts target concept');
    if (region.hemisphere && region.hemisphere !== sourceSide) fail('hemisphere contradicts source dictionary');
    if (relation.type === 'exact-source') {
      const mapping = region.structureIdSource;
      if (region.structureId !== relation.conceptId || !sourced(mapping) || mapping.sourceUrl !== relation.sourceUrl || mapping.sourceLocator !== relation.sourceLocator) fail('exact-source has no matching same-source concept mapping');
      if (sourceTissue === 'unknown' || targetTissue === 'unknown' || sourceSide === 'U') fail('exact-source cannot resolve unknown tissue or hemisphere');
    }
    const signature = JSON.stringify([key, relation.conceptId, relation.type]);
    if (seen.has(signature)) fail('duplicate relationship');
    seen.add(signature);
  });
  return { valid:errors.length === 0, errors };
}
