# S5 implementation report

Status: S5 implementation ready for root review and independent commit. ROICompare integrated only after root's explicit release following S2 commit `15f0507`. No staging, commit, browser CLI, Python or dependency installation. Desktop browser acceptance belongs to root. Project-level original-result storage/restore/recompute remains W6 integration.

## Implemented

- `computation-manifest.js`: validates complete A/B manifests, freezes defensive copies, preserves operand and transform-chain order, normalizes only each discrete label set and source-dependency ordering. Recursive comparison includes scientific fields and optional source/alignment evidence. JSON and standards-compliant CSV carry the same unformatted original metrics, probability metrics, sampling and manifest.
- `makeAssetIdentity` hashes precisely supplied raw bytes with Web Crypto SHA-256; unknown source space may remain null without comparison eligibility. Local NIfTI provenance retains separately hashed original `.nii`/`.nii.gz` file bytes and explicitly encoded little-endian computation payload, with datatype in derived identity and encoding metadata. Versions without verified upstream releases use actual content hashes.
- `build-asset-identities.mjs` creates/checks 11 volume entries from actual local bytes, including originals, derived source NIfTI, native label inputs, dictionaries, processing sources and reference templates as applicable. Registered AAL/AAL3 retain actual project transform-file bytes/hashes. No upstream unavailable transform is invented.
- `volume.js` hashes each received `.bin` before accepting expected digest, verifies probability and project-transform bytes, and attaches independently recorded original dependency identities, source grid, chain and source/alignment limitations. Missing catalog dependencies remain null and cannot pass computation provenance requirements.
- `roi.js` preserves identity/source/chain metadata across serialization, rejects missing source space rather than silently assuming MNI, attaches an immutable result manifest, and checks it against actual operands, current algorithm version, selections, thresholds and grid.
- `roi.worker.js` requires a locked manifest before preflight; rejects mismatches; retains the snapshot through confirmation and completion. Confirmation cannot replace the manifest.
- `ROICompare.jsx` prepares identities/normalized selections before creating the worker, rejects late or mismatched result manifests, and freezes the completed manifest again after Worker cloning. Local import hashes retained original NIfTI bytes and explicit derived payload before registration. Existing CSV action and new JSON action export the captured original result; contextual collapsed source hashes are available. S2 exact references, version-mismatch gates and descriptors, and S4 resolution/loss confirmation remain intact.
- `tests/e2e/roi-provenance.spec.mjs` authors actual AAL3 label 134 JSON/CSV download parsing at both declared spacings, checks source and transform hashes against local files, sampling loss, exact target grids, and persistence of downloaded result after selection change. Authored/syntax-checked, not desktop-executed.

## Consumer API

- `makeComputationManifest({appVersion,algorithmVersion,inputs,transforms,sourceGrids,targetGrid,interpolation,thresholds,labelSets,spatialEvidence?})`
- `compareComputationManifest(saved,current) -> {matches,differences}` (historical missing facts remain missing)
- `makeAssetIdentity(Uint8Array,{id,version,spaceId}) -> Promise<AssetIdentity>`
- `prepareComparisonManifest(a,normalizedSelectionA,b,normalizedSelectionB,target,options?) -> Promise<ComputationManifest>`; use existing `normalizeROISelection`. Rehashes actual in-memory payloads before locking manifest. Default/current `appVersion=4.1.0`, `algorithmVersion=roi-shared-grid-v2`.
- `prepareLocalVolumeProvenance(volume,originalFileUint8Array,{id:filename}) -> Promise<enrichedVolume>`; invoke after assigning local source/alignment declaration, before registering the custom volume.
- `exportComparisonBundle(comparison,manifest=comparison.manifest) -> {json,csv}`; never recomputes exported results.
- Worker input adds `manifest`; output `comparison.manifest` is the same scientific snapshot. UI should revalidate/freeze with `makeComputationManifest` after structured cloning.

## Observed validation

