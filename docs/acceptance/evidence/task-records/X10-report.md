# X10 implementation report

Status: **DONE_WITH_CONCERNS** — implementation and permitted Node/build checks complete; browser, scientific rendering and performance acceptance remain unrun. Root owns review and commit. No commit, deployment, Python, browser/desktop automation or browser test execution was performed by this worker.

Working checkout: `F:/project/brain-model/.worktrees/research-20261029`; assigned base: `1a773a16f559240ab4bd6b08be56e0d595656385`. Read X10-brief.md first, then integration context and source preparation/research. Applied executing-plans/TDD within root's sole-writer/sole-committer rulings; no subagents.

## Implemented behavior

- A wide common-DialogHost source comparison opens from ROI A/B choices. Each side displays exact source identity/reference context, its own exact label boundaries and all three slices. Independent source choosers preserve the distinction from numerical ROI computation. There is no main-template overlay of native/unknown sources.
- Extracted the existing Three.js AtlasCanvas into a reusable component, retaining Explorer's resize disposal guard and behavior. Added controlled camera restoration, point picking, keyboard orbit/zoom, explicit WebGL startup error, and an optional experiment-only CPU rendering probe. Existing BrainScene is unchanged: source-only native/unknown rendering must use the existing independent exact-boundary renderer rather than the main template scene. This is the context-authorized reusable extraction, not a new scientific renderer.
- Source slices reuse the existing volume parser, nearest-neighbor sampling and slice renderer. The helpers now accept optional bounds, preserving their existing defaults. The paired view computes extents from all eight affine-transformed voxel edges, preserves finite fractional/outside-template points without clipping, and supplies explicit R/L/A/P/S/I orientation. Slice mouse, keyboard, sliders and decimal fields can move either side.
- Camera and crosshair switches are independent. A source must have canonical AssetIdentity, actual-byte verification, a specific common reference and recorded source evidence before either absolute camera/target or point linking is allowed. Generic MNI, matching grids, missing provenance and arbitrary matrices grant no link eligibility. Different/unknown references disable absolute camera and coordinate linkage with a local reason. User-declared scope is retained and not called independently registered. No generic transform engine exists; unavailable direction-correct bridges remain blocked.
- Programmatic echo updates are suppressed; current identities gate source events. Source changes clear rendering immediately, ignore late loads, terminate old workers and reject stale worker generations. A saved identity mismatch is explicit and requires source reset rather than silently binding new bytes. Missing saved labels are reported.
- Pair state uses ROI onStateChange and existing view/project codecs: source catalog IDs, exact identities, both decimal points/cameras, selections/thresholds/tails and independent switches. No new localStorage key or image buffer store. Named local-source restoration rejects foreign projects. History/project/named round trips retain the pair. Asset removal/exclusion detaches the affected side, leaves the other side and historical data intact, and merge collisions remap the catalog edge and exact-ID references. Derived byte identities such as `custom-a:derived:uint8:little-endian` are not mistaken for catalog dependencies; the paired assetId owns that dependency.
- Public projection always omits the complete paired state, regardless of current source or imported provenance claims. New bilingual comparisonViews omission feedback names the omitted views, points and cameras without disclosing private IDs. Private-to-public source changes and image removal cannot promote retained private positions/cameras into public links.

## Isolated experiment

`experiments/viewer-comparison` has its own package and lock, pinned exactly to `@niivue/niivue` 0.69.0. Root performed the authorized installation with `--ignore-scripts --no-audit --no-fund`; the worker did not install dependencies. Root's install receipt is X10-install-receipt.json: 15 lock resolutions, 14 installed on Windows, one expected optional Linux package absent. Registry integrity matches the agreed pin. Production package.json/package-lock.json have no changes, production source has no NiiVue import, and source-release preparation excludes the experiment.

The executable harness feeds identical synthetic decoded NIfTI/affine values and the same per-label exact boundary meshes to both renderers. Fixtures include a flipped, oblique, non-isotropic affine, discrete IDs 7/42 and signed values around inclusive positive/negative/absolute thresholds. Original-versus-derived identity and a canonical S5 manifest are retained. Label fixture original SHA-256 is `0e8f5880841a5e7ab3605f7fc3212ffabfe9e75a47b52b0f2ddd748aba774b2e`, derived payload SHA-256 is `640879fcdf99ad259e0e8eab9be5840285d105946ee01697704167f78c82d340`. Statistical original SHA-256 is `52a1dd407ef58b90e2b366d979f62137f89fd18186a6df642ebe5c1259cc0c1c`, derived payload SHA-256 is `af191c16d933e38fe0a95d50b8958878123d7075a45136b7a8a960cd58d61a81`.

NiiVue has separate STL meshes with source-label names and a returned viewer-mesh-ID map (STL has no intrinsic discrete-label field). The harness reads numeric world-mm points and shows deltas to the app's decimals in both directions. Capture is ready-gated; restore validates the existing project codec, recovers the embedded decoded volume, source identities, points, labels, thresholds/tails and Three.js camera, then rebuilds the candidate. NiiVue-specific angle/scale state is an explicit extra experiment adapter envelope, not a competing app project format. A new fixture generation owns a fresh canvas; late candidate draws stay on detached canvases, callbacks are removed, cleanup() is called and URLs are revoked.

