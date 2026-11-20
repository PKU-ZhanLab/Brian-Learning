# S6 implementation report

Base: `6248f7c`. Checkout: `F:/project/brain-model/.worktrees/research-20261029`. Task work performed 2026-10-30 (Asia/Shanghai). No commits, installs, Python, network downloads, browser or desktop actions were performed by this worker.

## Result and scientific boundary

The S6 software gates and reproducible assessment are implemented. The current assessment is **partial**, `humanValidated=false`, with no independent measurements/references/human review and 14 explicit missing coverage items. All 7 source entries are ineligible: one acquired Diedrichsen vermis candidate and six existing geometric subdivisions. No source geometry was replaced, no acquired candidate bytes were copied into public assets, and no human records were fabricated. Scientific independent anatomy validation and source replacement remain pending as instructed by the user.

## Files and authorized extension

Created:

- `src/lib/spatial-qc.js`
- `src/lib/spatial-qc.test.mjs`
- `scripts/spatial-qc.mjs`
- `scripts/validate-segmentation-source.mjs`
- `data-sources/spatial-qc/reference-set.json`
- `public/data/spatial-qc/assessment.json`
- `docs/validation/spatial-qc-protocol.md`

Modified only assigned paths `src/components/BrainScene.jsx`, `src/components/AtlasRegionDetails.jsx`, `scripts/anatomy_validate.mjs`, `public/data/manifest.json`, plus the root-approved two-line additive registry extension in `src/lib/atlas-resource.js`: `SPATIAL_QC_RESOURCE='manifest:spatial-qc'` resolves to `spatial-qc/assessment.json`. It uses the existing subscription/loading/generation/error/retry APIs, with no separate cache. Source tests for slices/camera were run unchanged because no numerical geometry or camera logic changed.

## Implemented gates

`evaluateSpatialQC` distinguishes hash-bound input/transform checks, independent regional measurements and actual scoped human reviews. Registration statistics and the historical AI three-plane report cannot grant reviewed status. References require source/version/licence/annotation metadata and an independence statement that excludes the evaluated assets and source lineage. Measurements bind asset/reference/ordered transform hashes, evidence digest and reference/region-specific prespecified limits. Reference and evaluated asset must explicitly share comparison space. Independent segmentation additionally requires bounded Dice overlap. Missing accepted measurements remain null/unmeasured; submitted rejected values are retained separately. No common submillimetre threshold is invented.

Human status requires identity/name, kind=human, a real calendar date, exact regional scope, asset digest, independent reference ID, evidence digest and a pass verdict. AI/program/agent entries cannot satisfy it. External verification of actual reviewer identity/qualification is outside software capability and is documented; production currently contains no qualifying record.

`validateSegmentationSource` requires original segmentation/version/resolved redistribution terms; actual source/derived asset hashes; original dictionary/IDs; explicit source/target spaces; connected hashed transform and derivation chains; stated structures; locked independent reference/measurement/review evidence; and recomputed regional human QC for every structure. A supplied `regionalAssessment.status='reviewed'` is ignored as evidence. `representationForAsset` also binds candidate, asset digest and exact structure coverage. `spatialQCForRegion` binds detail scope to atlas ID, version, space and actual measured asset/label; a registered review cannot confer human validation on its native counterpart.

The scene's numerical x/z subdivision and source envelope geometry are unchanged. Brainstem and cerebellar hemisphere/vermis subdivision metadata now say `illustrative-subdivision`, retaining contextual source notes and classification colours. The selected-source message explicitly describes illustrative boundaries. Atlas details expose validation scope and a report link, with shared resource retry on failure. Other source labels and the S1/S5 identities were preserved.

## Sources and deterministic generation

The registry locks 19 actual input files. The generated report includes those 19, its registry digest and three software digests, for **23 input records**. It computes four actual discrete atlas-label sets and matches original manifest labels: native/registered AAL 116/116, native/registered AAL3 166/166; AAL3 original label 134 is retained. Nine automated integrity/label checks pass. These checks do not measure anatomical accuracy.

