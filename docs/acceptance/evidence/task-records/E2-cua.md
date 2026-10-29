# E2 actual desktop acceptance — 2026-10-29

Pinned build: source commit `5ef95bed0bee54349ec023214d02868c0af2f901`; served on localhost:4193 from `output/cua-e2-5ef95be`. Actual user-interface actions used CUA only. No user research records were loaded; isolated origin contained a synthetic temporary edit.

Passed:
- Opened Schaum finding, changed its summary with an explicit synthetic-test suffix, saved. Result and coordinates displayed Draft; no inherited current-version check was created.
- Explicitly selected result source-check, supplied AI actor name/date/scope, and selected only first coordinate for a new check. Missing required details blocked submission. Actual keyboard date interaction completed successfully; initial date-fill-only observation did not persist and is not treated as an app defect.
- Saved result showed source-checked; first coordinate source-checked; other three remained Draft and all remained MNI-unspecified.
- Downloaded both draft and checked evidence JSON through actual export buttons; copied immutable files to `output/e2-cua/`. Schema validation and assertions over downloaded bytes confirmed exactly two fresh subject/version-bound events, original coordinates, preserved historic review events, and no human certification. Receipt contains hashes.
- Reverted temporary local edit through UI; original four checked coordinates and finding returned, synthetic edit no longer displayed.

Not completed:
- Browser authority denied fileChooser.setFiles to localhost:4193 with user-declined permission. No native picker, script, alternate-browser or indirect bypass attempted. Actual JSON import/roundtrip remains not-run; pure codec tests are not substituted for this interaction.
- Full project integration remains W2/W6/G1 acceptance.

Artifacts: `output/e2-cua/receipt.json`, `draft-evidence.json`, `source-checked-evidence.json`, `source-check-scope.png`. These contain synthetic workflow events and are test evidence only, not scientific curation records or publication content.

## Authorized import completed on bf1d5f1
The user allowed syntheticlocalhost imports. Root CUA imported source-checked-evidence.json through the actual chooser: UIconfirmed1paper/1result; onlyexplicitresult/firstpointchecked, remaining3pointsdraft. Actual globalexport BrainEvidence-results (3).json contains exactimportedrows inall10collections plusunchangedcanonicalbuiltinextras; output/e2-cua/import-receipt.json verifiesper-ID equality. Initialwhole-arraycheckincorrectlyexpectedselectedpaper-onlyexport; correctedcomparisonkeepsglobalextras and independentlycomparesthemto pinnedcuratedEvidence, no productionchange. Screenshotimport-authorized.png. Earlierfileauthorizationgate isresolved; W6/G1projectintegrationstillseparate.
