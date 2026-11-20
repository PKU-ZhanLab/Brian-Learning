# X6 implementation and handoff

Status: implementation ready for root review/commit. Root is the sole committer.
LiteratureWorkspace was released by root after E2 commit `3ad35f6`; X6 retains
its v2 migration, view-model, editor, and export changes.

## Shared dialog API

`DialogHost({dialogs,onCloseTop})` accepts an ordered list, from bottom to top:
`{id,modal,title,returnFocusRef?,content}`. `onCloseTop(id)` must remove only that
entry. IDs must be stable while the layer is open. `returnFocusRef` points to the
trigger; omitted refs capture the active element at mount. Content must not add
its own dialog role, modal backdrop ownership, global Escape handler, or
window.confirm. A confirmation is a modal entry containing action/cancel buttons;
the caller keeps the pending operation in state and removes the entry on cancel
or successful action. Add later confirmations after existing entries.
Use one shared host per application; independently mounted hosts would compete
for focus/inert ownership.

Only the last modal traps focus. Other entries and body siblings become inert.
Escape closes that one modal, or a focused nonmodal panel if no modal is open.
On removal, focus returns to that entry's trigger after the surviving layer
loses inert. Nonmodal panels do not block background tabbing and offer an explicit
return control; their source action can enter them again.

## Files

Created:
- `src/components/DialogHost.jsx`
- `src/components/DialogHost.css`
- `src/lib/localize-ui.test.mjs` (additional root-approved diagnostic scope)
- `tests/e2e/keyboard-dialogs.spec.mjs`

Modified:
- `src/App.jsx`: shared layers, one-layer Escape, source focus for nonmodal
  results, safe slash shortcut, current navigation/pressed selections.
- `src/components/AtlasExplorer.jsx`: host-owned role, selected view/label state,
  busy state.
- `src/components/WorkspaceFiles.jsx`: host-owned role, named view input label,
  native picker cancellation returns to its button, busy state.
- `src/components/ResultCoordinates.jsx`: host-owned nonmodal role and explicit
  return-to-workspace action.
- `src/components/LiteratureWorkspace.jsx`: real JSON import button with hidden
  input and native cancel focus return; comparison pressed state only.
- `src/components/BrainScene.jsx`: focus outline restored, described keyboard
  view/zoom/reset entry, view selection synchronized back to App, listener cleanup.
- `src/i18n/ui.js`: React.Children.map preserves stable child key identity while
  localizing cloned static sibling trees.
- `src/styles.css`: remove three outline:none overrides; visible focus for
  canvases/controls; reveal structure visibility controls on keyboard focus.

No EvidenceEditor edits. No staging, commits, browser CLI, installation, Python,
storage manipulation, or changes to the source/data contract.

## Keyboard/focus contract

- Atlas, save/share, help/data/references/notes/legend use the shared modal host.
- Opening a modal focuses its first available action. The top modal owns Tab and
  Shift+Tab wrap. Background/lower layers are inert and hidden from accessibility.
- Escape closes only the top modal, including when an input is focused. Removal
  returns focus to that dialog's own opener after inert is cleared.
- Nonmodal coordinates initially receive focus; Return to workspace focuses the
  source action without hiding the panel. Activating the source enters it again.
  Escape dismisses the focused panel when there is no modal.
- JSON import uses native button Enter/Space behavior. The native input cancel
  event restores the import trigger. Project import uses the same return behavior.
- Slash searches only outside inputs, textareas, selects, editable content,
  modifiers, composition, or open modal dialogs.
- Focused main canvas: 1 oblique, 2 lateral, 3 anterior, 4 superior, +/- zoom,
  Home reset. Standard-view buttons remain available by Tab; selection state stays
  synchronized. These keys are bound only on the canvas, never in a text input.
- Existing selection/visibility controls expose aria-current/aria-pressed; no
  radio/tab role is advertised without implementing that role's keyboard model.

## Verification record

- Browser CLI execution is prohibited for this agent; authored keyboard scenarios
  await approved isolated CI. No browser RED/GREEN is claimed.
- `node --test src/lib/localize-ui.test.mjs`: RED, 1 passed / 1 failed. A minimal
  static sibling tree renders cleanly before localization and emits React's
  unique-key warning after the old localizeUI array mapping. This proves the
  mechanism. After the child traversal fix the focused regression is GREEN, 2/2;
  rendered translated text/attributes, stable keyed identity across reorder, and
  data-user-content protection are covered.
- `npm run check`: PASS, 103/103 tests plus atlas/anatomy/catalog/evidence source
  and hash validations. No failures or skipped tests.
- Final `npm run build`: PASS, Vite 1621 modules. Existing >500 kB chunk advisory
  remains; this is a local build, not a public deployment.
