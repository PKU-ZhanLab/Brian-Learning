# X4 fix round 1 independent re-review

Scope: exact `583e9cf..c0bd8e27054aeba490526135330a935a779984b2` (seven changed files). Read the fix review package, appended implementation/admission report, original review and root's `output/x4-cua/baseline-mixed-return.json`. No review of unrelated changes, browser operation, test rerun, production edit, commit or delegation was performed.

## Original P2 — ADDRESSED

The original issue was that a clicked MNI marker could open the first, unrelated reported frame with no selected coordinate. Root's baseline receipt independently records `MNI-unspecified`, only `private-native-point`, and no selected rows at `583e9cf`.

The fix completes the missing selection chain:

- `src/App.jsx:104` holds a transient coordinate ID; `:332–335` passes the exact marker coordinate through result opening instead of dropping it. `:412` passes it into the panel and updates it on independent-point/table selection while keeping the existing exact X1 origin.
- `src/lib/result-coordinate-selection.js:4–6` resolves only within the current E2 result, deriving its actual reported space from the matched coordinate. It neither changes evidence nor confers overlay eligibility. Missing/foreign IDs produce no selected point.
- `src/components/ResultCoordinates.jsx:11–16` initializes and resynchronizes frame/selection for a new coordinate even when the result ID is unchanged. `:53` exposes the selected ID beside the actual frame; `:57` marks the exact row. `:30–34` adds an independent wireframe point indicator.
- Source return sends the panel's current selected point (`src/components/ResultCoordinates.jsx:51`) and restores that same transient ID when reopening the E2 result (`src/App.jsx:336`), including after panel remount.

## Spec verdict — PASS for this fix delta

The P2 is addressed by transient display state without a saved schema change. Reported coordinates, source spaces, result identities, scientific data and W5/W6 eligibility remain authoritative and unchanged. The visible indicator is separate from the original point mesh; it does not claim an activation extent. Existing bilingual labels and the concise frame/ID display remain intact.

The admission correction is appropriate: unknown Location frames use supported `MNI-unspecified`, rather than invalid null values. `tests/fixtures/result-layer-fixtures.mjs:8–15` creates the shared unknown/mixed fixtures by E2 migration. Its `:20–24` preflight calls actual `validateEvidence` and transactional `stageProjectImport`; `tests/e2e/result-layers.spec.mjs:11` invokes that preflight before every fixture upload. This strengthens the test premise rather than weakening production validation. The remaining null test explicitly checks E2 rejection and is labeled as a defensive display edge (`src/lib/result-coordinate-selection.test.mjs:30–35`).

This also corrects the old review's null-space wording: null preservation was a defensive component observation, not evidence that a null Location could pass normal project admission. The reachable unknown-space acceptance scenario is the supported `MNI-unspecified` fixture.

## Quality verdict — PASS; no new actionable defect found

- Point indicator updates when selection changes, reads only original coordinates, and stays outside the `spheres` list used for raycasting (`src/components/ResultCoordinates.jsx:25–34`, `:41`). It cannot steal independent point clicks. Its geometry/material are disposed and the ref cleared under the existing lifecycle guard (`:43`).
- Same-result second-marker changes and source reconstruction have focused helper coverage (`src/lib/result-coordinate-selection.test.mjs:23–28`). Shared admitted fixtures are exercised through their real E2 view models and W5 resolution (`:45–55`), and the unknown-layer round trip now stages the project (`src/lib/result-layer-controls.test.mjs:35–44`).
- The new browser scenario asserts the actual MNI frame and selected row immediately after the first marker click, then a second marker and source return (`tests/e2e/result-layers.spec.mjs:90–100`). It no longer masks the original defect by manually selecting a table row first.
- No production W5 eligibility, public-link sanitization, schema, contour, atlas-label identity or unrelated scientific path is altered in this delta. The earlier private-origin preservation checks remain in place.

## Verification boundary

Inspected the existing `X4-fixture-check.log` tail: 307 tests, 307 pass, 0 fail. Root reports a separate 13/13 targeted pass. Neither run was repeated by this reviewer. Root's receipt proves the baseline failure; it does not prove the fixed browser behavior. Actual fixed-build first/second marker hits, selected indicator visibility and source-return continuity remain root CUA acceptance. These pending live checks do not change the static ADDRESSED verdict.
