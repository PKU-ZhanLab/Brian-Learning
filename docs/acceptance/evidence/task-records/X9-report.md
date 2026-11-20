# X9 implementation and evidence

Status: implementation and Node verification complete; actual browser acceptance remains pending. No commit, browser/desktop execution, installation, Python, or subagent was performed by this implementer. Root owns Git, CUA, final review and the remaining browser acceptance.

Base: `fae05b6` (runtime baseline `e531eb1`). Read `X9-brief.md` and `X9-integration-context.md` first. Used executing-plans, test-driven-development and verification-before-completion guidance, with root's explicit single-implementer/no-commit/no-browser rulings taking precedence over generic skill dispatch/commit steps.

## Files and ownership

- Created `src/workers/nifti.worker.js`: delegates to the canonical W1 parser/writer; gzip uses platform compression streams; publishes only completed results and transfers only buffers newly allocated inside this worker.
- Created `src/lib/nifti-worker-client.js`: specified parse/export interfaces; one worker per operation; AbortSignal termination; phase progress; worker/load/deserialization failure rejection; never transfers caller-owned buffers. Test-only workerFactory adapts transport to real Node worker_threads.
- Created `src/lib/nifti-worker-client.test.mjs`: ten tests, including actual worker-module execution, canonical equality/budgets, abort/retry, no partial output, unchanged buffer lengths/SHA256, current-file/project/revision guard and original source-byte identity, and actual session preservation.
- Modified `src/lib/nifti.js`: extracted the existing compressed/input-byte admission into shared `assertNiftiFileSize`. Header, voxel, geometry, datatype, scaling and inflated/decoded budget logic remains canonical and unchanged.
- Modified authorized `src/lib/roi-import-state.js`: injectable parseVolume/onProgress/AbortSignal handoff in the one existing stageVolumeImport path. Original selected bytes remain attached and reach prepareLocalVolumeProvenance. Its check still runs after decoding/label reads/provenance and through the host's final commit guard. Existing Node tests retain default canonical parser.
- Modified `src/components/ROICompare.jsx`: actual browser import supplies the worker parser; cancellable import retains declarations, aborts on draft changes/unmount and retains W2 admission guards. Mask NIfTI export uses the worker and downloads only a complete current result; explicit cancellation and unmount terminate export. Import/export messages and controls are bilingual.
- Modified `src/App.jsx`: measured entry size justified local lazy/Suspense boundaries for BrainScene, SliceViews, LiteratureWorkspace, ROICompare, AtlasExplorer and WorkspaceFiles. Host dialogs, state, focus ownership, manifests and scientific identities stay outside those boundaries. Local load-error boundaries keep App/session/navigation available if an optional chunk fails.
- Modified `vite.config.js`: module-worker output format `es`; no chunk warning suppression.
- Created `scripts/profile-workspace.mjs`: pure measurement-artifact/bundle summarizer; no browser launch, profile connection, storage mutation or driver timing. Browser metrics default to null with reasons. Browser observations require explicit environment, input, method and evidence provenance; separate runs remain separate.
- Created `tests/e2e/performance.spec.mjs`: five isolated-runner cases, listed below. Authored and discovery-checked only.
- Root explicitly extended ownership to only the font import in `src/styles.css` and optional font link in `index.html`. Removed the blocking CSS @import, made Google Fonts stylesheet optional/nonblocking through print media switched after load, and retained existing system fallback families. Content/layout do not wait for font success. Blocked-font rendering/layout-shift verification is authored, not executed.

## RED → GREEN

1. Wrote worker-client tests first and ran `node --test src/lib/nifti-worker-client.test.mjs`: exit 1, `ERR_MODULE_NOT_FOUND` for the new client. This established the missing interface.
2. Implemented client/worker and ran the same command: 6 passed, 1 failed. Actual failure: `worker crash and cancelled worker admission leave the actual session unchanged` → `Missing expected rejection`. This showed the existing stageVolumeImport still bypassed the injectable worker and parsed synchronously.
3. Added only the authorized existing-stage adapter. Ran `node --test src/lib/nifti-worker-client.test.mjs src/lib/roi-import-state.test.mjs`: 17/17 passed.
4. Added actual current-guard/source-provenance coverage, abort-at-completion and message-deserialization failure tests. One new test initially compared the original file hash against the derived-volume identity. Inspection of canonical S5 showed original byte identity belongs in `sourceIdentities[0]`; corrected that test assertion without changing S5 semantics. This was a test consumer error, not a provenance implementation fix.
5. Final targeted command `node --test src/lib/nifti-worker-client.test.mjs src/lib/roi-import-state.test.mjs`: 20/20 passed, zero skipped/cancelled. Ten new worker tests plus ten retained import-state tests.
6. Final `npm run check`: **347/347 passed**, zero failed/skipped/cancelled; data and literature checks also passed. Full output: `.superpowers/sdd/README/X9-check.log`.
7. Final `npm run build`: exit 0, Vite v7.3.7, 1,667 modules. Full output: `.superpowers/sdd/README/X9-build.log`.
8. `npm run test:e2e -- tests/e2e/performance.spec.mjs --list`: exit 0, **5 tests discovered**. This command lists tests and does not launch a browser. The full browser execution command was deliberately **not run**, per the explicit implementation scope. This is not an e2e pass claim.
9. `node scripts/profile-workspace.mjs --measurements output/x9-profile/node-worker-and-staging.json`: exit 0; writes `output/x9-profile/workspace-profile.json`. Result: entry reduction 0.0957540495; all browser metrics null; browserMeasured false; cancellation/interaction acceptance null.

