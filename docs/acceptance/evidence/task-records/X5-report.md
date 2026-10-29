# X5 implementation report

Status: DONE_WITH_CONCERNS — implementation and Node/build verification complete; isolated E2E was authored and syntax checked, not executed. Root owns actual CUA and independent review.

Base: c0bd8e27054aeba490526135330a935a779984b2

## Changes

- Extracted the existing canonical project draft validator into `draft-store.js`; both project v2 and W2 envelopes reuse it. Limits remain 30 records, 50,000 UTF-8 bytes per payload and 1 MiB aggregate JSON. No secondary storage key.
- Added session `transact` to serialize pending writes and retry staging against an externally advanced revision. All writes still use the existing stage/commit boundary and its one durable publication.
- Added an App-owned pending draft manager and 300 ms autosave for paper/result/relation editors. Pending complete payloads remain available after quota/admission failure and editor remounts; errors and saved/pending state are visible. Current live view accompanies draft persistence. Before browser leave, unsaved pending data triggers the native protection; internal navigation flushes before remount and stays in place on failure.
- Added resume/discard controls, including recovery after filter or mode changes and refresh. New drafts retain their generated record identity; recovering imported incomplete payloads provides safe empty fields. Draft recovery clears source-check flags and never restores E2 reviewIntent/reviewer details.
- Formal evidence publication removes its own draft in the same transaction. Editor controls are disabled during submission. A formal save may succeed even when the autosave payload budget is exceeded; failed publication retains editing and the prior durable state.
- Added deletion previews with cascade counts and concrete object labels, plus bounded session history (20 actions) and Undo in Literature/Projects. Built-in restore labels explicitly describe restoration rather than call it undo.
- Undo uses per-record inverse deltas from the canonical removal function, restores the structured v2 closure and active layer references, retains unrelated later records and original source-artifact bytes, and rejects conflicting later record edits. Later navigation choices are preserved. Undo entries exclude volume binaries and saved-computation snapshots.
- Successful open/merge resets old editor/undo ownership, including same-ID project replacement. Failed import preserves current draft/editor state. Drafts remain project-scoped and excluded from public view links.

## Files

- `src/lib/draft-store.js` (new)
- `src/lib/draft-store.test.mjs` (new)
- `src/lib/undo-history.js` (new)
- `src/lib/undo-history.test.mjs` (new)
- `src/lib/workspace-session.js`
- `src/lib/workspace-project.js`
- `src/components/EvidenceEditor.jsx`
- `src/components/LiteratureWorkspace.jsx`
- `src/components/WorkspaceFiles.jsx`
- `src/App.jsx`
- `tests/e2e/draft-and-undo.spec.mjs` (new)

## TDD evidence

Initial RED:

`node --test src/lib/draft-store.test.mjs src/lib/undo-history.test.mjs`

Exit 1, 0 pass / 2 fail: both requested modules absent (`ERR_MODULE_NOT_FOUND`). Initial test set exercised actual canonical project/session/evidence APIs, not source-string checks or a mirrored persistence implementation.

Subsequent RED → GREEN fixes:

- Later navigation during cascade undo: RED `undo-conflict: view.literature.paperId`; GREEN preserves later navigation while restoring records/layers and three original result rows in order.
- Incomplete imported editor payload: RED `undefined !== 'remapped-new-id'`; GREEN recovers stable record identity and safe empty inputs.
- Delayed autosave after discard: RED showed the deleted draft reappearing in the actual queued session; GREEN checks current pending identity when the queued write executes, preventing resurrection.

Final targeted command:

`node --test src/lib/draft-store.test.mjs src/lib/undo-history.test.mjs`

13 tests / 13 pass / 0 fail. Coverage includes UTF-8/count/aggregate limits, current project isolation, refresh/project persistence, public-link exclusion, quota zero-overwrite, retained oversize editing, concurrent real session writes, failed formal save, atomic draft completion, failed import, E2 review reset, cascade undo with relation/location/artifact closure, bounded history, binary exclusion, conflict protection and delayed autosave/discard ordering.

Also ran targeted existing session tests while integrating: 26/26 pass at that stage.

Final full verification (after the autosave race fix):

`npm run check`

Exit 0; 320 tests / 320 pass / 0 fail. Log: `.superpowers/sdd/README/X5-check.log`.

`npm run build`

Exit 0; built in 3.03 s. Existing >500 kB chunk warning remains. Log: `.superpowers/sdd/README/X5-build.log`.

`node --check tests/e2e/draft-and-undo.spec.mjs`

Exit 0 (syntax only).

## Authored E2E and limits

Five isolated-CI scenarios cover: half-result preservation across filter/Anatomy/Evidence library/refresh; quota leave protection and discard; formal metadata save clearing its draft; cascade delete/undo exact evidence restoration; failed import and successful project replacement isolation. These browser tests were NOT run under the execution ruling. Root supplied a real baseline mode-loss reproduction and owns CUA validation of the resulting UI.

