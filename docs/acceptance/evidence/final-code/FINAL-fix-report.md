# Final correctness fix report

Status: **DONE_WITH_CONCERNS**. I1–I6 and M1 are corrected with canonical-module coverage. M2 remains a non-blocking readability observation. The source is stable for root's commit and one scoped re-review. Final browser/native/human/publication acceptance remains outstanding; this report does not close those gates.

Base reviewed: `dbac9ebd1a557876ff3f5167d314da964d8e5422`. Worktree: `F:/project/brain-model/.worktrees/research-20261029`.

## Finding dispositions

### I1 — project-owned custom atlas lifetimes

`custom-volumes.js` now assigns runtime ownership generations after admission, independently of file metadata and byte identity. `atlasResourceKey(identity, ownerScope)` and the single `atlasResourceKeyFor(metadata)` consumer helper keep local entry/project lifetimes distinct while preserving the four public identity fields unchanged. No content hashes are fabricated to resolve metadata conflicts.

`volume.js` retires old metadata and the existing shared resource record on replacement/removal, checks ownership before and after asynchronous work, and refuses an identity-only local request when multiple owned entries match. `loadAtlas(customId)` remains unambiguous. Public identity requests cannot be shadowed by a local entry carrying the same public identity. The registry publishes the new entries before retirement observers run, preventing mixed old-registry/new-session observations. Unchanged-asset note/navigation commits keep the existing resource lifetime.

Narrow consumers updated: App, AtlasExplorer, ROICompare, ComparisonViewport and SliceViews. Shared resource retries/subscriptions remain authoritative; no parallel cache was introduced.

Coverage includes independently usable same-byte imports, same-ID project replacement, same-project metadata replacement, a delayed A response after B publication, resource retirement observers, unchanged note commits, and a local/public identity collision. Existing public byte/version/grid/source dependency checks still pass.

### I2 — immutable artifacts and E5 aliases

`mergeWorkspace` preserves `source-artifact-v1` and `source-reference-v1` records without rewriting any byte-hashed content or original field anchors. It preserves and validates explicit `referenceAliases`, including their original bibliography snapshots. A pre-existing alias can follow a remapped canonical reference when that is representable without changing the historical alias/source namespace.

An artifact-ID collision or a reference/result/location remap that would change an immutable source binding is refused atomically. The current schema has reference aliases, but has no equivalent result/location/artifact namespace alias that could retain those original anchors. Incompatible alias snapshots or aliases that would bind an occupied reference ID are likewise refused. Errors instruct the user to export the current project and open the incoming project separately. No artifacts are deleted, rehashed, skipped in audit, or silently rewritten.

Tests use the real Axelrod package, `verifySourceArtifact`, `sourceExcerptBytes`, `auditTranscription`, ordinary project staging, independent serialize/parse, and `validateEvidencePackageClosure`. They cover all four collision kinds, unchanged storage/session/assets on refusal, identical packages, alias-bearing packages, and supported alias-following canonical remaps. Original source records remain byte-equivalent and their audits retain the same anchors, allowing only the explicit canonical-reference alias resolution.

### I3 — saved computation and navigation preservation

Occupied original/recomputed slots now admit only compatible identical normalized saved content, including class bytes. Different incoming content is refused with export/open guidance. Empty slots still accept incoming history with the existing typed reference remapping; current occupied slots are not repurposed.

Both projects' navigation entries are retained with their existing/remapped bindings. Identical visits may be reused, the incoming selected visit remains selected, and histories exceeding the existing 50-entry bound are refused rather than truncated. Explicit snapshot IDs in merged views must resolve to the retained corresponding slot.

Three old regressions encoded superseded positional/replacement assumptions. Their original files are preserved under `output/final-fix/*.test.before.txt`. The session test now exercises remapping into an empty slot; the asset test first asserts refusal of an occupied conflicting history and then tests remapping without replacing it; the navigation test asserts retained current history plus the selected remapped incoming visit. New tests independently cover occupied originals/recomputations, identical histories, non-overlapping slots, snapshot/view bindings, navigation capacity and zero publication on refusal.

### I4 — startup recovery and capacity-safe archival