## Input and environment identities

Baseline preserved: `output/x9-profile/baseline-node-and-bundle.json`. Actual new Node observations: `output/x9-profile/node-worker-and-staging.json`. Summary: `output/x9-profile/workspace-profile.json`. None is a browser profile.

Same input inventory, same i9-13900K / 32 logical CPU / 68,387,856,384-byte RAM Windows 10.0.26300 machine, Node v24.15.0. Inputs read from local filesystem; no network throughput claim.

| Input | Shape | NIfTI bytes | SHA256 |
|---|---|---:|---|
| small.nii | 64³ | 524,640 | aa90e56ab0b586cdb05c050ac889fb7e85fc081492144ad301b0b616623c7d57 |
| typical.nii | 128³ | 4,194,656 | f1e17f7d0d7b6063bcf9c84695f167a8607d1edd84873021a9b486c0316c6279 |
| near-limit.nii | 400³, 64,000,000 voxels | 128,000,352 | fc320b750815e518954da548350091c97d1589c0836e3510d3d5276d61d4c709 |

These valid Int16 synthetic inputs were root-provided baseline artifacts. All newly measured input byte lengths/hashes match them. They are synthetic, highly compressible inputs, not representative clinical image entropy.

## Node measurements and limits

Single samples; these are elapsed real Node-worker roundtrips, including worker startup, structured cloning, worker work and result handoff, **not speedup, browser interaction p95, browser UI feedback or low-end device evidence**. The original canonical baseline ran synchronously in one Node process and is not directly comparable as a speed benchmark.

| Input | Baseline canonical parse/export ms | Worker parse/export roundtrip ms | Abort → rejected promise ms |
|---|---|---|---:|
| small | 4.684 / 2.432 | 24.375 / 21.394 | 0.224 |
| typical | 18.860 / 8.775 | 36.536 / 37.559 | 0.070 |
| near-limit | 476.896 / 236.106 | 520.579 / 579.104 | 0.134 |

Cancellation is requested after the actual worker emits `parsing`; termination rejects immediately and subsequent messages cannot publish data. This metric measures client rejection only, not worker OS teardown completion or a rendered cancel notice. Input and volume hashes/lengths stayed unchanged for every measurement. Peak RSS for the worker measurement process was **713,460 KiB**, a process-wide high-water mark; it is not a per-task/browser heap peak. No arbitrary main-thread input buffer is detached.

Measurements were produced with read-only local Node modules: worker_threads adapts only `self.addEventListener`/`postMessage`; the production worker module and W1 parser/writer run unchanged. Each input was read, SHA256 hashed, worker-parsed, data hashed, worker-exported, aborted on a separate parsing request, then both hashes/lengths checked. The full values, method scope, time, device and raw samples are preserved in the observation JSON; no browser driver or user storage was accessed.

### Carried unchanged-asset navigation cost

Used actual canonical prepareLocalVolumeProvenance, createWorkspaceSession and stageWorkspaceChange with a synthetic already admitted current session containing one real imported volume, no saved ROI snapshot, and in-memory storage adapter. This is a representative synthetic current-session measurement, not the user's live browser session.

- Typical 4,194,304-byte voxel asset: five view-only stages took **28.750, 28.979, 28.847, 28.943, 28.732 ms**. Canonical full project codec still ran; compressed project text ~8,459 bytes; current volume array was reused. Commit timing excluded.
- Near-limit 128,000,000-byte voxel asset, separate process: canonical original/derived provenance **246.980 ms**; initial W2 stage **876.452 ms**; three unchanged-volume navigation stages **1,106.872, 1,100.518, 1,079.449 ms**. Current volume array reused; full compressed project ~168,962 bytes. Process-wide high-water RSS **1,079,848 KiB**. Commit timing excluded.

This is measured evidence of a remaining cost: near-limit sessions cannot be claimed to meet the common-interaction ≤200 ms target, and main-thread canonical provenance/admission, plus ROI mask construction before export, remain possible cancel-feedback delays. No W2 codec or mutable-object identity cache was added.

