# X7 implementation report

Status: **DONE_WITH_CONCERNS**. Implementation and Node/build verification are complete. Actual viewport, computed contrast, keyboard/pointer reachability, browser zoom and renderer lifecycle acceptance remain with root CUA. The isolated browser suite was authored and syntax checked; it was not run.

Execution checkout: `F:\project\brain-model\.worktrees\research-20261029`.
Assigned execution base: `eaed1996da77e7575afce9cd6dadd793f3a1e053`.

## Instructions and ownership

- Read `X7-brief.md` first, then `X7-design-context.md`, and `C:/Users/win/.agents/skills/frontend-design-3-0.1.0/SKILL.md`.
- Used the approved pale-green research desk direction and retained the existing DM Sans/Noto Sans SC/font fallback stack. No font, package, animation library, or other dependency was added.
- Root authorized the narrow additional `createAtlasCanvasResizeGuard` export in `src/lib/atlas-explorer.js` and meaningful tests in the existing `src/lib/atlas-explorer.test.mjs`. It is consumed by the actual AtlasCanvas effect. This authorization was requested before editing those additional files.
- The existing navigation-history adapter and test were used for the missing X2 scroll contexts and the new scrollable model/reading/atlas layout surfaces, as permitted by the brief.
- No subagents, browser automation, Playwright execution, desktop automation, Python, install commands, commit, or publication were performed. Root remains the sole committer and CUA operator.

## Baseline evidence

The root-supplied baseline in `X7-design-context.md` was the input evidence; this worker did not relaunch a browser or independently repeat it:

- At requested 390, X3/X4 observed client width 375 and document width 717; header project/share/notes/export actions extended rightward.
- `output/x7-cua/display-settings-390-baseline.json` confirmed `display-controls: display:none`, a zero-width opacity input, and no reachable replacement settings/restore control.
- At requested 650, the recorded browser rounding yielded `max-width:650px = false`, `max-width:651px = true`. This is recorded as a boundary observation, not a 650 settings-hiding failure.
- X4 had passing paper/frame text contrast and fitting result controls, but small result body text, crowded source/frame presentation and selection-name/legend overlap.
- X2 recorded an actual null `getBoundingClientRect` from AtlasExplorer's queued resize notification after close/handoff. The implementation had not changed between the reviewed versions.

No new screenshot or final computed-style evidence is claimed by this report.

## Delivered behavior and layout

The three established X3 task layouts and saved width contracts remain in use:

1. **Model first:** compact global rows, existing structures/model/context arrangement, and a selected-identity strip above the model rather than on top of the atlas legend. The canvas and slice controls can scroll within their owning panel when vertical space is short.
2. **Evidence first:** the useful model remains available while papers and editors retain the reading column. Long titles/limitations wrap, papers retain their full body, and long selection baskets have a bounded scroll area. If fixed chrome plus a long basket exceeds the available reading-panel height, the owning reading workspace itself can scroll rather than cutting away the body.
3. **Comparison:** the existing full-width matrix keeps its sticky dimension and title cells and independent horizontal/vertical scrolling. Compact table controls retain at least a 32px target.

At narrow widths, the existing research panel switch and single-column anatomy flow remain. The atlas explorer changes to a scrollable column of label controls, model/slices, and label/source details. Project/save, share, notes, references, export, help/data and display controls have reachable entries. References, notes and image export are grouped in **More actions**; Projects & views, Display settings and Share view stay direct. The narrow action row uses a wrapping two-column grid.

### Shared display settings

- `DisplaySettingsDrawer({settings,onChange,onRestoreHidden,...})` and the desktop settings disclosure both use `DisplaySettingsControls` and the same existing App-owned opacity/exploded/labels/schematic/clinical/hiddenIds state.
- Drawer visibility is independent of media-query changes: a drawer opened wide remains mounted and operable after resizing to narrow or short viewports.
- Opacity, all four switches and Restore hidden structures are present. The restore action remains discoverable with a disabled zero-count state.
- The drawer uses the existing DialogHost's modal/focus/Escape/return-focus machinery. App's slash shortcut also respects the open settings layer.
- None of the new controls navigates away from the evidence editor or bypasses the existing X5 workspace transaction/unmount guards. Existing task/navigation handlers were retained. A direct Share view entry was deliberately retained during self-review because an existing coordinate E2E contract uses it.

