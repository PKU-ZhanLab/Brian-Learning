# E3 implementation report

Status: DONE_WITH_CONCERNS — implementation and static/model validation passed; real desktop acceptance remains root-owned. Base: `2912228ceac68bc2e1bad06bf0736723e805ee61`. Checkout: `F:/project/brain-model/.worktrees/research-20261029`.

No staging, commits, browser automation, user-storage access, uploads, Python execution, dependency installation or deployment were performed. The current root CUA baseline is historical evidence only, not evidence of the new implementation.

## Interfaces

- `buildEvidenceSearchIndex(bundle,{aliases,regions}): SearchIndex` creates language-independent entries. Each entry has `referenceId`, `normalizedText`, `topics`, paper-level `studyModalities: Reported<string[]>`, `resultEntries`, and unchanged copied `mappings`. Additional `fields` maps retain the origin paths used by `matchedFields`.
- `searchEvidence(index,{query,topic,paperModality,resultModality,regionRef}): SearchHit[]` returns `{referenceId,resultIds,matchedFields}`. Paper-method filtering requires reported values with source provenance. Result-method filtering selects only result IDs with that modality. It never relabels result methods. `regionRef` requires equality of all five atlas-identity fields, including side and version; it never infers a relationship from an alias.
- Normalization applies NFKC, case folding, Unicode dash and whitespace normalization. Both Chinese and English text are always indexed, independently of display language. Fields include bilingual titles/abstracts/conditions/limitations, findings, original location labels and source rows, ROI definitions, original source-region labels, and linked catalog names. Source-backed alias groups expand only when an original indexed field contains a group term; aliases cannot cascade or add mappings.
- Explicit reference/reading `studyModalities` takes priority. Legacy reading-library `modalities` can be adapted only when that reading has its independent `methodProvenance.source`. No result, mapping, title, or abstract supplies paper methods. Malformed or unsourced positive paper-method records become uncertain for display/search. Missing paper methods remain not-extracted; they do not mean a method was absent.
- Workbench paper and recorded-result methods have separate selectors. Paper detail shows both scopes. Cards show paper method tags. The recorded-result selector restricts displayed structured results using the returned result IDs. UI markers: cards `data-reference-id`; results `data-result-id`.
- New component state is `paperModality` and `resultModality`; `modality` remains a compatibility alias for the paper filter. The existing view/project codec bounds both fields to 100 characters, restores legacy `modality` as the paper fallback, and uses the same serializer/schema versions and privacy projection as before.

## Changed paths

Created:

- `src/lib/evidence-search.js`
- `src/lib/evidence-search.test.mjs`
- `data-sources/results/search-aliases.json`

Modified within original ownership:

- `src/components/LiteratureWorkspace.jsx`
- `src/data/results.js`
- `data-sources/literature-upgrade/curation.mjs`
- `scripts/literature_validate.mjs`
- `tests/e2e/evidence.spec.mjs`

Narrow additions explicitly authorized by root after concrete adapter requests:

- `data-sources/results/curated-results.json`: regenerated from the sole `curatedEvidence` representation.
- `src/lib/workspace-project.js` and `src/lib/workspace-project.test.mjs`: retain both new method-filter fields through the existing codec.

No App, BrainScene, ROI, volume, schema, workspace-session or persistence-store code changed.

## Primary-source anchors

