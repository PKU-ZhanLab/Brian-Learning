# E2 implementation report

Implemented in `F:/project/brain-model/.worktrees/research-20261029`. No staging, commit, browser CLI, Python execution, dependency installation or deployment was performed by this worker.

## Files

Created:

- `src/lib/evidence-schema.js`
- `src/lib/evidence-schema.test.mjs`
- `tests/fixtures/evidence-v1-baseline.json`
- `docs/evidence-schema-v2.md`

Modified:

- `src/lib/research-contracts.js`
- `src/lib/evidence-workspace.js`
- `src/lib/evidence-workspace.test.mjs`
- `src/data/results.js`
- `data-sources/results/curated-results.json`
- `scripts/literature_validate.mjs`
- `src/components/LiteratureWorkspace.jsx` (minimal v2 adapters only)

`EvidenceEditor.jsx` did not require a modification: its existing fields receive the single `getResultViewModel` projection, and the parent saves them through `resultViewModelToEvidence`. No layout redesign or changes to W1/S1 files.

## Interfaces and behavior

`evidence-schema.js` owns `EvidenceBundleV2`, `Reported`, missing-state constructors, independent review events, `validateEvidenceV2`, `migrateEvidence`, `deriveReviewState`, `getResultViewModel`, `resultViewModelToEvidence` and explicit dependent-record deletion. Shared JSDoc contracts were added to `research-contracts.js`.

`evidence-workspace.js` preserves the public validation/merge/load/save/empty interfaces, delegating all versions to the schema boundary. v1 loads are in-memory previews. Explicit successful saves write `brain-model.evidence.v2`, retaining `brain-model.evidence.v1`; corrupt data or failed storage writes preserve original bytes. DOI merges rewrite active reference edges in experiments, readings, claims, mappings, source artifacts, results, nested legacy display fields and review subjects. Unnormalized imported originals remain in `legacyImports`; no top-level original is modified. Existing editing creates a new record version, preserves structured fields and unchanged coordinate dispersion, and prevents previous-version checks from certifying changed content.

Built-in `curatedEvidence` is v2. Existing `curatedResults` consumers receive view models derived from it. Portable JSON matches the v2 bundle. Four results and eight original numeric locations are preserved; all eight retain `MNI-unspecified`. No experiment boundary was inferred. Schaum's result modality remains MEG; time windows/frequency/effects stay not-extracted. Axelrod preserves per-analysis n=13/16, left t=2.57/df=12, text p=.012 versus table p=.01 with different source links and explicit locators, and correction failure. Bosco coordinate SD is represented as between-subject dispersion, separate from unknown localization error.

Original source research was read from `source-dossier.md` and `output/source-research/existing-source-excerpt-candidates.json`. Numerical additions create no fresh source-check, space-check or human-review event. Historical AI checks are retained with missing-material limitations. Human review requires the human actor, name, valid date, scope and version; an AI event cannot become human-reviewed.

## Actual validation

1. Copied the original portable v1 JSON before edits. `Get-FileHash tests/fixtures/evidence-v1-baseline.json -Algorithm SHA256` returned `76078639BB42E23994695D9E6BF922F8200A6305E9E818FE29A7C1E24AC91C2A`, rechecked unchanged after implementation. The fixture's exact byte hash is also asserted in the migration test.
2. Required initial red: `node --test src/lib/evidence-schema.test.mjs` failed with `ERR_MODULE_NOT_FOUND` for `evidence-schema.js`. Coordinate/fixture invariants were already present in that test.
3. Latest targeted green: `node --test src/lib/evidence-schema.test.mjs src/lib/evidence-workspace.test.mjs` returned **20 tests, 20 pass, 0 fail**. Coverage includes original coordinates/unknowns, no inferred experiments, reading-only claims, scoped review, invalid human events, missing-vs-zero values, source safety/ownership, numeric transcription, DOI rewrites, v1 preview/save failure preservation, editor version/reset behavior, dispersion preservation, deletion, metadata-only lookup and corrupt storage.
4. `node scripts/literature_validate.mjs` passed after the final data update: 118 papers, 115 reading records, 4 structured findings, 8 source-checked historical coordinates, frame count `MNI-unspecified: 8`; all 11 audited animal mapping fixes remain intact (8 active brain / 3 hidden spinal).
5. `npm run check` passed during integration: **102 tests, 102 pass, 0 fail**, plus data/hash and literature validation. One final pure-model test was added afterward and included in the latest 20-test targeted pass; the final UI export adjustment removes package-wide legacy snapshots from selected exports.
6. `npm run build` passed (Vite 7.3.7, 1618 transformed modules). Existing chunk-size warning above 500 kB remains. No browser acceptance is inferred from the build.

## Remaining validation and limits

- Root owns CUA acceptance of current result reading, editing, export/reimport and project round trips. This worker did not operate the browser.
- This is schema, migration and compatibility work. E4 still owns source artifact identity/field-level transcription auditing, and E5/E6 own complete portable closure and publication workflows. Source artifacts in the model do not themselves prove semantic agreement with a paper.
- The four result records do not imply four independently established experiments. The original eight locations still have zero direct-template overlay qualification.
- All source checks carried from v1 are historical AI/unknown-actor records with explicit missing-source-material limits. No human or expert review has been provided or claimed.
- Required final commit remains root-owned while workers overlap.

## E2 review fix round 1

