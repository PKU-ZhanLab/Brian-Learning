# X8 implementation report

Status: **DONE_WITH_CONCERNS** — implementation and Node/build checks complete; isolated browser cases are authored only. Root retains independent review and desktop CUA acceptance. No commit, install, Python, browser, Playwright execution or desktop automation was performed.

Execution checkout: `F:/project/brain-model/.worktrees/research-20261029`.

Review base: `1657b5fcffb385d87458bca725150ccd604f0308`.

## Contracts and behavior

- `summarizeEvidenceCounts(bundle,{matching,selected})` consumes canonical evidence and E3 `SearchHit[]`; it never searches. `papers` is distinct references represented by structured results, `results` is unique structured results, and `coordinates` is owned canonical locations. `bibliography` is distinct bibliographic references. `selected` counts known, distinct selected paper IDs. `matching.papers` is matching bibliographic references, with separately derived `structuredPapers`, `results` and `coordinates`. The caller applies existing region/only-results scope to E3 hits before counting. Baseline is 3 structured papers / 4 findings / 8 coordinates, alongside 118 bibliographic records.
- Library matching counts, baseline counts and selected BibTeX scope now name their denominators. Empty matches have a real Clear filters action. Existing not-extracted, unknown-space and no-coordinate displays remain in place.
- `WorkspaceStatus({status,onRetry,onCancel,onOpenResult})` is a presentation consumer. It does not fetch, subscribe, write storage or mutate scientific state. Error, loading, empty and contextual ready/result feedback are shown by the owning action. No permanent global ready row was added.
- Shared resources remain authoritative. App's S3 error rows now use localized messages and the existing `retry(key)`. ROI source/explorer consumers subscribe to shared generation changes and rerun their existing cached `loadAtlas` consumer when Retry creates a generation. No second fetch/cache was introduced. Retry preserves query source, original project assets, pending drafts and existing selections; explorer selection summaries fall back to known manifest labels or stable source atlas/label identity.
- Project export uses `utf8ByteLength(stage.projectText)` from the already staged canonical project; it does not serialize a second time. Preview separately names image count, raw image bytes and actual whole download bytes. A no-image project containing saved numerical computation no longer suggests a zero-byte whole download.
- Export choices distinguish PNG image, public view link, full local project, matching evidence package JSON and BibTeX. Full-project and evidence privacy/asset scope is explained at the relevant action (evidence details remain collapsed). Canonical W1/W3 budgets/payloads and W6 staging remain unchanged.
- Public-link feedback consumes only omission codes returned by the existing public projection. It lists all applicable safe categories, including local reading selections, result layers, coordinate/explorer/camera positions, imported views and navigation context. Names, IDs, private prose and raw codes are never interpolated. Inline save-dialog feedback receives the actual share outcome instead of replacing it with Completed. Clipboard fallback identifies a downloaded link text file truthfully.
- Draft size/native quota/JSON parse/named-view ownership errors get actionable localized presentation. Complete pending payload, native zero-overwrite behavior and X5 leave guards remain untouched. Draft errors appear once at the active editor; draft list feedback stays outside the editor, matching bottom dialog errors are suppressed, and authoritative draft-save feedback is not duplicated after retry. A newer formal evidence save clears a stale App restoration toast. New evidence imports/saves/metadata actions clear old success feedback before they can fail.
- X1 source-name admission now round-trips the encoded coordinate context through the actual shared `validateViewState` before permitting navigation. It therefore accounts for the `independent:` escaping namespace and codec's 500-character limit. Names that cannot be preserved are rejected with a field-specific localized error; input is neither truncated nor cleared. Tests also exercise actual full project serialization/parsing at accepted boundaries, including quote-escaped strings.

## Changed files

New:

- `src/lib/workspace-status.js`
- `src/lib/workspace-status.test.mjs`
- `src/components/WorkspaceStatus.jsx`
- `tests/e2e/recovery-and-feedback.spec.mjs`

Assigned production adapters:

