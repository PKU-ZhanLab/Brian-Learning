import { atlasRegionKey, makeAtlasRegionRef, relationsForRegion } from './atlas-identity.js';

/** Index original dictionary records by complete source identity, never display name. */
export function buildRegionIndex(manifest) {
  const index = new Map();
  for (const [atlasId, meta] of Object.entries(manifest?.atlases ?? {})) {
    if (!meta.atlasVersion || !meta.spaceIdentitySource) continue; // Unsourced user images have a separate identity contract.
    for (const label of meta.labels ?? []) {
      if (label.id <= 0) continue;
      const ref = makeAtlasRegionRef(atlasId, meta, label.id);
      index.set(atlasRegionKey(ref), { ...label, ref, atlas:meta });
    }
  }
  return index;
}

/** @returns {import('./research-contracts.js').AtlasRegionRef[]} */
export function serializeAtlasSelection(refs) {
  return refs.map(ref => {
    atlasRegionKey(ref);
    return { atlasId:ref.atlasId, atlasVersion:ref.atlasVersion, labelId:ref.labelId, hemisphere:ref.hemisphere, spaceId:ref.spaceId };
  });
}

export function selectAtlasRegions(refs, mode = 'replace', current = []) {
  if (!['replace','add'].includes(mode)) throw Error('Unknown atlas selection mode');
  return [...new Map(serializeAtlasSelection(mode === 'add' ? [...current,...refs] : refs).map(ref => [atlasRegionKey(ref),ref])).values()];
}

const get = (index,key) => index instanceof Map ? index.get(key) : Object.hasOwn(index ?? {}, key) ? index[key] : undefined;
export function restoreAtlasSelection(saved, regionIndex) {
  const selected = [], unresolved = [];
  for (const ref of selectAtlasRegions(saved, 'replace', [])) (get(regionIndex,atlasRegionKey(ref)) ? selected : unresolved).push(ref);
  return {selected,unresolved};
}

export function regionDetails(ref, regionIndex, relations) {
  const record = get(regionIndex,atlasRegionKey(ref));
  const linked = relationsForRegion(ref,relations);
  return {ref:serializeAtlasSelection([ref])[0], labelName:record?.name ?? `#${ref.labelId}`, sourceUrl:record?.labelMetadataSource?.sourceUrl ?? null, sourceLocator:record?.labelMetadataSource?.sourceLocator ?? null, relations:linked, hasEvidence:linked.some(row => Array.isArray(row.evidenceIds) && row.evidenceIds.length > 0)};
}
