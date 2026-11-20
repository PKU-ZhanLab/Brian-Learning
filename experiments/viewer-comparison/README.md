# Viewer comparison

Isolated NiiVue 0.69.0 candidate and the current Three.js boundary renderer, using the same synthetic NIfTI and per-label STL boundaries. No browser acceptance or performance measurements have been executed.

From this directory, use `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, `npm run build`, and, only in a permitted browser session, `npm run dev`. Root installed the pinned dependency on 2026-10-30. Production dependencies and the source-release input list exclude this directory. No CDN or remote data URL is used by the harness.

Select label IDs 7/42 or a signed statistical map. The app's parser, threshold selection, affine sampling, discrete surfaces, AssetIdentity and project codec remain authoritative. NiiVue receives the same voxel values and separate meshes named `source-label-7.stl` / `source-label-42.stl`; the displayed record maps its generated mesh IDs back to source IDs. STL itself cannot preserve a label-ID field. Check both the exact boundaries and slice label IDs before accepting this adapter.

Move the app's decimal RAS fields and send their world-mm point to NiiVue. Move NiiVue's crosshair and inspect its numerical returned point and delta, then use that point in the app. Capture the canonical project and adapter camera, change the fixture/tail/threshold, and restore: the app project codec validates and restores the embedded decoded volume, identities, selection, points and Three.js camera before rebuilding the candidate. The NiiVue angle/scale adapter state is separate from the canonical project; it is not a new application project format or an NVD replacement.

The performance control records 20 CPU draw-submission samples with environment and workload labels. Current scope differs (Three.js 3D boundaries versus NiiVue multiplanar plus 3D); these samples are diagnostics, not a fair speed ranking. First frame, GPU completion, interaction latency, memory, representative large public inputs and repeated matched-view workloads still require a permitted browser protocol. Empty metrics remain `null`.

Each candidate generation owns a fresh canvas, revokes its object URLs, detaches the old canvas, removes callbacks and calls the pinned `cleanup()` API. A late completion can draw only to its detached canvas. Browser lifecycle, GPU memory and cancellation acceptance remain unrun.

The fixture is synthetic, with no participant data. `notices/NiiVue-BSD-2-Clause.txt` is the exact pinned upstream license (SHA-256 `604be23eceeef93996165e2cd46eefd4d713f98f1b4a5414ab109516dc1b30bf`). Installed package SPDX metadata was inspected; this is not a complete dependency or bundled-asset legal audit. Retain dependency notices before redistributing a compiled experiment. Do not distribute this experiment as part of the production source package.