The Diedrichsen source remains at official commit `6857dfa732de6dd60c94da2f84d0b15ccf316618`. All five acquired source file hashes remain pinned to their prior download manifest. The script re-parses actual segmentation/T1 bytes using the existing strict NIfTI parser and validates the actual original TSV dictionary: 34 nonzero labels and eight vermis labels (6,9,12,15,18,21,24,27); matching 153×103×84 grids and affine `[-1,0,0,76;0,1,0,-108;0,0,1,-72;0,0,0,1]`. Parser space remains native-unverified; the README's `MNI152NLin6AsymC` declaration is preserved separately. Grid agreement remains automated metadata, not independent accuracy.

The candidate remains ineligible because redistribution/version/attribution resolution is pending, no documented conversion/target-space derivation exists for the viewer's `MNI152NLin6Asym` target, and independent reference, measurement and human review evidence are absent. Pinned README CC BY/contributing-paper exception, absent referenced LICENSE, and older web-page CC BY-NC statement remain explicit. Brainstem Navigator is recorded as not acquired/not redistributable under the researched agreement; FreeSurfer is method-only with no acquired fixed-space output.

No wall-clock generation timestamp is embedded. `--check` recomputes inputs and compares exact saved bytes, rejecting stale output rather than silently updating expectations. Historical evidence is never regenerated by these scripts. `anatomy_validate --check` was added as a read-only mode while retaining its strict legacy requirements; spatial scope is printed separately from its automated geometry report.

## RED/GREEN and command evidence

1. `node --test src/lib/spatial-qc.test.mjs` initially failed with `ERR_MODULE_NOT_FOUND` for the nonexistent spatial QC contract, as the task expected.
2. Additional observed RED regressions: comparison-space mismatch erroneously returned reviewed; disconnected derivation/output and unresolved original source version erroneously passed; an unbound external reference was accepted; a registered measurement could lend review to a native label. Each corresponding regression passed after the gate was implemented. The detail adapter initially failed for its missing export before implementation.
3. Final focused command:

   `node --test src/lib/spatial-qc.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs src/lib/atlas-resource.test.mjs`

   Exit 0, **19/19 passed**: nine QC/resource-consumer tests plus native Colin27/slice/view-state, camera framing and shared resource regression tests. The exact three-file task test subset is included in that run. Tests include synthetic complete positive source/review fixtures only inside the test file; they are not production evidence.
4. `node scripts/spatial-qc.mjs` — exit 0; explicit generation of the new partial assessment. Initial implementation inspection exposed actual AAL3 uint8 storage (AAL is uint16); the reader was corrected to use each manifest's actual discrete dtype. The original TSV was adapted through the existing validated JSON label parser, preserving raw input bytes and IDs.
5. `node scripts/spatial-qc.mjs --check` — exit 0 after generation; **partial**, human=false, 14 missing items. Repeated with the same result. A later software change was deliberately checked before regeneration: exit 1 with `Spatial QC assessment is stale. Regenerate explicitly...`; explicit regeneration restored GREEN. The check did not rewrite output.
6. `node scripts/validate-segmentation-source.mjs --check` — exit 0, structured **partial**, all seven candidates remain `eligible=false` as expected. Actual dictionary/grid inspection reruns.
7. An ephemeral `--candidate` fixture containing fake reviewed/human booleans, licence text and hash but no source/evidence chain — exit 1, `eligible=false`. Temporary file/directory were removed. No candidate fixture was added to production.
8. A Node before/after SHA-256 audit around both `--check` commands found **22/22 files unchanged** (19 locked inputs, registry, new assessment, historical anatomy validation). Five historical files were additionally compared against `git show HEAD:<path>`: root review, label-resampling report, registration report, QC PNG, and anatomy validation; all bytes match HEAD.
9. `git diff --check` — exit 0.

