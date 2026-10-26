import {Matrix4} from 'three';

const DIRECTIONS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const CORNERS=[[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]];

export function nativeDisplayVolume(volume,{threshold=.5,tail='positive'}={}){
  if(!volume.kind||volume.kind==='label')return volume;
  if(!['mask','probability','statistic'].includes(volume.kind)||!Number.isFinite(threshold)||threshold<0)throw Error('Invalid map threshold');
  if(volume.kind==='probability'&&(threshold>1||volume.data.some(v=>v<0||v>1)))throw Error('Probability values and threshold must be within 0–1');
  const data=new Uint8Array(volume.data.length);
  for(let i=0;i<data.length;i++){const v=volume.data[i];data[i]=Number(volume.kind==='mask'?v!==0:tail==='negative'?v<0&&v<=-threshold:tail==='absolute'?v!==0&&Math.abs(v)>=threshold:v>0&&v>=threshold);}
  return {...volume,data,sourceKind:volume.kind,kind:'label',labels:[{id:1,name:volume.name||'Thresholded map'}],displayThreshold:threshold,displayTail:tail};
}

export function atlasLabelSummary(volume){
  const counts=new Map(),sums=new Map(),positions=new Map();
  const [nx,ny,nz]=volume.shape,a=volume.affine.flat(),xfast=volume.order!=='z-fastest';
  if(![nx,ny,nz].every(n=>Number.isInteger(n)&&n>0)||volume.data.length!==nx*ny*nz)throw Error('Invalid atlas dimensions');
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const id=volume.data[xfast?i+nx*(j+ny*k):(i*ny+j)*nz+k];
    if(!Number.isInteger(id)||id<=0)continue;
    counts.set(id,(counts.get(id)||0)+1);const sum=sums.get(id)||[0,0,0];sum[0]+=i;sum[1]+=j;sum[2]+=k;sums.set(id,sum);
    if(!positions.has(id))positions.set(id,[i,j,k]);
  }
  const labels=Array.isArray(volume.labels)?volume.labels:Object.entries(volume.labels||{}).map(([id,v])=>({id:+id,...(typeof v==='string'?{name:v}:v)}));
  const map=new Map(labels.map(v=>[Number(v.id??v.value??v.index),v]));
  const mm3=Math.abs(new Matrix4().set(...a).determinant());
  return [...counts].sort(([a],[b])=>a-b).map(([id,count])=>{const xyz=sums.get(id).map(v=>v/count);return {...map.get(id),id,name:map.get(id)?.name||map.get(id)?.label||`Label ${id}`,voxels:count,volumeMm3:count*mm3,centroid:[a[0]*xyz[0]+a[1]*xyz[1]+a[2]*xyz[2]+a[3],a[4]*xyz[0]+a[5]*xyz[1]+a[6]*xyz[2]+a[7],a[8]*xyz[0]+a[9]*xyz[1]+a[10]*xyz[2]+a[11]]};});
}

/** Independent atlas geometry: no target template, coordinate transform or registration is inferred. */
export function buildAtlasSurfaces(volume,selectedIds,{overview=false,maxFaces=1_200_000}={}){
  const [nx,ny,nz]=volume.shape,a=volume.affine.flat(),matrix=new Matrix4().set(...a);
  if(a.length!==16||!a.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-10)throw Error('Invalid atlas affine');
  const selected=new Set(selectedIds.map(Number)),stride=overview?Math.max(1,Math.ceil(Math.cbrt(nx*ny*nz/1_500_000))):1;
  const shape=[nx,ny,nz].map(n=>Math.ceil(n/stride)),[sx,sy,sz]=shape;
  const xfast=volume.order!=='z-fastest',at=(i,j,k)=>i<0||j<0||k<0||i>=sx||j>=sy||k>=sz?0:volume.data[xfast?(i*stride)+nx*((j*stride)+ny*(k*stride)):((i*stride)*ny+j*stride)*nz+k*stride];
  const inverseTranspose=matrix.clone().invert().transpose().elements;
  const triangles=matrix.determinant()<0?[0,2,1,0,3,2]:[0,1,2,0,2,3];
  const groups=new Map(),bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  let faces=0;
  for(let k=0;k<sz;k++)for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){
    const id=at(i,j,k);if(!selected.has(id))continue;
    let group=groups.get(id);if(!group){group={id,positions:[],normals:[]};groups.set(id,group);}
    for(let f=0;f<6;f++){
      const [dx,dy,dz]=DIRECTIONS[f];if(at(i+dx,j+dy,k+dz)===id)continue;
      if(++faces>maxFaces)throw Error('Surface is too large; display fewer labels.');
      const normal=[inverseTranspose[0]*dx+inverseTranspose[4]*dy+inverseTranspose[8]*dz,inverseTranspose[1]*dx+inverseTranspose[5]*dy+inverseTranspose[9]*dz,inverseTranspose[2]*dx+inverseTranspose[6]*dy+inverseTranspose[10]*dz],len=Math.hypot(...normal);
      for(const corner of triangles){const c=CORNERS[f][corner],x=(i+c[0]-.5)*stride,y=(j+c[1]-.5)*stride,z=(k+c[2]-.5)*stride;
        const p=[a[0]*x+a[1]*y+a[2]*z+a[3],a[4]*x+a[5]*y+a[6]*z+a[7],a[8]*x+a[9]*y+a[10]*z+a[11]];
        group.positions.push(...p);group.normals.push(...normal.map(v=>v/len));for(let q=0;q<3;q++){bounds[0][q]=Math.min(bounds[0][q],p[q]);bounds[1][q]=Math.max(bounds[1][q],p[q]);}
      }
    }
  }
  return {meshes:[...groups.values()].map(v=>({...v,positions:new Float32Array(v.positions),normals:new Float32Array(v.normals)})),bounds:faces?bounds:null,stride,faces,missingIds:[...selected].filter(id=>!groups.has(id)),space:volume.space};
}