- `src/App.jsx`
- `src/components/LiteratureWorkspace.jsx`
- `src/components/ROICompare.jsx`
- `src/components/WorkspaceFiles.jsx`
- `src/components/AtlasExplorer.jsx`
- `src/components/SelectionTray.jsx`
- `src/components/EvidenceEditor.jsx`
- `src/lib/coordinate-input.js`
- `src/lib/coordinate-input.test.mjs`
- `src/i18n/ui.js`

Root explicitly authorized the additional bounded child presentation adapters during this task:

- `src/components/BrainScene.jsx`: removed only the obsolete T1-refresh error sentence/catch presentation. App already owns the authoritative S3 T1 error/retry. Loading/image/query behavior is unchanged.
- `src/components/SliceViews.jsx`: replaces raw shared-anatomy error text with localized resource feedback. Existing shared retry/loading/query behavior is unchanged.

Bounded existing E2E adapters, explicitly authorized by root:

- `tests/e2e/evidence.spec.mjs`: paper evidence download label now specifies evidence package JSON; closure/content assertions retained.
- `tests/e2e/draft-and-undo.spec.mjs`: raw draft-budget/quota strings and old status role now match localized error alerts; exact draft content, retry, discard, formal-save atomicity and leave guards retained.
- `tests/e2e/workspace-assets.spec.mjs`: raw native quota text now matches localized storage-full text; scope, asset selections and exact storage preservation retained.
- `tests/e2e/workspace-import.spec.mjs`: raw quota toast now matches normalized storage-full text; editor content and exact storage preservation retained.

No schema, evidence truth, transforms, scalar values, reference identity, public eligibility, project persistence or payload limits were changed. No other worker changes were reverted.

## RED / GREEN evidence

1. Initial RED:

   `node --test src/lib/workspace-status.test.mjs src/lib/coordinate-input.test.mjs`

   Exit 1, 18 tests: 10 pass / 8 fail. New presentation adapters were absent and the concrete overlong-source case incorrectly admitted coordinate points. The test imported and called the actual canonical codec/session/draft/search/resource APIs; no JSX/source-text matching was used.

2. Initial GREEN:

   Same command: exit 0, 18/18 pass after implementation. One test fixture initially used Flanker (no search hits); it was corrected to the actual bundled Bosco paper, without changing production search. Result-method count coverage was tightened to an explicit synthetic canonical sibling-method variation (one matching result/one coordinate in one paper), preventing a vacuous all-zero filter case.

3. Self-review RED / GREEN — JSON budget versus parse errors:

   `node --test src/lib/workspace-status.test.mjs`

   Exit 1, 8 pass / 1 fail: `workspace-json-budget` was incorrectly described as malformed JSON. Tightened parse recognition; same focused regression then passed. Budget failure remains a size explanation while an actual `SyntaxError` receives the file-format explanation.

4. Self-review RED / GREEN — manifest dictionary fallback:

   `node --test src/lib/workspace-status.test.mjs`

   Exit 1, 8 pass / 1 fail: manifest dictionaries were not resolving a known label name. Added array/dictionary resolution in the presentation adapter; removed an unsafe component `.find()` fallback against a dictionary. Same command passed 9/9. Label/source identity is retained; no region is guessed.

5. Focused dependency verification:

   `node --test src/lib/workspace-status.test.mjs src/lib/coordinate-input.test.mjs src/lib/atlas-resource.test.mjs src/lib/draft-store.test.mjs src/lib/evidence-search.test.mjs src/lib/workspace-session.test.mjs`

   Exit 0, 60/60 pass. Coverage includes:

   - canonical 3/4/8 versus bibliography/matching/selection counts;
   - E3 result-ID restriction within one matching paper;
   - actual staged UTF8 bytes (including non-ASCII notes and saved computation), separately from zero image bytes;
   - real public codec omissions without private text;
   - real draft manager native quota and payload-budget failure preserving complete latest payload and previous durable bytes, then successful retry;
   - first shared manifest failure/retry/loading/ready;
   - an actual one-voxel source atlas that fails once and recovers through S3, preserving exact current session identity, image values, selection and pending draft;
   - encoded/escaped source-reference boundaries through named and full-project codecs.

