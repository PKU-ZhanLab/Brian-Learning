// Categorical sampling on a matched pial/white ribbon. Never average label IDs.
export const RIBBON_DEPTHS = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1];
export function projectRibbon({pial, white, sample, allowedIds, cortexMask, depths=RIBBON_DEPTHS}) {
  if (pial.length !== white.length || pial.length % 3) throw Error('Paired surface vertices do not match');
  const count=pial.length/3;
  if(cortexMask&&cortexMask.length!==count)throw Error('Cortex mask does not match vertices');
  if(!depths.length||depths.some(d=>!Number.isFinite(d)||d<0||d>1))throw Error('Sampling must stay inside the cortical ribbon');
  const labels=new Uint16Array(count), support=new Uint8Array(count);
  for(let i=0;i<count;i++){
    if(cortexMask&&!cortexMask[i])continue;
    const votes=new Map();
    for(const d of depths){
      const p=i*3,value=sample(pial[p]*(1-d)+white[p]*d,pial[p+1]*(1-d)+white[p+1]*d,pial[p+2]*(1-d)+white[p+2]*d);
      if(!Number.isInteger(value)||value<=0||value>65535||!allowedIds.has(value))continue;
      votes.set(value,(votes.get(value)||0)+1);
    }
    // Ignore background; ties go to the smallest source ID, deterministically.
    let winner=0,best=0,total=0;
    for(const [id,n] of votes){total+=n;if(n>best||(n===best&&id<winner)){winner=id;best=n;}}
    labels[i]=winner;support[i]=Math.round(255*total/depths.length);
  }
  return {labels,support};
}

// AAL cortical labels only; deep nuclei, hippocampus and cerebellum stay volumetric.
export const isAalCorticalLabel = label => /^(Precentral|Frontal|Rolandic|Supp_Motor|Olfactory|Rectus|OFC|Insula|Cingulum|Cingulate|ACC_|ParaHippocampal|Calcarine|Cuneus|Lingual|Occipital|Fusiform|Postcentral|Parietal|SupraMarginal|Angular|Precuneus|Paracentral|Heschl|Temporal)/.test(label.name);

export function surfaceLabelAt(volume, hemisphere, index) {
  const values=volume?.surfaceLabels?.[hemisphere];
  if(!values)return undefined;
  const value=values[index];
  if(!value)return null;
  const label=volume.labels?.find(l=>l.id===value);
  return label?{...label,value}:null;
}