- RED: initial required module import failed `ERR_MODULE_NOT_FOUND`; existing ROI 16 passed.
- GREEN: initial manifest/ROI suite 21/21.
- RED: actual loader lacked identity; corrupt-buffer regression failed before byte verification.
- GREEN: loader now rejects changed `.bin` and real AAL project-transform bytes.
- RED/GREEN: standards-compliant CSV parsing caught escaping error, fixed to doubled CSV quotes.
- RED/GREEN: in-memory data mutation and obsolete algorithm version could masquerade as matching identity; now rejected.
- Final `node --test src/lib/computation-manifest.test.mjs src/lib/roi.test.mjs src/lib/roi-grid.test.mjs src/lib/volume.test.mjs src/lib/atlas-identity-build.test.mjs`: 32/32, 0 failures, approximately 2.24 seconds. Worker round trip covers A/B original identities, grids, ordered fields, tail/threshold, discrete labels, immutable confirmation snapshot, sampling warnings and deterministic original metrics.
- `node scripts/build-asset-identities.mjs --check`: verified 11 volume identities plus all preserved source/transform bytes.
- `node --check tests/e2e/roi-provenance.spec.mjs`: exit 0.
- `git diff --check` for assigned S5 files: exit 0. `npm run build`: exit 0; existing bundle-size warning remains. Final JSX-only contextual source details were included in the last build.
- E2E runner intentionally not invoked under desktop-browser restriction. No browser-interaction pass is claimed.

## Rulings and remaining integration

- Ruling: `spatialEvidence[2]` is an additive manifest field. It retains exact recorded source-space/alignment bases and limitations while the required `AssetIdentity` / `GridSpec` fields remain unchanged. Published FSL/JHU/BA space names are retained; `canOverlayOnTarget` remains the explicit existing eligibility policy. Source-space naming does not grant new registration certification.
- Ruling: upstream transform already incorporated into a distributed source NIfTI is not represented by a fabricated transform file. Empty chain records no additional transform file applied in this derivative path; published source/alignment evidence and the actual source file/script identities remain available. Registered AAL chains contain the preserved real `.npz` file.
- Ruling: low-level synchronous `compareROIs` still permits manifest-free geometry fixtures and returns `manifest:null`; production worker requires a complete manifest. This preserves existing exact-math tests without claiming unidentified computations are reproducible.
- Ruling: unknown manifest catalog entries can still be viewed after verifying their actual `.bin` digest, but `sourceIdentities:null` / `transforms:null` prohibit reproducible ROI computation. Unknown chains are never rewritten as empty.
- Root approved minimal S1 test mock-route update for the new required asset-identities JSON and replacing fake hash fixtures with actual byte digests; S1 clean-checkout/deterministic rebuild/source-tamper assertions were retained.
- Pending: root CUA downloaded JSON/CSV checks, W6 full-project result storage and original/current-input mismatch UI, W2 custom-registry transaction wiring. No historical v1 result is assigned a newly observed hash as its historical identity.

## Review fix round 1 — S5-R1

The source builders confirm the review finding: HO recoding reads `HarvardOxford-fs-labels.txt`; registered AAL/AAL3 import `register_volume.py`; DK reads the FSL T1 to set its target grid. Each affected volume now has that dependency's actual-byte `AssetIdentity`, independently of other catalog entries. `asset-identities.json` was regenerated; no source binary, original source file, ROICompare, App or W2 work-in-progress file was changed.

New `src/lib/asset-identity-build.test.mjs` creates isolated copies, not links to originals. Per affected volume it checks dependency inclusion and exact hash, rejects a changed dependency with `--check`, regenerates to the changed dependency fingerprint while preserving the already-built binary's unchanged identity, then rejects a missing dependency. It also verifies the originals remain unchanged. DK's target template is pinned elsewhere too: changing it first fails the pinned source digest; the fixture explicitly updates that source declaration before testing stale-catalog rejection and intentional regeneration. That step is confined to the copied fixture and does not rerun or certify a scientific derivation.

