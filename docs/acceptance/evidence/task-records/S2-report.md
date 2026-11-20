# S2 report — independent source-label selection

Worktree: `F:/project/brain-model/.worktrees/research-20261029`. Implementation and targeted Node/build validation are ready for root review. Desktop CUA interaction and project/view-container acceptance remain pending. No staging, commit, subagent, browser CLI, Python, package installation, source-data mutation or deployment was performed.

## Changed paths

- `src/lib/atlas-selection.js`
- `src/lib/atlas-selection.test.mjs`
- `src/components/AtlasRegionDetails.jsx`
- `src/components/AtlasRegionDetails.css`
- `src/components/BrainScene.jsx`
- `src/App.jsx`
- `src/components/ROICompare.jsx`
- `src/components/AtlasExplorer.jsx` — root explicitly extended ownership for optional full-reference selection callback plumbing.
- `tests/e2e/spatial-selection.spec.mjs`

Other workers' concurrent changes to ROI core, manifests, volume loading, workspace-session tests and evidence modules were left intact. Existing DialogHost, its focus/ARIA behavior, native overlay guards, ROI `resolutionMm`, sampling preflight and result fields remain.

## Behavior and contracts

`buildRegionIndex(manifest)` indexes recorded original labels using S1 `makeAtlasRegionRef` and `atlasRegionKey`. It skips user/custom volumes without recorded source-space identity; it does not fabricate atlas references for them.

`selectAtlasRegions(refs, mode, current)` deduplicates by the complete five-field key only. `serializeAtlasSelection` emits exactly the five shared reference fields, with fresh objects. `restoreAtlasSelection(saved,index)` returns `{selected,unresolved}`; absent versions/spaces remain unresolved. Neither name matching nor nearest-region migration exists in these adapters. `regionDetails` returns `{ref,labelName,sourceUrl,sourceLocator,relations,hasEvidence}`. It reads the dictionary provenance and exact identity relations; no relationship produces an empty list. `hasEvidence` requires explicit nonempty evidence IDs, and does not promote a dictionary/concept relationship into research evidence.

BrainScene's cortical colors and clicks read the same original DK vertex labels / validated ribbon labels / volume labels. The projected geometry/hash guard, source hemisphere restrictions and background handling remain. Per-vertex source refs drive exact highlighting. DK concept associations use only S1's explicit `exact-source` relations; AAL/AAL3/BA no longer acquire a concept through name scoring. Surface clicks call optional `onRegionSelect(refs,coordinate,queryContext)`; the original `onSelect` remains the separate concept/teaching entry. The query context also preserves method, request counter, click hemisphere, and replace/add intent; click hemisphere never rewrites source-label hemisphere. Changing a selected label updates materials without replacing the main geometry or issuing focus/reset. App suppresses automatic preset changes for exact label selection; explicit atlas/preset/view controls retain their existing behavior.

The independent atlas explorer adds “Use atlas label”, which returns the dictionary-backed ref with its source coordinate and query method. It closes through the existing DialogHost path. Native/unknown-space selections can open their details and be annotated; they do not change the main atlas, main-template coordinate, or overlay eligibility. Volume-only deep nuclei remain accessible there, rather than being placed onto cortex.

Minimal details show original label name/ID, version, source hemisphere, source space, query method and the dictionary URL/locator. Unlinked labels say “暂无已关联概念/研究结果” / “No linked concepts or research results yet.” No literature is synthesized. Explicit concept links are separate buttons.

Notes now have either original `structureId` semantics or full `regionRef` semantics. New region notes have no `structureId`; they preserve `regionRef`, display name, source coordinate/frame and query context. Existing note local persistence, JSON note export/import and saved-note buttons retain the region ref. Selecting a saved note resolves only its full key, and unavailable refs are disabled rather than migrated by name. Concept notes retain their original meaning. Region details filter notes by full ref key, keeping AAL 8121/8211 and AAL3 87/91 independent.

ROI entry keeps the selected atlas and original integer label, plus `aRegionRefs`. ROI state emits both `aRegionRefs` and `bRegionRefs`; descriptors pass these refs into worker result metadata. Restoring supplied refs against different current versions/spaces disables calculation and retains the original refs for unresolved handling. Explicit user reselection authorizes the new source identity. Legacy states with only integers remain readable; source identities are attached only after the current source actually loads, not fabricated as historical provenance. Existing loss confirmation, source-missing handling and shared-grid controls remain.

## Rulings