A 20-sample CPU draw-submission diagnostic is available with environment and workload labels. The current workloads differ (Three.js boundaries versus NiiVue multiplanar plus 3D); the harness explicitly prevents treating those values as an equivalent-workload speed ranking. No measured value has been produced; GPU, memory, latency, first-frame, representative large public inputs and matched-view comparative performance remain pending.

The upstream BSD-2-Clause license was copied after matching the preserved source manifest and SHA-256 `604be23eceeef93996165e2cd46eefd4d713f98f1b4a5414ab109516dc1b30bf`. A single scoped .gitattributes -text rule preserves those exact bytes. `git check-attr text` reports unset; filtered/raw Git blob hashes agree (`a592d66dc5dbde86b58200ef9145f9b3e12b55f7`). Available installed dependency top-level licenses were copied, with metadata/presence recorded. This is not a complete transitive bundled-asset or legal audit.

Provisional decision in docs/VIEWER_EVALUATION.md: retain current renderer while evaluating the isolated candidate. This is based on missing executed compatibility evidence, not measured superiority or permanent rejection. Re-evaluation requires permitted rendering, numeric, discrete-ID, threshold, lifecycle/privacy and matched performance evidence.

## Actual verification

Meaningful RED was observed before implementation: same-reference linking returned false; paired state was absent; source bounds were clipped to template coordinates. The focused test then became green. Additional observed RED→GREEN regressions covered paired source detachment/remap, foreign named-project sources, canonical derived IDs incorrectly treated as catalog dependencies, and explicit public omission feedback.

| Command/evidence | Actual result |
| --- | --- |
| `node --test src/lib/comparison-link.test.mjs` initial | 0/4, expected behavioral RED |
| Focused core/view/asset/session/Explorer plus prototype fixture modules | 85/85 passed; X10-focused.log |
| `npm run check` | 397/397 passed, exit 0; X10-check.log |
| Final adapter/status and comparison tests after only omission adapter change | 16/16 passed, exit 0; X10-final-adapter.log. Per root ruling, no redundant full-suite rerun for this bounded adapter change. |
| Final fixture tests | 3/3 passed, exit 0; X10-prototype-check.log |
| Final `npm run build` | passed, exit 0; X10-build.log |
| Isolated `npm run build` | passed, exit 0; X10-prototype-build.log |
| `npm run test:e2e -- tests/e2e/linked-comparison.spec.mjs --list` | 8 tests discovered, exit 0; X10-e2e-list.log. No browser launched. |
| Production import scan / manifest diff | no NiiVue source import; parent dependency manifests unchanged |
| `git diff --check` | passed; Git only reported normal CRLF→LF notices for App/ROICompare |

Builds retain the project's large-chunk and mixed dynamic/static volume-import notices; the isolated candidate also emits large-chunk notices. These are build warnings, not measured runtime performance results.

Authored E2E covers two same-reference sources, different registered atlases, native/unknown references, both-direction decimal/3D/slice keyboard/mouse movement, independent switches, stale source change/close, opener focus, project state export, and widths 390/650/768/1366/1920. It was discovered only. Browser rendering, GPU behavior, scroll/Tab containment, actual 200% zoom, touch/screen-reader interaction, network privacy, complete state restoration and performance acceptance remain **not run** under the native URL guard. No alternate browser route was used.

## Exact changed files

Tracked modifications:

- .gitattributes
- src/App.jsx
- src/components/AtlasExplorer.jsx
- src/components/ROICompare.jsx
- src/components/SliceViews.jsx
- src/lib/volume.js
- src/lib/workspace-assets.js
- src/lib/workspace-assets.test.mjs
- src/lib/workspace-project.js
- src/lib/workspace-session.js
- src/lib/workspace-status.js
- src/lib/workspace-status.test.mjs

New implementation/test/document files:

- src/components/AtlasCanvas.jsx
- src/components/ComparisonViewport.jsx
- src/components/ComparisonViewport.css
- src/lib/comparison-link.js
- src/lib/comparison-link.test.mjs
- tests/e2e/linked-comparison.spec.mjs
- docs/VIEWER_EVALUATION.md
- experiments/viewer-comparison/package.json
- experiments/viewer-comparison/package-lock.json (root-installed)
- experiments/viewer-comparison/index.html
- experiments/viewer-comparison/vite.config.js
- experiments/viewer-comparison/main.jsx
- experiments/viewer-comparison/style.css
- experiments/viewer-comparison/fixture.mjs
- experiments/viewer-comparison/fixture.test.mjs
- experiments/viewer-comparison/README.md
- experiments/viewer-comparison/notices/NiiVue-BSD-2-Clause.txt
- experiments/viewer-comparison/notices/dependency-metadata.json
- experiments/viewer-comparison/notices/dependencies/@lukeed_csprng-license
- experiments/viewer-comparison/notices/dependencies/@lukeed_uuid-license
- experiments/viewer-comparison/notices/dependencies/@ungap_structured-clone-LICENSE
- experiments/viewer-comparison/notices/dependencies/@zarrita_storage-LICENSE
- experiments/viewer-comparison/notices/dependencies/array-equal-LICENSE
- experiments/viewer-comparison/notices/dependencies/fflate-LICENSE
- experiments/viewer-comparison/notices/dependencies/gl-matrix-LICENSE.md
- experiments/viewer-comparison/notices/dependencies/nifti-reader-js-LICENSE
- experiments/viewer-comparison/notices/dependencies/numcodecs-LICENSE
- experiments/viewer-comparison/notices/dependencies/reference-spec-reader-LICENSE
- experiments/viewer-comparison/notices/dependencies/unzipit-LICENSE.md
- experiments/viewer-comparison/notices/dependencies/uzip-module-LICENSE
- experiments/viewer-comparison/notices/dependencies/zarrita-LICENSE

Worker report/logs (ignored execution evidence): .superpowers/sdd/README/X10-report.md, X10-focused.log, X10-check.log, X10-final-adapter.log, X10-prototype-check.log, X10-build.log, X10-prototype-build.log, X10-e2e-list.log. Root owns X10-install-receipt.json and preexisting source preparation evidence.

No entire-plan completion, actual NiiVue adoption, human-certified spatial validation, legal approval or browser acceptance is claimed.

Root staged-diff follow-up: the staged check caught one extra blank line at AtlasCanvas.jsx EOF while the file had previously been untracked. Removed only that final blank line; no tests rerun and the Git index was not touched.

## Review fix round 1/5 — I1/P1 and I2/P2

Assigned base: 91dc4b37a9ba591690529e1386230a713e769a45. Read X10-review.md and addressed only the two required findings. M1/M2 were not expanded into implementation work. No commits, index writes, installs, browser/desktop/Playwright execution, Python or broad-suite repetition.

I1: added prepareComparisonDisplay, which uses the existing nativeDisplayVolume membership rule and re-prepares the derived buffer through canonical prepareVolume. Statistical/probability/mask slices now sample membership rather than the source sampler closure. The raw volume remains unchanged; its exact identity is held separately as sourceIdentity on the display derivative, which does not inherit a raw-byte identity claim. Integer label sources retain their original sampler and exact IDs. SourcePanel and the isolated prototype fixture both use this adapter. The regressions exercise actual sampleRAS plus atlasLabelAt for positive, negative, absolute, probability and mask cases, including excluded +1. Observed initial RED: statistical sampler returned [-3,3,1] instead of [0,1,0], probability sampler returned [.25,.75,1] instead of [0,1,1].

I2: added an explicit per-side reset generation to the actual loading effect request key. Same-ID Reset always reruns source loading even with empty labels/.5/positive; resolving identity alone does not alter that key. The actual source-load adapter preserves S3/loadAtlas as the cache authority, validates the saved identity, and exposes cancellable request lifetime. Source chooser/reset actions immediately invalidate old load/worker generations; cleanup cancels and terminates pending work. Node regressions cover same-ID empty-source reload, saved-identity-mismatch recovery, subsequent point edits, resolved-identity no-reload behavior, and late cancelled/superseded completion. Observed RED: same-ID reset generations yielded the identical request key.

Exact changed files for this fix round: src/components/ComparisonViewport.jsx; src/lib/comparison-link.js; new src/lib/comparison-display.js; new src/lib/comparison-display.test.mjs; new src/lib/comparison-source.test.mjs; experiments/viewer-comparison/fixture.mjs; this ignored report and fix logs. No quantitative ROI calculation or persistence schema was changed.

Actual commands/results:

- node --test src/lib/comparison-display.test.mjs — initial 1/3 (expected two behavioral RED failures), then green through focused run.
- node --test src/lib/comparison-display.test.mjs src/lib/comparison-source.test.mjs — I1 green, I2 request-key behavioral RED before reset-generation implementation.
- node --test src/lib/comparison-display.test.mjs src/lib/comparison-source.test.mjs src/lib/comparison-link.test.mjs src/lib/atlas-explorer.test.mjs experiments/viewer-comparison/fixture.test.mjs — 22/22 passed, exit 0; X10-fix1-focused.log.
- npm run build — passed, exit 0; X10-fix1-build.log. Existing mixed-import/large-chunk notices retained.
- isolated experiments/viewer-comparison npm run build — passed, exit 0; X10-fix1-prototype-build.log. Large-chunk notices retained.
- git diff --check — passed. New untracked fix files were also checked for trailing whitespace/extra final blank lines.

Both review defects are addressed within the permitted Node/build gate. Browser, scientific rendering, interaction and performance acceptance remain unrun; no new runtime acceptance claim is made.