Read `.superpowers/sdd/README/E2-review.md` against reviewed E2 base `3ad35f6` and current `63b2cab`. Addressed all four P2 findings with four direct regression tests before implementation.

- Built-in result reversion now supplies `retainedResultIds` to dependent-record removal. The local override and its dependent records are removed, while independently authored relations survive because the built-in endpoint still exists. Actual endpoint deletion still removes its relations. The only `LiteratureWorkspace.jsx` change in this round is the revert call; X6's import/cancel/accessibility changes are preserved.
- Paper ownership is resolved through result reference, experiment reference or result claim. Display and paper pruning share this resolver. Pruning removes the owned experiment-backed results, locations, claims, mappings, artifacts and review subjects; retained unrelated records remain intact. The regression also exercises the selected-paper export's prune-all-other-papers pattern and validates both outputs.
- Statistics validate each entry's object shape before access and pass its own `sourceRefs` through the shared safe HTTP(S)/artifact resolver. Null, primitives, arrays, malformed records, unsafe URLs and unresolved artifact IDs return an invalid `ValidationReport`; a valid artifact anchor is accepted. The public v2 validator guards malformed inputs from throwing.
- The edit adapter treats inherited status fields as display values, never fresh review evidence. It preserves actual review events verbatim with their original IDs/versions and assigns edited records new versions. A changed finding/coordinate remains unchecked even when the caller leaves inherited `source-checked` flags unchanged. A separately supplied explicit fresh `ReviewEvent` for the new version can mark it checked.

Actual commands/output:

1. `node --test src/lib/evidence-schema.test.mjs src/lib/evidence-workspace.test.mjs` after adding regressions and before fixes: **24 tests, 20 pass, 4 fail**. The four failures reproduced null-statistic throwing, relation deletion, dangling experiment-backed pruning and inherited-review restamping.
2. The same targeted command after all fixes and the selected-export regression assertions: **24 tests, 24 pass, 0 fail**.
3. `Get-FileHash tests/fixtures/evidence-v1-baseline.json -Algorithm SHA256`: unchanged `76078639BB42E23994695D9E6BF922F8200A6305E9E818FE29A7C1E24AC91C2A`. Existing coordinate/unknown-state invariants pass in the targeted tests.
4. `git diff --check -- src/lib/evidence-schema.js src/lib/evidence-schema.test.mjs src/lib/evidence-workspace.test.mjs src/components/LiteratureWorkspace.jsx`: exit 0, no output. The component diff was inspected and contains only the authorized revert-call change.

No broad tests, build, browser operation, staging, commit, subagent, data mutation or edits to S4/X6-owned files were performed in this fix round. Existing CUA/E4/E5 limits remain unchanged.

## E2 review fix round 2

Read the appended re-review of `cc55248` on current `a9267cf`. Addressed the explicit-editor-check regression while preserving all round-1 protections.

Added `src/lib/evidence-editor.js` and its focused `.test.mjs` as the pure state and submit boundary actually called by `EvidenceEditor.jsx`. Fresh intent starts empty independently of inherited result/coordinate display flags. Reviewer/tool name, date and scope start blank; actor type starts unknown. Explicit status selections and recheck buttons record only the chosen subjects, while content edits revoke affected check intent. The existing editor now submits `{record, reviewIntent}` through its save callback, and `LiteratureWorkspace` forwards that exact intent to the shared schema adapter.

The adapter requires the supplied actor identity/type, valid date and nonempty scope, validates selected subjects, and creates fresh `source-checked` events with the newly assigned version and the actual subject source link. No status projection alone creates an event. Historical events retain their original IDs, data and versions. Human/AI/unknown actors all remain source checkers here; this UI has no route to `human-reviewed`. Coordinate-only checks remain independent of result checks. For a fresh result check, the compatibility display fields use the supplied reviewer, date and scope rather than inherited provenance.

Touched `EvidenceEditor.jsx`, the save callback in `LiteratureWorkspace.jsx`, `evidence-schema.js`, focused tests and schema documentation. X6 JSON import, cancel and accessibility changes are preserved; other X6/S4 files are untouched. No data or fixture edits.

Actual validation:

1. Initial red after adding the boundary regressions: `node --test src/lib/evidence-schema.test.mjs src/lib/evidence-workspace.test.mjs src/lib/evidence-editor.test.mjs` failed with the new editor boundary module not yet present (`ERR_MODULE_NOT_FOUND`; 8 tests passed, 2 test files failed to load).
2. The final same targeted command passed: **28 tests, 28 pass, 0 fail**. Tests exercise the production submit contract for a new checked result, an edited/rechecked result, explicitly checked coordinates, coordinate-only review, blank fresh reviewer fields, invalid scopes/dates/types, inherited flags producing no fresh checks, and human/AI/unknown actors never becoming human certification. All four round-1 regressions remain covered.
3. `npm run build`: PASS, Vite 7.3.7, 1623 modules transformed. The existing >500 kB chunk warning remains. No browser acceptance is inferred from this build.
4. Owned `git diff --check`: exit 0, no output.
5. `Get-FileHash tests/fixtures/evidence-v1-baseline.json -Algorithm SHA256`: unchanged `76078639BB42E23994695D9E6BF922F8200A6305E9E818FE29A7C1E24AC91C2A`. The targeted migration test also verifies all eight unchanged `MNI-unspecified` points and missing-value invariants.

No broad tests, browser CLI, subagents, staging or commits. Root still owns CUA interaction acceptance and final commit.
