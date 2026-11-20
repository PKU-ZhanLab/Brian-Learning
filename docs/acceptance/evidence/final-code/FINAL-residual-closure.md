# Final residual closure — primary integrator assessment

Code range: `cdeb6ed550733b13fb0cb3c24ccf41f0f80bcbd2..aa20e40f2e6261492f4ef8d63ba4f89204fca386`.

**Software disposition: R1 and R2 closed for the demonstrated code/API contracts.** This is the primary integrator's direct assessment of the bounded residual correction, separate from the earlier independent whole-branch and scoped reviews. It is not a second exhaustive branch review or a claim of rendered/browser/scientific acceptance.

## R1 — addressed

The complete changed loader, registry helper, adapter and worker-publication diff was inspected. Both `loadAtlasVersion` and its `loadAtlas` wrapper recheck the captured local owner after their await boundary, retaining abort checks. The comparison request predicate now reads current registry ownership on delivery and every later use; the existing worker handler checks that predicate before publishing results. Public byte identities, source validation and shared cache keys are not weakened.

The eight new residual regressions include warmed local APIs with and without signals, the exact comparison adapter, ownership expiring between loading and delivery, a previously valid predicate becoming false without an effect rerun, cold/warm current-owner success, abort/cancel, and public cached results surviving an unrelated local replacement. These run through the real canonical APIs. The preserved exact witness that has no catch now exits with the intended ownership rejection; the regression explicitly asserts that rejection instead of treating the original program's exit code as a passing test.

## R2 — addressed

The complete seven-file correction and new tests were inspected. A missing, empty or mismatched incoming selected visit now results in a separate selected active-view visit. Current and incoming historical entries retain their view and scroll data. A matching selected incoming visit remains selected. The existing capacity and computation-slot binding checks remain after the proposed addition; a required 51st entry is refused atomically.

The tests perform actual project staging, the same checkpoint operation used by App, a new navigation push and two back operations. They retain A's original view/scroll/original snapshot and B's recomputed snapshot; they cover missing, empty and explicit history and the 49/50-entry boundary. The older remap assertion was preserved on the historical entry, with an additional assertion for the separately selected active view.

## Independent root verification

- Matched all seven working source/test files to the worker's new `residual-source-sha256.json` before testing and again before committing.
- Inspected the complete bounded production/test diff, including the full new `final-residual.test.mjs`; no new broad code search or source edits by the integrator were needed.
- Ran `npm run check` on those exact stable files: data validators passed, literature validation passed, **450 tests passed, 0 failed, 0 cancelled, 0 skipped**. Receipt: `output/release-candidate/neuroatlas-4.2.0-20261030-root-final/verification/residual-worktree-check.txt`.
- Verified staged whitespace, committed the seven files as `aa20e40f2e6261492f4ef8d63ba4f89204fca386`, and confirmed a clean working tree.
- Preserved the worker's 73/73 covering receipt, all exact RED/GREEN programs, the cdeb6ed failed-scope review, and the withheld cdeb6ed reproduction. None was overwritten to present the earlier candidate as approved.

All Important findings established by the final broad review and its scoped follow-up now have corrected code and covering evidence. The earlier independent reviewer did not issue a later all-clear for aa20e40; this document records who performed the final direct closure. M2's dense-code maintainability observation remains non-blocking and disclosed.

## Remaining gates

Final distributable-source installation/build/hash/restore verification still belongs to the separately recorded delivery process. A documentation-only successor may carry these exact code changes and records; its build must identify its own actual source commit.

The recovery download/acknowledgement UI, label button, final combined browser journeys, native 200% zoom/picker/screen reader/touch, measured browser performance and viewer equivalence remain unrun. Human anatomical/source review and independent researcher acceptance remain pending. S6 stays partial, human=false, 14 coverage gaps and zero eligible replacements; E6's exact source-space gaps are unchanged. GitHub workflow authorization and deployment remain pending. No browser, server or remote operation was used for this closure.