Self-review performed on the assigned source diff and new modules. The delayed autosave resurrection bug found there was reproduced with a failing real-session test and fixed before final full verification. No remaining known source blocker. The implementation does not add autosaving to the separate existing free-text note composer; X5's paper/finding/relation editors are covered, and note deletion can be undone. No extra source/style path was required. No package installation, Python, browser automation or git commit was performed.

Ruling: use inverse per-record research deltas rather than old full-project snapshots; never overwrite later conflicting evidence records. For changed navigation leaves, preserve the user's later navigation while restoring deleted evidence and applicable layer references. Cost if wrong: the user's current paper navigation may remain newer instead of returning to the originally deleted paper.

Ruling: leave browser execution to root under the explicit execution ruling, despite the original plan's E2E command. Actual desktop acceptance and isolated CI outcomes remain unverified by this implementer.

## X5 review fix round 1 (base c00d8bef5e77fe65208a3dbf9f1efcf73dadce45)

Status: DONE_WITH_CONCERNS — both Important review findings fixed; root's actual CUA/independent confirmation remains the browser acceptance boundary.

Read `.superpowers/sdd/README/X5-review.md` in full before changing code.

### P1 — queued note deletion

App now submits `{type:'delete-note', id}` rather than a click-time aggregate notes array. `applyUndoableAction` filters the transaction's current `state.notes`. Thus queued deletions operate on the newly admitted base and retain an unrelated note added while they wait.

A real-session integration test holds a leading queued transaction, queues Delete A, queues an unrelated addition C, then queues Delete B (both semantic actions created before the first deletion publishes). After release and all commits, only C remains. The test uses the production undo action and actual W2 session staging/commit.

### P2 — pending drafts at export

Added the narrow shared `captureDraftSafeWorkspace` helper in the existing `draft-store.js`. The actual App export path calls it before reading the export snapshot. The helper awaits canonical manager admission, checks project/snapshot ownership and pending dirty state, then captures. It contains no parallel schema, storage key or staging implementation. Export confirmation also flushes pending edits before checking that its staged preview still matches the session.

Admission or quota failure propagates to WorkspaceFiles' existing visible error path, preventing a stale export preview/download while retaining the complete editor payload and previous durable bytes. A timer firing after successful pre-export admission is a no-op, so that timer alone cannot stale the preview.

Tests exercise this actual shared boundary with the existing `planProjectExport` and `stageWorkspaceChange`: a pending-before-debounce draft is present in the generated project JSON; an oversize 50,021-character payload and a quota failure prevent capture and retain editing/old durable bytes; retry includes the current text. No source-string assertions or mirrored UI handlers were introduced.

### Exact RED/GREEN evidence

RED command (before production changes):

`node --test --test-concurrency=1 src/lib/draft-store.test.mjs src/lib/undo-history.test.mjs`

Exit 1; 16 tests, 13 pass, 3 fail:

- `project export capture admits pending pre-debounce edits through the real W2 session before serialization` → `TypeError: draftModule.captureDraftSafeWorkspace is not a function`
- `project export refuses failed oversized/quota autosaves instead of capturing older durable drafts` → same missing boundary
- `semantic queued note deletions do not resurrect a deleted note or erase an intervening addition` → `Error: unsupported-undo-action`

GREEN, same exact command after production fixes:

Exit 0; 16 tests, 16 pass, 0 fail; duration 592.0673 ms.

Final covering command:

`node --test --test-concurrency=1 src/lib/draft-store.test.mjs src/lib/undo-history.test.mjs src/lib/workspace-assets.test.mjs src/lib/workspace-session.test.mjs`

Exit 0; 40 tests, 40 pass, 0 fail; duration 1131.2744 ms. Full output: `.superpowers/sdd/README/X5-round1-tests.log`.

`node --check tests/e2e/draft-and-undo.spec.mjs` → exit 0 (syntax only).

`npm run build` → exit 0; built in 3.00 s. Existing >500 kB chunk warning remains. Full output: `.superpowers/sdd/README/X5-round1-build.log`.

No repeat full suite was run, per controller instructions; no broader concern arose from this narrow fix. Original mode/filter/refresh/discard test cases were retained. Two additional isolated E2E cases were authored: deterministic held-autosave export includes latest text; oversize failed-autosave export exposes the error, provides no Confirm download and preserves editor text. Browser tests were not executed.

Round-1 changed source/tests: `src/App.jsx`, `src/lib/undo-history.js`, `src/lib/undo-history.test.mjs`, `src/lib/draft-store.js`, `src/lib/draft-store.test.mjs`, `tests/e2e/draft-and-undo.spec.mjs`. WorkspaceFiles needed no source edit because its existing preview error handling already reports rejected export staging.

Self-review checked the narrow source diff, transaction-base derivation, shared helper use in the actual export path, propagation of errors, preservation of pending payloads, and unchanged earlier recovery scenarios. No package install, browser action, Python, subagent or git commit.
