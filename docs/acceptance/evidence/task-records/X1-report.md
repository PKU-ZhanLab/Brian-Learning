# X1 implementation report

Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Base supplied by root: `8f7b6f19948e847ba923aaa43fc329eab3a0eae6`.
Status: implementation and local verification complete; independent review and immutable-build CUA acceptance belong to root. Changes remain unstaged. No commit, push, deployment, subagent, browser execution, Python environment change, or dependency installation was performed.

## Implemented behavior

- `parseCoordinateInput(text,{spaceId,convention,maxPoints})` preserves finite decimal coordinates, handles comma/whitespace rows, newline/semicolon batches, JSON triples and JSON batches. LPS explicitly converts X/Y to internal RAS. Missing space, invalid convention, empty/incomplete/nonfinite values and more than 1,000 points produce field errors. Invalid batches are atomic: no partial navigation.
- Shared bilingual `CoordinateNavigator` supplies single/batch paste, point selection, source-space/convention controls, jump, provenance-bearing copy, positive per-axis step and explicit `[0,0,0]` center. No input or restoration clamp is applied. Native atlas slice clicks no longer round to integers; native/main/ROI displays retain entered numeric values. Bounds warnings describe displayed template extents, not anatomical validity or registration accuracy.
- The main navigator starts collapsed. The task entry expands it and focuses its coordinate input. Its collapsed summary is the single XYZ readout; the expanded navigator owns that readout while open. Out-of-template coordinates remain flagged even when collapsed. Native/ROI inputs retain locked, distinct source references.
- Task entries call existing anatomy/research/ROI flows: Enter coordinates, Search regions, Import image, Find papers. Import opens the existing NIfTI form and focuses the file control. The coordinate example is explicit and skippable. No additional scene state or automatic ROI computation was introduced.
- Exact source identity remains explicit. Only canonical `MNI152NLin6Asym` input routes to App's legacy `brain` sentinel. Raw `brain`, `independent:brain`, and recursively reserved-looking names are escaped injectively, stay independent, and roundtrip distinctly through display/copy/named/project state. Unknown or other reference spaces invalidate the main atlas query and retain independent context.

## Compatibility and privacy boundary

Root authorized a narrow extension of the existing v2 view codec, plus the obsolete native-slice regression fixture update. No parallel serialization subsystem was added.

- `coordinateSpace` persists App's existing context string or explicit null. Only an absent legacy field defaults to `brain`; supplied null, unknown and native values remain independent. Finite coordinates, main slices and native `slicePoint` are preserved outside displayed bounds. Existing bounded camera validation is retained.
- `coordinateOrigin` records `kind: manual | result | private | unknown`, `cameraSensitive`, `imported`, and, for result origins only, the exact result/reference/coordinate/space IDs. This is operational provenance, not scientific certification. Missing or unsupported origin kinds become unknown; a generic `public` flag grants nothing.
- Public result coordinates require W5 `projectPublicResultLayers` canonical equality against bundled evidence and current local records, plus an exact current point/space match resolved through the existing layer mechanism. IDs or publication flags alone do not authorize coordinates. The check does not depend on the layer still existing, so layer deletion does not release the active private point.
- Project-file parsing always marks coordinate provenance imported and the camera sensitive, overriding supplied `imported:false` or `cameraSensitive:false`. Imported manual-looking origin cannot grant public sharing; a canonical result reference must still independently pass the W5 gate. Declared origin metadata remains in the private project. Foreign named-view manual provenance is also marked imported; owned named views retain their established local boundary.
- Actual fresh manual coordinate submission/batch selection/center can establish manual point provenance. Per-axis steps and slice movements preserve prior origin; they cannot turn private result coordinates into public coordinates merely by moving an axis. ROI-derived locations are private; custom-source coordinates are private; result-overlay and scene-marker selection retain result origin.
- A fresh manual point does not release an old sensitive camera. Taint survives normal navigation and restoration; a false restored flag cannot clear live taint. Reset view clears it only after invoking BrainScene's reset, which frames bundled cortex/anatomy and excludes ROI and result-marker groups. Direction-only standard views retain the existing target, so they deliberately do not clear taint. This distinction is intentional.
- Public projection resets private/unknown/independent coordinates, all main slice coordinates, camera, related explorer slice/camera state and query context, and reports `coordinate` omission. If a public/manual point is allowed but its prior camera is sensitive, the camera is omitted separately. Public main crosshairs are synchronized to the authorized point so copied public IDs cannot authorize unrelated imported slice values. Private projects and named views keep their complete local context.
- The pre-existing tests for public native slices/public camera sharing now explicitly declare trusted local manual provenance. They are separate from the tests proving file claims cannot establish that trust.