6. Final full validation:

   `npm run check` — exit 0; data/hash validation and literature validation pass; **336/336 Node tests pass, 0 failed/skipped**.

   `npm run build` — exit 0, production build succeeds. Vite reports the existing static/dynamic `volume.js` chunk-placement warning and >500 kB chunks. No bundle splitting work was added to X8.

   Final outputs: `.superpowers/sdd/README/X8-check.log` and `X8-build.log`. A first full run also passed; both full commands were rerun after the late manifest-dictionary fallback correction so these logs correspond to the final production edits.

7. `node --check` succeeds for the new recovery-and-feedback file and all four adapted E2E files. `git diff --check` succeeds (Git emits only CRLF normalization notices).

## Authored browser coverage and validation limits

`recovery-and-feedback.spec.mjs` has seven isolated cases: bilingual baseline/matching/clear-filter feedback; first manifest plus single-atlas retry with retained project work; omission privacy plus actual staged/download bytes; real reverse-alias title conflict removing stale success with exact durable preservation; native quota with one contextual editor error and retry; computation cancellation retaining labels/project with delayed worker delivery; and overlong escaped source rejection preserving input and position.

These browser cases were syntax-checked only. They have **not** been executed, and no desktop/CUA acceptance, screen-width/zoom visual acceptance or keyboard/focus acceptance is claimed. Root owns that acceptance. The existing X7 CSS/layout was not modified; added feedback uses existing tokens/classes and existing DialogHost. Real browser storage-quota behavior and the complete cancellation/download UI path remain for root/isolated CI validation; Node tests verify the underlying canonical failure/atomicity paths, not browser rendering.

## Rulings and self-review

- Kept structured-paper totals separate from metadata bibliography totals, and passed actual E3 hit IDs into the count adapter rather than implementing another query engine.
- Used the already staged project text for actual bytes rather than modifying project/session serializers or calling a second serializer.
- Used codec admission directly for source-reference length, including namespace overhead and escaped text, rather than duplicating a hard-coded input maxlength or truncating identity.
- Defer T1 feedback to its existing App resource row; the obsolete BrainScene refresh sentence could not be made truthful by introducing a child fetch/retry path.
- Kept shared generation observation local to existing consumers; retries are forwarded to S3. No duplicate persistence or fetch system was introduced.
- Captured explorer selection-preservation decision before the state updater (rather than reading a ref that is updated immediately afterward), so concurrent updater timing cannot turn a first-load default into a retry selection by accident.
- Preserved original leave guards, pending complete payload, zero-overwrite and one-commit publication. No X5 manager/session changes were needed.
- Author self-review completed. Root independent review is still required. No deferred implementation finding is known; the material concern is unexecuted browser/desktop acceptance under the assigned execution boundary.

## Fix round 1 — I1 and M1

Status after the bounded correction: **DONE_WITH_CONCERNS** — corrected source and feedback paths pass final Node/build validation; root retains browser/CUA GREEN acceptance. Read `X8-review.md` before this correction. Starting production head was `df865f63f1914eeddba60684e34c4df5d69cf28c`. No commit, install, Python or browser/desktop automation was performed by this worker; unrelated edits were preserved.

### I1: resolved identity must retrigger the mounted ROI source

`src/components/ROICompare.jsx` now includes the resolved shared resource `key` in the existing source-load effect dependencies: `[atlasId, version, key, generation]`. A null-metadata source that failed before a manifest existed therefore reloads when metadata resolves to a generation-0 identity, and equal-generation identity changes are observed. The existing active-consumer cleanup guard, shared `loadAtlas` consumer, S3 retry owner, A/B state and selection-preservation guards remain unchanged.

Root supplied actual pre-correction CUA RED evidence: directly mounted ROI after first manifest 503, then main manifest Retry 200, left both source label lists disabled with errors and no per-source retry. Root's artifacts are `output/x8-cua/manifest-ROI-red.json`, `manifest-ROI-red.png` and `initial-manifest-events.jsonl`. This worker did not operate CUA or independently inspect those artifact pixels.

