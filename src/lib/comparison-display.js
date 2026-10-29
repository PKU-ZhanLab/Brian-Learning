import {nativeDisplayVolume} from './atlas-explorer.js';
import {prepareVolume} from './volume.js';

export function prepareComparisonDisplay(volume,options){
  const display=nativeDisplayVolume(volume,options);
  if(display===volume)return volume;
  // The membership buffer is a display derivative, not the source bytes named
  // by AssetIdentity. Rebuild every sampler through the canonical authority.
  const {identity,...metadata}=display;
  return prepareVolume(display.data,{...metadata,sourceIdentity:identity});
}
