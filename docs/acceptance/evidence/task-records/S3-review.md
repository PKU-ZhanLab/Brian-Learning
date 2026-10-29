# S3 review — f4c17aa..2912228

## Spec Compliance

- ✅ The inspectable S3 implementation matches the requested modules and integration points. Full query replacement and rejection checks are implemented in `src/lib/query-state.js:7-17`; identity-bound query gating is used in `src/App.jsx:115-116`, `src/components/BrainScene.jsx:933-945`, and `src/components/SliceViews.jsx:29-38`. All requested production files and all three requested test files have corresponding hunks.
- ✅ Moving a coordinate or slice invalidates query data and active label highlighting (`src/App.jsx:174-177`); source changes discard the queryable volume and invalidate the query (`src/App.jsx:135-150`). Cortical queries travel separately from geometry readiness (`src/components/BrainScene.jsx:759-762`). Decimal slice coordinates are preserved (`src/components/SliceViews.jsx:11-15`).
- ✅ Shared manifest/volume resources deduplicate pending work, preserve an observable failure during recovery, reject obsolete generations, and expose explicit retry (`src/lib/atlas-resource.js:35-57`). The App retry handler does not call a project-change/import writer (`src/App.jsx:273`). Native slice-pair behavior is retained and unspecified/null spaces receive additional rejection checks (`src/lib/volume.js:153-170`; `src/lib/atlas-slices.test.mjs:5-12`). No scientific or human-validation status upgrade is introduced by this diff.
- ⚠️ Required interaction acceptance remains open. The e2e file is authored and syntax-checked, not browser-passed (`tests/e2e/spatial-query.spec.mjs:1-81`; `S3-report.md`, Desktop/CI acceptance anchors). Root separately reports that pinned-head CUA recovered an initial 503 with one retry and displayed the correct DK identity. Note/evidence preservation, delayed completion, loading-time clicks, fractional slice movement, camera restoration, and native T1 viewing still need the controller's completed evidence before marking S3 fully accepted.
- ⚠️ A→B→A and white-matter visibility preserving cortical label identity are not directly asserted by the authored e2e scenarios: the delay scenario ends in BA (`tests/e2e/spatial-query.spec.mjs:21-42`). The controller should include these explicit brief cases in its focused interaction acceptance. Unit request-ID checks help but do not substitute for those interactions.
- ⚠️ Failed-import atomicity and unchanged native geometry/scientific provenance outside the touched paths are not independently revalidated by this task-scoped diff review. The diff retains the transactional import code; no import acceptance claim is inferred from the Node tests.

## Strengths

- `src/lib/atlas-resource.js:46-55` publishes the shared pending promise before notifying subscribers and uses a generation guard even when abort is ignored; the reentrant subscriber and late-generation tests exercise actual resource behavior (`src/lib/atlas-resource.test.mjs:29-39,46-53`).
- `src/lib/volume.js:101-146` preserves byte/catalog/transform verification behind versioned loading. The authorized S5 test adaptation still corrupts real volume and transform bytes and checks observable error state, rather than replacing digest checks with an assertion about metadata (`src/lib/computation-manifest.test.mjs:49-72`).
- `src/App.jsx:178-190` retains dictionary-bound selections separately from current spatial query data, preserving annotations while active query/highlight state can be invalidated.

## Issues

### Critical (Must Fix)

- None found in this task-scoped review.

### Important (Should Fix)

- No proven production defect found. This is a static code-quality clearance, not closure of the pending interaction gate above.

### Minor (Nice to Have)

- `src/lib/atlas-resource.js:27`: the dynamic import of `volume.js`, combined with the existing static imports of that module, introduces a Vite mixed static/dynamic import warning. The actual warning is present in `S3-build.log:9-10`; `S3-report.md` mentions only the pre-existing large-chunk advisory. This does not establish a runtime failure, but the build is not warning-clean and the import supplies no separate chunk. Record the warning accurately, and consider an explicit loader-registration boundary or a small dependency-neutral loader module if removing the cycle later. Do not imply that this dynamic import provides bundle splitting.

## Assessment

**Task quality: Approved, with the Minor build-hygiene finding above.**

**Spec acceptance: Pending the controller's required interaction evidence.** No code blocker was established from the reviewed diff.

**Evidence inspected:** task brief, implementation report, reviewer template, complete supplied diff, targeted test-log footer (23 passed; 0 failed/skipped), and the build warning/success lines. No tests/build/browser were rerun; no production files, index, HEAD, or branch state were changed.

**Focused checks outside the diff:**

- Named risk: keyed scene retry could fail to restore the staged camera. Inspected only the relevant `BrainScene.jsx` readiness callbacks (`250`, `826-829`, `909-910`, `933-942`) against the App retry/restore code already in the diff (`src/App.jsx:202-205,273,294`). Normal remount loading publishes `loaded:false` before `loaded:true`; no deterministic camera regression was established. Actual camera restoration remains a controller interaction check.
- Named risk: the imported-volume identity bridge might manufacture spatial verification. Inspected `prepareLocalVolumeProvenance` (`src/lib/computation-manifest.js:75-81`) and custom-volume metadata references. Existing spatial evidence retains `user-declared` and its independent-verification limitation; the new bridge copies the existing identity rather than supplying a human/registration certification.
- Named risk: eagerly keyed manifest consumers might request a placeholder identity before auxiliary metadata resolution. Inspected only the main manifest's atlas identity/data/metadata/space/overlay fields. Current enabled builtin entries already contain the identity fields and concrete data paths; no current placeholder-key failure was established. This is not a general acceptance claim for future manifests.

**Review limits:** the first combined tool response truncated the large diff output. Its omitted sections were read as bounded sections of the same supplied diff; no Git diff was regenerated. Current-code inspection outside the diff was limited to the named risks above. Earlier camera-repair memory supplied historical context only and was not treated as current validation evidence.
