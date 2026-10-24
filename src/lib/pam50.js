const PAM50_PREFIX = 'https://raw.githubusercontent.com/spinalcordtoolbox/PAM50/609a18235d9143dad0d6bf5bb35e2bff9e55196f/';

/** Shared by public-release packaging and the browser loader. */
export function pam50RemoteDescriptor(id, entry) {
  if (entry.dataset !== 'PAM50' || !entry.source?.startsWith(PAM50_PREFIX) || !/^[a-f0-9]{64}$/.test(entry.sourceSha256 || '')) throw new Error(`PAM50 source provenance is incomplete: ${id}`);
  const isLevel = /\/PAM50_spinal_levels\.nii\.gz$/.test(entry.source);
  return { format: 'nifti1-gzip', url: entry.source, sha256: entry.sourceSha256, selector: isLevel ? 'label' : 'threshold', ...(isLevel ? { labelValue: entry.nativeLabel, spatialUnitsIfMissing: 'mm', unitsEvidence: 'Pinned PAM50 0.5 mm template grid and matching source affine; level-label header omits spatial-units code' } : { threshold: entry.threshold ?? 0.5 }), sourceShape: entry.nativeShape, sourceAffine: entry.nativeAffine };
}

export function createPAM50Loader(onMessage) {
  const worker = new Worker(new URL('./pam50.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = event => onMessage(event.data);
  worker.onerror = event => onMessage({ type: 'worker-error', message: event.message || 'PAM50 worker failed' });
  return { load(entries) { worker.postMessage({ entries: entries.map(([id, entry]) => ({ id, ...entry.remoteGeometry })) }); }, terminate() { worker.terminate(); } };
}

export { PAM50_PREFIX };