## RED evidence

Commands were run in the checkout above.

1. `node --test src/lib/coordinate-input.test.mjs` before implementation failed `ERR_MODULE_NOT_FOUND` for `coordinate-input.js`.
2. `node --test --test-name-pattern='coordinate context|public projection resets' src/lib/workspace-project.test.mjs` failed 2/2: coordinateSpace was absent and independent-coordinate omission was absent.
3. The precision-step test failed with actual `0.123456789012346` versus expected JS numeric addition `0.12345678901234569`; the unnecessary `toPrecision(15)` was removed.
4. The sentinel-routing test initially failed because the navigation boundary exports did not yet exist.
5. `node --test --test-name-pattern='same-template private|canonical public result identity|explicit manual input' src/lib/workspace-project.test.mjs` failed 3/3: same-template private/unknown positions remained public, locally altered public-looking records were accepted as coordinate origins, and a sensitive camera remained in a manual-point link.
6. The origin-transition test initially failed because `nextCoordinateOrigin` did not yet exist.
7. `node --test --test-name-pattern='canonical public result identity' src/lib/workspace-project.test.mjs` failed for copied public point identity with mismatched slice values `[901,902,903]`.
8. The first full check passed data/literature checks and 266/267 tests; its only failure was the old native-slice test expecting `[999,-999,999]` to clamp to `[100,-140,120]`. Root authorized changing that obsolete expectation to retain exact finite decimals.
9. `node --test --test-name-pattern='canonical reference|reserved-looking' src/lib/coordinate-input.test.mjs src/lib/workspace-project.test.mjs` failed 2/2 for raw `brain` versus raw `independent:brain`; recursive namespace escaping fixed the collision.

## GREEN and final verification

- `node --test src/lib/coordinate-input.test.mjs src/lib/workspace-project.test.mjs src/lib/query-state.test.mjs`: 50/50 passed at the initial parser/space integration stage, preserving S3 query identity/generation behavior.
- `node --test src/lib/coordinate-input.test.mjs src/lib/workspace-project.test.mjs src/lib/atlas-slices.test.mjs`: latest run after the final exact-source-name correction passed **54/54**.
- `npm run check`: the completed full run passed data/hash/literature checks and **272/272 tests**, after privacy and obsolete-native-clamp corrections and before the final namespace collision regression was added. The final namespace change was then verified with the 54-test focused command above; no broad rerun was made solely to repeat already-passing checks.
- `npm run build`: latest run after the namespace correction and collapsed-summary bounds indication passed, Vite 7.3.7, 1,650 modules transformed. Existing dynamic/static `volume.js` import and >500 kB chunk warnings remain. Final entry artifact: `dist/assets/index-mh1o4NlR.js`; no deployment performed.
- `node --check tests/e2e/coordinate-navigation.spec.mjs`: passed after authoring/adapting the collapsed-input test helper.
- `git diff --check`: passed before report generation; only existing CRLF-to-LF normalization advisories were printed.

## Changed files

New:
- `src/lib/coordinate-input.js`
- `src/lib/coordinate-input.test.mjs`
- `src/components/CoordinateNavigator.jsx`
- `src/components/TaskEntryPoints.jsx`
- `tests/e2e/coordinate-navigation.spec.mjs`

Modified:
- `src/App.jsx`
- `src/components/SliceViews.jsx`
- `src/components/AtlasSlicePanel.jsx`
- `src/components/ROICompare.jsx`
- `src/i18n/ui.js`
- `src/styles.css` (new-control styles and local disclosure overflow only)
- `src/lib/workspace-project.js` / `src/lib/workspace-project.test.mjs` (root-approved compatibility/privacy extension)
- `src/lib/atlas-slices.test.mjs` (root-approved obsolete clamp expectation and trusted-local public-link fixture)

This report is `.superpowers/sdd/README/X1-report.md`.

## Self-review and limits

- Reviewed all App coordinate transitions, including private ROI centers, custom atlas selection, result overlay, result-marker re-selection, slice changes, manual entry, named/project restoration, and explicit camera reset. Result source eligibility uses existing W5 authority and exact point equality; no imported publication flag is accepted.
- Reviewed that S3 resource/query paths remain authoritative and that mode values remain `anatomy/research/roi`. No W6 result history, snapshot recomputation policy or source data were changed.
- Numbers use JavaScript finite-number precision; no arbitrary-precision arithmetic or localization precision is claimed. Input decimal values are not intentionally rounded or clamped.
- Browser regression files are authored for the isolated permitted runner only. `npm run test:e2e -- tests/e2e/coordinate-navigation.spec.mjs` was **not executed**, and no desktop browser or browser storage was operated. Browser/clipboard/focus/linked-canvas behavior, breakpoint/zoom accessibility and the private-result → manual point → reset-camera scenario remain for root's immutable-build CUA acceptance. Root's supplied pre-X1 synthetic privacy witness motivated the additional origin guard; this worker did not independently execute that witness.

