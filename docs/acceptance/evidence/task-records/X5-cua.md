# X5 actual desktop acceptance — 2026-10-30

Root used CUA on pinned c00d8be and fixed eaed1996da77e7575afce9cd6dadd793f3a1e053 atlocalhost4214, ordinary synthetic-file chooser imports and actual downloads. No storage injection, monkey-patched browser API or hidden application state read was used. Current preview is fixed build/session44463; viewport override is reset.

## Passing actual checks

- Baseline c0bd8e2: half-entered finding disappears after Anatomy→Evidence library→Add finding. On X5, identical content survives mode changes, normal refresh and explicit Resume draft. Separate filter change closes the editor but keeps its exact finding text and owning paper for recovery.
- Incomplete formal result save is refused by required-field validation and retains its saved draft. A50021-character payload exceeds the actual draft budget; mode change stays in the editor with all50021characters. Explicit discard removes the draft and it does not reappear after mode roundtrip.
- Initial X5 c00d8be allowed Export project after autosave failure; the actual file had0drafts. Fixed eaed199 rejects export with no Confirm download and retains full editing. Changing to a valid new value and immediately exporting from visible Draft pending save yields an actual project file with one exact latest draft/record/project identity. fixed-export-receipt.json records decoded assertions.
- Actual local browser storage quota was reached using an admitted synthetic envelope of5210000characters plus a40017-character unfinished finding. Native setItem quota refusal was visible without mocks. Navigation and export were blocked; complete input remained. After explicit discard, actual exported notes/evidence/drafts/volumes/original and recomputed snapshots equal the preceding fixture. Public link omits pending draft/source artifact content. The earlier2610000-character fixture did not exhaust quota and is explicitly recorded as a non-failure calibration.
- A normal file open of the exported small project restores its saved draft. Formal metadata save removes only its own draft; after normal refresh, the new title is durable and the unrelated finding draft is still recoverable.
- Invalid JSON import preserves the exact active editor value. Successful same-project-ID replacement clears active editing, old draft recovery and a known nonempty undo history, while restoring the imported original paper.
- Actual deletion preview lists1paper,2results,2locations,2claims,1relation and1source artifact. Confirm removes the paper/layer; one Undo restores them. The actual downloaded project equals the original evidence and layer objects exactly, and the nonempty source artifact still passes its excerpt/record hash verification. This adds live nonempty-artifact coverage beyond the empty-array unit fixture.
- No localhost4214 console errors were recorded during these interactions.

## Evidence and limits

Receipts, fixtures, screenshots and immutable build entry hashes are in output/x5-cua. Key records: recovery-receipt.json, filter-recovery.json, pending-draft-export-baseline.json, fixed-export-observations/receipt.json, real-quota-observations/receipt.json, undo-receipt.json and import-and-formal-save.json. Original downloads remain in Downloads. The large quota project was replaced by the small synthetic project afterward.

A CUA reload attempt during real quota failure returned while the complete unsaved editor remained. getJsDialog exposed no confirmation handle, so an actual visible native leave-dialog UI was not verified; keep that narrow gate open. Native OS picker cancellation, screen reader, physical touch/color-vision and isolated Playwright execution remain unrun. Human scientific review remains pending by user choice.

Raw draft budget/quota/JSON errors and duplicate prior success messages are visible; X8 owns their clear bilingual presentation. This does not affect the verified zero-overwrite paths. Software verification comprises worker320/320 fullcheck before fix, worker40/40 covering tests/build for fix, root16/16 fresh focused pass and independent fix review PASS; no claim of a post-fix full suite run yet.
