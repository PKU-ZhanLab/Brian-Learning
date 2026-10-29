# S3 actual desktop acceptance — 2026-10-29

Root used the selected in-app browser through CUA. Runtime source was pinned in immutable local archives. HTTP-only localhost proxies supplied known failures/delays; they did not automate the browser, inject application state, or import files. Downloads used ordinary UI buttons; original downloaded files are retained.

## Passed on 2912228

- **Initial manifest failure and in-page retry:** request 1 returned 503, Retry data loading appeared; request 2 returned 200 after one click and the DK query became ready with the expected byte-bound source/version. The old pinned 604abd6 baseline showed no Retry and remained unloaded after its separate request succeeded.
- **Preservation through another failed initialization:** saved one synthetic note and one explicitly synthetic local paper through the UI, downloaded notes/evidence, reloaded into controlled manifest request 3=503, then retried to request 4=200. Notes match field-for-field; both evidence downloads have identical SHA-256 `47ab479f5820d8acd0cb3c44d6c453ed1d7d3bb8dd1b74353b2f803029e23521`. The only note-file difference is export time. See retry-receipt.json.
- **Error retention and actual camera restoration:** forced volume.json's first load to fail, chose Sagittal and zoomed in twice, exported a project before retry. During the delayed retry, the old error remained and Retry was disabled. After success the error cleared. A second project export has exactly the same camera position, target, zoom 1.4884, frameExtent and up vector. See camera-receipt.json.
- **AAL→DK→BA with late AAL:** observed AAL loading clear query source/label; selected final BA loaded first. HTTP logs confirm AAL returned later, but the visible query still identifies BA and `public/data/ba-v2/talairach-ba.bin`. DK was already cached in this scenario.
- **AAL→BA→AAL with all transfers pending:** a fresh page started the delayed requests. All switches cleared active query fields. Clicking the visibly rendered gray cortical surface during final AAL loading returned no old source/label. Final AAL was ready with the registered AAL source/version. One shared AAL transfer served both A selections. See aba-records.json and delayed-events.jsonl.
- **Actual cortical hit, white-matter visibility, and slice replacement:** a real surface click returned AAL 2201 Frontal_Mid_L by cortical-ribbon query at decimal coordinates. Showing white matter preserved the complete query. Moving the axial slider changed method to voxel and coordinate Z to 39. The source/version remained correct.
- **Fractional slice click and background:** an actual axial canvas click produced `[-0.6411077115099317,-19.012503815564514,39]`, label 4011. Moving to Z=120 returned a completed background result with no label, without nearest-label filling.
- **Native and unknown spaces:** Original T1 slices rendered AAL on its Colin27 T1 in three views; native comparison was disabled and the main registered AAL query did not change. Schaum's MNI-unspecified coordinates opened in their independent axes-only frame, with no direct brain-overlay control. The later paper-selection bug below was separately isolated.

## Found and fixed, then passed on 2644ab3

Opening Schaum without a permitted direct mapping cleared a valid independent query and falsely reported background/loading at the unchanged coordinate. The original failing JSON/screenshot is preserved. Fix 2644ab3 passed independent scoped review and 25 focused tests.

Root repeated the same real surface-click→paper-open sequence. All seven visible query attributes and the text remained exactly equal. Opening/closing the MNI-unspecified coordinate viewer and closing the library also preserved that query. The main detail area said Select a 3D structure to begin; source-label detail count and selected concept rows were both zero, so retaining a spatial query did not grant a paper an anatomical attribution. See fixed-paper-query.json/.png.

## Evidence and limits

All receipts, recorded DOM/AX text, screenshots and actual downloaded copies are under `output/s3-cua/`; acceptance-receipt.json validates the observed UI records and names each artifact. Raw HTTP logs establish which request failed or returned late. No viewport screenshots are used as a substitute for source/coordinate assertions.

The authored Playwright CI suite was not run. Actual file-import acceptance is still awaiting the user's permission after the earlier browser denial and was not bypassed. This does not establish anatomical accuracy or human review. The mixed static/dynamic import warning is tracked for X9. The T1 error child's old refresh-to-retry wording and untranslated raw error are tracked for X8; the actual shared Retry control worked.