### Scientific meaning and interaction states

- `tokens.css` adds text/surface/selection/comparison/font/spacing/target tokens. The comparison tokens equal the existing ROI data palette (`#27a5b5`, `#e39845`, `#8e69c6`). Scientific atlas palettes, axis colors, data, geometry, marker eligibility, thresholds, source labels and provenance algorithms were not changed.
- Supporting UI text uses dark green text tokens rather than the former very pale secondary colors. Body copy is generally 14–16px, supporting copy 12–13px, and coordinates/numbers use the existing-compatible monospace fallback stack with tabular figures.
- Current/selected controls retain their semantic pressed/current states and visible boundary/weight treatment. Hidden structures use a strike-through/eye-off cue rather than overall row opacity alone.
- Existing reduced-motion rules were retained; no new animation was introduced.

### Bounded AtlasCanvas lifecycle fix

- The effect captures its owning `container` before creating/attaching the renderer.
- The resize guard stops before measuring if disposed, replaced, or disconnected; zero/nonfinite dimensions do not update or render a camera.
- Rendering is gated on active/connected state. The original minimum rendering height, geometry, source query and camera framing logic remain unchanged.
- Cleanup deactivates the guard first, disconnects the observer, removes named change/end listeners and pointer listeners, clears pointer state, disposes controls/geometry/materials/renderer and removes the canvas.
- Pointer release also rejects inactive/zero-size canvases.

### Scroll restoration

The existing App capture/restore mechanism and canonical bounded navigation-history validator now admit:

- Missing X2 contexts: `tree` (`.structure-tree`), `atlasDetails` (`.atlas-details`), `atlasSlices` (`.atlas-slices`).
- New scrollable layout contexts: `model` (`.center-panel`), `reading` (`.literature-workspace`), `atlasWorkspace` (`.atlas-explorer-grid`).

Existing left/right/detail/literature/label-list/matrix/window contexts remain. No second history or direct storage publication was introduced. New positions pass the same finite, nonnegative bounded validation and are preserved by the existing W6 project codec.

## Files

Created:

- `src/styles/tokens.css`
- `src/components/DisplaySettingsDrawer.jsx`
- `tests/e2e/responsive-workspace.spec.mjs`
- `.superpowers/sdd/README/X7-report.md`

Modified:

- `src/App.jsx`
- `src/styles.css`
- `src/components/WorkspaceLayout.css`
- `src/components/LiteratureWorkspace.css`
- `src/components/EvidenceEditor.css`
- `src/components/ROICompare.css`
- `src/components/AtlasExplorer.css`
- `src/components/AtlasRegionDetails.css`
- `src/components/WorkspaceFiles.css`
- `src/components/ResultLayerBar.jsx`
- `src/components/ResultLayerBar.css`
- `src/components/ResultCoordinates.css`
- `src/components/AtlasExplorer.jsx` (bounded lifecycle fix only)
- `src/lib/atlas-explorer.js` (explicitly authorized narrow helper)
- `src/lib/atlas-explorer.test.mjs`
- `src/lib/navigation-history.js`
- `src/lib/navigation-history.test.mjs`

## Verification executed

All commands ran in the execution checkout, using existing Node dependencies:

| Command / check | Result |
| --- | --- |
| `node --test src/lib/atlas-explorer.test.mjs src/lib/navigation-history.test.mjs src/lib/workspace-layout.test.mjs src/lib/draft-store.test.mjs` | Passed, 38 tests. |
| `node --check tests/e2e/responsive-workspace.spec.mjs` | Passed, including final E2E edits. |
| Node-only preflight of the E2E long-title/long-limitation fixture using `preflightResultLayerProject` | Passed the real project parse/evidence/staging admission for anatomy/research × comparison/non-comparison variants, with result layers. No browser/storage interaction. |
| `npm run check` after final implementation edits | Passed data hashes/affines/catalog validation, literature validation, and all **326** Node tests; 0 failed/skipped. |
| `npm run build` after final implementation edits | Passed; 1664 modules transformed. Existing-style mixed dynamic/static volume import and >500kB chunk advisories remain. |
| `git diff --check` | Passed; Git only reported CRLF-to-LF normalization advisories for two pre-existing files. |

