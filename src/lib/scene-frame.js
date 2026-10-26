import { Vector3 } from 'three';

export function overviewFrame(bounds, aspect = 1) {
  const target = bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
  const direction = new Vector3(-320, 400, 70).normalize();
  const right = new Vector3(0, 0, 1).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  let halfWidth = 0, halfHeight = 0;
  for (const x of [bounds[0][0], bounds[1][0]]) for (const y of [bounds[0][1], bounds[1][1]]) for (const z of [bounds[0][2], bounds[1][2]]) {
    const point = new Vector3(x-target[0], y-target[1], z-target[2]);
    halfWidth = Math.max(halfWidth, Math.abs(point.dot(right)));
    halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)));
  }
  return { target, extent: Math.max(halfHeight, halfWidth / Math.max(aspect,.1), 16) * 1.12, direction: direction.toArray() };
}