- `node --check tests/e2e/keyboard-dialogs.spec.mjs`: PASS.
- `git diff --check`: PASS.
- Root's actual desktop CUA, reported in this task: clean English reload has
  `errors=[]`; the former 15 App key warnings disappeared. Enter opened Atlas,
  then Save. Lower layer inert=true / top inert=false. Shift+Tab wrapped first to
  last; Tab wrapped last to first. First Escape closed Save alone and returned to
  Atlas's Save trigger; second Escape closed Atlas and returned to top navigation's
  Atlas labels trigger. Screenshot: `output/x6-nested-dialog.png`.

## Rulings and remaining acceptance

- Ruling: browser RED execution in the original brief is superseded by root's
  prohibition on this agent executing browser CLI. The tests were authored first;
  the actual nested keyboard path was checked by root CUA. Cost: the authored CI
  selectors/other scenarios are not yet demonstrated by a browser test run.
- Ruling: do not claim all original key warnings had the same exact React call
  stack. The minimal causal regression plus clean App CUA verifies this fix at
  both levels; no console interception/suppression was added to production code.
- Native file chooser Enter/Space and actual desktop cancellation remain pending
  root CUA. The Playwright test intercepts a chooser and clears files; that cannot
  certify native OS cancellation.
- Nonmodal result reentry, visible focus across controls, canvas controls, Chinese
  interactions, and screen-reader announcements remain pending root acceptance.
  DOM roles alone do not certify screen-reader output.

## CUA continuation

1. Literature workspace → Import JSON by Enter, cancel the OS picker, verify
   focus returns; repeat with Space. Do the same for Open project file.
2. Search Schaum → open paper → View reported result coordinates → Return to
   workspace → activate source again → Escape; verify source focus each time.
3. Tab to an unselected structure's visibility button; confirm it is visible and
   has an outline. In a view-name input type `/` and confirm it stays in the input.
4. Focus the main canvas, use 1–4, +/- and Home; compare the visible camera and
   pressed standard-view buttons. Repeat core path in Chinese.
5. With an available screen reader, verify dialog title, one active modal,
   state announcements, control names and return position; otherwise leave open.

## Fix round 1 of 5 — review P1 and P2

Review: `X6-review.md`, base X6 commit `63b2cab`. Root independently reproduced
both findings in static preview 4191 without HMR. This round supersedes any
earlier implication that locale-switch state retention or Help-to-Data focus had
already been accepted. Status: fixes ready; awaiting root static CUA retest.

Exact files changed this round:
- `src/i18n/ui.js`
- `src/lib/localize-ui.test.mjs`
- `src/components/DialogHost.jsx`
- `tests/e2e/keyboard-dialogs.spec.mjs`
- This report only. No App/EvidenceEditor or other owner files changed.

P1 cause and fix: the Chinese early return kept null static keys while English
used React.Children.map positional keys. The new zh/en/zh recursive identity
regression failed before the fix with null versus `.0`/`.1` and `research` versus
`.$research`; it passes after removing the locale-specific traversal bypass.
Both locales now perform the same public React child traversal; translateUI
continues to translate strings/attributes only in English. Protected user prose
retains its original element. No private React validation flags or production
console suppression are used.

The authored mounted-browser regression begins in Chinese research mode, enters
`Schaum`, opens Add paper, and fills the unlocalized DOI field with an unsaved
value. It switches zh -> en -> zh, verifying the query and unsaved DOI remain,
the original input/editor DOM nodes stay connected, and the original scene
canvas remains the same node. The stable canvas assertion catches scene remount
and consequent camera reset. DOI intentionally avoids conflating independent
Chinese/English text values with lost editor state. Node identity checks alone
do not prove mounted state; the browser scenario is unexecuted here.

P2 cause and fix: replacing Help content with Data removed its focused action
while layer `app-modal` stayed active, leaving BODY focused without a focusin
event. DialogLayer now runs a layout check when active modal content changes.
It moves focus only if focus has left that scope, preserving focus already
inside it. The stable layer ID and original opener ref remain mounted. The
separate initial/activation effect remains, so nonmodal Return to workspace is
not pulled back by background updates. Added a narrow Enter Help -> Enter Data
scenario asserting focus is inside Data, then Escape returns to the original
external Help button.

Verification this round:
- RED: `node --test src/lib/localize-ui.test.mjs`, 2 pass / 1 fail, expected
  zh/en reconciliation key mismatch.
- GREEN: same focused command, 3/3 pass, no skips/failures.
- `node --check tests/e2e/keyboard-dialogs.spec.mjs`: pass.
- `npm run build`: pass, 1622 modules; concurrent accepted E2/S4 code was present.
  Existing >500 kB bundle-size advisory remains.
- No broad check rerun, installation, native picker, browser CLI, staging or
  commits. Root owns actual static CUA for both repaired paths; broader remaining
  native-picker/screen-reader limits above remain unchanged.
