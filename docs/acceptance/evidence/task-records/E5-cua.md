# E5 actual portable-reading acceptance

Pinned `ef814661dd2a2e2b3d90f774b278eeac2a75f496` at localhost:4209, built from `output/cua-package-ef81466`. Root used CUA normal page/file operations. E5 review findings remain under fix; these passes do not close them.

- Searched and selected Kanwisher 1997 and downloaded its evidence. The actual file has one reference, one reading, one claim, two mappings and zero structured findings/coordinates. Both language summaries, limitations, methods and mapping support match the committed legacy reading. Generic closure validates with no built-in context. This fixes the prior actual export containing bibliography only.
- Created a clearly synthetic renamed reference `cua-reading-only-20261030`, rewrote internal IDs and removed duplicate DOI identity. Imported it with the normal chooser. The page displayed its own title, method, full reading summary/limitations and both uncertain fusiform concept links even though no legacy built-in card uses that ID.
- Single-paper re-export preserves references/readings/claims/mappings exactly. The filtered-set export while this synthetic query is active matches the single-paper JSON exactly and includes no unrelated paper. No coordinates or anatomical verification were invented.
- Actual alias-package back-import reproduced E5-R1: independently valid `axelrod2015 -> cua-alias-axelrod` package is rejected in the built-in library with the self-alias validation error. The existing synthetic reading remains exact in the subsequent filtered export. `synthetic-alias-roundtrip.json` and `alias-baseline-error.txt` retain the witness.
- Browser warning/error logs were empty. Evidence, text/screenshots and downloads are in `output/e5-cua/`; `reading-receipt.json` describes the exact assertions. Original Downloads files remain preserved.

## Fixed alias import and conflict rejection

On pinned `8f7b6f19948e847ba923aaa43fc329eab3a0eae6`, served on the same localhost:4209 after rebuilding and reloading, the exact prior failing alias file now imports normally: one paper, two findings. Its actual single-paper export uses canonical `axelrod2015` references. The artifact body/hashes, locations and statistics remain exact, and the exported package passes independent closure and source audit with no integrity/semantic/unavailable errors.

A second structurally valid synthetic fixture changed only the active bibliography title while retaining the original alias snapshot. Import was rejected with a historical-title conflict. The subsequent actual paper export is byte-identical (same SHA-256) to the one obtained before that attempt. Evidence: `alias-fixed-receipt.json`, `alias-fixed-audit.json`, actual before/after JSONs and `title-conflict-error.txt`. No genuine human/spatial approval was introduced.

The review's remaining fixed-point source-event and repeated-same-alias paths have focused 55-test evidence and scoped independent approval. Cross-task project/public-share acceptance remains in G1; owning W2/W3/W5 evidence is recorded separately. X8 should clear stale success notices when a later import fails; in this actual case the old success status remained alongside the correctly displayed new error, with no data loss.