Startup recovery uses `workspace-assets.js`'s canonical detach rules to remove unavailable session-image references from live view/history. It retains notes/evidence/drafts, declares unavailable custom identities, and retains saved numerical metadata with missing-input status when appropriate. Envelope persistence now records session asset IDs and bounded saved-computation metadata; image arrays, voxel classes, masks and surfaces remain outside browser persistence. Existing old envelopes that did not contain saved numerical metadata cannot recreate it; a full prior project file remains necessary for those results and image bytes.

The exact first pre-refresh envelope is retained as an opaque `startupRecovery.originalEnvelope`. Repeated refresh/save keeps that same string instead of nesting another envelope. Ordinary saves cannot silently remove this recovery copy. The optional field passes through the sole full-project codec; it grants no live asset, spatial, source-check or public-share authority. Ordinary malformed/missing-asset file imports remain strict. Public views and evidence-only exports exclude the recovery context. Partial-image export refuses while an embedded recovery snapshot could contain deliberately omitted context; the user can first archive it explicitly. Distinct original recovery envelopes cannot be merged into the one available field and are refused atomically.

Capacity boundaries are unchanged for ordinary writes: the authoritative browser envelope is at most **32 MiB**, notes at most **8 MiB**, evidence at most **20 MiB**, and drafts at most **1 MiB** with their existing per-record limits. The original recovery envelope itself is bounded to **32 MiB of raw UTF-8**. Its JSON-string escaping is charged at its actual size to the existing **180 MiB project JSON** limit, rather than incorrectly treating an escaped copy as if it were the raw envelope. Normal 256 MiB decoded-payload, 128 MiB compressed-asset and 50-asset admission still applies.

If current metadata plus its embedded exact original exceed the 32 MiB browser limit, startup still restores the current research in memory and preserves the original storage bytes. Ordinary save/export staging refuses with `workspace-storage-budget-recovery` and actionable archive guidance. Workspaces without a recovery copy retain their ordinary `workspace-storage-budget` size guidance. There is no permissive export-only stage and no ordinary project download that bypasses normal Open admission solely to carry this recovery copy.

The narrow App/WorkspaceFiles recovery action is deliberately two-step:

1. Preview an archive of the exact original envelope as a separate `.json` recovery record, with explicit disclosure that continuing removes its embedded copy from the active project.
2. Request the download, keeping the original state unchanged. Only a separate **“I saved it; continue”** action acknowledges receipt and permits the already validated current-project stage to commit.

Canonical `downloadRecoveryArchive` / `acknowledgeRecoveryArchive` state is held on the existing stage record. Download initiation alone cannot authorize a commit. Cancellation/no acknowledgement, a thrown download failure, a stale stage, or failed storage commit cannot remove the original. Notes/evidence/numerical history/missing-image identities remain; pending drafts stay in the existing manager and can flush after archival. Ordinary current-project export then remains parseable and stage-importable. This archive is an original browser-envelope receipt, explicitly separate from a `.neuroatlas` project; it does not contain lost image bytes.

Coverage includes genuine persist → startup → ordinary navigation/new note/draft save, historical notes, numerical history, full project image recovery, repeated refresh, portable exact recovery bytes, malformed/oversized recovery, no public/selected-export leakage, distinct-envelope merge refusal, download/no-ack/commit-failure preservation, and an actual large valid old envelope whose escaped recovery representation exceeds 32 MiB. That last test exercises archive → acknowledgement → normal save → pending draft flush → new navigation/note → project export → parse → `stageProjectImport` successfully.

### I5 — earned derivative-byte verification

After project-entry decoding, layout/grid/encoding and derived digest checks pass, `parseProject` assigns the fresh runtime state `received-project-derived-bytes`. Its observation retains `originalSourceBytesEmbedded:false`; it does not certify raw original NIfTI bytes or independently validate registration.

`canLinkCoordinates` accepts that state only when the observation matches the loaded identity and both the admitted metadata and spatial evidence consistently describe the supported user-declared alignment. Unknown spaces, absent spatial evidence and contradictory/unverified alignment remain ineligible. Serialized verification flags are not restored as authority. Tampered payload, digest and grid cases reject. Tests clear the registry before parsing, so a warm atlas cache cannot hide a missing verification state.

### I6 — real manifest and asynchronous journey outcome

