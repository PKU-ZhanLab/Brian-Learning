# S1 report — atlas identities and explicit concept relations

Status: implementation and required targeted verification complete; root review and commit pending. Worktree: `F:/project/brain-model/.worktrees/research-20261029`; task base `ab7cf2b`. No staging, commit, browser CLI, Python, package installation, publish or user-storage operation performed.

## Changed files

- `src/lib/atlas-identity.js`
- `src/lib/atlas-identity.test.mjs`
- `src/lib/volume.js`
- `src/lib/volume.test.mjs`
- `public/data/manifest.json`
- `public/data/atlas-region-relations.json`
- `scripts/validate-atlas-identities.mjs`

Only these assigned production/test/data files were modified by S1. Concurrent W1/source-research edits were left intact. This report and S1 logs are ignored task artifacts.

## Implementation

`atlasRegionKey(ref)` validates and JSON-serializes the five identity values in fixed order `[atlasId,atlasVersion,labelId,hemisphere,spaceId]`. It never uses names, positions or directory order. Positive original label IDs are retained; AAL 8121/8211, AAL3 87/91 and different artifact versions have separate keys.

`makeAtlasRegionRef(atlasId,metadata,label)` resolves a numeric ID or label object only through the atlas's recorded dictionary. Caller-provided hemisphere/name/position fields do not override source metadata. Missing dictionary entries, missing label provenance, invalid original IDs, missing version and absent/mismatched space provenance throw. The result contains exactly the shared `AtlasRegionRef` fields.

`relationsForRegion(ref,relations)` returns exact identity matches; unknown identities return `[]`. It accepts either the relation array or its JSON envelope. `validateRegionRelations(relations,regionIndex,conceptIndex)` accepts Map/object indexes. Region-index values are the recorded label metadata (including tissue, hemisphere and optional `structureIdSource`); concept-index values may be the existing catalog entries. Validation rejects unknown region/concept IDs, source-less claims, unsupported types, tissue contradictions, left/right contradictions and source-mapping-free `exact-source` claims. Exact-source must match the recorded DK `structureId` and its original mapping locator; it cannot be promoted from a cross-atlas name match.

The explicit relation file contains 68 DK same-source mappings only. Each keeps the pinned CBIG annotation URL and a locator joining `scripts/dk_build.py:ROWS`, the original annotation name, original FreeSurfer integer, cortical side and catalog structure ID. AAL/AAL3/BA and other unverified concept relations remain absent.

All ten top-level atlas entries now record `atlasId`, `atlasVersion`, `upstreamVersion`, `versionBasis`, `spaceId`, `spaceIdentitySource`, and `labelMetadataSource`. Labels retain their original fields and gain source-backed hemisphere/tissue metadata and locators. Artifact versions are `sha256:<actual derived binary digest>`; `upstreamVersion:null` and an explicit note preserve the fact that an upstream release version has not been independently established. Space IDs preserve the original space strings and their original alignment statuses; these additions do not upgrade an uncertain template or project registration estimate.

`loadAtlas` returns those metadata fields and keys cache/pending work by atlas ID, version, digest, space, probability digest and declared grid, instead of atlas ID alone. Existing overlay/projection checks and native-space guards remain. Stable identities reuse their volume; changed version, digest, space or atlas ID load a separate volume even with the same filename.

## Source handling and rulings

- **Ruling:** Follow the dispatch's root-only commit rule instead of S1 Step 5's generic commit recipe. All changes remain unstaged for root review. Cost if wrong: root must perform the scoped commit.
- **Ruling:** The real dictionaries often do not encode tissue classes or sides. `_L/_R`, `Left/Right`, JHU's white-matter header, Jülich's explicit `GM` and original Talairach `Gray Matter`/Left+Right aggregations are usable source metadata. Other cases keep `U` / `unknown`; no coordinate signs or catalog ordering supply a missing value. All AAL/AAL3 tissue fields therefore remain `unknown`, rather than asserting a tissue mask not encoded by their label tables. DK's gray-matter category is explicitly tied to its cortical aparc extraction, not the entire aseg volume. Cost if wrong: conservative metadata and empty relations reduce currently linked concept coverage; further links need explicit sourced review.
- **Ruling:** BA's original Left and Right Talairach entries are explicitly aggregated to one integer by `scripts/ba_build.py`; these source labels are `B`. This describes source-label identity. A click's side remains separate downstream.
- **Ruling:** Legacy BA is `available:false` with `data:null`. Its 41 original declarations remain resolvable as declared artifact identities using preserved numeric-ID extraction provenance, with `U` / `unknown` and `original-dictionary-unavailable`. The validator does not claim measured binary coverage for them. Cost if wrong: the original legacy dictionary/binary would need separate recovery before stronger metadata claims.
- **Ruling:** S1 does not edit `BrainScene.jsx`, `App.jsx`, ROI/project selection or evidence consumers outside ownership. New explicit relations contain no unsubstantiated AAL/BA exact claims, but removing the current UI's name heuristics belongs to S2. S1's passing tests must not be described as full selection-flow acceptance.

