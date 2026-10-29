# X2 implementation report

Status: implementation and Node/build validation complete; actual desktop acceptance and independent review remain with root. Changes are unstaged; no commit, deployment, Python, dependency installation, browser installation, or user browser/storage operation was performed.

Base assigned: `6dccfa8e67000dc50a23b6149d34f72c88a71812`. Read X2-brief.md first, then X2-cua-baseline.md. Used executing-plans and test-driven-development skill instructions within the already assigned worktree; root owns commit/review and prohibited subagents. The baseline witness is the root's recorded A=[134], B=[] loss after selecting labels 134+133; no source-only claim substitutes for that witness.

## Implemented behavior

- `assignSelectionToOperand(previous,{side,regions,mode})` replaces or adds to exactly A or B. The required side/regions signature is retained, with optional `mode:'add'` for the requested collection operation. Uses S2 identity serialization/deduplication. Mixed atlas/version/space collections reject explicitly. An unresolved current collection rejects add. Other operand fields, thresholds/tails, resolution and display remain intact. Changing operands invalidates the displayed comparison selector, without mutating W6 numerical snapshots.
- `SelectionTray` shows the complete selected set, count, per-item removal, clear, Set as A, Set as B, and Add to current collection with an A/B selector. Explorer hands off its checked set, rather than its single detail row. Native/unverified data remain browseable and these comparison controls are disabled; App independently verifies every source ref against the current dictionary and the existing comparison eligibility gate.
- App navigation saves actual validated views (including exact refs/query, coordinates and explicit reference/null space, coordinateOrigin, result layers, A/B settings, selected saved result, paper/comparison/filter context, and selected explorer labels/picked detail) plus scroll offsets. Back, Forward and Recent visits restore these views through existing workspace staging. Scroll is restored after layout and again when async ROI/explorer sources are ready. Main navigation, task entry buttons, atlas entry/exit/handoff, and literature paper/list/comparison transitions participate.
- `pushNavigation`, `goBack`, `goForward` return `{history,target}`; targets are detached copies. Checkpoint replaces the current entry before leaving. Back then a new visit drops the forward branch. History is project-scoped, at most 50 entries and 1.5 MiB JSON, with no recursive histories or binary snapshots. The existing 2 MiB view admission and aggregate workspace/project limits also apply. Over-limit or failed staging leaves the current UI/workspace intact and reports the error.
- Persistence is only `view.navigationHistory` in the existing W2 envelope/W6 codec. No new storage key. Public encoding removes all history and private navigation context; decoding discards injected history/context. Added ROI inspection crosshairs and snapshot IDs are also excluded from public links.
- Imported project history receives imported=true, cameraSensitive=true and explorerSensitive=true recursively, regardless of claimed project identity. Its ROI computed flags are cleared. Named/foreign history ownership, startup restoration and all nested result layers are checked through the same project/W5 gates. Existing asset scanning includes historical entries; no asset bypass is introduced.
- Asset removal/export detachment prunes only visits that reference removed assets. `dependentViewFields` carries `navigationHistory:N`; the existing preview renders the number of unavailable recent visits to remove. Other visits and immutable W6 original/recomputed snapshots remain intact (existing missing-input handling remains authoritative).

## Rulings and limits

1. History reuses full W6 validated views, not an additional schema for scientific objects. Scroll-only context is bounded, fixed-key metadata. Privacy sensitivity remains conservative on restore: a previous sensitive camera/explorer context is not released by navigating to an older view.
2. Merge follows the existing W2 incoming-view replacement policy. Incoming history is first independently admitted against its own asset/evidence closure, then only incoming references are remapped and its owner rebound to the destination project. It replaces the displayed history together with the incoming view; histories are not combined. Current history objects are never rewritten by incoming collisions. The shared mapping now covers singular `coordinateId` and `layerId` as well as existing result/reference IDs.
3. History does not duplicate numerical data. W6 retains the original and the current recomputed slot. Entries retain the selected slot and exact snapshot ID. A superseded recomputed ID cannot silently inspect a newer result; the UI explicitly reports that its numerical result is no longer in the saved slots, restores inputs, and requires choosing an available result or explicit recomputation. Original/recomputed source bytes are never changed by navigation.
4. No browser execution claim is made. The required isolated E2E command was attempted once; launch was blocked before any assertion because Playwright's pinned `chromium_headless_shell-1248` executable is absent. Root explicitly ruled no download, installation or retry, and owns actual CUA verification on a pinned build. Scroll timing, focus, native rejection, multilingual layout, real unchanged B controls, and actual project download/public link must receive that acceptance.