The two-atlas journey calls one shared assertion that reads the committed catalog, checks both ordered operand identities, and checks the full unique source dependency closure. The current canonical case contains 15 inputs (two operands plus thirteen dependencies); no fixed two-input count remains. A Node contract test builds the actual canonical manifest and proves the assertion rejects missing/swapped operands, removed/extra dependencies and a changed dependency digest.

The calculation helper polls for confirmation, a final result, error or cancellation before branching, and separately waits for the result after confirming sampling loss. Error/cancellation states fail explicitly. Static discovery finds all three authored journeys. No browser execution occurred.

### M1 / M2

The imported-label detail action now uses the already validated exact `AtlasRegionRef` from the selection result and is disabled when no such reference exists. It no longer invokes the throwing constructor from an unguarded event handler. No label-source dictionary provenance is invented; the real constructor's imported-label refusal is covered. JSX syntax is checked; rendered/button behavior remains unrun.

M2 remains non-blocking. Only newly changed ownership/verification logic received local formatting; no unrelated formatting sweep was made.

## Verification and receipts

All receipts are in `output/final-fix/`. Original failing observations were retained, not overwritten by later successful results.

- `witness-1.mjs.txt` through `witness-6.mjs.txt`: exact Appendix A JavaScript extracted from FINAL-review.md. Each ran in its own `node --input-type=module` process before changes. `RED-witness-1.txt` through `RED-witness-6.txt` record exit 0 and the semantic failures, including leaked A metadata, duplicate-entry refusal, broken source digest, lost alias, overwritten snapshot, refresh save failure and 15-versus-2 inputs.
- `RED-additional-history-trust.txt`: 9 pass / 2 fail, demonstrating lost current navigation and contradictory unverified project alignment during the first implementation pass.
- `RED-retirement-publication.txt`: observer saw A's registry entry while B was being published. The registry publication order was corrected and the final test asserts B is already visible.
- `RED-portable-recovery.txt`: portable field loss/distinct-envelope acceptance failures; also retains an overbroad audit equality assertion that was corrected to account for the explicitly changed canonical alias ID while retaining exact historical anchors.
- `covering-run-1.txt`: 131 pass / 1 fail; obsolete paired-history replacement setup. `covering-expanded-attempt-1.txt`: 185 pass / 1 fail; obsolete incoming-entry-at-index-zero assumption. Both original fixtures are preserved, and the final assertions are stronger about retained current history.
- `portable-recovery-check.txt`: retains an intermediate test-harness misuse of `decodeView`'s argument; corrected to pass the canonical `.encoded` string. No production admission was weakened for that failure.
- `archive-recovery-first.txt`: 18/18. `escaped-capacity-recovery.txt`: 1/1 focused capacity/archive symmetry test.
- **`covering-final.txt`: exit 0, 189 tests / 189 pass / 0 fail / 0 cancelled / 0 skipped.** Exact command is its first line:

```text
node --test src/lib/final-correctness.test.mjs src/lib/research-journey-contract.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-assets.test.mjs src/lib/workspace-project.test.mjs src/lib/volume.test.mjs src/lib/atlas-resource.test.mjs src/lib/comparison-link.test.mjs src/lib/computation-manifest.test.mjs src/lib/evidence-package.test.mjs src/lib/evidence-workspace.test.mjs src/lib/navigation-history.test.mjs src/lib/saved-computation.test.mjs src/lib/draft-store.test.mjs src/lib/workspace-status.test.mjs
```

- `covering-message-final.txt`: exit 0, **46/46** after the final narrow error-code distinction above. Exact command: `node --test src/lib/final-correctness.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-status.test.mjs`. No unrelated source changed after the 189-test run; only the persistence error code and its presentation classifier changed, and their covering paths were rerun.

- `static-e2e-list.txt`: `node node_modules/@playwright/test/cli.js test tests/e2e/research-journeys.spec.mjs --list`, exit 0, **3 tests in 1 file**. Discovery only; no browser/server launched.
- `jsx-syntax-final.txt`: `node output/final-fix/check-jsx.mjs`, exit 0; esbuild JSX transform accepted App and all five changed components. An earlier stdin-piped syntax invocation stalled; `jsx-syntax-final-attempt1.txt` records stopping only its identified Node/esbuild processes. The saved-module retry completed successfully with explicit esbuild shutdown.
- `diff-check.txt`: `git diff --check`, exit 0. Only existing CRLF→LF normalization warnings for changed text files; no whitespace errors.
- `source-snapshot-sha256.json` lists exact final changed source/test file bytes for root's stable-source comparison; it is a handoff checksum receipt, not a release attestation.