New Node regressions are behavioral, not mirrored CSS assertions:

- A queued resize callback after disposal, host replacement or disconnect causes no additional owning-element measurement and no rendering-size callback.
- Zero/negative/nonfinite dimensions cause no renderer-size callback; a live positive-size notification resumes normally; disposal then stops it again.
- Independent tree/details/slices/model/reading/atlas-grid positions survive back/forward and full project serialization, while unknown or invalid positions are rejected.

Self-review checked the final App wiring, existing exact Share view entry, modal shortcut/focus routing, stale resize callback ownership, complete event cleanup, native switch labeling, long-content scroll fallbacks, responsive popover anchoring and unchanged scientific colors. Small corrections were made before the final full check/build.

## Authored but not executed

Required isolated command:

`npm run test:e2e -- tests/e2e/responsive-workspace.spec.mjs`

This command was **not run**, following root's explicit no-browser/no-Playwright worker ruling. The authored suite covers:

- Open settings at 1366×768, then resize the still-open drawer to 390/649/650/651 and operate opacity, all switches and restore-hidden. Closing returns focus to the trigger; desktop controls retain the changed state.
- Long titles/findings/limitations at 390, 650, 1366×768 and 683×384, including reaching the actual end of a long paragraph, global project/actions access and result-panel source link reachability.
- 683×384 is explicitly documented as a **200% reflow equivalent** of 1366×768; it does not certify actual browser-level zoom.
- Full-width matrix scrolling/sticky dimension at 390.
- Pending X5 draft retention while opening settings and save dialogs; evidence editing still disables model-first.
- Anatomy tree restoration via the actual App research-history controls.
- Sampled final computed contrast/font sizes, focus outlines, independent 40px controls and compact 24px-minimum exceptions.
- Atlas close/resize/reopen and handoff error capture.
- Viewport/media-query metadata and screenshots are written only when the isolated suite runs, under the configured Playwright execution output directory. No pixel-perfect snapshots were added.

## Acceptance limits and root checklist

- [ ] Actual requested 390/649/650/651 viewport measurements, media matches and screenshots.
- [ ] 1366×768 anatomy/research with slices open, all three task layouts and long source content.
- [ ] Actual browser 200% zoom with settings already open, without losing controls/state.
- [ ] Final computed ordinary-text contrast >=4.5:1 and font/target measurements across the changed workspaces. Token choices alone are not acceptance evidence.
- [ ] Keyboard and pointer reachability, nested/modal return-focus behavior, all narrow save/share/export/notes/refs/source actions.
- [ ] Long text tail, matrix tail and native label/source/slice content scroll reachability.
- [ ] Atlas close/resize/handoff without the recorded ResizeObserver/null error; check lifecycle behavior under actual WebGL.
- [ ] Required isolated E2E run when permitted.

Intended compact exceptions: structure/group visibility controls are 32×32; comparison table/remove controls and result-table point controls are at least 32px high; atlas label checkboxes are 24×24 within 40px rows. Settings switch inputs are 40×24 inside a whole clickable label row of at least 44px height, providing an equivalent larger activation area. These are implementation targets awaiting actual computed measurements. No real-touch or screen-reader acceptance is claimed.

The build's bundle advisories were not addressed because code-splitting/dependency changes are outside X7. Root should perform final CUA and review before committing with the planned message `feat: improve research readability and responsive controls`.

## Fix round 1 — I1/I2 and measured small text

Review/fix base: `05c730678c211a9927b65670d866403e8cf80e31`.
Read the full `X7-review.md` before changing the implementation. The following is an additive correction to the first report; it does not replace the preserved RED receipts or claim final browser acceptance.

### RED baseline and root observations

- **I1:** the reviewed implementation hid the functional `.meta-caption` at all widths. Ordinary research model/evidence layouts hid the atlas sidebar and voxel panel, leaving only a fixed MNI/RAS pill and omitting the active atlas, volume/ribbon interpretation and disabled unverified-overlay warning.
- **I2:** root's actual 1366×768 receipt measured the scene at y249.95–565.49, while Focus selected structure occupied y547.10–587.10. Only 18.39px was visible and the action center hit Enter coordinates `SUMMARY`, not the button. Preserved evidence: `output/x7-cua/toolbar-clipping-initial.json` and `output/x7-cua/toolbar-clipping-initial.png`.
- **Small text:** root's actual narrow expanded menu measured References/My notes/Export view at 11px and the reference-count badge at 9px. Root also observed a 9px anatomy group count and a decorative 8px 3D badge. Preserved evidence: `output/x7-cua/small-text-initial.json` and `output/x7-cua/menu-small-text-initial.png`.
- Root separately reported passing drawer persistence/state/restore/focus-return and a normal390 client/document width of 375/375. Its receipt is `output/x7-cua/settings-initial-receipt.json`. These are root-supplied results, not worker browser measurements.

