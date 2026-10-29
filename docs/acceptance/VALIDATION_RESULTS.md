# G1 validation results

Current working implementation started from b73910b22f7b44d49a7ec0bd692682349372ccef. Final root commit/candidate remains pending. This file records actual commands only; no browser executed in G1.

| Action | Status | Receipt / scope |
|---|---|---|
| New release verifier and English-directory regressions | pass | output/g1-focused3.txt;8/8 at that intermediate scope; final integrated result below |
| Stale S6 lock refusal after version-only manifest change | pass (expected refusal) | output/g1-qc-stale.txt: main-manifest locked input hash mismatch |
| Explicit current registry/assessment refresh | pass | output/g1-qc-regenerate.txt; original three files preserved in evidence/pre-4.2.0/ |
| Spatial QC --check and segmentation --check | pass | output/g1-qc-check.txt / g1-segmentation-check.txt; partial/human=false/14 gaps/0 eligible unchanged |
| G1 two authored E2E files --list | pass discovery only | output/g1-e2e-list.txt;5 tests; runtime not-run |
| Final full npm run check | pass | output/g1-final-check-post-receipt.txt;414/414; data/literature validators passed |
| Final public build and builder output receipt | pass | output/g1-final-build-post-receipt.txt;174 data assets,36 descriptors,16 fixed result pages; existing chunk warnings |
| Final dirty-tree artifact verification | pass (narrow scope) | output/g1-final-release-verify.txt;222 files, no missing/extra/changed;clean=false/exactCommit=false |
| Portable source probe check/build/closure | pass (intermediate source snapshot) | output/g1-package-check-green.txt414/414;package-test-green1/1;package-build-green + package-verify-green; transformed-source-package, not exact commit |
| Isolated prototype source fixtures | pass | output/g1-prototype-fixture.txt;3/3;no browser/GPU claim |
| All authored E2E discovery | pass discovery only | output/g1-all-e2e-list.txt142 cases/22files;g1-public-e2e-list.txt13 dedicated cases;no browser executed |
| Final QC and segmentation --check | pass software / partial scientific | output/g1-final-qc-check.txt / g1-final-segmentation-check.txt;scientific verdicts unchanged |
| Browser/desktop/native200%/filecancel/reader | not-run | Same-turn UI stop remains binding |
| Independent researchers and human source/anatomical review | pending-review | No actual participant/reviewer records available |
| Public4.2.0 deployment | not-run | Push approval unresolved; metadata-only live4.1.0 evidence remains version-scoped |

Historical task output paths remain preserved; selected real receipts and exact task/review/CUA records are snapshotted under evidence/ with SHA256 inventory. Earlier red failures and narrowed green retests are not erased. The bounded metadata refresh changed only application version and the associated current QC input/registry hashes; it does not improve scientific verdicts.

## Failure witnesses preserved

The first portable probe failed: its new closure test tried to read intentionally excluded candidate-cache inputs; npm check reported413/414 because existing build tests generated ignored .superpowers scratch and the new source walker treated that as source changes. Both red logs remain output/g1-package-test.txt and g1-package-check.txt. The closure now validates every noncache lock plus exact cache preparation/exclusion declarations. Only documented generated scratch roots are omitted from source identity; new unexpected source/config/root files still fail. A synthetic scratch witness was observed RED in g1-scratch-red-bounded.txt then GREEN in g1-scratch-green.txt. One unbounded RED invocation stalled with no output and its two verified owned Node test processes were stopped; the bounded rerun produced the concrete expected failure. No evidence was deleted.

The completeness witness deleted an application entry before creating a new expected release; the old verifier incorrectly accepted it (g1-output-receipt-red.txt). The builder now independently records all output files in build-files.json; expected-manifest creation rejects missing output (g1-output-receipt-green.txt,3/3). The full414-test suite and actual build/222-file verification then passed. Earlier221-file candidates predate this stricter receipt and are historical probes, not final candidates.

Source-tree sorting uses deterministic code-point order for cross-platform fingerprints. Final root clean-commit reproduction, fresh dependency installation, independent branch review, runtime/scientific acceptance and deployment remain separate. Documentation updates after the working build deliberately make that build stale against the current root source; immutable artifact verification still describes its recorded earlier source. Root must rebuild after the final commit.

## Final worker source-package probe

After the builder output-receipt and deterministic-order corrections, a fresh output/release-candidate/g1-20261030-final-worker-probe/source was prepared. Its explicit package-closure check passed1/1, npm run check passed414/414, public build passed, ordinary E2E discovery found142 cases/22files, and isolated prototype source fixtures passed3/3. The copied-source build carries the new build-files.json and222 total files; verification against the immutable expected.json and explicit copied-source root passed with no missing/extra/changed files. sourceKind=transformed-source-package, clean=false, exactCommit=false; originCommit=b73910b22f7b44d49a7ec0bd692682349372ccef. Host dependencies were already present and resolved from the prepared workspace; no installation was performed. This is a portable closure/build probe, not a fresh-install or final clean-commit release. Root owns fresh installation/reproduction after committing the reviewed branch.

Final outputs: output/g1-final-package-test.txt, g1-final-package-check.txt, g1-final-package-build.txt, g1-final-package-verify.txt, g1-final-package-e2e-list.txt and g1-final-package-prototype.txt. Their exact receipts are inventoried in evidence/g1-command-receipts.json. No prior candidate or failed output was removed.
