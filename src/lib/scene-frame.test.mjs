import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { overviewFrame } from './scene-frame.js';

function projected(bounds, aspect) {
  const frame = overviewFrame(bounds, aspect);
  const camera = new THREE.OrthographicCamera(-frame.extent * aspect, frame.extent * aspect, frame.extent, -frame.extent, .1, 3000);
  camera.up.set(0, 0, 1); camera.position.fromArray(frame.target).add(new THREE.Vector3(...frame.direction).normalize().multiplyScalar(1000));
  camera.lookAt(...frame.target); camera.updateMatrixWorld();
  const points = [];
  for (const x of [bounds[0][0], bounds[1][0]]) for (const y of [bounds[0][1], bounds[1][1]]) for (const z of [bounds[0][2], bounds[1][2]]) points.push(new THREE.Vector3(x,y,z).project(camera));
  return { frame, points };
}

test('overview frames the available brain centrally while the cord is absent', () => {
  const { frame, points } = projected([[-80,-112,-55],[80,82,85]], 2.7);
  assert.ok(frame.extent < 160, 'brain-only view must not reserve a 680 mm cord frame');
  const ys = points.map(p => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 1.3, 'available anatomy should fill the view');
  assert.ok(Math.abs(Math.max(...ys) + Math.min(...ys)) < .01, 'available anatomy should be centred');
});

test('loaded whole CNS and brainstem fit in both wide and narrow viewports', () => {
  for (const bounds of [[[-80,-112,-562],[80,82,85]],[[-32,-72,-65],[32,0,15]]]) {
    for (const aspect of [2.7,.45]) {
      const { points } = projected(bounds, aspect);
      assert.ok(points.every(p => Math.abs(p.x) < .94 && Math.abs(p.y) < .94), 'all anatomy corners must be inside the frame');
      const occupied = Math.max(...points.map(p => Math.max(Math.abs(p.x),Math.abs(p.y))));
      assert.ok(occupied > .75, 'available anatomy must not shrink into a tiny thumbnail');
    }
  }
});