### Changes

1. **Context beside the model:** replaced the hidden canvas caption/fixed pill with an in-flow native `details/summary` above the model. Its closed summary shows the active atlas identity and the same metadata-driven volume/ribbon sampling distinction. A disabled-overlay warning remains visible when the atlas is not eligible for the model. Keyboard expansion exposes the model reference and RAS/mm convention, the atlas's own reference, the existing spatial-relationship label and exact atlas version. Ribbon metadata includes the distinction between surface sampling and independent T1 voxel lookup. Nothing is inferred about registration or eligibility; existing metadata/`alignmentLabel` are consumed unchanged. The unconditional X7 caption-hiding override was removed.
2. **Reserved model action space:** moved the existing six model actions out of the overflow-hidden scene into an in-flow wrapping bar below it. All remain 40×40px. Model/data notes is a separate 40px-high action in the same flow, wrapping onto its own line when needed. The scene retains its pointer hint, legend and standard views. Tool callbacks and scientific rendering/state logic are unchanged. Parent model scrolling can expose the whole reserved action bar rather than clipping its lower actions behind the coordinate summary.
3. **Measured supporting text:** More actions buttons/count badge and anatomy group counts now use the 13px supporting token explicitly. Removed the decorative 3D badge from the viewer title rather than enlarging an unnecessary secondary label.

Files changed in this round only:

- `src/App.jsx`
- `src/styles.css`
- `tests/e2e/responsive-workspace.spec.mjs`
- `.superpowers/sdd/README/X7-report.md`

No schema, geometry/query algorithm, renderer lifecycle helper, source data, package, persistence or navigation guard changes were made in this round.

### Targeted regressions authored

The isolated responsive E2E now includes actual geometry/hit testing of every model action and Model/data notes in anatomy/research at 1366×768, 390×844 and 683×384. Each control is scrolled into view and focused, its own center is tested with `document.elementFromPoint`, and its rectangle is checked for overlap with Model/data notes. The test records coordinates/hit identities and retains a 40px target expectation with a 0.5px browser/device rounding allowance. The old clipped Focus selected center would fail the own-button hit assertion.

Research model/evidence layouts are also covered with a registered ribbon atlas, a volume atlas and a native atlas ineligible for overlay. The tests explicitly hide-check the ordinary sidebar/voxel context, verify the remaining visible atlas/method/warning, expand provenance from the keyboard, then resize the same context to 683×384 and use the existing panel switch. Six atlas/layout fixture variants passed Node-only real project admission.

The existing responsive menu/typography scenarios now assert final computed 13px minimum menu labels/count and group-count text. These are browser acceptance assertions, not CSS-source mirror unit tests.

`683×384` remains a 200% **reflow equivalent**, not actual browser-level zoom. These additional E2E cases were authored and syntax checked but **not run**. The required isolated command remains:

`npm run test:e2e -- tests/e2e/responsive-workspace.spec.mjs`

### Checks executed after the amendments

| Check | Outcome |
| --- | --- |
| `node --test src/lib/workspace-layout.test.mjs` | Passed, 7/7 existing layout/history/persistence contracts. |
| Node-only project preflight for `aal-registered`, `ho`, `aal` × model/evidence layout | Passed, 6/6 variants. No browser or storage publication. |
| `node --check tests/e2e/responsive-workspace.spec.mjs` | Passed after the final small-text/test edits. |
| `git diff --check` | Passed; only App CRLF-to-LF normalization advisory. |
| `npm run build` | Passed after final source edits, 1664 modules. Mixed dynamic/static volume import and >500kB chunk advisories remain. |

The full 326-test suite was not repeated for this presentation-only fix round, per root's instruction. The earlier full-suite result remains recorded above for its own revision. No CSS mirror tests, browser launch, Playwright execution, Python, dependency installation, subagent or commit was performed.

