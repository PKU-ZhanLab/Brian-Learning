// All returned coordinates use RAS millimetres. Reference-space identity is never inferred.
export function parseCoordinateInput(text,{spaceId,convention='RAS',maxPoints=1000}={}) {
  const errors=[];
  if(typeof spaceId!=='string'||!spaceId.trim())errors.push({field:'spaceId',code:'space-required'});
  if(!['RAS','LPS'].includes(convention))errors.push({field:'convention',code:'invalid-convention'});
  const source=typeof text==='string'?text.trim():'';
  if(!source)errors.push({field:'coordinates',code:'coordinates-required'});
  if(errors.length)return {points:[],errors};
  let rows;
  if(source.startsWith('[')) {
    try {const parsed=JSON.parse(source);rows=Array.isArray(parsed[0])?parsed:[parsed];}
    catch {return {points:[],errors:[{field:'coordinates',code:'invalid-coordinate',line:1}]};}
  } else rows=source.split(/\r?\n|;/).filter(row=>row.trim()).map(row=>row.includes(',')?row.split(',').map(value=>value.trim()):row.trim().split(/\s+/));
  const limit=Number.isInteger(maxPoints)&&maxPoints>0?Math.min(maxPoints,1000):1000;
  if(rows.length>limit)return {points:[],errors:[{field:'coordinates',code:'too-many-points',limit}]};
  const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const points=[];
  rows.forEach((row,index)=>{
    if(!Array.isArray(row)||row.length!==3||row.some(value=>!['number','string'].includes(typeof value)||!decimal.test(String(value))||!Number.isFinite(Number(value)))) {
      errors.push({field:'coordinates',code:'invalid-coordinate',line:index+1});return;
    }
    const point=row.map(Number);
    points.push(convention==='LPS'?[-point[0]||0,-point[1]||0,point[2]]:point);
  });
  if(!rows.length)errors.push({field:'coordinates',code:'coordinates-required'});
  return {points:errors.length?[]:points,errors};
}

export function stepCoordinate(point,axis,delta) {
  if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||!Number.isInteger(axis)||axis<0||axis>2||!Number.isFinite(delta))throw Error('invalid-coordinate-step');
  const next=point.map((value,index)=>index===axis?value+delta:value);
  if(!next.every(Number.isFinite))throw Error('invalid-coordinate-step');
  return next;
}

export function coordinateOutsideBounds(point,bounds) {
  return !!bounds&&['x','y','z'].some((axis,index)=>point[index]<bounds[axis][0]||point[index]>bounds[axis][1]);
}

export function formatCoordinate(point,spaceId) {
  return `${spaceId} · RAS · ${point.join(', ')} mm`;
}

// Keep arbitrary typed reference names from colliding with App's legacy contexts.
export function coordinateNavigationSpace(spaceId) {
  if(spaceId==='MNI152NLin6Asym')return 'brain';
  return ['brain','pam50','schematic'].includes(spaceId)||spaceId?.startsWith('independent:')?`independent:${spaceId}`:spaceId;
}
export function coordinateReferenceSpace(context) {
  if(context==='brain')return 'MNI152NLin6Asym';
  if(context==='pam50')return 'PAM50 native straightened';
  return context?.startsWith('independent:')?context.slice('independent:'.length):context;
}

export function nextCoordinateOrigin(current,source={kind:'unknown'}) {
  return {...source,cameraSensitive:current?.cameraSensitive!==false||source.kind!=='manual'||source.cameraSensitive===true,explorerSensitive:current?.explorerSensitive!==false||source.explorerSensitive===true};
}