Checker wording now says **cataloged** source/transform bytes. This corrects the earlier overly broad wording about “all preserved” bytes; it verifies the dependency inventory it enumerates, not an automatic discovery of every possible scientific/software/environment dependency.

RED command: `node --test src/lib/asset-identity-build.test.mjs` — exit 1, tests 4, pass 0, fail 4. All three dependency subtests failed with `must retain its own dependency`, reproducing the omitted per-volume identities before the builder change.

Regeneration command: `node scripts/build-asset-identities.mjs` — exit 0; exact output:

```text
Wrote 11 volume identities.
```

Final covering command: `node --test src/lib/asset-identity-build.test.mjs src/lib/computation-manifest.test.mjs` — exit 0; exact output:

```text
▶ each derivation dependency is fingerprinted per affected volume and tampering invalidates the catalog
  ✔ data-sources/raw/HarvardOxford-fs-labels.txt (1866.5841ms)
  ✔ scripts/register_volume.py (1843.4949ms)
  ✔ data-sources/raw/MNI152_T1_2mm_brain.nii.gz (2135.5955ms)
✔ each derivation dependency is fingerprinted per affected volume and tampering invalidates the catalog (5847.0367ms)
✔ asset hashes are exact raw bytes; unknown space remains null (49.2761ms)
✔ manifest rejects missing hashes/spaces/chains and freezes a defensive normalized copy (1.159ms)
✔ same name and URL cannot hide byte/version/space/transform/grid/threshold or operand changes (1.0062ms)
✔ JSON and CSV export preserve the exact manifest and every original metric including sampling (0.7574ms)
✔ local original and explicitly little endian derived volume identities survive worker serialization and deterministic recompute (4.0083ms)
✔ actual loaded bytes receive verified identity; corruption cannot borrow the expected hash (44.0807ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6032.5937
```

Final catalog command: `node scripts/build-asset-identities.mjs --check` — exit 0; exact output:

```text
Verified 11 volume identities and their cataloged source/transform bytes.
```

`git diff --check -- scripts/build-asset-identities.mjs public/data/asset-identities.json src/lib/asset-identity-build.test.mjs` — exit 0, no output. No full build, browser CLI, Python, package installation, staging, commit or subagents were used in this fix round. S5-R1 is addressed for root review; previous browser/project-integration validation boundaries remain unchanged.

## CUA follow-up — authored E2E threshold expectation

Read root's `S5-cua.md` and the retained `output/s5-cua/receipt.json`. The authored test incorrectly expected discrete-label threshold 0; the actual UI configuration and downloaded manifests preserve 0.5 for both A and B. Discrete labels use membership and ignore this threshold. Only `tests/e2e/roi-provenance.spec.mjs` was corrected: it now asserts both recorded A/B threshold records at 0.5 and explains why. Production code/defaults and retained downloads were not changed.

`node --check tests/e2e/roi-provenance.spec.mjs` — exit 0, no output.

Focused retained-download command:

```text
node --input-type=module -e "import fs from 'node:fs';import assert from 'node:assert/strict';for(const name of ['one-mm','two-mm']){const saved=JSON.parse(fs.readFileSync('output/s5-cua/'+name+'.json','utf8'));assert.deepEqual(saved.manifest.thresholds,[{kind:'label',threshold:.5,tail:'positive'},{kind:'label',threshold:.5,tail:'positive'}]);console.log(name+': A/B label threshold=0.5, tail=positive; retained JSON assertion passed.');}"
```

Exit 0; exact output:

```text
one-mm: A/B label threshold=0.5, tail=positive; retained JSON assertion passed.
two-mm: A/B label threshold=0.5, tail=positive; retained JSON assertion passed.
```

`git diff --check -- tests/e2e/roi-provenance.spec.mjs` — exit 0, no output. No broad tests, build, browser CLI, staging, commit or subagents were used for this test-only follow-up. Root's separately documented CUA evidence covers both spacings and all nine dependencies; this follow-up validates the corrected assertion against those preserved downloads, not a new E2E-runner execution. W6 full-project persistence/recompute remains outside this acceptance.