## Fix round 1 — X1-R1 and X1-R2

Review base: committed `a809ce3c97e08903d3b04d6027459f4626c578bc`. Read `X1-review.md`. Scope was restricted to the two Important findings; **X1-R3 remains deferred to X8**, as directed by root.

### X1-R1: independent explorer privacy

Added `explorerSensitive` to the existing origin record, separate from the main `cameraSensitive` field. Project-file parsing forces both fields true regardless of file claims. Missing legacy explorer provenance is conservative. Main manual navigation preserves the explorer boundary; a main BrainScene reset only clears the main camera field. Restoring a view cannot clear an already-sensitive explorer boundary with a false supplied flag. Foreign named views are conservative for both contexts.

When the main coordinate and camera are shareable but the independent explorer context remains sensitive, `encodeView` resets only the projected explorer `slicePoint` and `camera`, reports `atlasExplorer.location`, and leaves the live/private context unchanged. Owned named views and project files still preserve the complete explorer state. A fresh app initializes a known empty explorer context as nonsensitive. Imported explorer context remains conservatively omitted from public links across main-only operations; this fix does not silently reset its user-visible slice or camera state or add an explorer reset workflow.

The exact new witness uses explorer `slicePoint:[111.25,222.5,333.75]`, camera position `[901,902,903]`, target `[801,802,803]`, actual project parsing, manual main point `[10,20,30]`, then the actual main reset transition `{...origin,cameraSensitive:false}`. It verifies that public links omit the explorer locations while named/private project roundtrips and the source object retain them. The pre-existing native/public-link fixture explicitly marks its trusted local explorer context nonsensitive; no assertion was weakened to accept imported trust.

### X1-R2: raw versus legacy source identity

Newly typed raw `pam50` and `schematic` are escaped just like raw `brain` and reserved prefixes. Historical stored `pam50` retains its existing `PAM50 native straightened` display meaning. That historical mapping now lives in the tested `coordinateReferenceSpace` boundary; App no longer applies a separate unconditional `pam50` rewrite. Raw `pam50`, raw `PAM50 native straightened`, raw `schematic` and recursively escaped names remain independent, display/copy exactly, and survive private/named roundtrips. Returning the unchanged raw reference to `CoordinateNavigator` also preserves its expected batch signature instead of clearing the newly pasted batch.

### Fix-round RED / GREEN evidence

- RED: `node --test --test-name-pattern='X1-R1|X1-R2|reserved-looking' src/lib/coordinate-input.test.mjs src/lib/workspace-project.test.mjs` — 1 passed, 3 failed. Failures demonstrated explorer taint being cleared by a new manual origin, missing imported explorer sensitivity, and the missing centralized historical `pam50` display mapping.
- GREEN: the same command — **4/4 passed** after the narrow fixes.
- Final focused regression: `node --test src/lib/coordinate-input.test.mjs src/lib/workspace-project.test.mjs src/lib/atlas-slices.test.mjs` — **57/57 passed**.
- `node --check tests/e2e/coordinate-navigation.spec.mjs` — passed.
- `git diff --check` — passed, with only existing CRLF normalization advisories.

Authored, but did not execute, two browser cases in `coordinate-navigation.spec.mjs`: exact raw `pam50` batch/copy retention; and synthetic project import → manual main point → Reset view → share link, followed by reopening the explorer to confirm that its visible private point was retained. The fixture is generated in the isolated test itself; no production source or user file was changed. Root separately reported a real baseline CUA witness and owns fixed immutable-build acceptance. No browser, storage, subagent, Python, dependency install, full check/build rerun, commit or deployment was performed in this fix round.

Changed in this fix round: `src/App.jsx`, `src/lib/coordinate-input.js`, `src/lib/workspace-project.js`, their two focused test files, the trusted-local fixture in `src/lib/atlas-slices.test.mjs`, the authored coordinate-navigation browser tests, and this report. Self-review checked fresh defaults, absent legacy fields, forged imported false flags, owned/foreign named restore boundaries, main manual/axis/reset transitions, unchanged private explorer storage, and the legacy/raw source-name mapping. X1-R3's reference-length mismatch was intentionally left unchanged.