## Exact source/test files

Created:
- `src/lib/selection-handoff.js`
- `src/lib/selection-handoff.test.mjs`
- `src/lib/navigation-history.js`
- `src/lib/navigation-history.test.mjs`
- `src/components/SelectionTray.jsx`
- `tests/e2e/selection-handoff.spec.mjs`

Modified:
- `src/App.jsx`: actual handoff, full-view navigation transaction, history controls, context/scroll capture/restore, minimal task/atlas/literature adapters.
- `src/components/AtlasExplorer.jsx`: full checked refs, tray, persisted picked row, late source-ready scroll hook.
- `src/components/ROICompare.jsx`: exact saved snapshot identity guard; ROI crosshair persistence; late source-ready scroll hook; unavailable historical snapshot notice. No comparison algorithm change.
- `src/components/LiteratureWorkspace.jsx`: narrow `onNavigate(nextState, optionalLocateRequest)` hook for open paper, comparison view, return to list/results. Existing source-supported region-location behavior runs after successful navigation.
- `src/lib/workspace-project.js`: W6 history/context/picked/crosshair adapters; public projection; recursive imported-trust treatment.
- `src/lib/workspace-session.js`: ownership/nested W5 validation at stage and startup; incoming merge owner/remapping adapter.
- `src/lib/workspace-assets.js`: only dependent history visit detachment and preview count.
- `src/components/WorkspaceFiles.jsx`: contextual rendering of history detachment count in existing dependency preview.
- `src/styles.css`: tray and history controls only. No i18n file edit required; new text is bilingual at the component boundary.

Report/logs: this report, `X2-check.log`, `X2-build.log` in the task's existing ignored SDD directory.

## RED/GREEN evidence

- Initial missing-module run identified new exports as absent; immediately created behaviorless API stubs and reran to establish assertion-level RED: all 7 initial tests failed (lost A label set, missing source rejection/add, null history target, no codec/history).
- Implemented handoff/history/codec: original targeted 7/7 GREEN.
- Added admission/detachment/merge tests first: 3 expected RED failures (nested layers not rejected, dependent history not pruned, foreign history owner not rebound), then GREEN.
- Added public inspection privacy/startup tests first: 2 expected RED failures (private ROI point still present, foreign startup history accepted), then GREEN.
- Added collision/unresolved-source assertions first: singular coordinateId remained unremapped and mismatched collection source was accepted; both RED, then GREEN.
- Final targeted set: 13/13 GREEN. Tests cover A's full two-label set, every retained B field/settings, add semantics, cross-atlas/version/space rejection, exact comparison/paper context and scroll target, unknown space/null preservation, detached copies, limit/fork/checkpoint semantics, public history injection, imported trust, nested layer/asset admission, startup gate, asset-prune count, and incoming singular-coordinate identity remapping/current nonmutation.

## Commands and results

