import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadAnatomyVolume, loadAtlas, loadManifest, atlasLabelAt, makeSliceCanvas, SLICE_BOUNDS } from '../lib/volume';
import { dataURL } from '../lib/assets.js';
import { ROI_COLORS, ROI_DEFAULT_DISPLAY, voxelMaskSurface } from '../lib/roi.js';
import { createPAM50Loader } from '../lib/pam50.js';
import { overviewFrame } from '../lib/scene-frame.js';

const PASTELS = ['#9ebdb2', '#e4bcaa', '#b6b7d3', '#b8cbb0', '#d9c797', '#a6becf', '#d5b0ba', '#b8c5d5', '#c9c1a7', '#98bfbf', '#d7c4b9', '#c2b5ca'];
const axisColors = { x: '#c999a0', y: '#a3b6cb', z: '#87afa0' };
const normalized = value => String(value || '').toLowerCase().replace(/ventrical/g, 'ventricle').replace(/brodmann\s*(?:area)?\s*/g, 'ba').replace(/left|right|hemisphere|ctx|cortex|cortical|\blh\b|\brh\b|_/g, '').replace(/[^a-z0-9]/g, '');
const isWhole = preset => ['whole', 'cns', 'full', 'whole-cns', 'all'].includes(preset);
const isCord = preset => ['brainstem', 'spine', 'brainstem-spinal', 'brainstem-spine'].includes(preset);
const sideOf = s => s.hemisphere === 'L' ? -1 : s.hemisphere === 'R' ? 1 : Math.sign(s.position?.[0] || 0);
const toPoint = point => new THREE.Vector3(...point);

