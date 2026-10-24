const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const TYPES = {
  2: { bytes: 1, ArrayType: Uint8Array, getter: 'getUint8' },
  4: { bytes: 2, ArrayType: Int16Array, getter: 'getInt16' },
  8: { bytes: 4, ArrayType: Int32Array, getter: 'getInt32' },
  16: { bytes: 4, ArrayType: Float32Array, getter: 'getFloat32' },
  64: { bytes: 8, ArrayType: Float64Array, getter: 'getFloat64' },
  256: { bytes: 1, ArrayType: Int8Array, getter: 'getInt8' },
  512: { bytes: 2, ArrayType: Uint16Array, getter: 'getUint16' },
  768: { bytes: 4, ArrayType: Uint32Array, getter: 'getUint32' },
};

/** Minimal, validated single-file NIfTI-1 reader for the pinned PAM50 sources.
 * Explicit sforms are required. A caller may supply documented mm units only
 * when a pinned source omits the spatial-units header (PAM50 level labels do).
 */
export function parseNifti1(buffer, { spatialUnitsIfMissing } = {}) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 352) throw new Error('nifti-header');
  const view = new DataView(buffer);
  const little = view.getInt32(0, true) === 348 ? true : view.getInt32(0, false) === 348 ? false : null;
  if (little == null || String.fromCharCode(view.getUint8(344), view.getUint8(345), view.getUint8(346)) !== 'n+1') throw new Error('nifti-header');
  const ndim = view.getInt16(40, little), shape = [0, 1, 2].map(axis => view.getInt16(42 + axis * 2, little));
  if (ndim < 3 || ndim > 7 || shape.some(n => n <= 0) || Array.from({ length: Math.max(0, ndim - 3) }, (_, axis) => view.getInt16(48 + axis * 2, little)).some(n => n !== 1)) throw new Error('nifti-dimensions');
  const count = shape.reduce((a, b) => a * b, 1);
  if (count > 50_000_000) throw new Error('nifti-too-large');
  const datatype = view.getInt16(70, little), type = TYPES[datatype], bitpix = view.getInt16(72, little);
  if (!type || bitpix !== type.bytes * 8) throw new Error('nifti-datatype');
  const offset = view.getFloat32(108, little);
  if (!Number.isInteger(offset) || offset < 352 || offset + count * type.bytes > buffer.byteLength) throw new Error('nifti-data-length');
  const spatialUnitsCode = view.getUint8(123) & 7;
  if ((spatialUnitsCode !== 2 && !(spatialUnitsCode === 0 && spatialUnitsIfMissing === 'mm')) || view.getInt16(254, little) <= 0) throw new Error('nifti-explicit-mm-sform-required');
  const affine = Array.from({ length: 12 }, (_, i) => view.getFloat32(280 + i * 4, little)).concat([0, 0, 0, 1]);
  const determinant = affine[0] * (affine[5] * affine[10] - affine[6] * affine[9]) - affine[1] * (affine[4] * affine[10] - affine[6] * affine[8]) + affine[2] * (affine[4] * affine[9] - affine[5] * affine[8]);
  if (!affine.every(Number.isFinite) || Math.abs(determinant) < 1e-10) throw new Error('nifti-affine');
  const rawSlope = view.getFloat32(112, little), rawIntercept = view.getFloat32(116, little);
  const slope = Number.isFinite(rawSlope) && rawSlope !== 0 ? rawSlope : 1;
  const intercept = Number.isFinite(rawSlope) && rawSlope !== 0 && Number.isFinite(rawIntercept) ? rawIntercept : 0;
  let data;
  if ((little === HOST_LITTLE_ENDIAN || type.bytes === 1) && offset % type.bytes === 0) data = new type.ArrayType(buffer, offset, count);
  else {
    data = new type.ArrayType(count);
    for (let index = 0; index < count; index++) data[index] = view[type.getter](offset + index * type.bytes, little);
  }
  return { data, shape, affine, order: 'x-fastest', coordinateSystem: 'RAS', units: 'mm', unitsProvenance: spatialUnitsCode === 2 ? 'NIfTI header' : 'Explicit pinned-source metadata; source header units were unspecified', datatype, slope, intercept, voxelSizeMm: [0, 1, 2].map(axis => Math.hypot(affine[axis], affine[4 + axis], affine[8 + axis])) };
}

export function cropNiftiSelections(volume, descriptors) {
  const { data, shape, affine, slope, intercept } = volume, [nx, ny, nz] = shape;
  const records = descriptors.map(descriptor => ({ ...descriptor, low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity], count: 0 }));
  const labelRecords = new Map(records.filter(record => record.selector === 'label').map(record => [record.labelValue, record]));
  const thresholdRecords = records.filter(record => record.selector === 'threshold');
  function include(record, index) {
    const x = index % nx, y = Math.floor(index / nx) % ny, z = Math.floor(index / (nx * ny));
    record.count++;
    record.low[0] = Math.min(record.low[0], x); record.high[0] = Math.max(record.high[0], x);
    record.low[1] = Math.min(record.low[1], y); record.high[1] = Math.max(record.high[1], y);
    record.low[2] = Math.min(record.low[2], z); record.high[2] = Math.max(record.high[2], z);
  }
  for (let index = 0; index < data.length; index++) {
    const value = data[index] * slope + intercept;
    if (!Number.isFinite(value)) continue;
    const label = labelRecords.get(value);
    if (label) include(label, index);
    for (const record of thresholdRecords) if (value >= (record.threshold ?? 0.5)) include(record, index);
  }
  return records.map(record => {
    if (!record.count) throw new Error(`nifti-empty-mask:${record.id}`);
    const low = record.low, cropShape = record.high.map((value, axis) => value - low[axis] + 1);
    const mask = new Uint8Array(cropShape.reduce((a, b) => a * b, 1));
    let at = 0;
    for (let z = low[2]; z <= record.high[2]; z++) for (let y = low[1]; y <= record.high[1]; y++) for (let x = low[0]; x <= record.high[0]; x++, at++) {
      const value = data[x + nx * (y + ny * z)] * slope + intercept;
      mask[at] = Number(Number.isFinite(value) && (record.selector === 'label' ? value === record.labelValue : value >= (record.threshold ?? 0.5)));
    }
    const croppedAffine = [...affine];
    for (let axis = 0; axis < 3; axis++) croppedAffine[axis * 4 + 3] += affine[axis * 4] * low[0] + affine[axis * 4 + 1] * low[1] + affine[axis * 4 + 2] * low[2];
    return { id: record.id, mask, sourceVoxels: record.count, grid: { shape: cropShape, affine: croppedAffine, order: 'x-fastest', space: 'PAM50 native straightened template' } };
  });
}