Source locators point to preserved original files: AAL `ROI_MNI_V4.txt`, AAL3 `ROI_MNI_V7_1mm_vol.txt`, DK `aparc.annot.ctab`, Harvard–Oxford/JHU/Jülich/Talairach XML dictionaries and the existing source extraction scripts. All recorded source-file SHA-256 values are verified by the validator. Space-provenance JSON pointers are dereferenced and checked against the preserved space declaration; script locators must contain the original declared space string.

## RED → GREEN evidence

1. Wrote the real-manifest/catalog identity tests first. `node --test src/lib/atlas-identity.test.mjs` failed because `atlas-identity.js` did not exist (`ERR_MODULE_NOT_FOUND`), as the brief explicitly permits. Output: `S1-red.log`.
2. Added the same-filename cache behavior regression before changing `volume.js`. `node --test src/lib/volume.test.mjs` failed at the changed-version `notStrictEqual` assertion: old atlas-ID caching returned the original object. Output: `S1-volume-red.log`.
3. During source-contract review, added a missing-space-provenance rejection assertion. It failed with `Missing expected exception`; then implemented the matching provenance requirement and records. Output: `S1-space-red.log`.
4. Final targeted command: `node --test src/lib/atlas-identity.test.mjs src/lib/volume.test.mjs` — exit 0, **7/7 passed**, no skipped tests. Output: `S1-green.log`.
5. `node scripts/validate-atlas-identities.mjs` — exit 0, **806 indexed identities**, **765 actual positive volume labels**, **41 declared-only legacy labels**, **68 explicit relations**, **738 unknown relationships**, **0 tissue/laterality conflicts**. Output: `S1-validation.log`.
6. Final project command `npm run check` — exit 0; data/geometry/affine/source and literature checks passed; **83/83 Node tests passed** including concurrent W1 tests. Output: `S1-check.log`. Concurrent worktree snapshot only; root owns final integration verification.
7. `git diff --check -- public/data/manifest.json src/lib/volume.js src/lib/volume.test.mjs` — exit 0.
8. Independently compared every pre-existing manifest leaf with `git show ab7cf2b:public/data/manifest.json`: **9,310 original scalar values unchanged**. No binary or geometry file modified. Existing `check-data.mjs` also verified source volume digests and unchanged pial/white hashes.

## Denominators

Actual-volume counts come from reading each declared binary's positive discrete values, not label-array position. Projectable-cortical counts come from the existing surface-projection manifest (DK from its cortical-only annotation table). Zero projectable count means no such projection is declared; it is not a whole-atlas coverage claim.

| Atlas | Declared identities | Actual volume labels | Linked volume labels | Projectable cortical labels | Linked projectable labels |
|---|---:|---:|---:|---:|---:|
| DK | 68 | 68 | 68 | 68 | 68 |
| AAL native | 116 | 116 | 0 | 0 | 0 |
| AAL3 native | 166 | 166 | 0 | 0 | 0 |
| Harvard–Oxford | 21 | 21 | 0 | 0 | 0 |
| JHU | 48 | 48 | 0 | 0 | 0 |
| BA Talairach | 42 | 42 | 0 | 0 | 0 |
| BA legacy | 41 | unavailable | 0 | 0 | 0 |
| BA Jülich subset | 22 | 22 | 0 | 0 | 0 |
| AAL registered estimate | 116 | 116 | 0 | 78 | 0 |
| AAL3 registered estimate | 166 | 166 | 0 | 86 | 0 |

The audit's former 24/78 and 24/86 guessed concept associations are not retained as exact-source relations and are not reported as whole-atlas coverage.

## S2 integration handoff and remaining limitations

