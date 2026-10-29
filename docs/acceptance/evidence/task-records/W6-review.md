# W6 task review

## Spec compliance

- ✅ Source implementation is spec compliant for the reviewed W6 scope and the root-authorized volume-provenance/lossless-layout correction. Reviewed base `bf1d5f19a445b7974f3530fcb26178a037bb9429` → head `a30cc08c33d449db65d85c031a1c5b63693411ff` using the supplied diff. No missing or unauthorized implementation change found.
- ✅ Saved inspection uses recorded classes to derive display geometry, retains original numerical facts, invokes S5's comparator, and never creates a worker; explicit computations receive fresh IDs and retain the original slot (`src/lib/saved-computation.js:78-112`, `src/components/ROICompare.jsx:231-278`). App stages history through the existing capacity/storage boundary and checks request/project freshness before publication (`src/App.jsx:222-229`).
- ✅ V1 migration delegates evidence migration, creates only a container identity, clears the computation trigger, and leaves missing history absent (`src/lib/workspace-project.js:235-238`). Named historical slots require the originating project; public encoding removes the slot and decoding forces `none` (`src/lib/workspace-project.js:57`, `src/lib/workspace-project.js:82`, `src/lib/workspace-project.js:96`; regressions at `src/lib/workspace-project.test.mjs:252-258`).
- ✅ The bounded project envelope reuses S5 validators/hashes. Exact layout restoration precedes voxel-digest verification, preserves both supported orders, and retains the distinction between original-source hash records and verified embedded decoded bytes (`src/lib/workspace-project.js:115-175`, `src/lib/workspace-project.js:256-274`). Metre/micron, precision/shear, asymmetric order, unknown-space, signed-zero, and contradictory-header cases are exercised by actual codec fixtures (`src/lib/workspace-project.test.mjs:279-318`). The initial strict precision/order rejection is superseded, not accepted as a limitation.
- ⚠️ Browser acceptance and genuine human scientific review remain incomplete in the evidence supplied to this review. The four authored browser cases are substantive but explicitly unexecuted (`tests/e2e/workspace-reproducibility.spec.mjs:1`, `tests/e2e/workspace-reproducibility.spec.mjs:24-48`; `.superpowers/sdd/README/W6-report.md:66`). Root must attach permitted CUA acceptance evidence and keep genuine human review pending until it actually occurs; source approval is not completion of those gates.
- ⚠️ Complete failed-import preservation across all live editing surfaces and later X5 draft integration are cross-task/runtime requirements. W6 retains the existing staged commit boundary; the supplied diff alone cannot certify every browser state or future X5 integration (`src/App.jsx:223-229`, `.superpowers/sdd/README/W6-brief.md:85`).

## Strengths

- History and displayed geometry are separated instead of treating an overlay as the authoritative snapshot (`src/App.jsx:222`, `src/lib/saved-computation.js:109-112`). Regressions compare real IDs, metrics, classes, and original object preservation rather than only checking method calls (`src/lib/saved-computation.test.mjs:90-110`).
- The provenance extension exports the existing canonical validators instead of introducing a second identity/hash implementation (`src/lib/computation-manifest.js:10-22`). Layout and provenance are individually bounded and included in aggregate admission before binary export (`src/lib/workspace-project.js:141-158`, `src/lib/workspace-project.js:179-213`).
- Current observations are explicitly scoped to the project entry and do not backfill absent historical manifests (`src/lib/workspace-project.js:269-271`, `src/lib/workspace-project.test.mjs:245-250`).

## Issues

### Critical

- None found in the reviewed task scope.

### Important

- None found in the reviewed task scope. Outstanding browser/human acceptance is reported above and must remain open.

### Minor

- Build output is not warning-free: static/dynamic `volume.js` imports prevent chunk separation, and bundles exceed the 500 kB advisory (`.superpowers/sdd/README/W6-layout-build-public.log:10`, `.superpowers/sdd/README/W6-layout-build-public.log:22-25`). These are reported existing advisories, not evidence of a new W6 correctness defect; retain them for the performance/build workstream rather than claiming pristine build output.
- One focused run stalled, with cause unresolved (`.superpowers/sdd/README/W6-report.md:82`). The unchanged retry and integration pass provide useful final evidence, but do not establish that the stall was fixed. Preserve this qualification; investigate a reproducible recurrence rather than rerunning broad suites without a named doubt.

## Checks and limits

- Reviewed the supplied diff in one logical pass; the initial oversized tool response truncated long lines, so omitted ranges were recovered from that same diff. No source diff was regenerated and no repository crawl was performed.
- Named outside-diff risk: committing a computation might notify the asset registry and invalidate its own active request. Checked `src/lib/workspace-session.js:50-61,70-77` and `src/lib/custom-volumes.js:29-34`: unchanged assets produce no replacement and no registry notification; the suspected regression is not present.
- Named outside-diff risk: restoring an exact affine might leave a stale rounded inverse/sampler on the decoded object. Checked the NIfTI return shape (`src/lib/nifti.js:158`) and geometry consumers (`src/lib/volume.js:20-32`, `src/lib/roi.js:218-227`): parsed NIfTI has no cached inverse, and consumers derive it from the restored affine; the suspected regression is not present.
- Read the final supplied evidence: focused **117/117** (`.superpowers/sdd/README/W6-layout-focused-retry.log:119-126`), full check **229/229** (`.superpowers/sdd/README/W6-layout-check.log:279-286`), and successful public build with 173 hashed assets and 36 official-source descriptors (`.superpowers/sdd/README/W6-layout-build-public.log:26-27`). Read the root's pre-correction metre-unit witness as well. No tests or browser actions were rerun by this reviewer.

## Assessment

**Task quality: Approved.** The reviewed source preserves historical facts, separates explicit recomputation, and handles the required lossless project representation through bounded shared contracts. Approval is for W6 implementation quality; browser acceptance and genuine human review retain their stated incomplete status.