Final root review digest: `15f24a05c5973a612686440e84e7cefe5d179d1ea7dcdd4ddc19adbba9eb0dd9`.

Final generated assessment digest: `3042b0fb7609cf3b3a0bac5cf982c600633b4554ee7d24c4783088df1a5767f9`.

## Optional legacy anatomy validation failure

`node scripts/anatomy_validate.mjs --check` — exit 1 at the pre-existing requirement `spinal-C1: absent geometry lacks unavailable/schematic status`. The present manifest declares 36 on-demand official-source PAM50 entries, while this old validator expects 36 bundled meshes. It also requires private raw HCP TRK/archive and registration-field inputs that are absent from this checkout (`data-sources/anatomy/hcp1065_avg_tracts_trk.zip`, `data-sources/space/MNI152NLin2009aAsym_to_MNI152NLin6Asym_dipy.npz` were checked and absent). Later checks were not reached and are not claimed to pass. Historical `public/data/anatomy/validation.json` stays byte-identical.

Root ruling: keep those strict legacy source/geometry checks, do not convert missing evidence into a pass or broaden to a new bundled/source validator in S6. Root will triage full-source validation separately in G1 against original read-only inputs. The required S6 scripts/tests above are distinct from that optional failing command.

## Remaining integration/scientific limits

- Root owns fresh independent code review, full check/build and permitted CUA interaction acceptance; none is claimed by this worker.
- No independent continuous whole-brain planes, orientation/midline/ventricular landmarks, cortical boundaries, deep-nucleus/AAL3-134, brainstem or vermis metric has been supplied. All 14 remain missing, with null metrics.
- No genuine reviewer records are available. No human/independent anatomical certification is claimed.
- No qualified source replacement occurred; candidate licence/space/derivation/region checks remain pending.
- Software cannot authenticate real people or independently certify licence interpretation; those external responsibilities must be resolved before future review/source records are admitted.

## Authorized reproducibility follow-up (supersedes earlier input counts/digest)

Root identified a real packaging gap before review: seven input paths pointed into ignored `output/s6-source-research/`, and source packaging omitted the registry. Root explicitly authorized a bounded source-preparation/packaging correction. The initial report's no-download statement applies to that initial implementation iteration; this follow-up explicitly acquired only the five pinned inert official candidate files described below. No browser, Python, installation, commit or push was performed.

Additional paths: `scripts/prepare-spatial-qc-sources.mjs`, `src/lib/spatial-qc-sources.test.mjs`, `data-sources/spatial-qc/source-preparation.json`, and byte-identical copies `data-sources/spatial-qc/candidate-inspection.json` and `download-manifest.json`; bounded modifications to `scripts/public-package.mjs`, `.github/workflows/research-ci.yml`, QC runner/registry/protocol and the new assessment. Original research output remains untouched. No raw downloaded README, TSV, atlas metadata or NIfTI candidate was newly added to tracked source/public assets.

The preparation manifest records five immutable official raw URLs at commit `6857dfa732de6dd60c94da2f84d0b15ccf316618`, exact lengths/SHA-256/Git blob hashes, and ignored cache root `data-cache/spatial-qc/cerebellar_atlases-6857dfa`. The explicit preparation command only fetches missing files, checks existing files before any download, refuses mismatches without overwriting, rejects redirects/unpinned paths/symlinks, bounds streamed decoded bytes, verifies both SHA-256 and Git blob identity, and writes verified missing files with exclusive creation. Downloaded text is never executed. Interrupted/missing downloads can be resumed explicitly while verified files are reused.

`--check` on preparation or either QC command never downloads or writes. Missing cache raises an actionable message naming `node scripts/prepare-spatial-qc-sources.mjs`. An observed real HTTP transfer exposed compressed `Content-Length` versus decoded bytes; a RED test was added, then corrected by requesting identity encoding and relying on locked decoded length/hash when transfer encoding is compressed. No integrity requirement was relaxed.

