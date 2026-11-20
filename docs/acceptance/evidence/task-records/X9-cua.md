# X9 actual desktop acceptance

Root browser operation used CUA only. Sources: initial cd7e10e, corrected6248f7c, immutable build receipts under output/x9-cua. Inputs are the three generated synthetic Int16 NIfTI files/hash inventory in output/x9-profile, plus the previously verified W6 history project. No private research files or injected browser/Storage/Worker monkeypatches were used.

## Actual failure → correction evidence

- **Lazy import handoff:** HTTP fixture delayed only the ROI module by1,200ms. On cd7e10e, task entry left the import disclosure closed and focus on Import image after mount. On6248f7c, cold entry and warm entry both open the disclosure and focus roi-import-file. Leaving for Anatomy before module resolution then choosing generic ROI comparison leaves the disclosure closed and focus on ROI comparison: no stale focus theft. lazy-import-red/green.json and red PNG.
- **Stale mask output:** restored the same W6 original7-voxel result, delayed only the NIfTI worker module1,500ms, began Export A then Recompute. Initial cd7e10e removed Cancel export yet downloaded old ROI-A.nii after recompute. Fixed6248f7c started export visibly but produced no download in the5-second observation window after recompute. Inspecting the original again and exporting succeeded. Canonical parsing proves every resulting voxel, grid and affine matches the original A mask (7 nonzero voxels,181×217×181). late-export-red/green.json, late-old-mask-red.nii, current-mask-green.nii, mask-export-green-receipt.json and HTTP logs.

## Normal, large-input and failure recovery

- Normal524,640-byte file imported through the actual worker and single W2 stage. Actual full project download retains exact values/shape/affine and the original source SHA256; its distinct derived identity is preserved. Native/unverified image remains ineligible for template comparison. small-imported.neuroatlas and small-import-receipt.json.
- Real128,000,352-byte /64,000,000-voxel input, with no artificial network delay: Cancel import was present and usable, the action ended, its file declaration/provenance and enabled retry remained. An actual project download after cancellation contains exactly the previous small image with unchanged identity/values and unchanged other research fields. No partial large asset appears. near-limit-cancel-ui.json, after-near-limit-cancel.neuroatlas and near-limit-cancel-receipt.json.
- Retrying the same large file without reselecting succeeds. The actual downloaded project contains exactly two images; all64,000,000 new values equal the generated source, its original file hash is exact, and the old small image is unchanged. Both are native/unverified. The177,417-byte compressed project matches preview; raw image bytes are separately128,524,992. near-limit-retry-ui.json, near-limit-export-ui.json, after-near-limit-retry.neuroatlas and near-limit-retry-receipt.json.
- Intentional first worker module503: current small image/research survives exactly, declaration remains, retry enabled. Retrying the same selected128³ file downloads worker200 and adds exactly one complete image with2,097,152 exact values and original source hash; old image unchanged. worker-failure-ui.json, after-worker-failure.neuroatlas, after-worker-retry.neuroatlas and worker-failure-retry-receipt.json.

## Measured limits and remaining gates

No browser p95, browser-wide peak heap, first-paint time, cold/warm timing comparison or precise rendered cancellation latency is claimed. Cancellation above is an actual functional/retention observation, not a timed≤1s certification. During large-file retry an initial page-state observation hit a3-second runtime timeout; a later observation confirmed successful import. This is retained as an observation limit, not an exact application latency measurement.

The Node-only near-limit canonical W2 staging cost remains about1.1s, as reported in X9-report.md. Browser timing/heap fields remain null, with final G1 profiling outstanding. Highly compressible synthetic inputs do not establish clinical/low-end performance. Full isolated E2E remains unrun while workflow push permission is pending.

One bounded presentation issue remains queued: a worker module503 is shown as 'Could not read the image. Check the NIfTI file.' The valid file/declaration survives and retry works, but processing-module failure should have specific retry guidance. No data-corruption failure was observed.

The Edge native-app safety check stopped computer use because it could not reliably establish the current browser URL. No200% zoom or native file-dialog cancel occurred, and no retry/workaround was attempted. Subsequent computer/browser acceptance in this turn is stopped; code/source/test work continues independently. The new Edge test tab was opened in the background; its zoom was never changed.