**Remaining acceptance:** root must capture GREEN action-center/overlap, provenance visibility/keyboard, menu/count font/contrast and real 200% zoom evidence on the corrected implementation. Passing source/build checks do not establish these viewport results. This round is implementation-ready for that independent review and CUA.

## Fix round 2 — compact source summary preserves reading space

Fix base: `027d38e`. Root reported that the scoped round1 review passed and that all seven actual model action centers passed. During the remaining reading-layout gate, root's normal two-layer evidence fixture exposed the following direct RED measurement:

- Default-expanded layer disclosure: 236px high; reading panel about 273px; paper heading starts at y715.
- Manually collapsing the **same** disclosure: reading panel about 468px; heading starts at y520.
- Preserved evidence: `output/x7-cua/reading-chrome-before.json` and `output/x7-cua/reading-chrome-before.png`.

Root's recorded ruling was applied without a redesign or schema change: ResultLayerBar now defaults to its compact source summary at **all** widths. Removed its media-query initializer and resize listener; the existing user-controlled disclosure state is now initialized to `false` and is changed only by the disclosure toggle. A user expansion or collapse is therefore not overridden when crossing the narrow/wide breakpoint. The existing result ID/title summary and all source/visibility/removal/clear actions are unchanged, as are scientific fields, marker resolution, private-state rules and persisted view state.

Files changed in this round only:

- `src/components/ResultLayerBar.jsx`
- `tests/e2e/result-layers.spec.mjs`
- `tests/e2e/responsive-workspace.spec.mjs`
- `.superpowers/sdd/README/X7-report.md`

The result-layer E2E now explicitly opens the disclosure before operating its source/visibility/clear actions. Existing exact source-return, marker coordinate/frame, hidden layer, private coordinate/camera/explorer restriction and public projection assertions were retained unchanged.

New isolated responsive regressions are authored for cold compact defaults at 390/650/651/1366, plus explicit expansion/collapse remaining under user control across narrowing and widening. The reading-space regression uses the two-layer research fixture at1366×768 and measures the real reading-panel height and heading position before/after expansion and re-collapse. It requires at least 400px of initial reading space, the heading starting above the bottom100px of the viewport, a measured >100px reading-space difference on expansion, restoration on re-collapse, and unchanged layer data. It does not merely assert a CSS declaration. Source ID/title remain asserted in the compact summary, and expanded action availability is still tested.

Checks executed after final source/test changes:

| Command | Outcome |
| --- | --- |
| `node --test src/lib/result-layer-controls.test.mjs src/lib/result-layers.test.mjs src/lib/workspace-layout.test.mjs` | Passed, **15/15** targeted layer, source/private-state, layout and project contracts. |
| `node --check tests/e2e/result-layers.spec.mjs` | Passed. |
| `node --check tests/e2e/responsive-workspace.spec.mjs` | Passed. |
| `git diff --check` | Passed. |
| `npm run build` | Passed, 1664 modules; existing mixed-import/chunk-size advisories remain. |

Self-review confirmed that this is only a disclosure default/resize-state change; no CSS/layout schema or renderer/source algorithm was modified. All existing layer E2E action paths were checked for the newly required explicit disclosure step. No repeated full suite, browser launch, Playwright execution, subagent, installation, Python or commit was performed.

The authored E2E cases remain **unrun**. Root owns actual GREEN reading-space and toggle/resize acceptance. Suggested isolated command when permitted:

`npm run test:e2e -- tests/e2e/result-layers.spec.mjs tests/e2e/responsive-workspace.spec.mjs`

## Fix round 3 — short comparison body and native restore expectation

Fix base: `c95d1fd`; original X7 runtime before X8: `1657b5f`.
Read `X7-fix3-findings.md` first and then the existing report. X8 canonical status/count changes and all other edits were preserved.

### Actual RED evidence and ruling

