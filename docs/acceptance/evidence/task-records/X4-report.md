# X4 implementation report

Base: `cff2763e29f3ab128e47651e7473260d09245834`.
Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Changes are unstaged; root remains the sole committer.

## Files

- `src/components/ResultLayerBar.jsx` (new): global source strip keyed by layer/result IDs; exact-result source action, visibility, remove and clear; paper/finding/frame context; collapsed disclosure at <=650px.
- `src/components/ResultLayerBar.css` (new): layer controls and narrow wrapping, independent selection names, result identity and coordinate-table readability.
- `src/lib/result-layer-controls.js` (new, root-authorized narrow helper): pure visibility/remove/clear view edits through W5 `validateResultLayers`, preserving every unrelated view field including coordinate origin, camera/explorer sensitivity, atlas, ROI and current paper.
- `src/lib/result-layer-controls.test.mjs` (new): four behavioral tests using real E2/W5/W6 functions and codecs; no JSX/source-shape assertions or copied handler implementation.
- `src/App.jsx`: exact E2 lookup from the same stable-ID public/local precedence used by W5; global layer strip remains reachable in reading/comparison layouts; marker click sets its precise origin and opens its result; source-paper return routes via X2/X3 and retains the result identity/finding panel; independent selected-region names.
- `src/components/BrainScene.jsx`: marker click returns exact result/coordinate IDs without first changing its origin to manual; selected regions use an independent categorical surface contour/deep-object selection box; selected and unselected atlas/category base colors no longer get selection tints.
- `src/components/ResultCoordinates.jsx`: explicit result ID, finding and source paper; source-paper return; clickable independent points plus equivalent named coordinate-table buttons; preserves null/unknown source spaces; only eligible coordinates get the existing main-overlay action. Concrete lifecycle guard captures the owning host, checks active/connected/positive dimensions, and disconnects/disposes on close before any queued resize callback may touch resources.
- `src/components/AtlasLegend.jsx`: separate selection-boundary key and A-only/B-only/intersection labels, using authoritative `ROI_COLORS` from the existing ROI renderer.
- `tests/e2e/result-layers.spec.mjs`: original four W5 scenarios preserved, four X4 scenarios appended: save A -> read B -> actual main-canvas point -> exact A/source return; private point -> clear -> public omission; unknown-space controls; compact non-color-dependent controls.

## Verification

- RED: `node --test src/lib/result-layer-controls.test.mjs` -> four expected missing-feature failures (`editResultLayers` unavailable). Initial fixture validation errors were corrected before the feature RED run.
- GREEN: `node --test src/lib/result-layer-controls.test.mjs src/lib/result-layers.test.mjs` -> 8/8 pass.
- `npm run check` -> data validation and literature validation pass; **302 tests, 302 pass, 0 fail**. Full output: `X4-check.log` beside this report.
- `node --test src/lib/result-layer-controls.test.mjs src/lib/result-layers.test.mjs src/lib/workspace-project.test.mjs src/lib/coordinate-input.test.mjs` -> **62/62 pass**. Output: `X4-targeted.log`.
- Final `npm run build` -> success. Existing warnings: mixed dynamic/static import of `volume.js` and large generated chunks. Output: `X4-build.log`.
- `node --check tests/e2e/result-layers.spec.mjs` -> success.
- `git diff --check` -> no whitespace errors; Git notes App's existing CRLF will normalize to LF on a future Git write.

## Rulings and remaining acceptance

- Root explicitly prohibited browser/desktop/Playwright execution for this implementer. Consequently the brief's browser RED/GREEN command was not run. Browser tests are authored only, not reported as passing. Live interaction, widths/zoom, grayscale recognition, actual contrast, main-point hit targeting and close/resize lifecycle acceptance remain root CUA / permitted CI work.
- Root authorized the narrow pure control helper/test instead of source-string or mirrored JSX tests. Layer schema, public eligibility and project serialization remain W5/W6 responsibilities.
- The surface contour is a selection indicator derived from the displayed categorical vertices; it does not change label IDs, data, measurement meaning or imply a newly validated anatomical boundary. Deep-object boxes and selected names are independent indicators.
- AtlasExplorer's separate ResizeObserver issue was not touched (assigned X7/G1).
- No dependency installation, Python, browser/storage automation, subagent, commit or deployment was performed.

## Review fix round 1 — P2 exact coordinate/frame return

Read the independent review's single P2 verbatim. Root ruled that exact return includes the clicked coordinate's visible reported frame and selected row/point. A correct hidden coordinate origin alone does not satisfy that behavior.

Changes after `583e9cf`:

