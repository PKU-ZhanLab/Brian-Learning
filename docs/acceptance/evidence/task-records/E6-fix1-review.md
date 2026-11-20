**Bind the derived grid to S5's immutable asset record — ADDRESSED.** `src/lib/statmap-source.js:96–97` normalizes the authoritative `sourceGrid` with S5's existing `validateGridSpec` and requires exact equality with the already normalized manifest output grid before accepting the derived identity at line 106. Missing/malformed authority grids fail closed; shape, affine, space and order are included in the comparison. `src/lib/statmap-source.test.mjs:70–76` covers changed shape, the original 999 mm affine witness, changed order, missing authority geometry and equivalent nested/flat affine normalization.

**Preserve the downloaded original's rights evidence — ADDRESSED.** `src/lib/statmap-source.js:67–73` validates and defensively clones the supplied license/sourceRefs/date/optional basis; absent rights produce an explicit unknown record. Line 87 retains it separately as `sourceRights` while preserving the original candidate observation. `src/lib/statmap-source.test.mjs:78–84` covers exact evidence retention, independent mutation, absent rights, malformed/unsourced records and unchanged candidate/unknown-space/no-derived status. This records supplied rights evidence without independently certifying the external license.

### New Breakage in the Fix Diff

- None found in the bounded fix diff `0b73fcb7c31627afb4b4b1b389f8d9359f28447d..1a773a16f559240ab4bd6b08be56e0d595656385`.

### Out-of-Scope Observations

- No new observations. The previous review's P3 bilingual-limitation issue (`data-sources/results/upstream-assets.json:151–176`) and pre-existing build chunk warning remain carried forward, non-blocking for this fix round; neither is changed by this diff.

### Checks and Limits

- Read the supplied fix package once, the task brief, previous Important findings and appended fix report; compared the amended code/tests against S5 grid normalization (`src/lib/computation-manifest.js:14–17`, `src/lib/computation-manifest.js:32–45`). No Git command was run.
- Confirmed the named covering command in the report is `node --test src/lib/statmap-source.test.mjs src/lib/result-publication.test.mjs`. Read its existing RED/GREEN output: `E6-fix1-red.log` records 19 tests / 17 pass / 2 fail for the new missing-grid-rejection and missing-rights assertions; `E6-fix1-green.log` records the same named tests with 19 pass / 0 fail. The test changes exercise both specific findings and retain the prior positive derivation and publication cases. These are supplied run results, not a new reviewer execution.
- No specific new doubt required an executable witness; no suite, browser, desktop, Playwright, source download or network operation was run. Only this requested review report was written; source, index, HEAD and other changes were preserved.
- Scientific/anatomical correctness, actual external rights, browser/routing behavior, deployment and real human review remain pending or outside this fix review. Passing fixtures do not establish those acceptances.

### Verdict

**Fix round: All findings addressed, no new Critical/Important breakage.**

**Spec compliance: PASS for the two scoped findings. Code quality: PASS for this fix diff.** The unchanged scientific/browser/human-review gates remain pending.
