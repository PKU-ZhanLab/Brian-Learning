// Shared admission rules. Counts and bytes are inclusive safe-integer limits.
export const MAX_WORKSPACE_ASSETS=50;
export const MAX_WORKSPACE_RAW_PAYLOAD_BYTES=256*1024*1024;
export const MAX_COMPRESSED_ASSET_BYTES=128*1024*1024;
export const MAX_PROJECT_UTF8_BYTES=180*1024*1024;
export const MAX_LABEL_FILE_BYTES=2*1024*1024;
export const MAX_LABEL_ROWS=50000;
export const MAX_LABEL_JSON_BYTES=4*1024*1024;
export const MAX_LABEL_TEXT_CHARS=2000;
export const utf8ByteLength=value=>new TextEncoder().encode(value).byteLength;

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function metadataText(value,field,max=2000,fallback=''){
  if(value==null)return fallback;
  if(typeof value!=='string')throw Error(`Invalid volume metadata: ${field}-type`);
  if(value.length>max)throw Error(`Invalid volume metadata: ${field}-too-long`);
  return value;
}
function headerMetadata(input,includeSource=true){
  if(input==null)return {};
  if(!record(input))throw Error('Invalid NIfTI source metadata');
  const output={};
  for(const key of ['format','affineSource','spatialUnits','description','referenceSpace'])if(input[key]!=null)output[key]=metadataText(input[key],key,2000);
  for(const key of ['littleEndian','affineConflict','geometryDoesNotVerifySpace','userDeclaredAligned','restoredFromProject'])if(input[key]!=null){if(typeof input[key]!=='boolean')throw Error(`Invalid volume metadata: ${key}`);output[key]=input[key];}
  for(const key of ['datatype','qformCode','sformCode','originalSpatialUnits','min','max','nonzero'])if(input[key]!=null){if(!Number.isFinite(input[key]))throw Error(`Invalid volume metadata: ${key}`);output[key]=input[key];}
  for(const key of ['qformAffine','sformAffine'])if(input[key]!=null){if(!Array.isArray(input[key])||input[key].length!==16||!input[key].every(Number.isFinite))throw Error(`Invalid volume metadata: ${key}`);output[key]=[...input[key]];}
  if(input.scaling!=null){
    if(!record(input.scaling))throw Error('Invalid volume scaling metadata');
    output.scaling={};for(const key of ['slope','intercept']){const value=input.scaling[key];if(key==='intercept'&&input.scaling.slope===0&&!Number.isFinite(value)){output.scaling[key]=null;continue;}if(value!=null&&!Number.isFinite(value))throw Error('Invalid volume scaling metadata');output.scaling[key]=value??null;}
  }
  if(includeSource&&input.sourceImport!=null){
    let source=input.sourceImport,depth=0;
    while(record(source)&&source.sourceImport!=null){if(++depth>16)throw Error('NIfTI source metadata are too deeply nested');source=source.sourceImport;}
    output.sourceImport=headerMetadata(source,false);
  }
  return output;
}
export function validateVolumeMetadata(input){
  if(!record(input))throw Error('Invalid volume metadata');
  const kind=({labels:'label',stat:'statistic',prob:'probability'})[input.kind]||input.kind||'label';
  if(!['label','mask','statistic','probability'].includes(kind))throw Error('Invalid volume kind');
  if(input.canOverlayOnTarget!=null&&typeof input.canOverlayOnTarget!=='boolean')throw Error('Invalid volume alignment flag');
  const alignment=metadataText(input.alignmentStatus,'alignmentStatus',100,'unverified');
  const result={kind,name:metadataText(input.name,'name',500),space:metadataText(input.space,'space',160,'native-unverified'),source:metadataText(input.source,'source',4096),provenance:metadataText(input.provenance,'provenance',20000),note:metadataText(input.note,'note',20000),license:metadataText(input.license,'license',10000),alignmentStatus:alignment==='user-declared'?'user-declared':'unverified',canOverlayOnTarget:input.canOverlayOnTarget===true,metadata:headerMetadata(input.metadata),labels:[],limitations:[]};
  if(input.limitations!=null){if(!Array.isArray(input.limitations)||input.limitations.length>100)throw Error('Invalid volume limitations');result.limitations=input.limitations.map(value=>metadataText(value,'limitations',4000));}
  result.labels=validateLabelRows(input.labels??[]);
  return result;
}

export function validateLabelRows(rows){
  if(!Array.isArray(rows)||rows.length>MAX_LABEL_ROWS)throw Error('Invalid volume labels: label-count');
  const ids=new Set();let jsonBytes=2;
  const labels=rows.map(label=>{
    if(!record(label)||!Number.isSafeInteger(label.id)||label.id<=0||ids.has(label.id))throw Error('Invalid or duplicate volume label ID: labels-invalid-table');
    const name=metadataText(label.name,'label-name',MAX_LABEL_TEXT_CHARS);if(!name.trim())throw Error('Invalid volume label name: labels-invalid-table');ids.add(label.id);
    const normalized={id:label.id,name,...(label.zh!=null?{zh:metadataText(label.zh,'label-zh',MAX_LABEL_TEXT_CHARS)}:{})};
    jsonBytes+=utf8ByteLength(JSON.stringify(normalized))+(ids.size>1?1:0);
    if(jsonBytes>MAX_LABEL_JSON_BYTES)throw Error('Invalid volume labels: label-json-budget');
    return normalized;
  });
  return labels;
}

export function assertWorkspaceBudget({assetCount,rawPayloadBytes,compressedAssetBytes=[],projectUtf8Bytes=0}){
  const check=(value,max,code)=>{if(!Number.isSafeInteger(value)||value<0||value>max)throw Error(code);};
  check(assetCount,MAX_WORKSPACE_ASSETS,'asset-count');
  check(rawPayloadBytes,MAX_WORKSPACE_RAW_PAYLOAD_BYTES,'decoded-budget');
  if(!Array.isArray(compressedAssetBytes))throw Error('compressed-asset-budget');
  for(const bytes of compressedAssetBytes)check(bytes,MAX_COMPRESSED_ASSET_BYTES,'compressed-asset-budget');
  check(projectUtf8Bytes,MAX_PROJECT_UTF8_BYTES,'project-json-budget');
}