1. Root-only commit and CUA ownership override the brief's generic commit/browser-run recipes. No files were staged or committed and no browser CLI was used. Cost: root must review/commit and provide real interaction evidence.
2. Root approved the minimal AtlasExplorer extension because its existing internal numeric label state had no detail/annotation callback. No unrelated explorer behavior was rewritten. Cost: this one additional production file is part of S2's review scope.
3. The final noncortical use of the old name scorer assigned existing HO meshes to teaching display objects. Root approved replacing it with explicit source mesh ID → existing display-object IDs, solely to preserve existing geometry ownership. This table is not an atlas/concept equivalence relation and is not added to `atlas-region-relations`. Where the mesh source has an actual HO label ID, its source region ref is preserved for exact clicking/highlighting. Assets lacking such a source ref retain the concept/schematic path. Cost: changed source mesh IDs need an explicit display mapping update; no fuzzy fallback will silently place them.
4. Project/view schema ownership remains W6's. App supplies and consumes the fields below, but the current validator strips them. The adapter tests and note wiring are **not** full project/view round-trip acceptance. Cost: W6 must preserve/validate these fields and run the actual container scenarios.

## W2 / W6 handoff

App's view payload supplies `atlasSelection: AtlasRegionRef[]`, `unresolvedAtlasSelection: AtlasRegionRef[]`, and optional `atlasSelectionQuery`. `restoreWorkspaceView` resolves both arrays through the current source index and keeps absent/version-mismatched refs unresolved. The current `validateViewState` still strips the new fields, so named views, public views and full projects do not yet round-trip this selection. W6 must decide and validate the public subset; private notes/query free text must never enter public links. No new localStorage key was introduced by S2.

Project note normalization must preserve the exclusive target `{regionRef}` OR `{structureId}` plus region `queryContext`; `projectNotes` currently strips these new region fields. Preserve the full source space name (existing 50-character coordinateSpace truncation is insufficient for some identities), retain original versions, and reject malformed refs transactionally. Never migrate by structureName. The separate standalone note file flow already validates and preserves a full ref.

ROI view state must preserve `aRegionRefs`, `bRegionRefs`, `resolutionMm`, plus S4/S5's independently owned result/provenance fields. Current project/view containers also predate those additions. Native `atlasExplorer` currently retains original numeric source IDs but needs version/full-ref persistence in the W6 container work; this task's callback does not imply explorer project restoration has been upgraded.

## Verification evidence

- RED: `node --test src/lib/atlas-selection.test.mjs` failed with `ERR_MODULE_NOT_FOUND` for the missing new module, before implementation (`S2-red.log`).
- During test construction, corrected two fixture assumptions against actual source metadata: Frontal_Sup_L is AAL **2101**, not Precentral_L 2001; AAL3 native bytes are `uint8`, whereas AAL native bytes are `uint16`. These corrections do not change production label IDs or data.
- GREEN: `node --test src/lib/atlas-selection.test.mjs src/lib/surface-projection.test.mjs src/lib/atlas-explorer.test.mjs src/lib/scene-frame.test.mjs` — exit 0, **14/14 passed**, no skips (`S2-green.log`). New tests read every positive discrete label from all four real native/registered AAL/AAL3 binaries: **116 + 166 + 116 + 166** label refs round-trip unchanged. Temporal IDs, changed versions/spaces, unlinked source details, and absence of invented evidence are covered.
- `npm run build` — exit 0, Vite built successfully; existing large-chunk warning remains (`S2-build.log`). Latest observed build: 2.92 s. Build includes concurrent worker modules and is not a public deployment.
- `node --check tests/e2e/spatial-selection.spec.mjs` — exit 0. Test file covers unlinked Frontal_Sup_L → ref-bound annotation → ROI A 2101; independent temporal note targets 8121/8211 and 87/91; native LC_L with disabled main-template comparison. **No browser interaction result is claimed.** Root CUA owns desktop acceptance; the CLI suite was not run.
- `git diff --check -- <S2 owned implementation/test paths>` — exit 0.
- One opportunistic `npm run check` snapshot did **not** fully pass: **127 passed / 1 failed**. The failure was concurrent W2's intentionally added `workspace-session.test.mjs` importing the not-yet-created `workspace-session.js` (`ERR_MODULE_NOT_FOUND`, `S2-check.log`). This is reported as a concurrent integration state, not a green full-suite result; its owner must finish that module and root must rerun integration checks.

## Remaining acceptance limits

Desktop selection/highlight/annotation/ROI interaction, camera preservation in a live browser, note-button restore after refresh, project and named-view round trips, native-picker/reader behavior and final integration checks are not certified by these unit/build results. Root's CUA and W6's persistence scenarios must record their actual outcomes. S3 still owns unified asynchronous resource/query generation safety; S2's matching atlas ID guard and existing generation checks do not replace it. No new registration, independent anatomy verification or human anatomical certification is claimed.