Concrete proposed owner extension, sent to root but not implemented: W2 could define a validated view-only staging path retaining its reference/revision/storage admission and atomic publication, explicitly refusing asset/snapshot/evidence edits and avoiding the full exported-projectText obligation for navigation. It needs an owner-defined immutability/mutation contract and meaningful changed-buffer regression coverage; reuse by array identity alone is unsafe. The full project export/import path must remain canonical. No authorization to alter W2 was assumed.

## Bundle evidence

Entry: **2,163,167 → 1,956,035 bytes**, **9.5754% reduction**. New dedicated NIfTI worker ~11 kB. Heavy workspaces now have independent chunks; Three remains **516,020 bytes**. These byte measurements establish splitting, not faster first paint.

The build truthfully still warns about >500 kB chunks and static/dynamic `volume.js` mixing. App and multiple panels require shared volume/query utilities; S3 also intentionally resolves volume.js dynamically. This task does not move identity-critical utilities or change S3 ownership just to remove a warning. Warnings were not hidden or budgets raised. Further entry size remains dominated by eagerly required shared data/application dependencies; defer broader source/data redesign to their owners and browser evidence.

## Browser acceptance still required

All `coldStartMs`, `warmAtlasSwitchP95Ms`, `interactionP95Ms`, `cancelFeedbackMs`, `peakHeapBytes` remain **null with reasons**. Targets are cancellation feedback ≤1,000 ms and common location/selection p95 ≤200 ms. Neither is graded passed without actual permitted measurements on the fixed device/network/input inventory. CPU throttling in authored CI tests also does not reproduce a real low-end device.

Five discovered e2e cases:

1. Block optional Google font hosts; assert content/import control/navigation accessible and no horizontal overflow; attach browser-observed layout-shift sum and actual fallback family. No invented CLS threshold.
2. Fail optional ROI panel module download; local failure feedback preserves App/navigation.
3. Delay only the dedicated worker module in isolated runner; cancel import, verify no registered asset and retained declaration, retry successfully.
4. Admit a small asset, then fail the NIfTI worker download; exact durable envelope/current asset remains, retry uses same stage path.
5. Real browser worker operations for 64³/128³/400³ under 4× CPU throttling; hashes/lengths preserved, no cancelled result, attach browser-clock worker roundtrips/rejection. Input identities are explicitly recorded and are not silently equated to baseline files. It explicitly does not claim end-to-end admission/UI feedback or peak heap.

Remaining root/CI checks: run those cases only in the permitted isolated browser; actual CUA small/large import cancellation/error/retry and exported masks; first render and warm atlas switch; scientific location/selection interaction samples/p95; browser-wide memory peak including worker; optional font failure and delayed success/layout shifts; focus continuity through lazy dialogs; same-baseline remeasurements. Root may author a bounded development-only performance observation hook if needed; this implementer has not injected any browser control/instrumentation into production.

The parser's 128 MiB compressed/file cap, 64,000,000 voxel limit, canonical decoded budget and workspace payload admission do **not** imply browser durable quota. Existing root native-quota evidence (~5.21 MB envelope plus 40k draft fails atomically) remains separate and valid. Near-limit parser success is not end-to-end durable/project admission certification. Complete current and pending work must continue to survive any failed admission.

No original assets, baseline artifacts, historical output or other implementers' code was removed. No source commit or deployment was made. Browser acceptance, the measured W2 near-limit bottleneck and surviving bundle warnings remain explicit review concerns.

## Round 1 lifecycle corrections (review base cd7e10e)

Read `X9-review.md` first and addressed both P2 findings. Root supplied actual pinned-build RED evidence in `output/x9-cua/lazy-import-red.json`/PNG and `late-export-red.json`, with the late stale `late-old-mask-red.nii` plus worker-delay HTTP log. Those are root observations, not browser runs performed by this implementer. No W2 fast path was authorized or added.

### Import task lifecycle

The one-frame document lookup is removed. App now begins a unique task intent scoped to project/epoch, retains it through lazy loading, and passes that intent to ROICompare. The real file input's layout effect reports mount readiness (including warm/repeated entry); App schedules the details-open/focus handoff on the next frame, after DialogHost's queued return-focus cleanup. No pre-input frame consumes the intent.

Unrelated navigation, history travel, restored views/projects, mode departure and App unmount cancel both pending intent and any scheduled focus. Readiness from an old token/project is ignored; disconnected or inert inputs cannot steal focus. The token is consumed once. A current warm entry still requests the same handoff rather than depending on module download timing.

The transient state helper lives in the existing relevant `src/lib/roi-import-state.js`; it does not store drafts/volumes or create a parallel project/navigation codec. Four focused tests in its existing test file verify delayed readiness across empty frames, warm readiness after cleanup, departure before readiness/before scheduled frame, and stale visit/project signals.

