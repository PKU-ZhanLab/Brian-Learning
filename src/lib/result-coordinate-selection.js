/** Resolve a transient selection against this exact E2 result, never against
 * the first frame or a previous result's point. This does not confer eligibility.
 */
export function selectResultCoordinate(result,coordinateId=null){
  const coordinates=result?.coordinates??[],point=coordinates.find(value=>value.id===coordinateId);
  return {resultId:result?.id??null,coordinateId:point?.id??null,space:point?point.space??null:coordinates[0]?.space??null};
}
