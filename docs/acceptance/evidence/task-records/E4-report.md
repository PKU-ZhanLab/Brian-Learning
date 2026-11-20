# E4 report

Status: DONE_WITH_CONCERNS. Implementation and offline acceptance pass; genuine human review and spatial validation remain pending by the user's explicit choice. No commit, push, deployment or browser operation was performed by this worker. Root is the sole committer.

Base supplied by root: `a30cc08c33d449db65d85c031a1c5b63693411ff`.
Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Skill: `superpowers:executing-plans`, with its test-driven-development instructions. Root owns the independent review and desktop acceptance.

## Implemented scope

- `src/lib/source-artifact.js`: synchronous offline Node integrity/transcription interfaces, canonical excerpt bytes, excerpt SHA-256, full artifact-record SHA-256, safe stable collection/entity-ID/property paths, exact source-cell bindings and explicit explained normalizations. It distinguishes integrity errors, semantic mismatches, missing local material, declared field coverage, and numeric Reported fields outside this check. Malformed artifacts return closed reports. A shared paper artifact can support a selected subset without fabricating omitted results.
- `scripts/evidence-audit.mjs`: reads only local files; pins versioned artifact bytes through `source-artifacts/index.json`; checks embedded artifacts against those files. `--offline --output <new-path>` uses exclusive creation and exits nonzero for integrity, semantic or missing-material failures. It never fetches source URLs.
- Three new initial `*-v1.json` artifacts and their index, embedded in the canonical v2 evidence bundle and mirrored in `curated-results.json`. No historical artifact existed before this task; no historical source versions or audit fixtures were overwritten. The one-time task-local construction script refuses existing output files; future source revisions must receive a new version/file/index entry. `verify-sources.mjs` now defaults to the offline audit and rejects in-place `--refresh`; optional `--metadata-live` checks bibliography only.
- `source-audit.json` retains its historical entries and adds a separately scoped latest minimal-source check and exact artifact-file identities. `literature_validate.mjs` now checks artifact availability, byte integrity, source-field comparison, all-eight-coordinate coverage, the portable model, and the audit/index linkage.
- `src/data/results.js`: Schaum's four peak t values, n=59, beta 12–32 Hz, source CSD 100–373 ms, separate a priori 100–350 ms tROI, sensor cluster 12–31.9 Hz and cluster inference are retained using E2's existing Reported fields. The Methods explicitly explain the source-window extension to fit integer cycles and reduce leakage. Peak p and df remain null, not inferred. Axelrod text/table precision remains separate; reported Bonferroni raw-p threshold .004 is retained. Bosco coordinate SD remains between-subject dispersion, not localization error. No alternate evidence model or schema was introduced.
- Fresh AI source-check events are scoped to the active result/location record version and these listed minimal cells. Historical events remain intact. All eight locations retain `MNI-unspecified`, `derivedAsset:null`, `transformRef:null`; direct overlay eligibility remains zero. No human-reviewed or space-checked event was added.

## Primary source and lawful scope

Used only root's actual independently inspected focused captures:

1. `output/source-research/root-minimal-source-cells-20261029.json`: actual Europe PMC XML response cells for Schaum Table 1 (four rows) and Axelrod Table 1 (left/right FFA), plus selected Table 2 20-voxel values.
2. `root-axelrod-text-statistics-20261029.json`: publisher Results / Neuroimaging Results / MVPA.
3. `root-bosco-table1-protocol1-20261029.json`: primary PMC Table 1 / Protocol 1 TPJ and hMT/V5+ cells.
4. `root-schaum-method-context-20261029.json`: publisher Table 1, Figure 2A and named Methods contexts.

`existing-source-excerpt-candidates.json` and prior curated JSON were not treated as independent primary evidence. The task-local artifact constructor does not read either as source evidence. Root source inspection is AI-assisted, never human certification.

Primary locators retained in the artifacts:

- `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8096430/fullTextXML`
- `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4340964/fullTextXML`
- `https://elifesciences.org/articles/61679`
- `https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0117126`
- `https://pmc.ncbi.nlm.nih.gov/articles/PMC6671632/#T1`

The artifacts contain 120 minimal cells, 170 bindings, and 170 whitespace-delimited words across raw cell text: Schaum 82, Axelrod 46, Bosco 42. Bindings and source metadata account for most file size. No complete article, complete table, figure, abstract, or image was copied. Schaum/PLOS attribution and source licenses are retained; Bosco retains only necessary factual numeric cells and locators under publisher rights. Explanatory paraphrases and all normalizations are explicitly separate from literal source text. Bosco original minus glyphs and the trailing `3.0` SD precision are retained alongside parsed numeric values.

All three top-level `sourceFileSha256` values are null: the composite extraction does not have a single article byte stream, and rendered captures supply no raw bytes. Capture-specific observed XML response digests are retained only for the exact corresponding response:

- Schaum XML: `4448e66e6f314e18f960f5b76714300ef48b12ddc0fda92d3591ee74a3c60e80`
- Axelrod XML: `17443b3861014404ba0f117b76b93d298329074dbf7f2dda692a4b97f8023e86`
- All rendered captures: null.

Those full response bytes are not retained or rehashed by the offline audit. Excerpt integrity is not presented as full-source re-verification.

Final immutable v1 file digests in the index:

| Artifact | File SHA-256 |
|---|---|
| schaum2021-v1 | `a0eacb856dfb1b6f7e648875f98455f59573968d4d617ae62dffb90faef33b45` |
| axelrod2015-v1 | `cd79af8a7f638550c6760596071cdb710a8e2ce91abec9b4a473e5368cbc03f1` |
| bosco2008-v1 | `4ac841a0c515fbf8a41594aa071a5352e77ae0d1ac27d367dd029ce3da1b39dc` |

## Authorized integration extensions

Root explicitly authorized two narrow extensions after concrete failures:

1. **Editor artifact closure:** `resultViewModelToEvidence` retained statistical/location/review `sourceRefs` but omitted the referred artifacts, producing invalid editor save payloads once E4 introduced live artifact IDs. The adapter now copies only the actually referenced artifact closure, recursively, with original artifact content. It keeps all review and statistical anchors and does not weaken validation. A production-adapter test exercises edit → validate → save → reopen → merge for Axelrod and Schaum, with exact artifacts/statistics preserved and changed text's current review revoked. Three synthetic current fixtures that replaced the whole artifact collection now retain the canonical artifacts before adding their intended dummy artifacts; historical fixtures remain untouched.
2. **Source package inputs:** the packager's explicit source allowlist initially omitted the four runtime JSON files. Added precisely index + three v1 artifacts. The focused fresh-package test checks byte identity, runtime results import, no-network offline audit, recovered DK log byte count/hash, and the existing exact ignore exception. No broad allowlist, DK byte change, or ignore-rule change was made.

Files extended beyond the original E4 list: `src/lib/evidence-schema.js`, `src/lib/evidence-schema.test.mjs`, `src/lib/evidence-workspace.test.mjs`, `scripts/public-package.mjs`, `tests/e4-source-package.test.mjs`. Root authorized all of them.

## RED → GREEN evidence

The tool transcript contains the actual observed RED outputs; no initial successful run was passed off as a failing test.

| Check | Observed RED | Final GREEN |
|---|---|---|
| `node --test src/lib/source-artifact.test.mjs` | Missing source-artifact module; later actual disk audit failed before the portable data was integrated | 9/9 |
| Editor production closure test | Expected `["axelrod2015-v1"]`, received `[]`; original save regressions also rejected unresolved sourceRefs | Production adapter roundtrip passes; schema/workspace/source focused run 34/34 at that checkpoint |
| Fresh source-package test | ENOENT for packaged `source-artifacts/index.json` | Final fresh package passes all exact-byte/audit/DK checks |
| Malformed source material | Null cell/artifact threw instead of returning a report | Direct integrity and aggregate audit both return failure reports |
| Selected-result subset | Shared artifact incorrectly demanded the omitted right-FFA record | Remaining seven coordinates audit correctly |
| Correction/role semantics | Changing left FFA corrected significance to true was not detected | Correction status and analysis-role changes now enter semanticReviewRequired; raw Bosco precision test also passes |

