# W5 actual desktop acceptance — 2026-10-29

Runtime pinned to `b6f50edb6bb5b5861457caf6e5b2389d23f1cf84`, archived and built in `output/cua-layers-b6f50ed`, served at localhost:4205. Root used CUA normal controls only. No file was imported or uploaded.

## Passed on the initial W5 implementation

- Opened Schaum's four reported coordinates in the independent MNI-unspecified axes view. Save result layer closed the viewer and explicitly reported that the layer was saved but could not overlay the main brain.
- Saved a named view through the UI, then previewed and downloaded a full project. Offline parsing recovered exactly one layer containing all four stable location IDs, Schaum result/reference IDs, reported MNI-unspecified space, visibility and display style. It contains no second coordinate copy.
- The canonical resolver returns zero main-brain markers and four `unavailable-space` entries. Source-check status did not establish an exact main-template identity.
- Copy view link generated a real `neuroatlas-view-v2` URL. Its sole result layer uses neutral `public-layer-1`; the original random local layer ID is absent.
- Navigated normally to that copied public URL and exported the restored project. Every layer field equals the original except the intended neutral public layer ID. Research mode and all four stable coordinate identities survive.

Actual downloaded originals are retained in Downloads. Copies and the copied URL are under `output/w5-cua/`.

## Fixed named-view acceptance on bf1d5f1

Root built a separate pinned archive of `bf1d5f19a445b7974f3530fcb26178a037bb9429`, stopped only the known local preview session and served the fixed build on the same localhost:4205 origin. Ordinary reload retained the named view created through the earlier version's UI; no browser storage was inserted or edited.

- Entered an unfinished view name, then attempted to restore the real old layer-bearing entry that lacks a project origin. The UI refused it with the originating-project message, kept the dialog open and preserved the unfinished text exactly.
- Saved a new named entry under the current project through the UI. Switched to Anatomy (evidence panel count 0), then restored the new entry. The dialog closed only after success, and the evidence panel returned (count 1).
- Downloaded a third project after this restore. All layer fields exactly match the preceding public-link restored project, including all four stable location IDs, source/result identity, visibility/style and MNI-unspecified space. Research mode is restored. Resolving the saved layer still yields zero main-brain markers and four unavailable-space entries.
- Captured browser error/warning logs were empty. Screenshots and `receipt.json` preserve the visible refusal/owned-restore states and exact exported-file hashes. Offline verification imports the fixed pinned archive's codec/resolver, not a moving development module.

## Open acceptance

The independent review's cross-project collision bug is fixed and scoped re-review approved it. The actual unknown-origin refusal and same-project restore above supplement the focused synthetic A/B collision tests. Actual foreign/local project opening and invalid-coordinate restore still require permitted project import; visible/hidden marker rendering remains part of final X4/G1 integration. No browser acceptance is claimed for those unrun cases, nor for all persistent storage keys (actual UI/exports were checked; exact storage rollback is covered by focused Node tests).

The paper's external figure showed its existing load-failure fallback with working source links. This did not block coordinate data or saving; no remote figure bytes were used in these checks.

## Authorized private/local import acceptance

After user authorization, root imported synthetic project A containing one visible and one hidden private layer and two explicitly synthetic coordinates. Saved a named view normally, then opened independent project B reusing the same IDs but changing the first point from `[1,2,3]` to `[99,2,3]`. Restoring A's named entry was refused; the dialog and unfinished B name remained. B's downloaded evidence and layer fields match its input exactly, so the old view did not substitute coordinates.

Copy view link explicitly reported that local layers were omitted and should be shared in a project file. The actual clipboard URL decodes to empty resultLayers with no private paper/result/point/layer IDs or synthetic finding text. The full project keeps both visible/hidden entries and the resolver yields exactly the two visible positions; this is reference/render-input validation, not a claim to have visually counted occluded 3D markers.

Finally, opened a valid update of project A that removes one coordinate and has no current layers. Its old same-project named view still referenced that removed coordinate. Restore failed with the missing-coordinate reason, preserving the dialog, unfinished name, current empty layer list and updated evidence exactly in the real subsequent download. No browser-storage insertion was needed: all stale state was created through normal saved-view and project-file workflows.

`output/w5-cua/receipt.json` now includes the foreign-project, private-link and missing-coordinate assertions; actual project copies and screenshots are retained alongside it. Those former file-authorization gates are resolved. Visible/hidden marker control and visual rendering remain X4/G1 integration items; full W6 format restoration receives separate acceptance.