- `src/App.jsx`: passes marker `coordinateId` into transient result-panel selection state; every second marker click updates it even when `resultId` is unchanged. Table/independent-point selections update the same transient ID and retain the existing exact X1 provenance. Source-paper navigation reopens the E2 result with the panel's current selected ID.
- `src/components/ResultCoordinates.jsx`: resolves the requested coordinate against the exact result, selects its actual source frame and row instead of the first frame, exposes its ID beside the visible frame, and renders a separate wireframe sphere indicator. The indicator follows second-point clicks and is cleaned up with the existing lifecycle guard. Source return carries the current local point selection across the transient panel remount.
- `src/lib/result-coordinate-selection.js` and `.test.mjs` (new, authorized narrow display helper): resolve transient point/frame selection without mutating evidence or granting overlay eligibility. Four regressions cover native/null-first mixed results, second-marker changes plus source reconstruction, exact null-frame preservation and unchanged W5 denial, and stale/foreign-coordinate fallback.
- `tests/e2e/result-layers.spec.mjs`: appended the mixed-space real-marker scenario. It asserts the MNI frame and selected row immediately after the marker click (before any manual table selection), clicks a second marker in the same open result using its projected camera position, and verifies that frame/point after source-paper return. Existing W5/X4 cases remain present.

Verification:

- RED: `node --test src/lib/result-coordinate-selection.test.mjs` -> **4 tests, 4 expected failures**, missing exact-selection helper. `X4-fix1-red.log` retains the output.
- GREEN: `node --test src/lib/result-coordinate-selection.test.mjs src/lib/result-layer-controls.test.mjs src/lib/result-layers.test.mjs` -> **12/12 pass**.
- `npm run check` -> data/literature checks pass; **306 tests, 306 pass, 0 fail** (`X4-fix1-check.log`).
- Final `npm run build` -> success, same existing import/chunk warnings (`X4-fix1-build.log`).
- `node --check tests/e2e/result-layers.spec.mjs` and `git diff --check` -> pass (same CRLF normalization notice).

No saved schema, evidence/coordinate values, W5 overlay/public eligibility, or X1 source-origin behavior was changed. All five changed/new source/test files remain unstaged for root. Browser/Playwright execution and the actual mixed-space witness remain root CUA / permitted CI acceptance; no browser execution was performed here.

## Fixture admission correction before fix-1 commit

Root's actual normal-import witness found that the authored null-first mixed fixture and unknown fixture could not pass E2 admission: Location `sourceSpaceId` requires a supported literal enum such as `MNI-unspecified` or `subject-native`; null belongs to other contracts such as AssetIdentity, and is not an admissible Location frame. The earlier unknown-layer round-trip unit test exercised codecs without normal evidence/project-stage admission, so its green result did not demonstrate a reachable null-frame UI scenario. This finding corrects that integration claim. E2 validation was not relaxed.

Fixture/test-only correction:

- New shared `tests/fixtures/result-layer-fixtures.mjs` builds the actual browser fixtures through E2 migration. Unknown locations now use `MNI-unspecified`, with matching `ResultLayer.spaceId`. Mixed results start with a supported `MNI-unspecified` location followed by eligible `MNI152NLin6Asym` points.
- The shared preflight performs actual `validateEvidence` and `stageProjectImport` against built-in evidence, without committing/publishing storage. The browser file's existing `open` helper now preflights every uploaded fixture using that path before UI upload.
- `src/lib/result-coordinate-selection.test.mjs` exercises the same shared unknown/mixed fixtures through normal project-stage admission and checks their real E2 view models/W5 markers. The native/unknown selection regression now covers both `subject-native` and `MNI-unspecified` in validated evidence. A separate defensive null display-object edge test remains and explicitly asserts that E2 rejects that input.
- `src/lib/result-layer-controls.test.mjs` replaces its invalid null-location fixture with supported `MNI-unspecified` and now also runs the round trip through actual project staging.
- Production App, result-panel behavior, schema and space/public eligibility were not changed by this correction.

Verification:

- New admission regression RED: **4 pass / 1 fail**, with the expected `private-point-0: explicit supported source space required` and equivalent second-point error (`X4-fixture-red.log`).
- Corrected selection/control/W5 regressions: **13/13 pass**.
- Additional normal-admission checks for the source-return fixture (including its synthetic review event) and bundled-public fixture: **2/2 pass**.
- `npm run check`: **307/307 pass**, including data/literature validation (`X4-fixture-check.log`).
- E2E syntax and whitespace checks pass. Browser scenarios remain unexecuted; root CUA owns the live witness.