- Load explicit relationships from `manifest.regionRelations` (`atlas-region-relations.json`), then use the full `AtlasRegionRef` for selection/note/restore/ROI identity. `loadAtlas` already exposes the enriched metadata. User/custom labels need their own source/space identity handling; this task does not fabricate atlas refs for unsourced custom data.
- Remove `src/components/BrainScene.jsx:183` `findMatchingStructure` normalized substring/name scoring from exact-label selection. Current call sites around lines 534 (surface color/structure lookup) and 770 (click selection) can still associate AAL cingulate cortex with tract cards or select a BA/DK relation by catalog order. Replace those paths with exact refs and explicit relationships, and keep unlinked real labels selectable with minimal details.
- `BrainScene` currently allows DK `label.structureId` directly; require its recorded `structureIdSource`/explicit relation rather than promoting arbitrary dictionaries' similarly named fields.
- `src/lib/volume.js` `atlasLabelAt` still returns the existing minimal value/name/probability query result. S2/S3 must attach full identity/query context without guessing. Coordinate and surface queries are not yet generation-safe by S1 alone.
- `App.jsx`'s detail/notes/research flow still centers on catalog `selected` IDs and teaching `atlasLabels`; S1 does not make unlinked labels independently selectable, annotatable or restorable. `AtlasExplorer`/ROI computations retain raw integer labels but their full identity serialization is later work. `src/lib/roi.js:216` currently picks a limited metadata set for worker transfer and will need the identity/manifest contract when S4/S5 integrate it.
- Runtime loading uses the manifest's recorded digest in the cache identity; this task's validator hashes local files. It does not add download-time cryptographic verification or live manifest refresh. Resource generations/retry and computation identities remain S3/S5 work.
- Existing alignment statuses, original geometry/camera conventions, unknown-space overlay prohibitions and source labels are retained. No new registration or anatomical equivalence is established.
- Browser interaction, independent anatomical review, human certification, project migration integration, public build and publication were not performed by S1. Their acceptance remains with root and later tasks.

No additional deferred minor findings were identified during the S1 author self-review; a fresh root review is still required.

## S1 review fix round 1 — reproducible documented manifest rebuild

Review package: `S1-review.md`, reviewed S1 commit `191ac48`; fix dispatched with independent W1 fix at HEAD `61ca448`. Root explicitly extended ownership to the supported generator, a deterministic enrichment helper and a focused regression. No additional worker or subagent was spawned.

Finding addressed: the documented `node scripts/upgrade-manifest.mjs` path replaced seven atlas objects with older source-manifest objects and discarded the newly required identities/provenance. The unchanged fail-closed `loadAtlas` guard then refused the regenerated atlases.

Additional changed files:

- `scripts/upgrade-manifest.mjs`
- `scripts/enrich-atlas-identities.mjs` (new tracked source step)
- `src/lib/atlas-identity-build.test.mjs` (new focused regression)

The supported upgrade now invokes `enrichAtlasIdentities` after merging the original manifests and before writing the authoritative manifest and relations. The helper reproduces the original source-backed metadata derivation as tracked code, makes no filesystem writes, and clones its input. It reads the exact preserved label tables, verifies dictionary ID/name membership, verifies binary SHA-256/shape/positive values, checks pinned DK annotation bytes and source-name-to-concept mappings against the original extraction script, validates source space declarations, recomputes every source digest and generates the 68 DK relations. Missing or mismatched evidence throws rather than reusing stale metadata. The runtime guard in `volume.js` remains unchanged.

The upgrade also prefers an existing `ba-legacy` declaration in its preserved legacy snapshot. This matters on a fresh checkout without `legacy-manifest-v1.json`: the current manifest already has separate 41-label legacy and 42-label Talairach entries; copying the current 42-label BA entry into legacy would otherwise corrupt the original declaration set. The regression checks the original 41 IDs and total 806 declared identities.

The regression creates a temporary checkout beneath this task's ignored workspace, copies scripts/top-level manifest and small direct binary files, and uses read-only source-directory junctions only for reading preserved inputs. It executes the actual documented `--manifest-only` generator path, verifies all regenerated identities and explicit relations, repeats the build to establish deterministic results, changes only the temporary extraction-script bytes and checks freshly computed source digests, then loads regenerated DK through the unchanged runtime guard. It also rejects changed binary digests, mismatched AAL dictionary labels and a forged DK concept mapping. The temporary checkout is removed after verifying its resolved path is within the task workspace; original sources and the authoritative current manifest are unchanged.

Exact RED command and observed output (`S1-fix1-red.log`):

```text
node --test src/lib/atlas-identity-build.test.mjs
exit=1
tests 2
pass 0
fail 2
documented manifest upgrade deterministically rebuilds source identities and relations:
  AssertionError: dk: atlasVersion missing after documented rebuild
enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings:
  ERR_MODULE_NOT_FOUND: scripts/enrich-atlas-identities.mjs
```

Exact final GREEN command and observed output (`S1-fix1-green.log`):

```text
node --test src/lib/atlas-identity-build.test.mjs src/lib/atlas-identity.test.mjs src/lib/volume.test.mjs
exit=0
✔ documented manifest upgrade deterministically rebuilds source identities and relations
✔ enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings
✔ original non-contiguous IDs and artifact versions remain independent identities
✔ cingulate cortex labels never acquire cingulum white matter concepts
✔ BA4 and BA10 do not acquire a DK equivalent by catalog order or shared names
✔ source dictionaries, not coordinates or caller label fields, supply hemisphere
✔ relation validation rejects tissue, laterality, missing identity and unsourced exact equivalence
✔ slice rendering overlays aligned atlas voxels and leaves unavailable space uncoloured
✔ atlas cache separates version, content digest and declared space while preserving source metadata
tests 9
pass 9
fail 0
skipped 0
```