### Comparison/export lifecycle

ROICompare now uses a shared `replaceComparison` operation that invalidates outstanding export work before every scientific comparison clear/replacement, including explicit recomputation, initial-state restoration, automatic selection/registry replacement, inspection and completion. Selection/registry invalidation runs during layout effects, before a commit can leave a hidden old task active. Initial-state changes also invalidate before their null-state early return.

The transient task helper in existing `src/lib/roi-region-state.js` binds an export to its captured comparison and AbortSignal. Invalidation both aborts the worker and makes late continuations ineligible to download. A late task's finally cannot clear a newer task's busy state. Explicit Cancel and component unmount use the same invalidation. Display-only opacity/mode edits retain the same scientific classes/grid and do not cancel an otherwise valid mask export.

Thus recomputation may remove the old export control only after synchronously invalidating/aborting its task. It cannot leave a hidden active task that later downloads an old generic filename. Two focused async/task tests verify a delayed old result produces no download after invalidation, a subsequent current export succeeds, and late completion cannot clear that newer export.

### Round 1 verification

- RED: `node --test src/lib/roi-import-state.test.mjs src/lib/roi-region-state.test.mjs` exited 1 before helper implementation: both suites rejected missing `createImportTaskHandoff`/`createComparisonExportTasks` exports.
- GREEN after implementation: same command passed **18/18** tests, zero skipped/cancelled.
- Integrated focused verification: `node --test src/lib/roi-import-state.test.mjs src/lib/roi-region-state.test.mjs src/lib/nifti-worker-client.test.mjs` passed **28/28**, zero skipped/cancelled. This covers actual worker byte/budget/staging invariants as well as new transient lifecycle logic.
- `npm run build > .superpowers/sdd/README/X9-round1-build.log 2>&1`: passed, 1,667 modules; current entry ~1,959.50 kB. Existing `volume.js` static/dynamic and >500 kB warnings remain visible.
- `npm run check > .superpowers/sdd/README/X9-round1-check.log 2>&1`: passed **353/353**, zero failed/skipped/cancelled, with data/literature checks passing.
- `npm run test:e2e -- tests/e2e/performance.spec.mjs --list`: passed, **8 discovered** cases. Added delayed first Import image plus warm visit, leaving before lazy resolution then generic ROI entry (no stale focus/open), and delayed export → recompute → no old download → successful current export. The other five cases remain. Browser cases were authored/discovery-checked only; no full browser test command was executed by this implementer.

Round 1 edited only `src/App.jsx`, `src/components/ROICompare.jsx`, the two existing relevant ROI state modules/tests, `tests/e2e/performance.spec.mjs`, and this report/log evidence. Root retains CUA/Git/re-review ownership. Actual corrected browser focus/no-stale-download acceptance is pending root; Node tests are not represented as a browser GREEN. Near-limit ~1.1-second canonical W2 navigation remains documented performance debt under the plan fallback clause, not a correctness waiver or a passed p95/cancellation gate. Browser timing/peak-memory values remain unmeasured/null until permitted root observations supply them.

## Bounded processing-error copy correction (base 65128f9)

Root subsequently reported actual fixed-runtime CUA passing cold/warm/leave-before-resolve focus, stale-mask suppression after recompute and a subsequent exact seven-voxel export, real 128,000,352-byte input cancellation retaining the prior asset, same-file retry with 64 million exact voxels, and worker HTTP503 retaining declarations/retry. These are root-reported observations; this implementer did not execute a browser. Root's `output/x9-cua/worker-failure-ui.json` exposed one presentation problem: a valid source with a failed worker module displayed file-corruption/check-NIfTI advice.

Changed only ROICompare's error presentation plus its existing performance-test assertion:

- `nifti-worker-*` errors (load/crash, message/deserialization, invalid response/task) now receive the same concise processing-task feedback for import and mask export. It does not assert a network cause or file corruption.
- Chinese: `影像处理模块未能完成任务。当前输入仍保留，请重试。`
- English: `The image processing module could not complete the task. Your inputs are retained; please retry.`
- Canonical file-validation and budget messages, selected inputs, retry logic, staging and persistence are unchanged. Existing worker-failure e2e still asserts the exact durable envelope/current asset and successful retry; its alert assertion now checks the specific processing message.

Validation: `npm run build > .superpowers/sdd/README/X9-processing-copy-build.log 2>&1` passed (Vite build, 1,667 modules; existing size warnings remain). `npm run test:e2e -- tests/e2e/performance.spec.mjs --list` passed, eight cases discovered without browser execution. No mirror unit test was added for this copy-only edit, and the full suite was not repeated. Root CUA was stopped this turn by the automatic native URL check, so **the new message was not visually retested**. No browser, installs, Python, subagents or Git commit were performed here. No S6 or other implementation changes were reverted.