The primary combined test explicitly changes only Schaum x=50→51 and checks `semanticReviewRequired` with no integrity error; a changed excerpt byte with unchanged digest produces integrity errors; removing an artifact produces `unavailableArtifacts`. Other cases independently test DOI, ordered authors, citation URL, table identifier and coordinate source URL.

## Commands and actual results

- `node scripts/evidence-audit.mjs --offline --output output/evidence-acceptance/e4-source-audit-final-v2.json`: exit 0; 3 artifact files, 8 coordinates, 170 fields, zero integrity errors, semantic mismatches and missing artifacts; human review pending. Report is preserved at that path. Earlier acceptance reports are also preserved.
- `node scripts/literature_validate.mjs`: exit 0; 118 papers / 115 legacy reading records / 4 structured findings / 8 MNI-unspecified coordinates. Three result-metadata hashes checked.
- `node data-sources/results/verify-sources.mjs`: exit 0, offline mode, no live metadata request. The optional live metadata branch was not exercised.
- Requested full `npm run check`: exit 0; **239/239 tests**, data and literature validators pass. Complete log: `output/evidence-acceptance/e4-npm-check-final.log`. A subsequent source-only malformed-material guard was verified by the final focused tests below; no broad repetition was performed for that guard.
- `npm run build`: exit 0 after runtime JSON and editor closure integration; 1646 modules transformed. Existing volume mixed-import/chunk-size warnings remain. Node-only integrity code is not imported into browser runtime; results import only the three JSON artifacts.
- `node scripts/public-package.mjs output/e4-source-package/final-v2`: exit 0. This new acceptance package includes the final malformed-material guard; earlier red/green/final-v1 packages were preserved.
- With `E4_PACKAGE_FIXTURE` set to `output/e4-source-package/final-v2`, `node --test src/lib/source-artifact.test.mjs tests/e4-source-package.test.mjs`: exit 0; **10/10 tests**. Complete log: `output/evidence-acceptance/e4-source-package-final-tests.log`.
- The fresh packaged copy's `node scripts/literature_validate.mjs` was also run successfully on the previous final-v1 package: 3 result-metadata hashes; 20 omitted bibliography raw caches truthfully reported unavailable, zero raw bibliography cache rehashes. E4 minimal-source audit itself passed without network. Final-v2 differs only by the source-only malformed-input hardening and LF cleanup and passes the final no-network package audit above.
- `git diff --check`: exit 0. All changes remain unstaged for root review/commit.

## Limits and rulings

- The report's `valid:true` is scoped to the 170 declared source-cell/normalization comparisons and byte identities. It is not a full-paper semantic review or human/expert certificate.
- Exactly two numeric Reported fields remain outside this new primary-capture check: `results/axelrod2015-lffa/sample/included/value` and `results/axelrod2015-rffa/sample/included/value` (both inherited included n=17). They are explicitly listed in `coverage.uncheckedReportedNumericFields`. ROI-specific n=13/16 and all eight x/y/z triples are directly anchored. No claim is made that the new minimal captures rechecked every historic numeric fact.
- Generic MNI and coordinate SD do not establish current template identity, localization precision or overlay eligibility. All eight coordinates remain independent; no spatial/human completion is claimed.
- Browser/UI acceptance remains root-owned. No Python environment or dependency change was needed; no article download cache, unlicensed image, private material or desktop capture was added to the source package.
- Ruling: a shared paper artifact may contain primary cells for results absent from a selected-result export; compare only extant entities while requiring all actual coordinates' anchors. Cost if wrong would be false missing-result failures on legitimate subset exports; the dedicated regression covers this.
- Ruling: article DOI URLs, source point roles and MNI-unspecified are explained normalizations, not literal table cells. The original raw cells, exact primary locators and each normalization rationale remain independently inspectable. Cost if wrong is a misleading interpretation; these comparisons are explicitly AI-assisted and human review stays pending.
- Ruling: original artifact/metadata bytes and semantic transcription are separate checks. Future source updates must add a version; a matching hash alone cannot promote a field to human-reviewed or spatially validated.

