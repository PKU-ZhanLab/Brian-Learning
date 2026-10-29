# S4 implementation report

Status: implementation ready for review; desktop CUA acceptance is owned by root and remains pending here. No staging, commit, browser CLI, Python, dependency installation, source-binary changes or geometry changes.

## Changed files

- `src/lib/roi-grid.js`: `makeComparisonGrid(reference, resolutionMm)` accepts only declared 1/2 mm NLin6Asym RAS x-fastest grids; rejects unsupported resolution/reference geometry. Exports `inspectROISampling` using the exact shared sampler.
- `src/lib/roi.js`: source and target selected counts/physical volumes; per-label `labels` counts, `lostLabelIds`, `absentLabelIds` and four required statuses. `compareROIs` includes `sampling.A/B`; nearest-neighbour labels/masks, trilinear continuous maps, zero exclusion and 8,000,000 target cap remain.
- `src/lib/roi.worker.js`: request-linked `preflight`/`complete`; loss pauses until confirmation, absent source blocks, stale confirmation and cancelled preflight cannot complete.
- `src/components/ROICompare.jsx`: default 2 mm selector, explicit 1 mm choice, grid and source/target volume table, per-label loss/absence information, loss confirmation/cancellation, sampling in CSV. Grid is included in state callbacks and restore initialization as `resolutionMm`; grid/selection/registry changes invalidate old results and worker generations. Empty target does not show the disjoint-nonempty “intersection empty” sentence. Output spacing/registration accuracy caveat is visible.
- `src/lib/roi-grid.test.mjs`, `src/lib/roi.test.mjs`: actual source label 134, partial loss with actual labels 133/134, absent source, nonempty disjoint labels, declared grids, NIfTI round trips and worker confirmation/cancellation.
- `tests/e2e/roi-grid.spec.mjs`: isolated browser cases for 2 mm confirmation/cancel/empty-target wording, 1 mm exact self comparison and downloaded mask, grid invalidation, delayed real-worker message rejection after cancellation. Authored and syntax checked; not executed in this desktop task.

## Observed verification

1. RED: `node --test src/lib/roi-grid.test.mjs src/lib/roi.test.mjs` -> 15 pass / 1 fail, expected `ERR_MODULE_NOT_FOUND` for new `roi-grid.js`.
2. GREEN after grid/sampling implementation -> 20/20 pass.
3. RED worker regression: `node --test src/lib/roi.test.mjs` -> 15 pass / 1 fail; received undefined `phase` instead of `preflight`.
4. Final targeted run: `node --test src/lib/roi-grid.test.mjs src/lib/roi.test.mjs` -> 21/21 pass, 0 fail, approximately 1.92 seconds.
5. `npm run build` -> exit 0, Vite production build; existing bundle-size warning remains.
6. `git diff --check -- src/components/ROICompare.jsx src/lib/roi.js src/lib/roi.test.mjs src/lib/roi.worker.js`, `node --check src/lib/roi-grid.js`, `node --check tests/e2e/roi-grid.spec.mjs` -> exit 0.

Actual fixture: `public/data/aal-v3/aal3-fsl1mm.bin`, metadata `manifest.atlases['aal3-registered']`. Label 134: source 7 voxels / 7 mm³; 1 mm self comparison A=7, intersection=7, Dice=1; 2 mm self comparison A=0, intersection=0, Dice=null, status=`empty-target`, lost=[134]. Actual labels 133+134: source=15, target remains nonempty, lost=[134], status=`partial-loss`. Absent label 999 is `empty-source`, absent=[999], lost=[]; no fake point is inserted. Existing DK/Juelich BA4a 2 mm baseline remains A=1732, B=1065, intersection=57. Selected-grid NIfTI masks preserve shape, affine and counts at both spacings. Oversized surface omission preserves exact existing metrics/masks regression.

## Rulings and integration notes

- Ruling: absent valid source labels are represented by `sampling.status='empty-source'` rather than the previous generic `empty-label` exception, so source absence can be distinguished from target loss. Background/invalid selection/alignment/geometry rejection remains. A mixed present+absent selection is `partial-loss` with explicit `absentLabelIds`; the worker blocks it. Root acknowledged this interface choice.
- Ruling: `SamplingReport` includes additive `labels` and `absentLabelIds` fields beyond the required base fields. This supports truthful per-label volumes and identifies absence without conflating it with disappearance during resampling.
- Preflight resamples without surfaces and final computation resamples again after permission (or immediately for retained inputs). This favors a simple auditable gate over caching transferable buffers; no sampling approximation is introduced.
- S5 can consume `sampling`, full chosen result grid and preserved descriptors. No identity/provenance fabrication or project/schema changes were made. Persistence integration should retain `resolutionMm`; current component emits/restores it, while project/view schema remains assigned elsewhere.
- No automatic scientific accuracy claim follows from target count changes, unit tests or build. CUA and isolated CI browser execution remain unverified in this report; `npm run test:e2e -- tests/e2e/roi-grid.spec.mjs` was intentionally not run under the brief's desktop-browser restriction.
