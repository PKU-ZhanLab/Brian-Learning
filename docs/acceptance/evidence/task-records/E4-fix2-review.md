**Missing-current-selection Boolean audit bypass — ADDRESSED.** `src/lib/source-artifact.js:145`–`152` now requires a verified explicitly selected artifact to bind each retained, extant declared path. When none applies, it emits semanticReviewRequired with the original artifact/cell/path/locator, current recordVersion and `reasonCode: unresolved-source-version`. This happens before the unselected-artifact skip at `:154`, so the correction Boolean cannot disappear into a successful audit. Unselected historical expected values are not compared and no highest-version fallback is introduced.

**Check — Regression evidence:** the new test in `src/lib/source-artifact.test.mjs:164` reproduces the schema-valid URL-only/new-recordVersion witness while preserving artifacts/events. Both incorrect true and correct-looking false remain unresolved without selection; explicit v1 selection restores the false-versus-true comparison; the correct value with explicit selection passes. It also confirms the two previously disclosed inherited n=17 unchecked paths remain unchanged.

## New breakage in the fix diff

**None found.** The new applicability guard considers verified selected artifacts that actually bind the same stable path, so an unselected historical version does not independently force a mismatch when a selected version binds that path. Existing extant-entity and absent-native-legacy handling is retained. No production artifact, index, coordinate or review-state data changes in this diff.

## Out-of-scope observations

**None.** The two original findings remain addressed; this round did not broaden their review.

## Verification

**Check — Inspected supplied diff:** `19b703fe0db92b4b0bd8126a2eeda816f9c6014f..281ec2372b46b1e5cf5288ea035cbf944a833f14`, 37 additions / 2 deletions in the implementation and its tests only.

**Check — Recorded covering run inspected, not rerun:** `output/evidence-acceptance/e4-fix-round2-tests.log` explicitly names the new Boolean test, additive-version and native-v2 tests; records 12 tests / 12 pass / 0 fail. The appended fix report gives the matching command and observed RED/GREEN evidence.

**Check — Recorded offline output inspected, not rerun:** `output/evidence-acceptance/e4-fix-round2-source-audit.json` records valid true, 3 artifact files, 8 coordinates, 170 fields, empty integrity/semantic/unavailable arrays and humanReview pending. No new focused probe was necessary. No suite, git command, browser operation or subagent was run.

**Check — Binding constraints:** source/version selection remains explicit, historical artifacts/events remain preserved, and this fix does not alter the eight MNI-unspecified points, zero overlay eligibility or pending human/spatial review.

## Verdicts

**Spec compliance: Pass within this scoped fix.** The outstanding missing-current-selection bypass is closed without guessing source versions or fabricating historical data.

**Task quality: Approved within this scoped fix.** The targeted regression covers absence of provenance, actual semantic comparison after selection, and preserved disclosed numeric limits.

**Fix round: All findings addressed, no new Critical/Important breakage.**
