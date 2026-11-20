# X3 — Evidence reading layout and comparison basket

Implemented from `X3-brief.md` and the root's actual baseline/design context at starting commit `1136f228d9ee343d4c25978d8f346bd0a03448a9`. Used the requested frontend-design skill. No browser, desktop, Playwright execution or dependency installation performed by this implementer. Changes remain unstaged; root owns commits and actual CUA acceptance.

## Files

- Added `src/components/WorkspaceLayout.jsx`, `WorkspaceLayout.css`: restrained pale-green research desk; model/evidence/full-width compare presets; pointer and keyboard separator, labelled width slider/reset; anatomy control disclosure; narrow model/evidence panel switch and stacked anatomy controls. Main scene stays mounted, including language changes. Editor keeps the evidence preset while editing.
- Added `src/components/ComparisonBasket.jsx`: actual selected titles, open-paper/removal controls, explicit full-comparison action, capacity notice with individual replacement choices. A fourth request retains all three. Removing one while a fourth is pending exposes an explicit add action; cancelling changes nothing.
- Added `src/lib/workspace-layout.js`, `workspace-layout.test.mjs`: bounded layout normalization, pure comparison request/replacement, project/view/history migration and round-trip coverage.
- Modified `src/App.jsx`: layout capture/restore through the existing W6 codec and bounded X2 history; debounced layout-only saves use the existing transactional workspace boundary; paper/compare navigation selects the appropriate canvas. No new history or storage envelope. Original/recomputed snapshots stay in the existing capture path; X1 origin projection is unchanged.
- Modified `src/components/LiteratureWorkspace.jsx`, `LiteratureWorkspace.css`: contextual filter disclosure, basket, selected aria state, explicit return-to-comparison, editor layout notification, 15–16 px reading body, contextual 12–14 px source text, 15 px matrix, sticky titles and first dimension column with contained scrolling. Existing evidence/results/figures/provenance content retained.
- Modified `src/components/EvidenceEditor.css`: readable main-canvas editing and responsive fields/actions.
- Modified `src/lib/workspace-project.js`: one normalized `layout` view field; recursive existing history validation consumes the same codec. Public links accept only bounded layout fields; no private free text added.
- Added `tests/e2e/research-layout.spec.mjs`: authored scenarios for fourth-paper retention/replacement/removal; two/three papers at 1366×768 and 1920×1080; sticky titles/dimensions; compare → paper → history return with both scroll axes; saved/reset widths; editing and controls at 390/650/768.
- Minimal authorized selector adaptation in `tests/e2e/evidence.spec.mjs:40` and `:101`: open the actual filter disclosure before the existing post-reader filter/search interactions. Original assertions/data expectations unchanged.

## Navigation scroll mapping

Existing keys remain authoritative. `literature` is `.literature-scroll` outer reading scroll, `matrixX` is `.evidence-matrix.scrollLeft`. Existing `detail` now selects `.detail-scroll, .evidence-matrix` and retains the active comparison matrix's vertical scroll in research mode. These detail containers are mutually exclusive in the App's anatomy/research conditional; the outer literature scroll has its own key and cannot overwrite the matrix value. No navigation-history schema expansion.

## RED / GREEN and actual commands

- RED: `node --test src/lib/workspace-layout.test.mjs` failed with `ERR_MODULE_NOT_FOUND` for the absent workspace-layout module before implementation. Browser RED was not run, as explicitly prohibited in this session.
- GREEN: `node --test src/lib/workspace-layout.test.mjs src/lib/workspace-project.test.mjs src/lib/navigation-history.test.mjs` — 61 passed, 0 failed; includes 5 new layout/admission tests.
- `node --check tests/e2e/research-layout.spec.mjs` — exit 0.
- `node --check tests/e2e/evidence.spec.mjs` — exit 0.
- `npm run build` — exit 0, Vite 7.3.7; 1657 modules. Existing dynamic/static volume import and large-chunk warnings remain.
- Final `npm run check` — exit 0; data/evidence validation passed, 296 tests passed, 0 failed (final duration 5285 ms).
- `git diff --check` — exit 0; only the existing App CRLF-to-LF informational Git notice.

## Acceptance boundary

Pure state, project/view/history codec and existing scientific invariants have executable Node evidence. E2E is authored and syntax checked only; `npm run test:e2e -- tests/e2e/research-layout.spec.mjs` was not executed. Runtime runner is not installed in the provided environment and installation/execution was excluded by the task. Computed text contrast, actual reading room, two/three-paper interaction, pointer dragging, narrow reachability, 200% zoom, focus restoration and actual sticky behavior remain for root CUA / permitted CI acceptance. No claim of browser acceptance is made here.

## Review fix round 1 — base 0269aa3

Read the two Important/P2 findings in `X3-review.md` verbatim. Root supplied actual CUA evidence of explicit-return outer-scroll reset (1465.454 → 0) and the debounced coordinate-save regression. This implementer did not operate a browser.

- `src/lib/workspace-layout.js`: `comparisonReturnScroll` borrows only the nearest prior comparison's saved scroll when ordered basket membership and filter context match. It returns an independent copy; changed membership or filters have no historical scroll match. It never supplies a historical view, paper record or evidence payload.
- `src/App.jsx`, `src/components/LiteratureWorkspace.jsx`: the visible **Back to comparison** control calls a dedicated App return path, supplying matched outer/matrix scroll to the existing navigation transaction while retaining the current literature state, current workspace/evidence and current basket. It adds no second history or serialization path.
- `src/lib/workspace-layout.js`, `src/App.jsx`: the debounce now calls `scheduleLayoutSave` with a ref refreshed on every render. At execution it reads that current render's view and transaction function. Owner, epoch, restore-state, cancellation and existing transaction admission guards remain.
- `src/lib/workspace-layout.test.mjs`: focused same-context/mismatched-context return tests, plus a fake-timer test with a real workspace session/storage/transaction. A width change followed by language, atlas, decimal coordinate and selection changes before 300 ms persists the later values. Advancing the project epoch prevents a pending publication.
- `tests/e2e/research-layout.spec.mjs`: authored explicit-control return scenario verifies outer and both matrix scroll axes, retains a newly saved metadata title, and retains a basket changed while reading. The width scenario now actually checks 390 → paper width 500 → Research back 390 → Research forward 500, in addition to its original reload/reset assertions.

RED: `node --test src/lib/workspace-layout.test.mjs` failed before helper implementation because `comparisonReturnScroll` was not exported. GREEN: same command passed all 7 tests. Final targeted `node --test src/lib/workspace-layout.test.mjs src/lib/navigation-history.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs` passed 80/80. `npm run build` exited 0 (same existing bundle/import warnings); `node --check tests/e2e/research-layout.spec.mjs` and `git diff --check` exited 0. Final `npm run check` passed 298/298 with data/evidence validation. Changes left unstaged. Actual explicit-control behavior and debounce replay still require root CUA; authored E2E was not executed.