Exact validator command and summary (`S1-fix1-validation.log`):

```text
node scripts/validate-atlas-identities.mjs
exit=0
valid: true
indexedLabelIdentities: 806
actualVolumeLabels: 765
declaredOnlyLabels: 41
explicitRelations: 68
unknownRelationLabels: 738
tissueOrLateralityConflicts: 0
```

Read-only reproducibility probe: import the tracked `enrichAtlasIdentities`, enrich the committed current manifest, deep-compare its complete returned manifest and relation envelope with `public/data/manifest.json` and `public/data/atlas-region-relations.json`. Actual output: `Current committed identities and 68 relations reproduce exactly from tracked enrichment.` Exit 0.

`git diff --check -- scripts/upgrade-manifest.mjs scripts/enrich-atlas-identities.mjs src/lib/atlas-identity-build.test.mjs` exited 0. No broad suite, public build or browser was run, as directed for this focused review fix. No current public-data artifact needed modification. No staging or commit was performed, and concurrent evidence/source workers' edits were left intact.

Ruling: the supported build fails if the binary bytes and declared digest disagree; maintainers must first regenerate the matching source manifest rather than having identity enrichment silently rewrite an unverified digest. Source-provenance hashes are recomputed after valid source changes. Cost if wrong: inconsistent source updates stop the build until their input evidence is repaired, instead of producing a misleading identity.

All original S1 scientific/UI limitations and the S2 handoff remain unchanged. This fix addresses the generator reliability finding only; root retains integration review and commit responsibility.

## S1 review fix round 2 — absent temporary parent on clean checkout

Scoped review: appended `S1-review.md`, fix round 1 at `29af6ea`; root dispatched this round from `3ad35f6` with disjoint E2 changes. The previous generator P2 is addressed. This round changes only `src/lib/atlas-identity-build.test.mjs`: create `scratch` recursively before calling `mkdtempSync`. Existing SDD reports, worktree and source inputs are retained. Production enrichment/loading code is unchanged.

The absent-parent case was verified by a separate ignored task harness, `S1-fix2-clean-run.mjs`. It creates a fresh temporary checkout beneath the system temporary directory, copies the actual current `src` and `scripts` trees and package metadata, attaches source-data/dependency directories for reading, asserts that `.superpowers` does not exist, and invokes the actual focused test file. The source-data links are only read: scripts are real copies, so the focused test's temporary source-byte mutation cannot reach preserved originals. The harness validates its resolved temporary path before deleting only its own checkout. It does not rename, remove or move the real SDD directory to simulate a clean checkout.

Exact RED command and observed output (`S1-fix2-red.log`):

```text
node .superpowers/sdd/README/S1-fix2-clean-run.mjs
exit=1
Verified isolated checkout starts without .superpowers parent.
✖ documented manifest upgrade deterministically rebuilds source identities and relations
✔ enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings
tests 2
pass 1
fail 1
Error: ENOENT: no such file or directory, mkdtemp '<isolated checkout>/.superpowers/sdd/README/S1-rebuild-XXXXXX'
isolated_exit=1
```

The failure occurred in the actual first-test callback at its original `mkdtempSync` call, before the fixture's `try/finally`, confirming the review finding.

Exact clean-checkout GREEN command and observed output (`S1-fix2-clean-green.log`):

```text
node .superpowers/sdd/README/S1-fix2-clean-run.mjs
exit=0
Verified isolated checkout starts without .superpowers parent.
✔ documented manifest upgrade deterministically rebuilds source identities and relations
✔ enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings
tests 2
pass 2
fail 0
skipped 0
isolated_exit=0
```

Exact existing-worktree covering command and output (`S1-fix2-green.log`):

```text
node --test src/lib/atlas-identity-build.test.mjs
exit=0
✔ documented manifest upgrade deterministically rebuilds source identities and relations
✔ enrichment rejects changed binary digests, dictionary mismatches and stale DK concept mappings
tests 2
pass 2
fail 0
skipped 0
```

Both GREEN runs execute the three supported rebuilds, changed-source provenance refresh, unchanged runtime-guard load, exact identity/relation checks and negative source checks from round 1. `git diff --check -- src/lib/atlas-identity-build.test.mjs` exited 0. No broad suite, build or browser was run, as requested. No staging, commit, package installation, source-data edit or subagent occurred. Other workers' changes were left intact. No additional ruling or limitation was introduced by the one-line setup correction.