- At 683×384, the admitted two-paper `compare-long.neuroatlas` fixture produced a sticky comparison header 404.38px high inside a matrix with 224px client height. After matrix scrolling, a body-cell center still hit `THEAD`/`TH`. Root's preserved receipts are `output/x7-cua/comparison-short-blocked.json` and `output/x7-cua/comparison-short-blocked.png`.
- Root ruled that the visible title/secondary header content must be bounded while preserving readable body typography, sticky dimensions and keyboard access to full source titles. A title attribute alone would not meet this requirement.
- The previously authored native AAL expectation was incorrect: restoring the unverified/native `aal` request normally follows the existing S3 usable-atlas guard to usable `dk`. Root's `output/x7-cua/native-provenance-observation.json` records requested `aal`, actual `dk`, the MNI/RAS reference, verified native-template relationship and exact DK version. This is an observation of existing correct fallback behavior, not an eligibility defect.

### Implementation

- Comparison header titles now render in a visible two-line paper-open button. Its accessible name carries the **full** paper title; Enter uses the existing `openPaper` navigation/guard path to open the full source title and findings. No permanent secondary label or title-only tooltip was added.
- The source year, when present, occupies a bounded single supporting-text row. The existing removal action remains alongside it at the established compact 32px target. Paper-open actions retain a 40px minimum height. Only header presentation changed; sticky dimension/header behavior, body values and body typography/contrast were retained.
- Corrected both model/evidence native AAL responsive scenarios to expect DK fallback, verified DK provenance and the absence of an ineligible-overlay warning for that usable fallback. The expectation remains valid after reflow. No scientific eligibility, source space, atlas selection or fallback algorithm was changed to satisfy a test.
- Root additionally authorized removing the parenthetical `{allResults.length}` from the bilingual **paper-labelled** “Only papers with structured findings” checkbox. It redundantly showed a findings denominator beside X8's canonical paper/finding counts. Only that label suffix was removed; the checkbox handler/filter behavior and canonical library/matching count algorithms/labels remain unchanged. This also follows AGENTS' concise-label instruction. No mirror test was added for this one-line label adjustment.

Files changed this round only:

- `src/components/LiteratureWorkspace.jsx` — comparison header markup plus the explicitly authorized one-line filter-label suffix removal.
- `src/components/LiteratureWorkspace.css` — bounded comparison header title/year/control presentation.
- `tests/e2e/responsive-workspace.spec.mjs` — real short comparison regression and corrected native fallback expectations.
- `.superpowers/sdd/README/X7-report.md`.

### Focused regression and fixture evidence

The new isolated 683×384 regression uses the existing two-paper long-title/long-limitation fixture generator, including both result layers. A Node deep-equality check confirmed its **entire evidence object exactly equals** the admitted `output/x7-cua/compare-long.neuroatlas` evidence. The generated project also passed actual project/evidence/staging admission. The E2E therefore uses the same source content without depending on ignored controller output being present in a clean CI checkout.

The authored browser regression scrolls vertically and horizontally, measures the actual sticky **TH** rectangles (not the non-sticky natural THEAD box), requires header height below60% of the matrix client height and at least80px of visible body area, and checks real visible body-cell center hits via `document.elementFromPoint`. It rejects a header intercept, retains >=15px body text and checks the sticky dimension. It then focuses/opens both source-title controls by keyboard, verifies each full paper title, returns to the comparison and retains both columns plus the long limitation tail. Prior comparison/source/privacy/layer/shared-feedback assertions were not weakened.

### Verification executed

| Command / check | Outcome |
| --- | --- |
| Node deep equality against admitted `compare-long.neuroatlas` evidence and real project preflight | Passed. |
| `node --test src/lib/workspace-layout.test.mjs src/lib/evidence-search.test.mjs src/lib/workspace-status.test.mjs` | Passed, **24/24** layout/history, source-filter/provenance and X8 canonical status/count contracts. |
| `node --check tests/e2e/responsive-workspace.spec.mjs` | Passed. |
| `git diff --check` | Passed. |
| `npm run build` | Passed, 1666 modules; existing mixed dynamic/static volume import and >500kB bundle advisories remain. |

Self-review checked the scoped JSX diff: matrix body expressions, the X8 matching/library count rows, shared status component and source/privacy logic remain unchanged. Header paper opening delegates to the existing guarded action. No schema, algorithm, renderer, shared CSS, dependency or other file was changed.

The new browser regression remains **authored but unrun**. No browser/desktop automation, Python, install, commit, subagent or repeated full suite was performed. Root owns actual GREEN short-viewport body readability, full-title keyboard access and fallback-provenance CUA on this correction.