Source packaging now whitelists all four nonbinary QC metadata inputs, and a closure gate rejects every locked data-source input missing from the whitelist or ignored/cache input lacking exact manifest preparation. Cache and original `output/` are excluded. Local `research-ci.yml` adds explicit source preparation and both read-only QC checks before existing regression/build steps. The workflow change remains local; no push or new permission request was performed by this worker.

Follow-up verification:

- RED: the new source/cache test initially failed because preparation module did not exist; compressed-transfer regression then failed with `Source length mismatch: README.md` before its fix.
- `node --test src/lib/spatial-qc.test.mjs src/lib/spatial-qc-sources.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs src/lib/atlas-resource.test.mjs` — exit 0, **25/25 passed**. Six added tests exercise explicit fetch/reuse, read-only absence guidance, compressed transfer lengths, corrupt existing/download preservation, URL/redirect/cache-path refusal, and source-package input closure including negative omission cases.
- Initial working-checkout `node scripts/spatial-qc.mjs --check` with absent cache — exit 1 with explicit preparation guidance; no automatic download occurred. Explicit preparation subsequently verified 5/5 cache files (the final resumable run downloaded 2 and reused 3). Acquisition grants no QC/source status upgrade.
- `node scripts/public-package.mjs .superpowers/sdd/README/S6-source-package-probe` — exit 0, real isolated source package generated. All **15 noncache locked inputs** are present and hash-identical in this package. It initially had no candidate cache, and preparation `--check` failed with actionable guidance.
- From that fresh source package, `node scripts/prepare-spatial-qc-sources.mjs` — exit 0, **5 downloaded / 0 reused**, exact source/byte/Git blob checks. This is an actual upstream acquisition, not a fixture or copy from the original research output.
- Both `node scripts/spatial-qc.mjs --check` and `node scripts/validate-segmentation-source.mjs --check` — exit 0 in the working checkout **and the prepared source package**; no node_modules or installation was needed for these scripts. The saved new assessment reproduced byte-for-byte from the packaged inputs/software.
- Preparation `--check` plus both QC `--check` commands preserve **23/23** input/output files byte-for-byte. The same five historical files still match HEAD. Both fact JSON copies match original research bytes; all five original acquired candidate files still match their original download hashes.
- `git diff --check` — exit 0 before the final report append. No historical validation or root-review bytes changed.

The final registry has **20 locked input files**, and the final generated report has **25 input records** including registry and four software digests. Only the new assessment was regenerated. Final assessment SHA-256: `94cdf62f4044132d97b0586ac493a10a91d2c7376f30df7bc0dc7aad6b38e37c`.

Scientific status is unchanged: partial; human=false; zero independent covered regions; 14 missing coverage items; zero eligible replacement sources. Licence resolution, comparison-space derivation, independent measurements and genuine scoped human review remain pending. Missing-cache reproduction now depends explicitly on availability of the immutable official source host; it cannot be silently replaced with a different version.

## S6 review correction round 1 (base `fbfa0fe`)

Read `.superpowers/sdd/README/S6-review.md` first and applied the receiving-code-review and test-first workflows. All three P2 findings were verified against the current scientific files (unchanged since `65128f9`) and addressed within the original library/scripts/tests/protocol/registry/assessment and one bounded package-closure check. No X9 feedback files were changed. No browser, network acquisition, Python, installation, subagent, commit or push was used in this correction round.

1. **Exact proposed output versus original lineage.** Added the reviewer's distinct-source/derived-output witness: it failed with `eligible=true` despite all evidence naming only the source. The evaluator now receives only the exact proposed asset as measurable; original/intermediate derivation identities are separately supplied solely for independent-truth exclusion. Eligibility also requires each accepted regional measurement to identify the proposed output ID/hash. The regression now passes, a new output-scoped synthetic comparison/review is a positive control, and a self-derived reference from the original source remains rejected. Caller-supplied regional assets/lineage cannot override the validator's bound identities.