## Fix round 1 — review Important findings 1 and 2

Starting HEAD supplied by root: `c89f68b95d008db8a754dddc9ff292c524274ea3`. Read both Important findings in `E4-review.md` and reproduced both deterministic gaps before changing production code. Used `superpowers:receiving-code-review` for this fix pass. Ownership remained `src/lib/source-artifact.js`, its test and this task report; no schema, runtime, index or existing artifact bytes were changed.

**Finding 1 fixed:** auditing separates integrity verification of every retained artifact from comparison of current source fields. A field selects versions from its nearest explicit `sourceRefs` in the E2 record/Reported value. If it has no explicit artifact reference, only source-check events for that exact subject and current `recordVersion` can select a version. Reference metadata can use explicit selections from current paper findings/locations. A version's mere index presence, filename number, array order, or old event cannot select it. More specific field provenance can intentionally differ from another location/result in the same paper. Every retained artifact and embedded version still receives integrity comparison; historical events and objects are read without mutation. Coverage now separately lists integrity-checked and current-compared artifact identities.

The additive test constructs only an in-memory **synthetic** hash-valid Schaum v2 x=51, explicitly selects it for the current point, and retains v1 and all old events. This is a future-version lifecycle fixture, not a new real source observation. The audit accepts the corrected current value; x=52 fails against v2 expected 51. Tampering retained v1 still fails integrity. Explicitly selecting v1 instead compares against 50 even with v2 retained; reverting that selected current value to 50 passes. Reversing artifact array order changes no semantic result. No highest-version guessing or deletion of history is used.

**Finding 2 fixed:** `legacyV1/sourceTable` is required only when that actual historical field exists. Missing optional legacy fields are not fabricated or compared as current native data. Native provenance is supplied by an explicitly selected, verified source artifact with exact per-axis and source-space field locators. Native records may refer directly to the artifact ID without inventing a legacy table field or a fixed URL-array slot. Existing bound source URLs and legacy table fields remain compared when present. Paper resolution also follows existing E2 experiment/claim ownership when a result's direct referenceId is absent.

The native test removes snapshots and legacy-only artifact bindings, recomputes only synthetic in-memory fixture hashes, verifies `validateEvidenceV2` and every artifact integrity check, and then audits all eight coordinates without inserting any legacyV1 data. A wrong native x still fails. It also covers a native point whose only sourceRef is the selected artifact ID with no URL-slot binding. All fixture inputs remain unmodified by audit.

Exact commands and observed results:

1. `node --test --test-name-pattern='explicit current source versions|native v2 provenance' src/lib/source-artifact.test.mjs` — **RED 0/2**. Additive v2 emitted the old v1 expected-50/current-51 error; native v2 emitted the eight missing legacy-table errors listed in the review.
2. `node --test src/lib/source-artifact.test.mjs` after the scoped implementation — **GREEN 11/11**, including existing byte/coordinate/metadata/correction/malformed-material tests and both new witnesses.
3. `node scripts/public-package.mjs output/e4-source-package/fix-round1` — exit 0; new isolated source package. This was justified because packaged offline audit code changed; packager inputs/rules were unchanged.
4. With `E4_PACKAGE_FIXTURE` set to that package, `node --test src/lib/source-artifact.test.mjs tests/e4-source-package.test.mjs` — exit 0, **12/12**. Full output: `output/evidence-acceptance/e4-fix-round1-tests.log`. This final run includes the additional artifact-order and explicit-v1-selection negatives.
5. `node scripts/evidence-audit.mjs --offline --output output/evidence-acceptance/e4-fix-round1-source-audit.json` — exit 0; 3 source files / 8 coordinates / 170 current field anchors, no integrity, semantic or unavailable-material errors. Human review stays pending.
6. `git diff --check` — exit 0. `git status --short` showed only the two owned source-artifact files modified before this report append. All existing v1 artifacts/index/data remained unchanged. Fix edits remain unstaged for root.

