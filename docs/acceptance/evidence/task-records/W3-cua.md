# W3 actual desktop acceptance — 2026-10-29

Pinned source `ee4af54018b2506eb4a57aa1143cddb3e409b788` was archived to `output/cua-assets-ee4af54`, built successfully and served at localhost:4204. Root used CUA in the selected in-app browser, tab 15. No file was uploaded or imported.

## Passed

- Through normal controls selected registered AAL3 label 134 (Thal_Re_R, 7 source voxels) on both sides and the 1 mm grid. UI showed 7/7 voxels, Dice=1, Jaccard=1 and all labels retained.
- Project export first displayed the content preview; Confirm download produced a real `.neuroatlas` file. Offline parsing through the shared codec recovered the exact grid, metrics, 7,109,137 Uint8 classes (7 nonzero) and a manifest with 11 source identities.
- Added one explicitly synthetic note via the normal note-save transaction, then used Clear ROI overlay. UI returned to the uncomputed state. Export selected content produced a second real project download.
- The two decoded historical snapshots are deeply equal, including every class byte, grid, metrics, sampling report and manifest. The second file retains the synthetic note while `view.roi.computed` is false. The class-byte SHA-256 is `3f4196547c352dad8986b7bc48461040c550242cacf5214ae430033a830be760`.
- No browser errors or warnings appeared in the captured logs.

Actual downloads remain in the Downloads folder; copies, screenshot and assertion receipt are in `output/w3-cua/`. `receipt.json` records names, hashes and tested assertions.

## Limits

This confirms export and preservation of a snapshot committed through an ordinary workspace transaction. It does not establish the later W6 explicit inspect/recompute restoration flow, or preservation of an uncommitted result across a page reload.

Actual file open, merge, custom asset removal and restored missing-asset flows remain pending the existing unanswered synthetic localhost file-import permission request. No alternative browser, injected state or CI bypass was used. This run used no custom files or real research records.

The preview says `0 assets · 0 bytes` despite a stored computation payload: the count is image bytes only. This matches the independent review's Minor wording finding; X8 must clarify the displayed byte scope or include the calculation bytes. The current capacity admission uses the full payload budget.

## Authorized actual asset acceptance
See workspace-import-cua.md: A→Bassetownership, exactselectedexportpreview/file, detachviewretainhistory, removecancel/confirm, missinginputretention andmergehistoryverifiedbyactualCUA/downloads. Userauthorizationreceived; earlierfilepermissiongate resolved. No hiddenstorageinjection. W6finalformat/reproducibilityintegrationremains.