2. **Immutable human comparison context.** The changed-reference witness initially failed with `humanValidated=true`. Human review now must carry a canonically equal `comparisonContexts` entry produced from a deep-frozen copy of the exact asset ID/version/hash/space, full reference metadata/version/hash, ordered transform identities/hashes and provided version/space endpoints, complete measurement/evidence, protocol version/hash and full threshold/evidence record. Protocol and threshold evidence hashes are required and must be locked for source admission/global evaluation. Changed reference bytes/version, asset version, transforms/order, metric value, measurement evidence, threshold/value/evidence or protocol/version/evidence all leave the still-passing independent comparison pending human review. Tests explicitly demonstrate that new matching context-specific synthetic records can pass, so the negative tests do not merely fail because measurements became invalid. The protocol/algorithm were explicitly versioned to v2; no actual human approval was added.

3. **Locked and auditable consumed reviews.** Added a review loader that refuses unlisted review paths before reading them, rechecks the exact review bytes at consumption, and requires human review evidence digests to resolve to already byte-verified locked inputs. Human records without such evidence fail admission; the old AI report remains historical/nonhuman. The generated report now retains `reviewRecords` containing each consumed path, exact digest and raw identity/date/scope/context/opinion. Changed record bytes fail the old lock; updating an intentional lock changes the report audit trail even if overall verdict is unchanged. Source-package closure now rejects every review path lacking a lock, and its existing lock traversal covers corresponding evidence packaging. Tests include an unlisted `output/` review, nonexistent evidence digest, preserved positive audit contents and changed review date under an old lock. The new loader test first failed for the missing admission API before implementation.

Correction verification:

- `node --test src/lib/spatial-qc.test.mjs` observed the two concrete P2 RED witnesses; after the first correction only the stale-context witness remained RED, then both were GREEN.
- `node --test src/lib/spatial-qc.test.mjs src/lib/spatial-qc-sources.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs src/lib/atlas-resource.test.mjs` — exit 0, **28/28 passed**. This includes every required S6/native/slice/camera test plus cache/package/shared-resource and all review correction regressions.
- `node scripts/spatial-qc.mjs --check` before explicit v2 generation — exit 1 for stale output; it did not rewrite expectations. `node scripts/spatial-qc.mjs` then explicitly regenerated only the new assessment (exit 0).
- Both required commands, `node scripts/spatial-qc.mjs --check` and `node scripts/validate-segmentation-source.mjs --check` — exit 0 in the working checkout and the updated isolated source-package probe.
- `node scripts/public-package.mjs .superpowers/sdd/README/S6-source-package-probe` — exit 0 with the stronger review closure. The already verified ignored candidate cache was reused; no new download or public/source redistribution occurred.
- Before/after SHA-256 audit around preparation `--check` and both QC checks: **23/23 files unchanged**. The same five historical evidence files still match `git show HEAD:<path>` byte-for-byte; both fact JSON copies match original research bytes; all five original candidate files still match original download hashes.
- Verified generated review audit: exactly one consumed record, `public/data/aal-v3/root-review.json`, SHA `15f24a05c5973a612686440e84e7cefe5d179d1ea7dcdd4ddc19adbba9eb0dd9`, reviewer string `Root AI agent`; **zero qualifying human records**.
- `git diff --check` — exit 0 before final report append. Exactly eight owned scientific/package-gate files changed; this report is the ninth scoped artifact.

Final v2 assessment SHA-256: `bbaf45eb3824111b3b3c5a0c584efa0fe388e42dbd0459e02ae59dc442dbde0f`. Registry remains 20 locks / assessment 25 input records. Scientific status remains **partial, humanValidated=false, 14 missing coverage items and zero eligible replacements**. The optional strict legacy anatomy validation failure and real UI acceptance remain as previously recorded; no software pass closes those gaps. Root owns Git and scoped independent re-review.