No full-suite run, browser operation, dependency change or artifact rewrite was performed in this fix round. Root's separately supplied actual CUA acceptance receipt is `output/e4-cua/receipt.json`; it was not repeated or represented as worker-run verification. The previously disclosed n=17 scope limit and pending human/spatial review remain unchanged.

## Fix round 2 — missing current selection must remain unresolved

Starting base: `19b703fe0db92b4b0bd8126a2eeda816f9c6014f`. Read the new Important finding in `E4-fix1-review.md`; its two original findings remain addressed. Changed only `src/lib/source-artifact.js` and its test, plus this report append. No adapter or production artifact change was needed.

Reproduced the exact Boolean witness: cloned curated evidence; changed left-FFA result recordVersion to a new current version; recursively retained only URL sourceRefs within that result; preserved every artifact, legacy snapshot and historic event; changed `correction.value.passed` false→true. The fixture remains valid under E2. Before the fix, the declared Boolean binding disappeared from current comparisons without a semantic error.

The audit now keeps a declared extant binding unresolved unless an explicitly selected, verified source artifact actually binds that path, or the exact-current-version source event supplies that selection. Its semantic-review entry retains `artifactId`, `cellId`, stable `path`, exact source `locator`, current `recordVersion` and `reasonCode:'unresolved-source-version'`. It does not compare an unselected historical expected value or infer a latest version. A selection that resolves to an artifact without the declared path also remains unresolved rather than silently dropping the check. Non-numeric fields receive the same rule as numeric fields. Existing absent-native-snapshot and absent-subset-entity handling remains unchanged.

The regression proves that both true and correct-looking false values remain unresolved while current provenance is absent. Explicitly selecting `axelrod2015-v1` restores the actual false/true Boolean comparison; setting the actual Boolean back to false then passes. All original events/artifacts remain byte-content equivalent in the in-memory fixture. The inherited, unbound n=17 paths remain the same two disclosed unchecked numeric fields after source selection is resolved.

Commands and actual output:

1. `node --test --test-name-pattern='declared Boolean binding' src/lib/source-artifact.test.mjs` — **RED 0/1**. Failed because no `semanticReviewRequired` entry existed for `results/axelrod2015-lffa/correction/value/passed` with the original `axelrod2015-v1`/cell identity and unresolved-selection reason.
2. `node --test src/lib/source-artifact.test.mjs` — **GREEN 12/12**, 0 failures, including additive-version, historical-integrity, explicit-v1, array-order, native-v2 and wrong-current-value cases. Complete output: `output/evidence-acceptance/e4-fix-round2-tests.log`.
3. `node scripts/evidence-audit.mjs --offline --output output/evidence-acceptance/e4-fix-round2-source-audit.json` — exit 0; 3 artifact files, 8 coordinates, 170 compared field anchors, empty integrity/semantic/unavailable arrays; human review pending.
4. `git diff --check` — exit 0. Before this report append, `git status --short` showed only the two authorized source-artifact files modified. Edits remain unstaged.

No full suite, source-package rebuild, browser operation, dependency change, commit or versioned-artifact mutation was performed in round 2. The existing disk adapter already treats any semanticReviewRequired entry as a nonpassing report, so its code did not need alteration. Human/spatial review and the inherited n=17 limitation remain unchanged.