## S2 review fix round 1 — per-side ROI acceptance and displayed surface picks

Reviewed `S2-review.md` findings against `15f0507`, with S5's committed integration at `5ef95be` preserved. Work resumed after the explicit user interruption from the existing WIP; baseline S2 was not redone. App and all W2 files remain untouched by this fix. Root approved the additional focused test in `tests/e2e/spatial-selection.spec.mjs`. No staging, commit, subagent, dependency installation, broad suite, browser CLI or deployment was performed.

Changed files in this fix:

- `src/components/BrainScene.jsx`
- `src/components/ROICompare.jsx`
- `src/lib/atlas-surface-selection.js` (new)
- `src/lib/atlas-surface-selection.test.mjs` (new)
- `src/lib/roi-region-state.js` (new)
- `src/lib/roi-region-state.test.mjs` (new)
- `tests/e2e/spatial-selection.spec.mjs` (focused supplemental component interaction)

**P1 addressed:** `changeSelection` only invalidates computation/restore work. It no longer changes either side's expected source reference. A separate `reselectRegion(side,kind,update)` accepts the current identity only for the side whose atlas or labels the user explicitly reselects. Grid, threshold and tail controls preserve both sides' expectations. B source/label controls and an accepted local-image import clear only B; they do not accept a changed-version A. The shared mismatch helper still compares full five-field keys, and the emitted state retains the unresolved original refs until explicit reselection. S5's manifest preparation, comparison validation, result freezing and JSON/CSV provenance export are unchanged; S4 grid/loss controls remain.

**P2 addressed:** cortical coloring stores its discrete per-vertex label IDs alongside the same per-vertex source refs and displayed source identity. All cortical hits now use that displayed data through `pickDisplayedSurfaceRegion`, including BA and BA-histology; the hit coordinate is no longer separately sampled for surface selection. The nearest displayed vertex determines a mixed-triangle categorical pick, and a background vertex remains background. A source/version/space mismatch rejects stale displayed data. Separate slice-volume sampling is unchanged. No geometry or binary data changed.

The real-data regressions independently read the committed left cortical mesh and the committed BA volume bytes. BA triangle 292 has `[18,18,18]` at the displayed vertices while its centroid samples volume label 17; the surface picker now returns ref label 18. BA-histology triangle 1389 has `[83,83,83]` while its centroid samples 81; the picker returns ref label 83. The tests assert the discrepant volume-coordinate values as well as the corrected surface references, preserving the distinction between surface and slice queries.

Exact verification commands/results:

1. RED, before adding the helpers: `node --test src/lib/atlas-surface-selection.test.mjs src/lib/roi-region-state.test.mjs` — exit 1, both new test files failed with `ERR_MODULE_NOT_FOUND` for their absent helper modules. Saved to `S2-fix1-red.log`.
2. Focused helper GREEN: `node --test src/lib/atlas-surface-selection.test.mjs src/lib/roi-region-state.test.mjs` — exit 0, **5/5 passed**. Both real triangles, categorical background, A mismatch through grid/threshold/tail/B edits, and explicit A source/label reselection passed.
3. Final focused regression: `node --test src/lib/atlas-surface-selection.test.mjs src/lib/roi-region-state.test.mjs src/lib/atlas-selection.test.mjs src/lib/surface-projection.test.mjs` — exit 0, **12/12 passed**, no skips (`S2-fix1-green.log`). This includes original-label round trips, explicit source identities and existing projection constraints.
4. `node --check tests/e2e/spatial-selection.spec.mjs` — exit 0. The new supplemental test mounts the real ROICompare with actual registered AAL/AAL3 sources and an old-version A ref, changes 2→1 mm, B label/source, B threshold/tail, and verifies A stays blocked/unchanged; explicitly reselecting A authorizes only its new identity. A local statistic fixture supplies the threshold controls. It uses an isolated component mount because App/project schema integration belongs to W6. **Authored only: no browser execution or App/project integration acceptance is claimed.**
5. `npm run build` — exit 0, **built in 2.81 s** (`S2-fix1-build.log`), with the existing large-chunk advisory. This validates the actual JSX wiring and S5 imports in the shared current checkout; it is not a public release.
6. `git diff --check -- src/components/BrainScene.jsx src/components/ROICompare.jsx src/lib/atlas-surface-selection.js src/lib/atlas-surface-selection.test.mjs src/lib/roi-region-state.js src/lib/roi-region-state.test.mjs tests/e2e/spatial-selection.spec.mjs` — exit 0.

Both reviewed defects are addressed in code and focused Node regressions. Actual control interaction, live camera/geometry behavior, project/view restoration and final whole-plan integration remain with root CUA / W6. The separate existing W2 worktree changes were preserved.