The final whole-project `npm run check`, source/release packaging, clean build and fresh-source reproduction are root-owned after scoped review and were not repeated here. The focused set includes the relevant existing public trust, quota, draft, saved-computation, source-package, resource and navigation regressions.

## Exact changed source/test files

1. `src/App.jsx`
2. `src/components/AtlasExplorer.jsx`
3. `src/components/ComparisonViewport.jsx`
4. `src/components/ROICompare.jsx`
5. `src/components/SliceViews.jsx`
6. `src/components/WorkspaceFiles.jsx`
7. `src/lib/atlas-resource.js`
8. `src/lib/comparison-link.js`
9. `src/lib/custom-volumes.js`
10. `src/lib/volume.js`
11. `src/lib/workspace-assets.js`
12. `src/lib/workspace-project.js`
13. `src/lib/workspace-session.js`
14. `src/lib/workspace-status.js`
15. `src/lib/navigation-history.test.mjs`
16. `src/lib/workspace-assets.test.mjs`
17. `src/lib/workspace-session.test.mjs`
18. `src/lib/final-correctness.test.mjs` (new)
19. `src/lib/research-journey-contract.test.mjs` (new)
20. `tests/e2e/research-journeys.spec.mjs`
21. `tests/helpers/research-journey-contract.mjs` (new)

Additional writes: this report and new receipts/helper files under `output/final-fix/`. No original scientific inputs, source artifacts, QC lock entries, captured evidence bytes, protected historical documents, manifests or historical receipts were edited. No Git staging/commit/HEAD mutation, subagents, installation, Python, remote/network operation, push, browser, desktop/CUA, Playwright runtime or preview/server occurred. Fetch in tests is process-local synthetic transport only.

## Remaining acceptance

Scoped review and root's integrated/fresh-source checks remain. The new recovery preview/download/acknowledgement flow, imported-label action and corrected journeys still need permitted real browser/native/accessibility acceptance. Browser performance, NiiVue equivalence, independent researcher task acceptance, human anatomical/source certification and publication remain unverified. S6 remains partial, human=false, 14 gaps and zero eligible replacements; no new spatial authority or scientific conclusion is claimed. GitHub workflow permission remains pending and was not bypassed.

## Bounded residual correction after scoped review

Base: `cdeb6ed550733b13fb0cb3c24ccf41f0f80bcbd2`. This section records only FINAL-fix-review.md's R1/P2 and R2/P2, under root's explicit residual ruling in progress.md. The prior report, receipts, source snapshot and withheld cdeb6ed candidate are preserved. No further broad implementation or review was undertaken.

### R1 — ready-resource continuation and publication ownership

Disposition: **corrected with focused canonical coverage**. `loadAtlasVersion` now awaits the shared resource in both signal/no-signal branches and rechecks the captured local owner immediately before returning. `loadAtlas` rechecks after its own async wrapper continuation as well. Both continuations retain abort checks. These checks do not change any byte identity, expected version, hash, source/grid verification, public cache key or shared transfer.

The shared `isCustomVolumeScopeCurrent` helper reads the admitted registry. `createComparisonSourceLoader` captures the requested owner and checks both it and any returned local owner on acceptance and every later `isCurrent()` call, in addition to request generation. A registry replacement therefore invalidates the publication predicate synchronously even if no new request or React effect cleanup has occurred. Root approved one additional consumer guard: the existing ComparisonViewport worker callback now also checks `request.isCurrent()` before publishing either source information or geometry. No other component behavior changed.

Focused tests exercise the exact warmed-cache replacement through both `loadAtlas` and `loadAtlasVersion`, with and without AbortSignal; the real comparison adapter; ownership change between canonical loading and adapter delivery; a previously successful predicate becoming false after replacement; unchanged-owner cold and warm success; already-aborted/in-flight cancellation and adapter cancellation; cold replacement; and public cached results surviving an unrelated local replacement without another public download.

### R2 — selected merged visit agrees with the active view