Exact covering browser regression added to `tests/e2e/recovery-and-feedback.spec.mjs`:

`mounted ROI consumers recover from first manifest failure when resource identity appears at generation zero, retaining A and B`

This is an isolated fixture around the actual mounted `ROICompare`, with stable `initialState`, A labels `[2,3]` and B `[14]`. It intentionally avoids App's later restored-project remount masking the failure. The main manifest fails once, its retry supplies metadata, both atlas resource generations are asserted to remain zero, and the same component must enable both source lists and Compute while retaining both selections, without pressing either source Retry. It is authored and syntax-checked, not executed by this worker. No React renderer/DOM test package is installed locally; none was installed. Root's CUA rerun is still the actual consumer GREEN gate.

### M1: successful user titles must bypass error classification

`src/App.jsx` now tags actual caught errors (including startup restore errors) as `{error}` (optionally with a contextual prefix). Ordinary success/status strings are stored unchanged. `workspaceToastMessage()` in `src/lib/workspace-status.js` normalizes only explicitly caught errors; success text is returned verbatim, so `Undone: Quota study` and `Undone: Unexpected observations` cannot become storage/JSON failures. Typed errors render with an alert role while ordinary success remains status. No undo or persistence algorithm changed.

Exact covering Node test in `src/lib/workspace-status.test.mjs`:

`successful undo keeps Quota and Unexpected paper titles verbatim while caught failures remain normalized`

It uses actual `createWorkspaceSession`, `applyUndoableAction`, `undoLast` and durable transactions to add then successfully undo each user paper title. It confirms evidence was undone, the exact success title survives in English/Chinese, and explicitly tagged native quota/SyntaxError failures still receive the correct normalized message. No source/JSX string assertion is used.

Additional authored browser regression:

`successful undo preserves user paper titles containing Quota and Unexpected verbatim`

It saves actual local metadata, verifies the durable paper, invokes the real Recent actions Undo, checks the exact toast and verifies durable removal. It is authored and syntax-checked only.

### Round 1 verification

- RED: `node --test src/lib/workspace-status.test.mjs` — exit 1, 9 pass / 1 fail, before the new typed-feedback adapter existed.
- GREEN: same command — exit 0, **10/10 pass** after production wiring.
- `node --check tests/e2e/recovery-and-feedback.spec.mjs` — exit 0; the two added cases bring the authored file to nine cases. No browser suite was executed.
- Final `npm run check` — exit 0, **337/337 Node tests pass**, zero failures/skips, alongside data/hash and literature validation.
- Final `npm run build` — exit 0. The previously disclosed Vite mixed-import and chunk-size warnings remain; they were not changed or addressed (X9 ownership).
- Final logs: `.superpowers/sdd/README/X8-fix1-check.log` and `X8-fix1-build.log`.
- `git diff --check` — clean apart from Git's CRLF normalization notices.

Changed production/test files in this fix round: `src/components/ROICompare.jsx`, `src/App.jsx`, `src/lib/workspace-status.js`, `src/lib/workspace-status.test.mjs`, `tests/e2e/recovery-and-feedback.spec.mjs`; this report is appended as requested. Root owns final CUA execution and Git commit.

## Test-only asset-route correction

At starting head `e531eb1`, root identified that the authored single-atlas recovery case selected `ba-histology` but intercepted the historical Talairach asset. The test now reads `public/data/manifest.json` through Node `readFile` and derives its intercepted path from `fixtureManifest.atlases['ba-histology'].data` (currently `ba-v2/juelich-ba.bin`). Its failure/retry count and all existing note, draft and image assertions are retained. Only `tests/e2e/recovery-and-feedback.spec.mjs` and this appended report were changed.

`node --check tests/e2e/recovery-and-feedback.spec.mjs` passed (exit 0). `git diff --check` passed. No full-suite/build repetition or browser execution was performed for this test-only correction. Root separately reported actual corrected-path 503→200 recovery with exact downloaded note/evidence/draft/voxel/snapshot checks, recorded in `output/x8-cua/single-atlas-retry-receipt.json`; that execution was root-owned. No commit was made by this worker.
