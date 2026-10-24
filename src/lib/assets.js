const configuredBase = import.meta.env?.BASE_URL || '/';

/** Resolve a public asset beneath the application's deployment base. */
export function assetURL(value, base = configuredBase) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  const root = base.endsWith('/') ? base : `${base}/`;
  const relative = String(value).replace(/^\/+/, '');
  const rootRelative = root.replace(/^\/+/, '');
  if (rootRelative && rootRelative !== './' && relative.startsWith(rootRelative)) return root.startsWith('/') ? `/${relative}` : relative;
  return root + relative.replace(/^\.\//, '');
}

/** Atlas manifests may contain either /data/... paths or paths relative to data/. */
export function dataURL(value, base = configuredBase) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value;
  const relative = String(value).replace(/^\/+/, '').replace(/^\.\//, '');
  return assetURL(relative.startsWith('data/') ? relative : `data/${relative}`, base);
}
