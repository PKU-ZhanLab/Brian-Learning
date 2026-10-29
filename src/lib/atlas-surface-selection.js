/** Resolve a surface click only from the categorical data used to colour its vertices.
 * On a mixed triangle the nearest displayed vertex wins; IDs are never interpolated.
 * Coordinate/volume queries for slices remain a separate operation.
 */
export function pickDisplayedSurfaceRegion({positions,face,point,labelIds,regionRefs}) {
  if (!face || face.length !== 3 || !point || point.length !== 3 || !labelIds || !regionRefs) return null;
  let vertex=null,best=Infinity;
  for (const index of face) {
    if (!Number.isSafeInteger(index) || index < 0 || index*3+2 >= positions.length) return null;
    const distance=(positions[index*3]-point[0])**2+(positions[index*3+1]-point[1])**2+(positions[index*3+2]-point[2])**2;
    if(distance < best){best=distance;vertex=index;}
  }
  if (vertex === null || !labelIds[vertex]) return null;
  const ref=regionRefs[vertex] ?? null,labelId=labelIds[vertex];
  if (ref && ref.labelId !== labelId) return null;
  return {vertex,labelId,ref};
}
