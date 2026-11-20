import {validateResultLayers} from './result-layers.js';

/** Display actions preserve the complete view, including private point/camera origins.
 * W5 remains the authority for the layer references and space, and W6 for saving.
 */
export function editResultLayers(view,action,options){
  const layers=view.resultLayers??[];
  let next;
  if(action?.type==='clear')next=[];
  else if(action?.type==='remove')next=layers.filter(layer=>layer.layerId!==action.layerId);
  else if(action?.type==='visibility'&&typeof action.visible==='boolean')next=layers.map(layer=>layer.layerId===action.layerId?{...layer,visible:action.visible}:layer);
  else throw Error('invalid-result-layer-action');
  return {...view,resultLayers:validateResultLayers(next,options)};
}