Primary publisher re-read through the web research tool on 2026-10-29: [Schaum Version of Record](https://elifesciences.org/articles/61679), marked Version of Record May 4, 2021. The source-dossier E4 section and `output/source-research/existing-source-excerpt-candidates.json` were used to locate the existing result/table provenance, then the methods were checked against the live primary publisher before adding affirmative paper metadata.

- [Materials and methods](https://elifesciences.org/articles/61679#s4), heading **fMRI experiment**: describes 31 MEG participants doing the fMRI task plus 45 participants from Sebastian et al. 2017, total 76. This establishes fMRI at paper scope; those sample details are not newly copied into result records.
- Same methods section, **MEG experiment → MEG data acquisition and preprocessing**: describes a 275-channel whole-head MEG system. This independently establishes MEG at paper scope.
- **Introduction**, final paragraph before Results: describes MEG with fMRI used to validate source reconstruction; **Abstract** discusses motor inhibitory control and defines pre-SMA. These support the control topic and terminology context.
- [Table 1](https://elifesciences.org/articles/61679#table1): the pre-supplementary motor area and inferior frontal BA44/45 rows ground the minimal search aliases. Chinese forms in the alias file are explicitly identified as curator translations. The table remains MEG evidence; adding paper fMRI metadata does not change any table-result method.

`paperSearchAnnotations.schaum2021` records `studyModalities={state:'reported',value:['MEG','fMRI'],sourceRefs:[...#s4]}`, topics `attention/control`, publisher version, explicit methods heading locators, date and AI-assisted extraction. It creates no source-check, space-check or human-review event. E4 still owns offline source artifacts and field-level audit.

## RED → GREEN evidence

Logs are in this report's directory. Preliminary test creation had an extra closing parenthesis; that syntax failure was not accepted as behavioral RED. The implementation module was discarded, syntax corrected, and RED re-established before the recorded implementation:

1. `node --test src/lib/evidence-search.test.mjs`: module-missing RED, `ERR_MODULE_NOT_FOUND`; log `E3-red.log`.
2. Same command against empty API scaffolds: **4 tests, 0 pass, 4 fail**, including fixed-query assertion `zh: pre-SMA`, missing field-search, paper-method and alias behavior; log `E3-red-assertions.log`.
3. Initial index GREEN: **4/4**; `E3-green.log`.
4. `node --test --test-name-pattern='paper and recorded-result' src/lib/workspace-project.test.mjs`: RED, expected paper method `fMRI`, actual undefined; `E3-codec-red.log`. Codec then implemented and included in focused GREEN.
5. `node --test src/lib/evidence-search.test.mjs`: added defensive test RED for malformed/unsourced affirmative metadata; `E3-method-validation-red.log`. Index now keeps these unavailable.
6. Same search command: added historical-snapshot RED because applying new methods before migration retroactively annotated the retained v1 reference; `E3-history-red.log`. Annotation was moved after migration, onto active references only.
7. Final focused `node --test src/lib/evidence-search.test.mjs src/lib/workspace-project.test.mjs`: **28 tests, 28 pass, 0 fail**, including six search tests and the codec regression; `E3-focused-green.log`.
8. `node scripts/literature_validate.mjs`: passed; `E3-literature.log`. The final full check also runs it after the final historical-snapshot fix. Counts remain 118 references / 115 reading records / four structured results / eight coordinates, all eight `MNI-unspecified`. All 11 cross-species fixes remain covered.
9. One final `npm run check`: exit 0, **173 tests, 173 pass, 0 fail**; `E3-check.log`.
10. One final `npm run build`: exit 0, Vite build passed; `E3-build.log`. Two inherited warnings remain: `volume.js` is imported both dynamically and statically so dynamic import does not move it to a separate chunk; some minified chunks exceed 500 kB. Neither warning is attributed to E3.
11. `node --check tests/e2e/evidence.spec.mjs` passed; `git diff --check` passed. Git reports the existing CRLF-to-LF normalization notice for the edited JSX, no whitespace errors.
12. An independent portable-invariant assertion compared HEAD's complete JSON with the current JSON after deleting only the three new active Schaum reference fields (`topics`, `studyModalities`, `methodProvenance`): deep equality passed. All original legacy snapshots, results, locations, mapping values and review events are unchanged.

No broad check/build was repeated after it was green. Browser command `npm run test:e2e -- tests/e2e/evidence.spec.mjs --grep search` was deliberately **not run** because this task explicitly forbids browser automation; the test is authored for an isolated permitted CI runner, not accepted desktop behavior.

## Self-review and rulings

- Ruling: preserve independently sourced legacy reading-method curation through an index adapter, while requiring explicit reported provenance for affirmative paper filters. Cost if wrong: a legacy curated reading's method scope may be incomplete; this change makes no completeness claim and performs no new primary-method audit of the 115 historical readings.
- Ruling: annotate active references after migration. Historical `legacyV1` metadata remains original and does not acquire the new extraction. Direct regression and portable deep-equality verification cover this boundary.
- Ruling: root authorized the portable example and shared codec additions because otherwise the example equality validator and project restoration would be inconsistent with the new feature. No alternate serialization or schema version was introduced.
- Author self-review checked E1 mapping identity/laterality isolation, E2 missing-method provenance/historical snapshots, W2 transactional save-call preservation, no public query exposure changes, and result-modalities isolation. The two issues found (malformed affirmative display metadata and historical snapshot backfill) each received observed RED→GREEN regressions. This remains author review; root's review/CUA is independent acceptance.
- UI density: the two essential method selectors and detail summary express the required scope; cards retain compact method tags. No extra explanatory labels or descriptive blocks were added to the user flow.

## Root CUA selectors and expected behavior

Use the root-owned application session with region scope unrestricted, all other filters initially unrestricted. Existing query textbox names remain `Search papers, authors or regions` / `搜索论文、作者或脑区`.

1. Test `pre-SMA`, `pre SMA`, `BA44`, `BA44/45`, `停止`, `inhibitory` in English and Chinese. Each includes `[data-reference-id="schaum2021"]`. Pure-index IDs and card IDs should agree with equal filters; changing language must preserve the set. `前辅助运动区` and a Unicode nonbreaking-hyphen pre-SMA are additional model checks.
2. Topic selector `Filter by research topic` / `按研究主题筛选`, value `control`; paper-method selector `Paper methods` / `论文方法`, value `fMRI`. With query `pre-SMA`, Schaum remains a match and opens through `.paper-open`.
3. Detail `.paper-methods` shows Paper methods MEG/fMRI and Recorded result methods MEG. `[data-result-id="schaum2021-meg-stop"] .modality-tags` must contain MEG and must not contain fMRI. Search must create no new direct pre-SMA mapping/highlight.
4. Recorded-result selector `Recorded result methods` / `已录入结果方法`, value `fMRI`: Schaum disappears. Value `MEG`: it reappears. The selectors reset the paper view as before.
5. Language-switch button labels stay `切换为中文` and `Switch to English`. Card/result identity markers do not depend on display language.
6. Project/view filter round trips are model-tested. Actual project-file/export acceptance is not claimed here; root owns any UI/file permission and execution.

## Remaining limits

Desktop CUA, narrow-screen layout, 200% zoom and actual accessible-control behavior have not been exercised by this worker. The added e2e script has only syntax validation here. No human review, source-artifact integrity check, new space identity, coordinate overlay qualification, quantitative evidence score, or new structured experiment/result has been claimed. References without independently extracted paper methods remain unavailable to affirmative paper-method filtering even if a recorded result uses that method; result-method filtering remains available separately.

## E3 review fix round 1

Fix base `2644ab30be16b90b03073033829de0f92996fad5`. Read `E3-review.md` verbatim. Both Important findings are addressed; the Minor warning-evidence correction is reflected above. The unrelated committed S3 changes were retained; App/query-state and all S3 files were untouched. No staging/commit, browser automation, user storage, upload, package installation or Python execution occurred.

### Changes and interfaces

- `scripts/public-package.mjs`: the existing `results` source-input allowlist now includes the exact runtime dependency `search-aliases.json`.
- `src/lib/evidence-search.js`: `describeStudyModalities(record,{language})` returns `{label,reason,modalities}`. It distinguishes reported, not-reported, not-extracted, uncertain and not-applicable in both languages, retaining the recorded missingness reason verbatim. The affirmative search filter remains unchanged and still requires reported, sourced method values.
- `src/components/LiteratureWorkspace.jsx`: the existing paper-method `<dd>` consumes this summary, showing the state plus its reason in the same definition. Reported methods retain their method labels without an extra state label. No additional heading or secondary explanatory block was added.
- `src/lib/evidence-search.test.mjs`: added a focused state/reason and affirmative-filter regression.
- `tests/e3-method-summary.test.mjs`: renders the real JSX workbench with React SSR through the existing Vite runtime, checking the actual `<dd>` for all four missingness states/reasons in both languages and the reported MEG/fMRI display. This uses no browser or network listener.
- `tests/e3-source-package.test.mjs`: requires an explicit package fixture under `output/e3-package-fix1`, compares actual packaged alias bytes to the workspace source, dynamically imports the package's own search/results dependencies, and exercises fixed alias queries. It also checks the recovered DK source log against the package's own source manifest.
- `.gitignore`: a single exception allows `/data-sources/dk/scripts/recon-all.log`, which is an existing source-manifest prerequisite rather than a new generated log.
- `data-sources/dk/scripts/recon-all.log`: exact authorized recovery of the required original, 671020 bytes, SHA-256 `5417ae3f600fb82a4bf98fcd02d8961919060ea7e9dcfb8552cecddc260fb68b`.

`.gitattributes` was inspected and left unchanged: its existing `data-sources/** -text` rule already preserves the source log bytes. `git check-attr text eol -- data-sources/dk/scripts/recon-all.log` confirms `text: unset`. Root owns staging and verification of the eventual Git blob hash.

### Independent missing-input failure and recovery

The first explicit packaging attempt targeted the verified-new absolute child `F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix1/red-source` and failed because the manifest-required DK `scripts/recon-all.log` was absent from this worktree. This is independent of the E3 alias bug; log `E3-fix1-package-red-prepare.log` preserves the ENOENT failure. That partial output remains intact.

Read-only inspection found the exact original at `F:/project/brain-model/.deployment/source/data-sources/dk/scripts/recon-all.log`. Root explicitly authorized copying that one file into the same relative worktree path, adding the narrow ignore exception, and preserving bytes. Source SHA-256 matched the manifest before copying; copied SHA-256 matched afterward. A final read-only recheck confirmed both original and copy still have the same expected hash. The original was never moved or changed. No other caches were recovered.

### Observed RED → GREEN

All package targets were absolute, explicitly passed to `node scripts/public-package.mjs`, checked to be previously absent children of the named output scope before creation. The packager was never invoked with its protected default target. Existing package outputs were not overwritten or deleted. Each complete test package received only a junction to this checkout's existing `node_modules`; no dependency installation was needed.

1. `node --test src/lib/evidence-search.test.mjs`: observed method-summary RED, expected `未报告`, actual `尚未摘录`; `E3-fix1-summary-red.log`. The final implementation distinguishes all five states and retains reasons; initial focused GREEN **7/7**, `E3-fix1-summary-green.log`.
2. After exact DK recovery, `node scripts/public-package.mjs F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix1/red-complete-source` succeeded with the original alias allowlist; `E3-fix1-package-red-complete-prepare.log`. This is the complete reproduction package, distinct from the failed prerequisite attempt.
3. With `E3_PACKAGE_FIXTURE` set to that absolute red-complete-source path, `node --test tests/e3-source-package.test.mjs` failed because the packaged `data-sources/results/search-aliases.json` was absent; `E3-fix1-package-red-test.log`.
4. `npm run build` in that same complete red source package failed with the exact unresolved runtime import `../../data-sources/results/search-aliases.json` from `src/components/LiteratureWorkspace.jsx`; `E3-fix1-package-red-build.log`.
5. After the one-file allowlist fix, `node scripts/public-package.mjs F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix1/green-source` succeeded in a new directory; `E3-fix1-package-green-prepare.log`.
6. With `E3_PACKAGE_FIXTURE=F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix1/green-source`, final `node --test src/lib/evidence-search.test.mjs tests/e3-method-summary.test.mjs tests/e3-source-package.test.mjs` passed **9 tests, 9 pass, 0 fail**; `E3-fix1-focused-green.log`.
7. One GREEN `npm run build` in that fresh green package passed, exit 0; `E3-fix1-package-green-build.log`. Both inherited warnings remain: the static/dynamic `volume.js` import cannot move it into another chunk, and some chunks exceed 500 kB. Production causes remain outside E3 ownership.
8. `git diff --check` passed. Final source/copy hashes were checked again, and the package regression verifies the copied log bytes against the source manifest.

No full suite or full-checkout build was repeated; the prior full integration pass and the targeted changed-behavior/package checks cover this round. The real-render supplemental test initially passed after the helper's observed RED→GREEN implementation; it verifies the JSX wiring in addition to the pure-state regression. SSR output is not desktop CUA or layout acceptance. Browser acceptance remains root-owned and unclaimed.

Author self-review found no remaining scoped Important issue. Actual fresh-package dependency resolution and build now cover the previously missing release boundary. The additional recovered log/ignore exception were separately authorized and fully hash-verified; staging the artifact remains root-owned.

## E3 review fix round 2

Base `45e35acfd1a4f382005055403495621a0de45f61`. Read `E3-fix1-review.md` verbatim. The remaining Important finding is addressed: the generated source `.gitignore` now has the exact same narrow `!/data-sources/dk/scripts/recon-all.log` exception as the worktree rule. Both originally accepted fixes are unchanged.

Changed paths in this round are only `scripts/public-package.mjs` (one template line), `tests/e3-source-package.test.mjs` (package Git-inclusion regression), and this report. No App, query-state, search, summary, source-byte, root ignore/attributes or S3 edits were made.

The regression requires explicit source-package and acceptance-Git paths, verifies that its Git target is a previously absent child of `output/e3-package-fix2`, and refuses to initialize the source package itself. It copies only the package's actual generated `.gitignore`, `.gitattributes`, DK manifest and required log into a new acceptance repository, adding two unrelated log probes. `git init` and normal `git add .` execute with that new directory as their only Git target. No force-add is used. The test checks that the required log is tracked, both unrelated logs stay ignored, and the normally staged Git blob exactly matches the manifest's 671020 bytes and SHA-256 `5417ae3f600fb82a4bf98fcd02d8961919060ea7e9dcfb8552cecddc260fb68b`. Global/system Git configuration and inherited Git directory/index variables are excluded from this isolated test environment.

Observed commands and results:

1. Verified `F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix2` did not exist before starting. With `E3_PACKAGE_FIXTURE=F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix1/green-source` and `E3_PACKAGE_GIT_FIXTURE=F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix2/red-git`, `node --test tests/e3-source-package.test.mjs` produced **1 pass, 1 fail**: the actual old generated rules omitted the required log after normal `git add .`. Log: `E3-fix2-package-red.log`. The root-CUA-served old green-source was read only and remains preserved.
2. Added only the exact required-log exception to the existing generated ignore template; no unrelated packaging refactor.
3. Verified the new explicit package child was absent, then ran `node scripts/public-package.mjs F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix2/green-source`. Exit 0; `E3-fix2-package-prepare.log`. No default packager target or existing package was used.
4. With `E3_PACKAGE_FIXTURE=F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix2/green-source` and `E3_PACKAGE_GIT_FIXTURE=F:/project/brain-model/.worktrees/research-20261029/output/e3-package-fix2/green-git`, `node --test tests/e3-source-package.test.mjs` passed **2 tests, 2 pass, 0 fail**. Log: `E3-fix2-package-green.log`. This includes actual package alias imports and normal Git staging of the original log with the exact manifest hash.
5. `git diff --check` passed. Read-only `git diff --cached --name-only` in the worktree returned no staged paths. Final independent file hashes for the preserved old package and new package log both match the manifest hash above; the generated new ignore file contains the exact exception.

The isolated `red-git` and `green-git` acceptance repositories and both package attempts are retained as evidence. No main-repository staging/commit, browser, upload, installation, original-source mutation or package overwrite occurred. A build/full suite was not repeated because this round changes only Git inclusion semantics; the accepted fix1 package build remains the build evidence. Desktop acceptance remains root-owned. Author self-review found no remaining scoped integration gap.
