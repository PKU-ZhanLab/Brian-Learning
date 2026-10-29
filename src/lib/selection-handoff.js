import {selectAtlasRegions} from './atlas-selection.js';

/** Replace/add one raw source collection. Spatial eligibility remains the ROI gate's job. */
export function assignSelectionToOperand(previous={}, {side,regions,mode='replace'}={}){
  if(!['A','B'].includes(side))throw Error('operand-side');
  if(!Array.isArray(regions)||!regions.length)throw Error('selection-empty');
  if(!['replace','add'].includes(mode))throw Error('selection-mode');
  const prefix=side.toLowerCase(),current=previous[`${prefix}RegionRefs`]??[];
  if(mode==='add'&&current.length&&previous[`${prefix}Atlas`]!==current[0].atlasId)throw Error('selection-unresolved');
  if(mode==='add'&&previous[`${prefix}Labels`]?.length&&(!current.length||previous[`${prefix}Labels`].some(id=>!current.some(ref=>ref.labelId===id))))throw Error('selection-unresolved');
  const refs=selectAtlasRegions(regions,mode==='add'?'add':'replace',current),source=refs[0];
  if(refs.some(ref=>['atlasId','atlasVersion','spaceId'].some(key=>ref[key]!==source[key])))throw Error('selection-source-mismatch');
  return {...previous,[`${prefix}Atlas`]:source.atlasId,[`${prefix}Labels`]:refs.map(ref=>ref.labelId),[`${prefix}RegionRefs`]:refs,computed:false,snapshot:'none',snapshotId:null};
}