Disposition: **corrected with focused canonical coverage**. When a merged navigation history exists but its incoming selected visit is absent, empty, or does not represent the normalized incoming active view, `mergeWorkspace` appends and selects an independent active-view visit with empty scroll state. Current entries and the incoming historical entries retain their existing view/scroll bytes. A selected incoming visit that actually represents the active view keeps its selected position and scroll behavior. The existing 50-entry admission and snapshot binding checks run after the proposed new visit is added, so a full history refuses atomically instead of overwriting a visit.

Tests use actual `stageProjectImport`, `replaceNavigationEntry` (the App checkpoint operation), `pushNavigation`, and two `goBack` operations. Missing and empty incoming histories preserve A's exact coordinate/reading/ROI scroll and original-computation binding, B's recomputed binding, and subsequent navigation. An explicit matching incoming history is preserved; a mismatched selected visit is retained as history while a new active visit is selected. Forty-nine current visits plus the required new visit are admitted, and fifty current visits refuse with unchanged session/storage.

The existing singular coordinate-remap regression had an incoming active view that differed from its selected historical visit. Its exact cdeb6ed text is preserved as `residual-navigation-history.test.before.txt`. It now still asserts the exact remapped historical coordinate/source IDs, and additionally asserts that the separate actual active view is selected. No remap assertion was removed.

### Residual receipts and limits

All newly written receipts use `output/final-fix/residual-*`; no prior receipt or snapshot was overwritten.

- `residual-witness-1.mjs.txt` through `residual-witness-3.mjs.txt`: the three complete exact programs from FINAL-fix-review.md, extracted and run separately before edits. Their `residual-RED-witness-*.txt` logs reproduce stale A delivery, the actual adapter's stale `isCurrent()===true`, and `originalVisitRetained:false` respectively.
- `residual-RED-tests.txt`: new canonical tests before fixes, **2 pass / 6 fail**, with expected ownership, publication-predicate and checkpoint/capacity failures.
- `residual-GREEN-witness-1.txt`: exact original program, exit 0; pending A rejects with `Project atlas ownership expired`, current load returns B.
- `residual-GREEN-witness-2.txt`: exact original adapter program, exit 1 on the intended ownership rejection. This original program has no rejection handler; it is preserved rather than edited to conceal the changed outcome. The canonical adapter regression explicitly asserts that rejection and passes.
- `residual-GREEN-witness-3.txt`: exact original program, exit 0; before/after checkpoint both retain A and B, and `originalVisitRetained:true`.
- `residual-GREEN-tests-initial.txt`: **8/8** new residual tests.
- `residual-covering-1.txt`: **72/73**, preserving the obsolete selected-history assumption described above.
- **`residual-covering-final.txt`: exit 0, 73 tests / 73 pass / 0 fail / 0 cancelled / 0 skipped.** Exact command:

```text
node --test src/lib/final-residual.test.mjs src/lib/volume.test.mjs src/lib/atlas-resource.test.mjs src/lib/comparison-source.test.mjs src/lib/comparison-link.test.mjs src/lib/navigation-history.test.mjs src/lib/workspace-session.test.mjs src/lib/final-correctness.test.mjs
```

- `residual-jsx-syntax.txt`: `node output/final-fix/residual-check-jsx.mjs`, exit 0; esbuild's JSX transform accepts the single changed ComparisonViewport component. This is syntax checking, not browser execution.
- `residual-diff-check.txt`: `git diff --check`, exit 0.
- `residual-source-sha256.json`: new final-byte handoff hashes for the seven residual source/test files; the prior `source-snapshot-sha256.json` remains unchanged.

Exact residual changed source/test files:

1. `src/lib/custom-volumes.js`
2. `src/lib/volume.js`
3. `src/lib/comparison-link.js`
4. `src/components/ComparisonViewport.jsx`
5. `src/lib/workspace-session.js`
6. `src/lib/navigation-history.test.mjs`
7. `src/lib/final-residual.test.mjs` (new)

Additional writes are this appended report section and the new residual receipts/helper. No new project/history fields, caches, source authority, scientific data edits, package changes, installs, Python, subagents, Git/index/HEAD mutations, network/remote operations, server, browser, desktop/CUA or Playwright runtime occurred. Existing browser/native/human/publication limitations remain unchanged. Root owns the integrated check, commit, direct focused closure assessment and final source packaging. The residual source is stable for that handoff.