function drawOrientation(context, camera, x, y, radius = 25, scale = 1) {
  const axes = [
    { vector: [1, 0, 0], plus: 'R', minus: 'L', color: '#b98283' },
    { vector: [0, 1, 0], plus: 'A', minus: 'P', color: '#7d9d88' },
    { vector: [0, 0, 1], plus: 'S', minus: 'I', color: '#819bb4' },
  ];
  context.save(); context.translate(x, y); context.lineWidth = scale;
  context.font = `${10 * scale}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
  const cameraInverse = camera.matrixWorld.clone().invert();
  for (const axis of axes) {
    const vector = new THREE.Vector3(...axis.vector).transformDirection(cameraInverse);
    for (const sign of [-1, 1]) {
      const px = vector.x * radius * sign, py = -vector.y * radius * sign;
      if (Math.hypot(px, py) < radius * 0.23) continue;
      context.globalAlpha = sign * vector.z > 0 ? 1 : 0.48;
      context.strokeStyle = axis.color; context.fillStyle = axis.color;
      context.beginPath(); context.moveTo(0, 0); context.lineTo(px * 0.76, py * 0.76); context.stroke();
      context.fillText(sign === 1 ? axis.plus : axis.minus, px, py);
    }
  }
  context.restore();
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach(material => { material.map?.dispose(); material.dispose(); });
  });
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.66, metalness: 0.02, ...options });
}

function tube(points, radius, mat, segments = 42, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(toPoint));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, false), mat);
}

function ellipsoid(position, size, mat, detailed = false) {
  const geometry = new THREE.SphereGeometry(1, detailed ? 72 : 32, detailed ? 48 : 24);
  if (detailed) {
    const points = geometry.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const z = points.getZ(i);
      const relief = 1 + 0.027 * Math.sin(z * 60) + 0.008 * Math.sin(points.getY(i) * 37);
      points.setXYZ(i, points.getX(i) * relief, points.getY(i) * relief, z);
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.scale.set(...size); mesh.position.set(...position);
  return mesh;
}

function grayMatter(position, mat, horn = '', size = [3.5, 3, 180]) {
  const group = new THREE.Group();
  if (horn.includes('horn')) {
    const y = -42 + 5 * Math.sin(position[2] / 140);
    const offset = horn.includes('posterior') ? -1.7 : horn.includes('anterior') ? 1.7 : 0;
    group.add(ellipsoid([position[0], y + offset, position[2]], size, mat));
    return group;
  }
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 0); shape.bezierCurveTo(-2, -0.8, -3.2, -3.2, -3.5, -3.3);
  shape.bezierCurveTo(-2.3, -0.8, -2.2, 0.1, -3.4, 2.2); shape.bezierCurveTo(-3.2, 3.5, -1.2, 3.5, -0.8, 1);
  shape.lineTo(0.8, 1); shape.bezierCurveTo(1.2, 3.5, 3.2, 3.5, 3.4, 2.2);
  shape.bezierCurveTo(2.2, 0.1, 2.3, -0.8, 3.5, -3.3); shape.bezierCurveTo(3.2, -3.2, 2, -0.8, 0.6, 0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 428, bevelEnabled: false, steps: 86 });
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const z = -509 + vertices.getZ(i);
    const taper = z < -467 ? THREE.MathUtils.clamp((z + 515) / 48, 0.2, 1) : 1;
    vertices.setXYZ(i, vertices.getX(i) * taper, vertices.getY(i) * taper - 42 + 5 * Math.sin(z / 140), z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat); group.add(mesh);
  return group;
}

function schematicObject(structure, spinalSegments = []) {
  const { id, category } = structure;
  const p = structure.position || [0, 0, 0];
  const side = sideOf(structure) || 1;
  const mat = material(structure.color || PASTELS[0]);
  const group = new THREE.Group();
  group.visible = false;
  group.userData = { id, category, structure, schematic: true };
  if (category === 'tract') {
    let points;
    if (/corpus|callosum/.test(id)) points = [[-48, 0, 16], [-30, 0, 30], [0, 0, 34], [30, 0, 30], [48, 0, 16]];
    else if (/corticospinal/.test(id)) points = [[side * 36, -16, 58], [side * 27, -14, 24], [side * 15, -21, -4], [side * 7, -28, -34], [side * 4, -30, -68], [-side * 3, -31, -110]];
    else if (/cingulum/.test(id)) points = [[side * 12, 32, -7], [side * 13, 30, 26], [side * 14, 0, 38], [side * 15, -36, 27], [side * 19, -43, -1], [side * 25, -20, -14]];
    else if (/uncinate/.test(id)) points = [[side * 35, 30, -12], [side * 29, 12, -15], [side * 27, -1, -22], [side * 32, 0, -35], [side * 43, 9, -29]];
    else if (/fornix/.test(id)) points = [[side * 22, -28, -10], [side * 12, -33, 8], [side * 6, -14, 16], [side * 5, 2, 10], [side * 4, 3, -8]];
    else if (/optic/.test(id)) points = [[side * 22, -25, -4], [side * 34, -35, 4], [side * 31, -60, 12], [side * 18, -84, 7]];
    else if (/arcuate|superior-longitudinal/.test(id)) points = [[side * 42, 27, 22], [side * 43, -10, 39], [side * 44, -40, 30], [side * 52, -43, 4], [side * 51, -21, -8]];
    else if (/inferior-longitudinal/.test(id)) points = [[side * 40, 6, -31], [side * 41, -25, -22], [side * 35, -55, -10], [side * 26, -88, 2]];
    else if (/spinothalamic/.test(id)) points = [[side * 4, -31, -420], [side * 5, -30, -230], [side * 4, -31, -80], [side * 9, -23, -35], [side * 16, -18, 7]];
    else if (/dorsal|lemnisc/.test(id)) points = [[side * 2, -34, -420], [side * 2, -34, -200], [side * 3, -34, -70], [-side * 7, -25, -40], [-side * 15, -19, 6]];
    else points = [[p[0] * 0.5, p[1] + 26, p[2] - 12], p, [p[0] * 0.8, p[1] - 30, p[2] + 12]];
    if (structure.path?.length > 2 && !/corticospinal/.test(id)) points = structure.path;
    const count = /spinothalamic|dorsal|lemnisc/.test(id) ? 3 : 7;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 0.9;
      const shifted = points.map((v, j) => [v[0] + offset, v[1] + Math.sin(j) * offset * 0.5, v[2] + offset * 0.5]);
      group.add(tube(shifted, 0.72, mat, points.length > 5 ? 72 : 50, 6));
    }
  } else if (category === 'ventricle') {
    if (/lateral/.test(id)) {
      group.add(tube([[side * 13, 25, 14], [side * 15, 8, 21], [side * 17, -16, 24], [side * 23, -37, 17], [side * 26, -47, 4]], 3.5, mat));
      group.add(tube([[side * 25, -42, 12], [side * 28, -35, 0], [side * 29, -17, -13], [side * 26, -3, -17]], 2.3, mat));
      group.add(tube([[side * 23, -37, 17], [side * 22, -53, 14], [side * 17, -63, 11]], 2.6, mat));
    } else if (/aqueduct/.test(id)) group.add(tube([[0, -20, 0], [0, -27, -12], [0, -33, -25]], 1.2, mat));
    else if (/fourth/.test(id)) group.add(ellipsoid(p, [5, 4, 10], mat));
    else group.add(ellipsoid(p, [1.8, 12, 8], mat));
  } else if (category === 'cranial') {
    const root = [side * 4, p[1] - 7, p[2] + 3];
    const end = [p[0] + side * 16, p[1] + 10, p[2] - 5];
    group.add(tube([root, [p[0] * 0.6, p[1], p[2]], p, end], /optic|trigeminal/.test(id) ? 1.7 : 0.95, mat, 32));
  } else if (category === 'spinal') {
    if (/gray|horn|grey/.test(id)) group.add(grayMatter(p, mat, id, structure.size));
    else {
      const cervical = /spinal-C\d/.test(id), lumbar = /spinal-L\d/.test(id), sacral = /spinal-S\d/.test(id), coccygeal = /Co1/.test(id);
      const radius = cervical ? 6 : lumbar ? 6.5 : sacral ? 4.5 : coccygeal ? 2.4 : 4.8;
      const length = structure.size?.[2] ? structure.size[2] * 2 : sacral ? 9 : coccygeal ? 7 : cervical ? 12 : lumbar ? 12 : 16;
      const index = spinalSegments.findIndex(s => s.id === id);
      const previous = index > 0 ? spinalSegments[index - 1] : null, next = index >= 0 ? spinalSegments[index + 1] : null;
      const upper = previous ? (previous.position[2] + p[2]) / 2 : p[2] + length / 2;
      const lower = next ? (next.position[2] + p[2]) / 2 : p[2] - length / 2;
      const upperPoint = new THREE.Vector3(p[0], -42 + 5 * Math.sin(upper / 140), upper);
      const lowerPoint = new THREE.Vector3(p[0], -42 + 5 * Math.sin(lower / 140), lower);
      const ownRadius = structure.size?.[0] || radius;
      const upperRadius = previous ? (ownRadius + (previous.size?.[0] || ownRadius)) / 2 : ownRadius;
      const lowerRadius = next ? (ownRadius + (next.size?.[0] || ownRadius)) / 2 : ownRadius * 0.4;
      const geometry = new THREE.CylinderGeometry(upperRadius, lowerRadius, upperPoint.distanceTo(lowerPoint) + 0.12, 24, 1);
      geometry.rotateX(Math.PI / 2); geometry.scale(1, 0.8, 1);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.copy(upperPoint).add(lowerPoint).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), upperPoint.clone().sub(lowerPoint).normalize()); group.add(mesh);
      if (!coccygeal) for (const s of [-1, 1]) group.add(tube([[p[0] + s * radius * 0.7, p[1], p[2]], [p[0] + s * 10, p[1] - 1, p[2] - 4], [p[0] + s * 14, p[1], p[2] - 8]], 0.65, mat, 15, 5));
    }
  } else if (category === 'brainstem') {
    const size = /midbrain/.test(id) ? [12, 12, 13] : /pons/.test(id) ? [17, 14, 13] : [9, 9, 20];
    group.add(ellipsoid(p, structure.size || size, mat));
  } else if (category === 'cerebellum') {
    group.add(ellipsoid(p, structure.size || (structure.hemisphere === 'M' ? [9, 22, 18] : [26, 27, 20]), mat, true));
  } else if (category === 'vessel') {
    if (/basilar/.test(id)) group.add(tube([[0, -12, -52], [0, -10, -33], [0, -13, -17]], 1.5, mat));
    else group.add(tube([[side * 4, 0, -12], [side * 18, 7, -12], [side * 31, 4, -8], [side * 45, -1, 3], [side * 50, -25, 22]], 1.25, mat));
  } else if (/hippocampus/.test(id)) {
    group.add(tube([[side * 21, -8, -17], [side * 27, -17, -16], [side * 30, -29, -10], [side * 24, -38, -1]], 4.2, mat, 40, 12));
  } else if (/caudate/.test(id)) {
    group.add(tube([[side * 12, 15, 7], [side * 14, 5, 18], [side * 18, -17, 22], [side * 25, -32, 11], [side * 28, -18, -9]], 3.6, mat, 44, 12));
    group.add(ellipsoid([side * 12, 12, 9], [5, 7, 6], mat));
  } else {
    const size = /thalamus/.test(id) ? [8, 12, 8] : /putamen/.test(id) ? [5, 13, 8] : /pallid/.test(id) ? [3.5, 8, 5] : /amygdala/.test(id) ? [5, 5, 5] : [5, 5, 6];
    group.add(ellipsoid(p, structure.size || size, mat));
  }
  group.traverse(child => { if (child.isMesh) child.userData = { id, category, structure, schematic: true }; });
  return group;
}

function findMatchingStructure(structures, label, hemisphere) {
  const token = normalized(label);
  if (!token) return null;
  const compatible = structures.filter(s => s.hemisphere === 'M' || s.hemisphere === hemisphere);
  let result = null, score = 0;
  for (const structure of compatible) {
    const terms = [structure.en, structure.id.replace(/-[lr]$/, ''), ...(structure.aliases || []), ...Object.values(structure.atlasLabels || {}).flat()].map(normalized);
    for (const term of terms) {
      const current = term === token ? 1000 + term.length : term.length > 5 && (token.includes(term) || term.includes(token)) ? Math.min(term.length, token.length) : 0;
      if (current > score) { score = current; result = structure; }
    }
  }
  return result;
}

function nearestStructure(structures, point, hemi, category = 'cortex') {
  let best, distance = Infinity;
  for (const structure of structures) {
    if (structure.category !== category || (hemi && structure.hemisphere !== hemi && structure.hemisphere !== 'M')) continue;
    const p = structure.position;
    const d = (p[0] - point.x) ** 2 + (p[1] - point.y) ** 2 + (p[2] - point.z) ** 2;
    if (d < distance) { distance = d; best = structure; }
  }
  return best;
}

const BrainScene = forwardRef(function BrainScene(props, ref) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const compassRef = useRef(null);
  const stateRef = useRef(null);
  const propsRef = useRef(props);
  const [error, setError] = useState('');
  const [selectionBox, setSelectionBox] = useState(null);
  const [loading, setLoading] = useState(true);
  propsRef.current = props;
  const sceneText = (zh, en) => propsRef.current.language === 'en' ? en : zh;

  useImperativeHandle(ref, () => ({
    reset: () => stateRef.current?.reset(),
    focus: id => stateRef.current?.focus(id),
    setView: view => { const state = stateRef.current; if (state) { state.autoOverview = false; state.setView(view); } },
    exportPNG: () => stateRef.current?.exportPNG(),
    focusROI: () => stateRef.current?.focusROI(),
    retryRemoteAnatomy: () => stateRef.current?.retryRemoteAnatomy(),
    zoom: delta => { const s = stateRef.current; if (s) { s.autoOverview = false; s.camera.zoom = THREE.MathUtils.clamp(s.camera.zoom * (delta > 0 ? 1.22 : 0.82), 0.12, 18); s.camera.updateProjectionMatrix(); s.invalidate(); } },
    getCameraState: () => { const s = stateRef.current; return s ? { position: s.camera.position.toArray(), target: s.controls.target.toArray(), zoom: s.camera.zoom } : null; },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setError(sceneText('当前浏览器未能开启 WebGL。请启用硬件加速后重新打开。', 'WebGL is unavailable. Enable hardware acceleration and reopen the viewer.')); setLoading(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#f3f5f2', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none;';
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D central nervous system: drag to rotate, right-drag to pan, scroll to zoom, click a structure for details');
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-160, 160, 145, -145, 0.1, 3000);
    camera.up.set(0, 0, 1);
    camera.position.set(-270, 310, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -15, 15); controls.enableDamping = false; controls.minZoom = 0.12; controls.maxZoom = 18;
    controls.panSpeed = 0.8; controls.rotateSpeed = 0.65; controls.zoomSpeed = 0.8;
    scene.add(new THREE.AmbientLight('#ffffff', 0.28));
    const hemiLight = new THREE.HemisphereLight('#fffdf8', '#a4b4b0', 0.9); hemiLight.position.set(0, 0, 300); scene.add(hemiLight);
    const key = new THREE.DirectionalLight('#fffaf0', 2.1); key.position.set(-160, 200, 280); scene.add(key);
    const fill = new THREE.DirectionalLight('#e6efff', 0.35); fill.position.set(200, -90, 70); scene.add(fill);
    const root = new THREE.Group(); scene.add(root);
    const cortexGroup = new THREE.Group(), anatomyGroup = new THREE.Group(), sliceGroup = new THREE.Group(), selectionGroup = new THREE.Group(), roiGroup = new THREE.Group(), markerGroup = new THREE.Group();
    root.add(cortexGroup, anatomyGroup, sliceGroup, selectionGroup, roiGroup, markerGroup);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 1.2;
    const pointer = new THREE.Vector2();
    let animation = 0, destroyed = false;
    const status = {
      scene, camera, controls, renderer, cortexGroup, anatomyGroup, sliceGroup, selectionGroup, roiGroup, markerGroup,
      width: 1, height: 1, cortexMeshes: [], objects: new Map(), labelNodes: [], atlasVolume: null, anatomyVolume: null,
      loaded: false, atlasGeneration: 0, labelsGeneration: 0, frameExtent: 145, structures: [],
      assetDefinitions: new Map(), anatomyEntries: {}, anatomyFailures: new Set(), atlasOverlayBlocked: false,
      roiComparisonId: null, roiObjects: new Map(),
      remotePAMLoader: null, remotePAMPending: new Set(), remotePAMFailures: new Map(), remotePAMEnabledSeen: false, remotePAMRequest: null,
      autoOverview: false, overviewBounds: null, pendingFocusId: null,
    };

    function projectLabels() {
      const visible = propsRef.current.labels;
      status.labelNodes.forEach(({ node, structure }) => {
        const object = status.objects.get(structure.id);
        const isVisible = visible && (object ? object.visible : isStructureVisible(structure)) && structure.category !== 'vessel';
        if (!isVisible) { node.style.display = 'none'; return; }
        const position = labelPosition(structure).project(camera);
        node.style.display = Math.abs(position.x) > 0.95 || Math.abs(position.y) > 0.95 ? 'none' : 'block';
        node.style.transform = `translate(${(position.x * 0.5 + 0.5) * status.width}px,${(-position.y * 0.5 + 0.5) * status.height}px) translate(-50%,-50%)`;
      });
      const ruler = overlayRef.current?.querySelector('[data-ruler]');
      if (ruler) {
        const worldWidth = (camera.right - camera.left) / camera.zoom;
        const ideal = worldWidth * 0.14;
        const length = [1, 2, 5, 10, 20, 50, 100, 200].reduce((best, value) => Math.abs(value - ideal) < Math.abs(best - ideal) ? value : best, 20);
        ruler.style.width = `${length / worldWidth * status.width}px`;
        ruler.querySelector('span').textContent = `${length} mm`;
      }
      const compass = compassRef.current;
      if (compass) { const context = compass.getContext('2d'); context.clearRect(0, 0, 160, 160); drawOrientation(context, camera, 80, 80, 53, 2); }
    }
    function render() {
      animation = 0; if (destroyed) return;
      renderer.render(scene, camera); projectLabels();
      if (new URLSearchParams(window.location.search).has('sceneDebug')) {
        const visible = [];
        scene.traverseVisible(object => {
          if (!object.geometry) return;
          object.geometry.computeBoundingBox();
          const bounds = object.geometry.boundingBox?.clone().applyMatrix4(object.matrixWorld);
          visible.push({ id: object.userData.id || object.userData.hemisphere || object.userData.sliceAxis || 'unlabelled', category: object.userData.category || 'overlay', type: object.geometry.type, source: object.userData.sourceMetadata?.file || object.userData.sourceMetadata?.geometry || null, parentManaged: object.userData.id ? status.objects.get(object.userData.id) === object.parent : null, bounds: bounds ? [bounds.min.toArray(), bounds.max.toArray()] : null });
        });
        const summary = { preset: propsRef.current.preset, atlas: propsRef.current.atlas, categories: propsRef.current.visibleCategories, showSchematic: propsRef.current.showSchematic, sceneCanvases: container.querySelectorAll('canvas').length, anatomyChildren: anatomyGroup.children.length, managedObjects: status.objects.size, orphans: anatomyGroup.children.filter(object => status.objects.get(object.userData.id) !== object).map(object => ({ id: object.userData.id, category: object.userData.category, visible: object.visible })), visible };
        const key = JSON.stringify(summary);
        if (key !== status.debugSummary) { status.debugSummary = key; console.info('[NeuroAtlas scene]', key); }
      }
    }
    status.invalidate = () => { if (!animation && !destroyed) animation = requestAnimationFrame(render); };
    controls.addEventListener('change', status.invalidate);
    controls.addEventListener('start', () => { status.autoOverview = false; status.pendingFocusId = null; });

    function resize() {
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      status.width = bounds.width; status.height = bounds.height;
      renderer.setSize(bounds.width, bounds.height, false);
      const aspect = bounds.width / bounds.height;
      if (status.autoOverview && status.overviewBounds) status.frameExtent = overviewFrame(status.overviewBounds, aspect).extent;
      camera.left = -status.frameExtent * aspect; camera.right = status.frameExtent * aspect;
      camera.top = status.frameExtent; camera.bottom = -status.frameExtent;
      camera.updateProjectionMatrix(); status.invalidate();
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();

    function reset() {
      const preset = propsRef.current.preset;
      const whole = isWhole(preset) || isCord(preset);
      status.autoOverview = whole; status.pendingFocusId = null;
      const bounds = new THREE.Box3();
      if (whole) {
        scene.updateMatrixWorld(true);
        for (const object of [...status.cortexMeshes, ...status.objects.values()]) {
          if (object.visible) bounds.union(new THREE.Box3().setFromObject(object));
        }
      }
      const frame = !bounds.isEmpty() ? overviewFrame([bounds.min.toArray(), bounds.max.toArray()], status.width / status.height) : null;
      status.overviewBounds = frame ? [bounds.min.toArray(), bounds.max.toArray()] : null;
      status.frameExtent = frame?.extent || 108;
      controls.target.fromArray(frame?.target || [0,-16,12]);
      camera.zoom = 1;
      camera.position.copy(controls.target).add(new THREE.Vector3(...(frame?.direction || [-320,400,180])).normalize().multiplyScalar(1000));
      camera.up.set(0, 0, 1); controls.update(); resize();
    }
    function setView(view) {
      const directions = { lateral: [-1, 0, 0], sagittal: [-1, 0, 0], left: [-1, 0, 0], right: [1, 0, 0], anterior: [0, 1, 0], coronal: [0, 1, 0], posterior: [0, -1, 0], superior: [0, 0, 1], axial: [0, 0, 1], inferior: [0, 0, -1], oblique: [-0.62, 0.75, 0.38], '3d': [-0.62, 0.75, 0.38] };
      const direction = new THREE.Vector3(...(directions[view] || directions.oblique)).normalize();
      camera.up.set(0, direction.z > 0.95 ? 1 : 0, direction.z > 0.95 ? 0 : 1);
      camera.position.copy(controls.target).addScaledVector(direction, 600); controls.update(); status.invalidate();
    }
    function focus(id) {
      const structure = propsRef.current.structures.find(s => s.id === id); if (!structure) return;
      status.autoOverview = false;
      status.pendingFocusId = status.anatomyEntries[id]?.remoteGeometry && !status.assetDefinitions.has(id) ? id : null;
      const target = labelPosition(structure);
      const direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(target); camera.position.copy(target).addScaledVector(direction, 600);
      camera.zoom = structure.category === 'cortex' ? 1.35 : structure.category === 'spinal' ? 3 : 1.9;
      if (status.frameExtent > 200) { status.frameExtent = 108; resize(); }
      const actualObject = status.objects.get(id);
      if (actualObject && !actualObject.userData.schematic) {
        const bounds = new THREE.Box3().setFromObject(actualObject);
        const size = bounds.getSize(new THREE.Vector3());
        const span = Math.max(size.z, size.y, size.x, 20);
        camera.zoom = THREE.MathUtils.clamp((status.frameExtent * 2) / (span * 1.5), 0.22, 6);
      }
      camera.updateProjectionMatrix(); controls.update(); status.invalidate();
    }
    function focusROI() {
      status.autoOverview = false; status.pendingFocusId = null;
      const comparison = propsRef.current.roiComparison;
      if (!comparison?.center || !comparison.bounds) return;
      const target = toPoint(comparison.center), direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(target); camera.position.copy(target).addScaledVector(direction, 600);
      status.frameExtent = 108;
      const extent = Math.max(...comparison.bounds[1].map((value, axis) => value - comparison.bounds[0][axis]), 20);
      camera.zoom = THREE.MathUtils.clamp(status.frameExtent * 2 / (extent * 1.7), 0.3, 5);
      resize(); controls.update(); status.invalidate();
    }
    function exportPNG() {
      const originalRatio = renderer.getPixelRatio();
      const exportScale = Math.min(3, Math.max(2, 2400 / status.width));
      renderer.setPixelRatio(exportScale); renderer.setSize(status.width, status.height, false); renderer.render(scene, camera);
      const output = document.createElement('canvas'); output.width = Math.round(status.width * exportScale); output.height = Math.round(status.height * exportScale);
      const context = output.getContext('2d');
      context.fillStyle = '#f4f6f3'; context.fillRect(0, 0, output.width, output.height); context.drawImage(renderer.domElement, 0, 0);
      const scale = exportScale;
      context.fillStyle = '#283f37'; context.font = `${17 * scale}px "Microsoft YaHei", sans-serif`;
      context.fillText(sceneText('NEUROATLAS · 中枢神经系统教学模型', 'NEUROATLAS · Central nervous system'), 28 * scale, 35 * scale);
      context.font = `${11 * scale}px "Microsoft YaHei", sans-serif`;
      context.fillStyle = '#61756d';
      context.fillText(sceneText(`RAS · 单位 mm · ${propsRef.current.atlas?.toUpperCase() || 'ATLAS'} · 模板/群体图谱教学显示；空间关系与覆盖见来源`, `RAS · mm · ${propsRef.current.atlas?.toUpperCase() || 'ATLAS'} · Template/population atlas; see source alignment and coverage`), 28 * scale, 57 * scale);
      const comparison = propsRef.current.roiComparison;
      if (comparison) {
        context.fillText(`ROI A: ${comparison.A.atlasId} #${comparison.A.labelId} · ROI B: ${comparison.B.atlasId} #${comparison.B.labelId} · Dice ${comparison.metrics.dice?.toFixed(4) ?? '—'} · Jaccard ${comparison.metrics.jaccard?.toFixed(4) ?? '—'}`, 28 * scale, 75 * scale);
        [['aOnly', sceneText('仅 A', 'A only')], ['bOnly', sceneText('仅 B', 'B only')], ['intersection', sceneText('交集', 'Intersection')]].forEach(([key, label], index) => { context.fillStyle = ROI_COLORS[key]; context.fillRect((28 + index * 120) * scale, 88 * scale, 8 * scale, 8 * scale); context.fillStyle = '#61756d'; context.fillText(label, (42 + index * 120) * scale, 96 * scale); });
      }
      const worldWidth = (camera.right - camera.left) / camera.zoom;
      const ideal = worldWidth * 0.15;
      const mm = [1, 2, 5, 10, 20, 50, 100, 200].reduce((a, b) => Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a, 20);
      const width = mm / worldWidth * output.width;
      const y = output.height - 35 * scale, x = 28 * scale;
      context.strokeStyle = '#283f37'; context.lineWidth = 1.5 * scale;
      context.beginPath(); context.moveTo(x, y - 4 * scale); context.lineTo(x, y + 4 * scale); context.moveTo(x, y); context.lineTo(x + width, y); context.moveTo(x + width, y - 4 * scale); context.lineTo(x + width, y + 4 * scale); context.stroke();
      context.fillText(`${mm} mm`, x, y - 10 * scale);
      drawOrientation(context, camera, output.width - 58 * scale, output.height - 56 * scale, 28 * scale, scale);
      if (propsRef.current.labels) status.labelNodes.forEach(({ structure, node }) => {
        if (node.style.display === 'none') return;
        const point = labelPosition(structure).project(camera);
        context.fillStyle = '#294d3d'; context.fillText(structure.name, (point.x * 0.5 + 0.5) * output.width, (-point.y * 0.5 + 0.5) * output.height);
      });
      renderer.setPixelRatio(originalRatio); renderer.setSize(status.width, status.height, false); status.invalidate();
      const exportDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
      const link = document.createElement('a'); link.download = `NeuroAtlas-${exportDate}.png`; link.href = output.toDataURL('image/png'); link.click();
      return { width: output.width, height: output.height };
    }
    Object.assign(status, { reset, setView, focus, focusROI, exportPNG });

    function isStructureVisible(structure) {
      const p = propsRef.current;
      const categories = p.visibleCategories || [];
      const hemisphereVisible = !p.hemisphere || p.hemisphere === 'both' || structure.hemisphere === p.hemisphere || structure.hemisphere === 'M';
      const source = status.objects.get(structure.id)?.userData;
      const sourceVisible = p.showSchematic !== false || structure.category === 'cortex' || Boolean(source && (!source.schematic || source.actualEnvelope));
      const opacity = p.categoryOpacity?.[structure.category] ?? (structure.category === 'cortex' ? p.opacity ?? 1 : 1);
      // THREE treats only the literal false as hidden; undefined would still draw.
      return Boolean(sourceVisible && opacity > 0 && !status.anatomyFailures.has(structure.id) && categories.includes(structure.category) && hemisphereVisible && !(p.hiddenIds || []).includes(structure.id) && (!p.network || (structure.networks || []).includes(p.network)));
    }
    function labelPosition(structure) {
      const asset = status.assetDefinitions.get(structure.id)?.entry;
      const position = toPoint(asset?.displayCenter || asset?.center || structure.position);
      if (propsRef.current.exploded && structure.hemisphere !== 'M') position.x += sideOf(structure) * (structure.category === 'cortex' ? 26 : 12);
      return position;
    }
    function coordinateMetadata(structure) {
      const source = structure && status.assetDefinitions.get(structure.id)?.entry;
      return { sourceStructureId: structure?.id, coordinateSpace: structure?.category === 'spinal' ? source?.dataset === 'PAM50' ? 'pam50' : 'schematic' : 'brain' };
    }
    function updateLabels() {
      status.labelNodes.forEach(({ node }) => node.remove()); status.labelNodes = [];
      const p = propsRef.current;
      const selected = (p.selectedIds || []).map(id => p.structures.find(s => s.id === id)).filter(Boolean);
      const others = p.structures.filter(s => isStructureVisible(s) && !selected.includes(s));
      const items = [...selected, ...others.filter((_, index) => index % Math.max(1, Math.ceil(others.length / 8)) === 0)].slice(0, 11);
      items.forEach(structure => {
        const node = document.createElement('button'); node.type = 'button'; node.textContent = structure.name;
        node.style.cssText = 'position:absolute;left:0;top:0;background:rgba(255,255,252,.91);border:1px solid #d6dfd7;border-radius:5px;padding:4px 8px;color:#315447;font:11px "Microsoft YaHei",sans-serif;white-space:nowrap;pointer-events:auto;box-shadow:0 2px 8px #27443509;cursor:pointer;';
        node.addEventListener('click', event => { event.stopPropagation(); const source = status.assetDefinitions.get(structure.id)?.entry; propsRef.current.onSelect?.([structure.id], source?.displayCenter || source?.center || structure.position, coordinateMetadata(structure)); });
        overlayRef.current?.appendChild(node); status.labelNodes.push({ node, structure });
      });
    }
    function updateMaterials() {
      const p = propsRef.current;
      const selected = new Set(p.selectedIds || []);
      const graySelected = [...selected].some(id => /spinal-(gray|.*horn)/.test(id));
      const whiteSelected = selected.has('spinal-white');
      const hornSelected = [...selected].some(id => id.includes('spinal-') && id.includes('horn'));
      status.objects.forEach((object, id) => {
        const structure = object.userData.structure; object.visible = isStructureVisible(structure);
        object.position.x = p.exploded && structure.hemisphere !== 'M' ? sideOf(structure) * 12 : 0;
        object.traverse(child => { if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            mat.emissive?.set(selected.has(id) ? '#286b4e' : '#000000'); mat.emissiveIntensity = selected.has(id) ? 0.28 : 0;
            if (mat.isLineBasicMaterial) mat.color.set(selected.has(id) ? '#c28850' : structure.color || '#8fae9c');
            const selectionOpacity = (graySelected || whiteSelected) && /spinal-(C\d|T\d|L\d|S\d|Co\d)/.test(id) ? 0.10 : graySelected && id === 'spinal-white' ? 0.12 : hornSelected && id === 'spinal-gray' ? 0.22 : selected.size > 0 && !selected.has(id) ? 0.82 : 1;
            mat.opacity = selectionOpacity * THREE.MathUtils.clamp(p.categoryOpacity?.[structure.category] ?? 1, 0, 1); mat.transparent = mat.opacity < 0.999;
            mat.depthWrite = !mat.transparent;
            child.renderOrder = mat.transparent ? ({ cerebellum: 12, brainstem: 14, subcortical: 16, ventricle: 17, tract: 18, cranial: 19, spinal: 20 }[structure.category] || 15) : 0;
          });
        } });
      });
      status.cortexMeshes.forEach(mesh => {
        const hemi = mesh.userData.hemisphere;
        const cortexOpacity = THREE.MathUtils.clamp(p.categoryOpacity?.cortex ?? p.opacity ?? 1, 0, 1);
        mesh.visible = cortexOpacity > 0 && (p.visibleCategories || []).includes('cortex') && (p.hemisphere === 'both' || !p.hemisphere || p.hemisphere === hemi);
        mesh.position.x = p.exploded ? (hemi === 'L' ? -26 : 26) : 0;
        mesh.material.opacity = cortexOpacity; mesh.material.transparent = mesh.material.opacity < 0.999; mesh.material.depthWrite = !mesh.material.transparent; mesh.renderOrder = mesh.material.transparent ? 10 : 0;
        const colorAttribute = mesh.geometry.attributes.color, base = mesh.userData.baseColors, ids = mesh.userData.regionIds;
        if (!base || !colorAttribute) return;
        const c = new THREE.Color(), hiddenColor = new THREE.Color('#dce3de'), highlight = new THREE.Color('#c08753'), muted = new THREE.Color('#dce2dc');
        for (let i = 0; i < colorAttribute.count; i++) {
          c.setRGB(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
          const structure = ids[i];
          if (structure && (!isStructureVisible(structure) || (p.hiddenIds || []).includes(structure.id))) c.copy(hiddenColor);
          else if (structure && selected.has(structure.id)) c.lerp(highlight, 0.46);
          else if (selected.size > 0) c.lerp(muted, 0.13);
          colorAttribute.setXYZ(i, c.r, c.g, c.b);
        }
        colorAttribute.needsUpdate = true;
        const visibilityKey = `${p.network || ''}|${(p.hiddenIds || []).join(',')}`;
        if (mesh.userData.visibilityKey !== visibilityKey && mesh.userData.sourceIndices) {
          const original = mesh.userData.sourceIndices;
          const filtered = [];
          for (let i = 0; i < original.length; i += 3) {
            const region = ids[original[i]];
          if (!region || (!(p.hiddenIds || []).includes(region.id) && (!p.network || (region.networks || []).includes(p.network)))) filtered.push(original[i], original[i + 1], original[i + 2]);
          }
          mesh.geometry.setIndex(filtered);
          mesh.userData.visibilityKey = visibilityKey;
        }
      });
      selectionGroup.children.forEach(disposeObject); selectionGroup.clear();
      for (const id of selected) {
        const structure = p.structures.find(s => s.id === id);
        if (!structure || !isStructureVisible(structure)) continue;
        const pin = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 12), new THREE.MeshBasicMaterial({ color: '#f5d09a', depthTest: false }));
        pin.position.copy(labelPosition(structure)); pin.renderOrder = 10; selectionGroup.add(pin);
      }
      updateLabels(); roiGroup.visible = Boolean(p.roiComparison && !p.exploded); markerGroup.visible = !p.exploded; status.invalidate();
    }
    function colorCortex() {
      const p = propsRef.current;
      status.cortexMeshes.forEach(mesh => {
        const position = mesh.geometry.attributes.position;
        const colors = new Float32Array(position.count * 3), regions = new Array(position.count), palette = PASTELS.map(c => new THREE.Color(c));
        const world = new THREE.Vector3();
        const atlasCache = new Map();
        const compatible = p.structures.filter(s => s.category === 'cortex' && s.hemisphere === mesh.userData.hemisphere);
        const directDK = p.atlas === 'dk' && mesh.userData.vertexLabels;
        const dkLabels = new Map((mesh.userData.dkLabels || []).map(label => [label.id, label]));
        for (let i = 0; i < position.count; i++) {
          world.fromBufferAttribute(position, i);
          const directLabel = directDK ? dkLabels.get(mesh.userData.vertexLabels[i]) : null;
          const atlasLabel = directDK ? directLabel && { ...directLabel, value: directLabel.id } : atlasLabelAt(status.atlasVolume, world.toArray());
          let structure;
          if (atlasLabel) {
            if (!atlasCache.has(atlasLabel.value)) atlasCache.set(atlasLabel.value, atlasLabel.structureId ? compatible.find(s => s.id === atlasLabel.structureId) : findMatchingStructure(compatible, atlasLabel.name, mesh.userData.hemisphere));
            structure = atlasCache.get(atlasLabel.value);
          }
          regions[i] = structure;
          const c = atlasLabel ? palette[(atlasLabel.value * 7) % palette.length] : new THREE.Color('#cbd1c8');
          colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        }
        mesh.userData.baseColors = colors.slice(); mesh.userData.regionIds = regions;
        mesh.userData.visibilityKey = null;
        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      });
      updateMaterials();
    }
    function rebuildStructures() {
      anatomyGroup.children.forEach(disposeObject); anatomyGroup.clear(); status.objects.clear();
      const segments = (propsRef.current.structures || []).filter(s => s.spinalSegment).sort((a, b) => b.position[2] - a.position[2]);
      for (const structure of propsRef.current.structures || []) {
        if (structure.category === 'cortex') continue;
        const object = schematicObject(structure, segments); anatomyGroup.add(object); status.objects.set(structure.id, object);
      }
      for (const [id, asset] of status.assetDefinitions) applyActualAsset(id, asset.data, asset.entry, false);
      status.structures = propsRef.current.structures; colorCortex();
    }
    function applyActualAsset(id, data, entry, refresh = true) {
      status.assetDefinitions.set(id, { data, entry });
      const structure = propsRef.current.structures.find(s => s.id === id);
      if (!structure) return;
      const previous = status.objects.get(id), group = new THREE.Group();
      group.visible = false;
      const metadata = { id, category: structure.category, structure, schematic: entry.schematic === true, actualEnvelope: entry.actualEnvelope, sourceMetadata: entry, representation: entry.representation || 'atlas-segmentation' };
      group.userData = metadata;
      let object;
      if (data.kind === 'streamlines') {
        const vertices = [];
        for (const line of data.streamlines) for (let i = 0; i < line.length - 3; i += 3) vertices.push(line[i],line[i+1],line[i+2],line[i+3],line[i+4],line[i+5]);
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: structure.color || '#91ac97', transparent: true, opacity: 0.94, depthWrite: false }));
      } else {
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geometry.setIndex(data.indices);
        if (data.normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3)); else geometry.computeVertexNormals();
        object = new THREE.Mesh(geometry, material(structure.color || '#acbda9', { side: THREE.DoubleSide }));
      }
      if (entry.displayTransform?.length === 16) object.geometry.applyMatrix4(new THREE.Matrix4().set(...entry.displayTransform));
      object.geometry.computeBoundingSphere(); object.userData = metadata; group.add(object);
      if (previous) { anatomyGroup.remove(previous); disposeObject(previous); }
      anatomyGroup.add(group); status.objects.set(id, group); status.anatomyFailures.delete(id);
      group.visible = isStructureVisible(structure);
      if (refresh) updateMaterials();
    }
    function updateSlices() {
      sliceGroup.children.forEach(disposeObject); sliceGroup.clear();
      const slices = propsRef.current.slices;
      if (!slices?.enabled) { status.invalidate(); return; }
      for (const axis of ['x', 'y', 'z']) {
        const horizontal = axis === 'x' ? 'y' : 'x', vertical = axis === 'z' ? 'y' : 'z';
        const h = SLICE_BOUNDS[horizontal], v = SLICE_BOUNDS[vertical];
        const geometry = new THREE.PlaneGeometry(h[1] - h[0], v[1] - v[0]);
        let map;
        if (status.anatomyVolume) {
          const canvas = makeSliceCanvas(status.anatomyVolume, axis, slices[axis], { size: 192, radiological: false, transparent: true, roiComparison: propsRef.current.exploded ? null : propsRef.current.roiComparison, roiDisplay: propsRef.current.roiDisplay });
          map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
        }
        const mat = new THREE.MeshBasicMaterial({ map, color: map ? '#ffffff' : axisColors[axis], side: THREE.DoubleSide, transparent: true, opacity: map ? 0.82 : 0.12, depthWrite: false });
        const plane = new THREE.Mesh(geometry, mat);
        const center = { x: 0, y: 0, z: 0 }; center[axis] = slices[axis]; center[horizontal] = (h[0] + h[1]) / 2; center[vertical] = (v[0] + v[1]) / 2;
        plane.position.set(center.x, center.y, center.z);
        if (axis === 'x') plane.rotation.set(Math.PI / 2, Math.PI / 2, 0);
        if (axis === 'y') plane.rotation.set(Math.PI / 2, 0, 0);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: axisColors[axis], transparent: true, opacity: 0.85 }));
        plane.add(edges); plane.userData = { sliceAxis: axis }; plane.renderOrder = 2; sliceGroup.add(plane);
      }
      status.invalidate();
    }
    function updateROI() {
      const p = propsRef.current, comparison = p.roiComparison;
      if (status.roiComparisonId !== (comparison?.id || null)) {
        roiGroup.children.forEach(disposeObject); roiGroup.clear(); status.roiObjects.clear();
        status.roiComparisonId = comparison?.id || null;
        if (comparison) for (const key of ['aOnly', 'bOnly', 'intersection', 'A', 'B']) {
          const surface = comparison.surfaces?.[key] || voxelMaskSurface(comparison, key);
          if (!surface.positions.length) continue;
          const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(surface.normals, 3)); geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, material(ROI_COLORS[key], { side: THREE.DoubleSide, roughness: 0.92 }));
          mesh.visible = false; mesh.userData = { category: 'roi', roiPart: key, comparisonId: comparison.id }; roiGroup.add(mesh); status.roiObjects.set(key, mesh);
        }
      }
      const display = { ...ROI_DEFAULT_DISPLAY, ...comparison?.display, ...p.roiDisplay };
      status.roiObjects.forEach((mesh, key) => {
        mesh.material.opacity = THREE.MathUtils.clamp(key === 'intersection' ? display.opacityOverlap : ['A', 'aOnly'].includes(key) ? display.opacityA : display.opacityB, 0, 1);
        mesh.material.transparent = mesh.material.opacity < 0.999; mesh.material.depthWrite = !display.xray && !mesh.material.transparent; mesh.material.depthTest = !display.xray;
        mesh.renderOrder = (display.xray ? 500 : 40) + ({ aOnly: 0, bOnly: 1, intersection: 2, A: 0, B: 1 }[key]);
        mesh.visible = Boolean(mesh.material.opacity > 0 && (display.mode === 'parts' ? ['aOnly','bOnly','intersection'].includes(key) : display.mode === 'overlap' ? key === 'intersection' : key === display.mode));
      });
      roiGroup.visible = Boolean(comparison && !p.exploded); updateSlices(); status.invalidate();
    }
    function updateStudyMarkers() {
      markerGroup.children.forEach(disposeObject); markerGroup.clear();
      for (const marker of propsRef.current.studyMarkers || []) {
        if (marker.verified !== true || marker.coordinateSpace !== 'MNI152NLin6Asym' || marker.position?.length !== 3 || !marker.position.every(Number.isFinite)) continue;
        const radius = THREE.MathUtils.clamp(marker.radiusMm || 2, 0.5, 8);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color: marker.color || '#b85163' }));
        mesh.position.set(...marker.position); mesh.userData = { category: 'study-marker', marker }; markerGroup.add(mesh);
      }
      markerGroup.visible = !propsRef.current.exploded; status.invalidate();
    }
    function remotePAMStatus(stage) {
      const entries = Object.entries(status.anatomyEntries).filter(([, entry]) => entry.remoteGeometry);
      const failed = [...status.remotePAMFailures];
      propsRef.current.onReady?.({
        loaded: status.loaded,
        remoteAnatomyAvailableIds: entries.map(([id]) => id),
        remoteAnatomyLoadedIds: entries.filter(([id]) => status.assetDefinitions.has(id)).map(([id]) => id),
        remoteAnatomyPendingIds: [...status.remotePAMPending],
        remoteAnatomyLoading: status.remotePAMPending.size > 0,
        remoteAnatomyError: failed.length ? sceneText(`PAM50 官方源暂不可用（${failed.length} 个结构），请检查网络后重试。`, `The official PAM50 source is unavailable for ${failed.length} structures. Check the connection and retry.`) : null,
        remoteAnatomyStage: stage || (status.remotePAMPending.size ? 'loading' : 'idle'),
      });
    }
    function receiveRemotePAM(message) {
      if (destroyed) return;
      if (message.type === 'result') {
        status.remotePAMPending.delete(message.id); status.remotePAMFailures.delete(message.id);
        const entry = status.anatomyEntries[message.id];
        if (entry) applyActualAsset(message.id, message.data, { ...entry, ...message.metadata, representation: 'atlas-segmentation' });
        if (status.pendingFocusId === message.id && propsRef.current.selectedIds?.includes(message.id)) focus(message.id);
        if (!status.remotePAMFailures.size) setError(current => current.startsWith('PAM50') ? '' : current);
        propsRef.current.onReady?.({ remoteAnatomyGenerated: { id: message.id, ...message.metadata } });
      } else if (message.type === 'error' || message.type === 'worker-error') {
        const ids = message.ids || [...status.remotePAMPending];
        ids.forEach(id => { status.remotePAMPending.delete(id); status.remotePAMFailures.set(id, message.message); status.anatomyFailures.add(id); });
        setError(sceneText('PAM50 官方源数据暂不可用，相关曲面未显示；请检查网络后重试。', 'PAM50 source data are unavailable; the affected surfaces are not displayed. Check the connection and retry.'));
        console.warn('[NeuroAtlas remote PAM50]', ids, message.message);
        if (message.type === 'worker-error') { status.remotePAMLoader?.terminate(); status.remotePAMLoader = null; }
        updateMaterials();
      }
      remotePAMStatus(message.stage);
      if (!status.remotePAMPending.size && status.autoOverview) reset();
    }
    function updateRemoteAnatomy() {
      const p = propsRef.current;
      const entries = Object.entries(status.anatomyEntries).filter(([, entry]) => entry.remoteGeometry);
      if (!entries.length) return;
      if (p.remoteAnatomyEnabled !== true) { status.remotePAMEnabledSeen = false; remotePAMStatus('awaiting-request'); return; }
      if (!status.remotePAMEnabledSeen || status.remotePAMRequest !== p.remoteAnatomyRequest) {
        for (const id of status.remotePAMFailures.keys()) status.anatomyFailures.delete(id);
        status.remotePAMFailures.clear(); status.remotePAMEnabledSeen = true; status.remotePAMRequest = p.remoteAnatomyRequest;
      }
      const spinalVisible = (p.visibleCategories || []).includes('spinal');
      const selected = new Set(p.selectedIds || []);
      const requested = entries.filter(([id]) => (selected.has(id) || spinalVisible && (/^spinal-[CTLS]\d+$/.test(id) || p.remoteAnatomyTissues === true)) && !status.assetDefinitions.has(id) && !status.remotePAMPending.has(id) && !status.remotePAMFailures.has(id));
      if (requested.length) {
        requested.forEach(([id]) => status.remotePAMPending.add(id));
        try { status.remotePAMLoader ||= createPAM50Loader(receiveRemotePAM); status.remotePAMLoader.load(requested); }
        catch (error) { receiveRemotePAM({ type: 'error', ids: requested.map(([id]) => id), message: error.message }); }
      }
      remotePAMStatus();
    }
    function retryRemoteAnatomy() { status.remotePAMEnabledSeen = false; updateRemoteAnatomy(); }
    Object.assign(status, { rebuildStructures, colorCortex, updateMaterials, updateSlices, updateROI, updateStudyMarkers, updateRemoteAnatomy, retryRemoteAnatomy });

    function getIntersections(event, objects = [cortexGroup, anatomyGroup, roiGroup, markerGroup]) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(objects, true).filter(hit => {
        let visible = true; for (let obj = hit.object; obj; obj = obj.parent) visible = visible && obj.visible; return visible;
      });
    }
    let start = null, draggedSlice = null;
    function pointerDown(event) {
      if (event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY, shift: event.shiftKey };
      if (propsRef.current.boxSelect) {
        controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
        const bounds = renderer.domElement.getBoundingClientRect();
        setSelectionBox({ left: event.clientX - bounds.left, top: event.clientY - bounds.top, width: 0, height: 0 });
      } else if (event.altKey && propsRef.current.slices?.enabled) {
        const hit = getIntersections(event, [sliceGroup]).find(hit => hit.object.userData.sliceAxis || hit.object.parent?.userData.sliceAxis);
        const axis = hit && (hit.object.userData.sliceAxis || hit.object.parent?.userData.sliceAxis);
        if (axis) { draggedSlice = { axis, initial: propsRef.current.slices[axis], y: event.clientY }; controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId); }
      }
    }
    function pointerMove(event) {
      if (draggedSlice) {
        const millimetresPerPixel = (camera.top - camera.bottom) / camera.zoom / status.height;
        const range = SLICE_BOUNDS[draggedSlice.axis];
        propsRef.current.onSliceChange?.(draggedSlice.axis, Math.round(THREE.MathUtils.clamp(draggedSlice.initial + (draggedSlice.y - event.clientY) * millimetresPerPixel, range[0], range[1])));
        return;
      }
      if (start && propsRef.current.boxSelect) {
        const bounds = renderer.domElement.getBoundingClientRect();
        setSelectionBox({ left: Math.min(start.x, event.clientX) - bounds.left, top: Math.min(start.y, event.clientY) - bounds.top, width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) });
      }
    }
    function pointerUp(event) {
      controls.enabled = true;
      if (draggedSlice) { draggedSlice = null; start = null; return; }
      if (!start) return;
      const p = propsRef.current, distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (p.boxSelect && distance > 5) {
        const bounds = renderer.domElement.getBoundingClientRect();
        const left = Math.min(start.x, event.clientX) - bounds.left, right = Math.max(start.x, event.clientX) - bounds.left;
        const top = Math.min(start.y, event.clientY) - bounds.top, bottom = Math.max(start.y, event.clientY) - bounds.top;
        const ids = p.structures.filter(s => {
          if (!isStructureVisible(s)) return false;
          const point = labelPosition(s).project(camera), x = (point.x * 0.5 + 0.5) * status.width, y = (-point.y * 0.5 + 0.5) * status.height;
          return x >= left && x <= right && y >= top && y <= bottom;
        }).map(s => s.id);
        p.onSelect?.(start.shift ? [...new Set([...(p.selectedIds || []), ...ids])] : ids);
      } else if (distance < 6) {
        const hits = getIntersections(event);
        const hit = hits.find(h => h.object.userData.category !== 'cortex' || (p.opacity ?? 1) >= 0.35) || hits[0];
        if (hit) {
          let structure, point = hit.point.clone();
          if (hit.object.userData.category === 'roi') {
            const comparison = p.roiComparison, part = hit.object.userData.roiPart;
            p.onCoordinate?.(point.toArray(), { coordinateSpace: 'brain' });
            p.onReady?.({ loaded: true, method: 'roi', mapping: 'none', roiPart: part, position: point.toArray(), message: `${sceneText('ROI 二值标签', 'ROI binary labels')} · ${part === 'intersection' ? sceneText('交集', 'Intersection') : part === 'aOnly' ? sceneText('仅 A', 'A only') : part === 'bOnly' ? sceneText('仅 B', 'B only') : part} · ${comparison?.grid.space || ''}` });
            start = null; setSelectionBox(null); return;
          } else if (hit.object.userData.category === 'study-marker') {
            const marker = hit.object.userData.marker;
            p.onCoordinate?.(marker.position, { coordinateSpace: 'brain' }); p.onStudyMarkerSelect?.(marker);
            p.onReady?.({ loaded: true, method: 'study-marker', mapping: 'none', position: marker.position, message: marker.label || marker.studyId || sceneText('研究坐标', 'Study coordinate') });
            start = null; setSelectionBox(null); return;
          } else if (hit.object.userData.category === 'cortex') {
            point.sub(hit.object.position);
            let label = atlasLabelAt(status.atlasVolume, point.toArray());
            const directDK = p.atlas === 'dk' && hit.object.userData.vertexLabels;
            if (directDK && hit.face) {
              const positions = hit.object.geometry.attributes.position;
              const vertex = [hit.face.a, hit.face.b, hit.face.c].sort((a, b) => new THREE.Vector3().fromBufferAttribute(positions, a).distanceToSquared(point) - new THREE.Vector3().fromBufferAttribute(positions, b).distanceToSquared(point))[0];
              const value = hit.object.userData.vertexLabels[vertex];
              const entry = hit.object.userData.dkLabels.find(item => item.id === value);
              label = entry ? { ...entry, value } : null;
            }
            structure = label?.structureId ? p.structures.find(s => s.id === label.structureId) : label ? findMatchingStructure(p.structures, label.name, hit.object.userData.hemisphere) : null;
            const matched = Boolean(structure);
            p.onReady?.({ loaded: true, method: label ? 'atlas' : 'unlabelled', mapping: matched ? directDK ? 'original-vertex-annotation' : 'label-name' : 'none', atlasLabel: label?.name, position: point.toArray(), message: label ? `${label.name} · ${directDK ? sceneText('同源 DK 顶点注释', 'Matched DK vertex annotation') : sceneText('体素标签', 'Voxel label')}${matched ? '' : sceneText(' · 无对应结构卡片', ' · No matching structure card')}` : status.atlasOverlayBlocked ? sceneText('该图谱未配准，已停止标签查询', 'Atlas alignment is unverified; label queries are disabled') : sceneText('此处没有图谱标签，未按邻近脑回补标', 'No atlas label here; no nearest-gyrus inference was applied') });
          } else {
            structure = hit.object.userData.structure;
            const object = structure && status.objects.get(structure.id);
            if (object) point.sub(object.position);
            const source = object?.userData.sourceMetadata;
            if (source) p.onReady?.({ loaded: true, method: source.representation || 'atlas-segmentation', sourceStructureId: structure.id, nativeSpace: source.nativeSpace || source.space, displaySpace: source.displaySpace || source.space || source.nativeSpace, targetAlignment: source.targetAlignment, sourceMetadata: source, message: `${source.dataset || source.atlas || sceneText('解剖图谱', 'Anatomical atlas')} · ${source.targetAlignment?.verified === false ? sceneText('原生参考空间（未联合配准）', 'Native reference space; no joint registration') : source.representation === 'tractography' ? sceneText('群体扩散流线', 'Population tractography') : sceneText('图谱分割表面', 'Atlas segmentation surface')}` });
          }
          const coordinateInfo = coordinateMetadata(structure);
          if (structure && isStructureVisible(structure)) {
            const ids = start.shift ? (p.selectedIds || []).includes(structure.id) ? p.selectedIds.filter(id => id !== structure.id) : [...(p.selectedIds || []), structure.id] : [structure.id];
            p.onSelect?.(ids, point.toArray(), coordinateInfo);
          } else { p.onCoordinate?.(point.toArray().map(value => Math.round(value * 10) / 10), coordinateInfo); p.onSelect?.([], undefined, coordinateInfo); }
        }
      }
      start = null; setSelectionBox(null);
    }
    function cancelPointer() { controls.enabled = true; start = null; draggedSlice = null; setSelectionBox(null); }
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', cancelPointer);
    const suppressContext = event => event.preventDefault(); renderer.domElement.addEventListener('contextmenu', suppressContext);
    stateRef.current = status;
    rebuildStructures(); updateROI(); updateStudyMarkers(); reset();

    loadManifest().then(manifest => Promise.all(['left', 'right'].map(async (side, index) => {
      const entry = manifest.meshes?.find(mesh => mesh.id === `cortex-${side}`);
      if (!entry?.file) throw new Error(sceneText(`数据清单缺少 ${side === 'left' ? '左' : '右'}半球表面来源`, `The manifest has no ${side} cortical surface`));
      const sourcePath = dataURL(entry.file);
      const response = await fetch(sourcePath); if (!response.ok) throw new Error(sceneText('MNI152 表面数据加载失败', 'MNI152 surface data could not be loaded'));
      const data = await response.json(); if (destroyed) return;
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geometry.setIndex(data.indices);
      if (data.normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3)); else geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material('#ffffff', { vertexColors: true, side: THREE.DoubleSide, roughness: 0.78 }));
      mesh.visible = false;
      if (entry.vertexLabels && data.vertexLabels?.length !== data.positions.length / 3) throw new Error(sceneText('DK 表面顶点注释与几何不匹配', 'DK vertex annotations do not match the surface geometry'));
      mesh.userData = { category: 'cortex', hemisphere: index === 0 ? 'L' : 'R', sourceIndices: data.indices, sourceMetadata: entry, vertexLabels: data.vertexLabels, dkLabels: manifest.atlases?.dk?.labels || [] }; cortexGroup.add(mesh); status.cortexMeshes.push(mesh);
    }))).then(() => {
      if (destroyed) return; status.loaded = true; setLoading(false); colorCortex(); if (status.autoOverview) reset();
      propsRef.current.onReady?.({ loaded: true, method: status.atlasVolume ? 'atlas' : 'teaching', message: sceneText('MNI152NLin6Asym 真实皮层表面 · RAS', 'MNI152NLin6Asym cortical surfaces · RAS') });
    }).catch(error => { if (!destroyed) { setLoading(false); setError(error.message); propsRef.current.onReady?.({ loaded: false, message: error.message }); } });
    loadAnatomyVolume().then(volume => { if (!destroyed) { status.anatomyVolume = volume; updateSlices(); } }).catch(() => { if (!destroyed) setError(sceneText('T1 参考影像加载失败，切片影像暂不可用。请刷新重试。', 'The reference T1 image could not be loaded. Slice images are unavailable; refresh to retry.')); });
    loadManifest().then(async manifest => {
      const meshes = Array.isArray(manifest.meshes) ? manifest.meshes : [];
      await Promise.all(meshes.filter(entry => entry.atlas === 'ho').map(async entry => {
        const hemisphere = /left/i.test(entry.name) ? 'L' : /right/i.test(entry.name) ? 'R' : 'M';
        const structure = findMatchingStructure(propsRef.current.structures.filter(s => s.category !== 'cortex' && s.category !== 'brainstem'), entry.name, hemisphere);
        if (!structure) return;
        try {
          const response = await fetch(dataURL(entry.file));
          if (!response.ok) throw new Error(`Failed ${structure.id}`); const data = await response.json();
          if (destroyed) return;
          applyActualAsset(structure.id, data, { ...entry, representation: 'atlas-segmentation' });
        } catch (error) { if (!destroyed) { status.anatomyFailures.add(structure.id); console.warn('[NeuroAtlas anatomical asset]', structure.id, dataURL(entry.file), error); } }
      }));
      const cerebellum = meshes.find(entry => entry.id === 'cerebellum');
      if (cerebellum && !destroyed) {
        try {
          const response = await fetch(dataURL(cerebellum.file)); if (!response.ok) throw new Error('Failed cerebellum');
          const data = await response.json(); if (destroyed) return;
          const parts = propsRef.current.structures.filter(s => s.category === 'cerebellum');
          const hasVermis = parts.some(s => s.hemisphere === 'M');
          for (const structure of parts) {
            const indices = [];
            for (let i = 0; i < data.indices.length; i += 3) {
              const a = data.indices[i], b = data.indices[i + 1], c = data.indices[i + 2];
              const x = (data.positions[a * 3] + data.positions[b * 3] + data.positions[c * 3]) / 3;
              if (structure.hemisphere === 'L' ? x < (hasVermis ? -5 : 0) : structure.hemisphere === 'R' ? x >= (hasVermis ? 5 : 0) : Math.abs(x) <= 5) indices.push(a, b, c);
            }
            applyActualAsset(structure.id, { ...data, indices }, { ...cerebellum, representation: 'atlas-segmentation', note: 'Diedrichsen 小脑整体表面；中线几何分侧', noteEn: 'Diedrichsen whole-cerebellum surface; geometric separation at the midline' }, false);
          }
          updateMaterials();
        } catch (error) { if (!destroyed) { propsRef.current.structures.filter(s => s.category === 'cerebellum').forEach(s => status.anatomyFailures.add(s.id)); console.warn('[NeuroAtlas anatomical asset]', 'cerebellum', error); } }
      }
      const brainstem = meshes.find(entry => entry.atlas === 'ho' && /brain.?stem/i.test(entry.name || ''));
      if (brainstem && !destroyed) {
        try {
          const response = await fetch(dataURL(brainstem.file)); if (!response.ok) throw new Error('Failed brainstem');
          const data = await response.json(); if (destroyed) return;
          const parts = propsRef.current.structures.filter(s => s.category === 'brainstem');
          for (const structure of parts) {
            const indices = [];
            for (let i = 0; i < data.indices.length; i += 3) {
              const a = data.indices[i], b = data.indices[i + 1], c = data.indices[i + 2];
              const z = (data.positions[a * 3 + 2] + data.positions[b * 3 + 2] + data.positions[c * 3 + 2]) / 3;
              if (structure.id === 'midbrain' ? z > -22 : structure.id === 'pons' ? z <= -22 && z > -47 : structure.id === 'medulla' ? z <= -47 : false) indices.push(a, b, c);
            }
            if (!indices.length) continue;
            applyActualAsset(structure.id, { ...data, indices }, { ...brainstem, representation: 'atlas-segmentation', schematic: true, actualEnvelope: true, note: 'HO 脑干真实外表面；中脑、脑桥和延髓界线为教学几何分段，并非核验后的解剖分割', noteEn: 'Real HO brainstem envelope; midbrain, pons and medulla boundaries are illustrative geometric divisions, not validated anatomical subdivisions' }, false);
          }
          updateMaterials();
        } catch (error) { if (!destroyed) { propsRef.current.structures.filter(s => s.category === 'brainstem').forEach(s => status.anatomyFailures.add(s.id)); console.warn('[NeuroAtlas anatomical asset]', 'brainstem', error); } }
      }
      if (!destroyed) {
        updateMaterials();
        if (status.autoOverview) reset();
        if (status.anatomyFailures.size) { setError(sceneText(`${status.anatomyFailures.size} 个真实结构文件加载失败，相关结构已隐藏。请刷新重试。`, `${status.anatomyFailures.size} anatomical files failed to load. Those structures are hidden; refresh to retry.`)); propsRef.current.onReady?.({ loaded: status.loaded, anatomyFailures: [...status.anatomyFailures] }); }
      }
    }).catch(error => { if (!destroyed) setError(sceneText(`解剖表面清单加载失败：${error.message}`, 'The anatomical surface manifest could not be loaded.')); });
    fetch(dataURL('anatomy/manifest.json')).then(response => {
      if (!response.ok) throw new Error(sceneText('真实脊髓和纤维图谱清单加载失败', 'The spinal and tractography manifest could not be loaded'));
      return response.json();
    }).then(async manifest => {
      if (destroyed) return;
      status.anatomyEntries = manifest.structures || {};
      updateRemoteAnatomy();
      const entries = Object.entries(status.anatomyEntries).filter(([, entry]) => entry.geometry);
      await Promise.all(entries.map(async ([id, entry]) => {
        try {
          const response = await fetch(dataURL(entry.geometry));
          if (!response.ok) throw new Error(`Failed ${id}`);
          const data = await response.json();
          if (destroyed) return;
          applyActualAsset(id, data, entry, false);
        } catch (error) {
          if (!destroyed) { status.anatomyFailures.add(id); console.warn('[NeuroAtlas anatomical asset]', id, dataURL(entry.geometry), error); }
        }
      }));
      if (destroyed) return;
      updateMaterials();
      if (status.autoOverview) reset();
      const failed = entries.map(([id]) => id).filter(id => status.anatomyFailures.has(id));
      if (failed.length) setError(sceneText(`${failed.length} 个真实结构文件加载失败，相关结构已隐藏，未以示意模型冒充。请刷新重试。`, `${failed.length} anatomical files failed to load. Those structures are hidden; refresh to retry.`));
      propsRef.current.onReady?.({ loaded: status.loaded, anatomyLoadedIds: entries.map(([id]) => id).filter(id => !status.anatomyFailures.has(id)), anatomyFailures: [...status.anatomyFailures], message: sceneText(`真实解剖资产 ${entries.length - failed.length}/${entries.length} · 空间与覆盖见结构来源`, `Anatomical assets ${entries.length - failed.length}/${entries.length} · See each source for alignment and coverage`) });
    }).catch(error => { if (!destroyed) { setError(error.message); propsRef.current.onReady?.({ loaded: status.loaded, anatomyFailures: ['manifest'], message: error.message }); } });

    return () => {
      destroyed = true; cancelAnimationFrame(animation); resizeObserver.disconnect(); controls.dispose(); status.remotePAMLoader?.terminate();
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', cancelPointer);
      renderer.domElement.removeEventListener('contextmenu', suppressContext);
      status.labelNodes.forEach(({ node }) => node.remove()); disposeObject(root); renderer.dispose(); renderer.domElement.remove(); stateRef.current = null;
    };
  }, []);

  useEffect(() => { const state = stateRef.current; if (state && state.structures !== props.structures) state.rebuildStructures(); }, [props.structures]);
  useEffect(() => { stateRef.current?.updateMaterials(); }, [props.selectedIds, props.visibleCategories, props.hiddenIds, props.hemisphere, props.opacity, props.categoryOpacity, props.exploded, props.labels, props.network, props.showSchematic, props.language]);
  useEffect(() => { stateRef.current?.updateROI(); }, [props.roiComparison, props.roiDisplay, props.exploded]);
  useEffect(() => { stateRef.current?.updateStudyMarkers(); }, [props.studyMarkers, props.exploded]);
  useEffect(() => { stateRef.current?.updateRemoteAnatomy(); }, [props.remoteAnatomyEnabled, props.remoteAnatomyRequest, props.remoteAnatomyTissues, props.selectedIds, props.visibleCategories, props.language]);
  useEffect(() => { stateRef.current?.reset(); }, [props.preset]);
  useEffect(() => { const state = stateRef.current; if (props.view && state) { if (state.autoOverview && props.view === 'oblique') state.reset(); else state.setView(props.view); } }, [props.view]);
  useEffect(() => { stateRef.current?.updateSlices(); }, [props.slices?.enabled, props.slices?.x, props.slices?.y, props.slices?.z]);
  useEffect(() => {
    const state = stateRef.current; if (!state) return;
    const generation = ++state.atlasGeneration;
    loadAtlas(props.atlas).then(volume => {
      if (stateRef.current !== state || generation !== state.atlasGeneration) return;
      state.atlasOverlayBlocked = volume?.canOverlayOnTarget === false;
      state.atlasVolume = state.atlasOverlayBlocked ? null : volume; state.colorCortex();
      propsRef.current.onReady?.({ loaded: state.loaded, method: state.atlasOverlayBlocked ? 'independent' : volume ? 'atlas' : 'teaching', overlayBlocked: state.atlasOverlayBlocked, message: state.atlasOverlayBlocked ? sceneText(`${volume.space || '原生图谱'} 未配准到当前模板 · 已停止表面叠加和坐标查询`, `${volume.space || 'Native atlas'} alignment is unverified · Surface overlay and coordinate queries are disabled`) : volume ? sceneText(`${volume.space || 'MNI'} · 图谱体素采样`, `${volume.space || 'MNI'} · Atlas voxel sampling`) : sceneText('图谱体素数据未接入 · 教学定位', 'Atlas voxel data unavailable · Teaching locations only') });
    }).catch(() => {
      if (stateRef.current !== state || generation !== state.atlasGeneration) return;
      state.atlasVolume = null; state.colorCortex();
      propsRef.current.onReady?.({ loaded: state.loaded, method: 'unavailable', message: sceneText('图谱体素数据加载失败 · 体素标签查询不可用', 'Atlas data failed to load · Voxel-label queries are unavailable') });
    });
  }, [props.atlas]);

  return <div className="brain-scene" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    <div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 20, bottom: 76, color: '#6c7f75', fontSize: 10 }}>
        <div data-ruler style={{ borderBottom: '1px solid #87978e', borderLeft: '1px solid #87978e', borderRight: '1px solid #87978e', height: 6, width: 72, position: 'relative' }}><span style={{ position: 'absolute', bottom: 10, left: 0, whiteSpace: 'nowrap' }}>20 mm</span></div>
      </div>
      <div style={{ position: 'absolute', right: 93, bottom: 50, fontSize: 10, color: '#799084', letterSpacing: 1.4 }}>RAS <span style={{ marginLeft: 7, color: '#a5afa9' }}>mm</span></div>
      <canvas ref={compassRef} width="160" height="160" aria-label="Camera-linked R L A P S I orientation compass" style={{ position: 'absolute', right: 75, bottom: 60, width: 80, height: 80 }} />
    </div>
    {selectionBox && <div style={{ position: 'absolute', ...selectionBox, border: '1px solid #3d8067', background: '#4c8f7020', pointerEvents: 'none' }} />}
    {loading && <div role="status" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: '#ffffffdf', color: '#496457', padding: '12px 18px', border: '1px solid #dce5dc', borderRadius: 8, fontSize: 12 }}>{sceneText('正在加载 MNI152NLin6Asym 皮层表面…', 'Loading MNI152NLin6Asym cortical surfaces…')}</div>}
    {error && <div role="alert" style={{ position: 'absolute', left: 24, right: 24, bottom: 62, color: '#996536', background: '#fff7ecf2', padding: '12px 16px', borderRadius: 8, fontSize: 12 }}>{error}</div>}
  </div>;
});

export default BrainScene;