- `node --test src/lib/selection-handoff.test.mjs src/lib/navigation-history.test.mjs`: final 13 passed, 0 failed.
- `node --test src/lib/selection-handoff.test.mjs src/lib/navigation-history.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-assets.test.mjs src/lib/saved-computation.test.mjs`: 95 passed at that intermediate point, before the final collision assertion was added.
- `npm run check`: final 289 passed, 0 failed, includes data/literature validation.
- `npm run build`: passed. Existing dynamic/static volume import and large-chunk warnings remain; no build error.
- `git diff --check`: passed; Git reports CRLF-to-LF normalization notices for three touched files.
- `npm run test:e2e -- tests/e2e/selection-handoff.spec.mjs --workers=1`: 3 tests environment-blocked at browser launch, no interaction assertions executed. Authored normal-UI scenarios: full-set A/B with opposite operand/grid preservation; native selection with disabled handoff/removal; ROI→paper→back/forward with actual context, panel scroll and zero computation-worker submissions. Authored worker counter operates only inside isolated E2E.

## Root acceptance remaining

- Pin the final source/build and reproduce baseline A/B setup; set two registered labels into A and separately into B, inspect that the opposite operand/threshold/tail/grid survives.
- Remove a tray item, clear, add to chosen collection, reject mixed source/version and native-space comparison, restore the original explorer selection/picked row.
- ROI→evidence list→paper or paper comparison→Back/Forward: inspect actual paper/comparison context, both panels' scrolling, original/recomputed displayed result and no implicit recomputation.
- Download/open the full project (including private history), merge with ID collisions, and inspect a public link for complete absence of navigation history, private query context, ROI crosshair/snapshot ID and imported spatial state.

Root remains the sole committer. No files were staged.

## Fix round 1/5 — explicit missing threshold (base 9fea79d)

Read the independent review's Important finding verbatim: **“P2 — Navigation changes an untouched operand's intentionally missing threshold to zero”**. The review traces ROICompare's deliberate `''` missing sentinel through App getWorkspaceView/navigation/restore into W6's numeric fallback; root also confirmed the actual empty-threshold-navigation witness in `output/x2-cua/interaction-receipt.json` on pinned `9fea79d`.

Changed only the sole ROI view adapter in `src/lib/workspace-project.js`: A/B thresholds preserve the exact explicit empty string; absent fields and other pre-existing normalization behavior retain their deliberate numeric fallback of 0. No form gate, comparison algorithm, history format, or independent persistence layer changed. ROICompare continues to receive `''`, so its existing statistic/probability missingThreshold condition keeps calculation disabled.

Added two meaningful Node regressions in `src/lib/navigation-history.test.mjs`:

- Reproduce App's actual sequence with the production W6 adapters: capture a cleared B, normalize explorer navigation, assign labels 133+134 to A with the production selection helper, normalize restore, persist nested history and travel back. B's empty threshold, source and negative tail survive every adapter; A retains both labels and computed=false.
- Both explicit blank A/B thresholds survive view and full project serialize/parse. Legacy v1 missing threshold fields retain 0, and numeric thresholds remain numeric.

Authored two additional normal-UI scenarios in `tests/e2e/selection-handoff.spec.mjs`, parameterized for statistic/probability synthetic NIfTI imports. Each establishes an enabled calculation with numeric B, clears B and observes disabled calculation, opens the actual atlas explorer, sends labels 133+134 to A, and asserts B remains blank, its source/tail survive and calculation stays disabled. This round executed no browser, including no isolated launch retry.

RED: `node --test src/lib/selection-handoff.test.mjs src/lib/navigation-history.test.mjs` → 13 passed, 2 expected failures (`0 !== ''`) before the adapter fix. Both new regressions failed at the intended empty-string coercion.

GREEN: `node --test src/lib/selection-handoff.test.mjs src/lib/navigation-history.test.mjs src/lib/workspace-project.test.mjs` → **59 passed, 0 failed**, covering the new path plus the affected W6 view/project/public codec regressions. `node --check tests/e2e/selection-handoff.spec.mjs` passed; `git diff --check` passed. No broad unrelated existing suite rerun was needed for this two-field normalization fix. Browser assertions remain authored, not executed; root owns pinned CUA on the same witness.

The review's three minors remain explicitly deferred as instructed: per-visit binary encoding → X9; missing secondary scrollers → X7; transient undefined basket label → X8. No change was made for these concerns. All source edits remain unstaged; root remains the sole committer.
