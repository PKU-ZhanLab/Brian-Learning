# W3 implementation and W6 storage prerequisite

Status: **DONE_WITH_CONCERNS** — implementation and Node/build checks complete;
the authored isolated browser tests and desktop acceptance remain unexecuted.
Root owns review, staging, commits and permitted CUA operations. No subagents,
installs, Python, browser commands, file import attempts, user storage reads,
Git staging or commits were performed by this implementer.

## APIs and behavior

`planAssetRemoval(snapshot,assetId)` returns
`{assetId,dependentViewFields,dependentResults,next}`. It accepts only an asset
owned by `snapshot.projectId`. The candidate removes that volume; clears its
active atlas/explorer/precise selections and only its ROI side; preserves the
other side's source, labels, threshold, tail and region references; and clears
the computed trigger. It keeps notes/evidence and historical numerical values,
manifests, grids and classes. Affected historical snapshots become
`status:'missing-input'` with explicit `missingAssetIds`. Preview and cancel do
not publish anything.

`planProjectExport(snapshot,{assetIds,dependentPolicy:'include'|'detach'})`
returns `{workspace,preview}`. Include computes the referenced asset closure
across live views, historical records/snapshots and selected asset dependencies;
detach removes excluded asset references from the export copy's current view
and retains history with missing-input declarations. Explicit foreign IDs fail.
The default complete-project UI selects only all current-project assets.
Preview lists the exact final IDs/names/bytes/usage, notes and local evidence
counts, detached view fields and affected historical result containers. Only
Confirm download downloads the already admitted shared-codec text.

`describeWorkspaceAssets(snapshot)` returns current-project asset summaries:
`{id,name,kind,space,bytes,usedBy}`. `referencedAssetIds(value)` provides the
single asset-reference traversal consumed by the plans and missing-state gate;
legacy originals and opaque draft payloads are not rewritten or scanned.

App `stageAssetAction` captures the current view plus session ownership at the
explicit action, runs the pure plan, then `stageWorkspaceChange`. Removal
confirmation invokes `createWorkspaceSession.commit` exactly once. Export
confirmation invokes no commit or registry publication. Both reject an action
whose exact base snapshot has changed. The Stage now additionally exposes
`projectText`, the already prepared **same** `prepareProjectPayload` text, so
download does not use a second serializer or recompress after preview.

Quota failure leaves pending confirmation, asset list, checkbox selection and
research state intact. Cancel restores the initiating action's focus. The ROI
imported-volume section has a Manage project assets entry. A deliberately
detached ROI source is the empty string: validation and ROI controls retain it
instead of silently selecting another source. S3 resources/queries and E3's
distinct paper/result modality filters are untouched.

## Missing-input admission

The root-approved `missingAssetIds` field is a unique, bounded declaration of
unavailable historical dependencies, not evidence of scientific verification.
The sole project schema, the same session envelope and startup reader retain
it. It is capped at 20,000 existing custom-ID-shaped strings, using the shared
custom-ID syntax (1–112 characters after `custom-`). It never authorizes a live
view reference; undeclared missing references still fail. A snapshot referring
to one of these IDs must explicitly carry `status:'missing-input'`.

Plans generate declarations only from real current assets excluded/removed
while still referenced by historical research. Notes/evidence remain unchanged.
Declared missing IDs remain visible in the asset panel. They are absent from
public view links because the existing allowlisted view projection has no such
field. There is no new persistence key, alternate registry mutation or parallel
project serializer.

Merge keeps current and incoming origins separate. An incoming real asset that
collides with a current missing identity is remapped; an incoming missing
identity that collides with current real bytes is remapped together with only
its incoming historical references. Retained current snapshot identities remain
untouched. Direct regressions cover both directions and the existing W2 merge
regressions remain green.

## Root-authorized W6 storage prerequisite

The initial concrete gap was that the sole codec omitted both snapshots and
`stageProjectImport` forced them to null. Root authorized W6's storage-only
prerequisite rather than permitting loss or permanently blocking historical
exports. `saved-computation.js` now supplies these APIs for later W6 consumption:

- `savedComputationUsage(input)` →
  `{rawPayloadBytes,classCount,metadata}`. No binary clone or array-to-JSON
  expansion occurs during this preflight.
- `encodeSavedComputation(input,{maxRawBytes?})` →
  `{value,rawPayloadBytes,compressedBytes}`.
- `inspectEncodedSavedComputation(value)` →
  `{rawPayloadBytes,compressedBytes,classCount,metadata}` before binary decode.
- `decodeSavedComputation(value,{maxRawBytes?})` → saved snapshot with a compact
  `Uint8Array classes`, or null. All stream reads are bounded and cancelled on
  failure.

On disk a non-null snapshot retains the saved metadata plus
`classEncoding:'uint8-gzip-base64'`, `classCount`, and `classesGzip` (null for
legacy missing classes). The in-memory classes are bytes 0–3 and must exactly
match the positive three-dimensional grid size, at most 64,000,000 voxels.
Snapshot metadata is bounded to 2 MiB. Each compressed snapshot obeys W1's
128 MiB compressed payload cap. Both snapshots' class bytes **and** metadata
count toward the combined 256 MiB raw budget; their complete encoded JSON
counts toward 180 MiB. Decode reserves both declared snapshot budgets before
NIfTI allocations; bounded decompression must produce exactly `classCount`
valid bytes. Original metrics/probabilityMetrics/grid/manifest/display and other
bounded historical descriptors are retained. Redundant maskA/maskB/surfaces
are omitted from stored snapshots and from staged snapshot clones; later W6 can
derive them from classes without resampling sources.

The codec keeps `roiSnapshot` and `recomputedSnapshot` distinct. Import staging
retains both. Incomplete old snapshots (including historical containers lacking
an ID) retain their actual recorded facts; an incomplete or absent manifest is
marked `missing-provenance`, without inventing historical IDs or input hashes.
Complete recorded manifests are validated through S5's unique
`makeComputationManifest`; the stored original is preserved and is **not**
certified matched against current assets by this storage layer. Existing
missing-input state takes precedence over incomplete provenance. Legacy v1
has both snapshots null, drafts empty and missing-provenance.

File restoration now always clears `view.roi.computed`, for v1 and v2, while
preserving the source/label/threshold/display settings. This prevents the old
ROI auto-restore worker path from silently recomputing a newly retained saved
snapshot. Full saved-result scene restoration, status comparisons/difference
display, `restoreComputation` inspect-versus-recompute decisions, new computation
IDs and W6's dedicated e2e remain later W6 scope; none is falsely marked done
here. App capture retains a session's historical snapshot when the current ROI
overlay is cleared, so subsequent saves/removal/export do not erase it.

## Changed paths

- New `src/lib/workspace-assets.js`, `src/lib/workspace-assets.test.mjs`
- New `src/components/WorkspaceAssets.jsx`, `src/components/WorkspaceAssets.css`
- Changed `src/components/WorkspaceFiles.jsx`, `src/components/WorkspaceFiles.css`
- Changed `src/App.jsx`, `src/components/ROICompare.jsx`
- New `tests/e2e/workspace-assets.spec.mjs`
- Root-authorized prerequisite: new `src/lib/saved-computation.js` and
  `src/lib/saved-computation.test.mjs`; narrow changes to the existing
  `src/lib/workspace-project.js` and `src/lib/workspace-session.js`

## Verification evidence

- Initial RED command:
  `node --test src/lib/workspace-assets.test.mjs src/lib/workspace-session.test.mjs`
  → 15 passed / 1 failed file: new asset module missing.
  `W3-red.log` retains the observed failure.
- Storage prerequisite RED: new saved-computation APIs absent; asset admission
  rejected historical missing references. `W3-codec-red.log`.
- Additional observed REDs: historical tombstone collisions initially rejected
  merge (`W3-merge-red.log`); a restored v2 snapshot still left computed=true
  (`W3-no-recompute-red.log`); a declared missing input could retain a matched
  snapshot status (`W3-status-red.log`). Each was corrected.
- Final focused command:
  `node --test src/lib/workspace-assets.test.mjs src/lib/saved-computation.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-project.test.mjs`
  → **48/48 passed**, no failures/skips. `W3-green.log`.
  It covers scoped ownership, exact include/detach plans and purity, side-B
  preservation, unchanged research, invalid-metadata recovery, atomic quota
  rollback, declared versus undeclared missing references, both merge origins,
  separate historical/recomputed snapshots, Uint8 class round trips, invalid
  class values/counts/oversized grids, gzip expansion rejection, aggregate raw
  budget failure and truthful legacy migration. Large-budget rejection uses a
  synthetic byteLength probe, not a 512 MiB allocation.
- Final `npm run check` → **187/187 passed**, zero failures/skips; source,
  literature and data/hash validators passed. `W3-check.log`.
- Final `npm run build` → passed, **1641 modules**, with existing dynamic/static
  volume-import and >500 kB chunk advisories. `W3-build.log`.
- `node --check tests/e2e/workspace-assets.spec.mjs` passed.
- `git diff --check` passed; only existing CRLF conversion notices.
- No browser test was run. The authored test uses synthetic A→B projects,
  validates preview asset IDs against the actual downloaded JSON, verifies
  export/cancel leave storage unchanged, removes a used asset, exports retained
  history again, and checks quota failure preserves list/selection/all keys.

## Actual UI/source anchors for coordinator acceptance

- `src/App.jsx:226` action capture/staging; `:234` atomic removal versus pure
  download confirmation; `:336` WorkspaceFiles transaction wiring.
- `src/components/WorkspaceFiles.jsx:41` Asset action preview region;
  `:47` Confirm removal / Confirm download / Cancel; `:49` asset panel.
- `src/components/WorkspaceAssets.jsx:9` Project assets region;
  each item has `data-asset-id`, `Export asset: <name>` checkbox and
  `Remove asset: <name>` button. `:13` visible historical missing inputs.
  `Export dependency policy` selects include/detach and
  `Export selected content` stages the selected plan.
- `src/components/ROICompare.jsx:288` deliberately empty source option;
  `:317` Manage project assets entry.

Desktop/browser operation remains root-owned after the earlier browser import
denial. Actual file open/download/remove/focus/quota behavior, narrow layouts,
touch, 200% zoom and screen-reader acceptance are unverified. No full W6 scene
restoration or scientific reproducibility claim is made from these storage
tests. The source review and commit are still root-owned.

## Fix round 1 — large Base64 payloads and actual producer IDs

Read `W3-review.md` against base `ea99f2c`. Scope is only
`src/lib/saved-computation.js`, its focused test file, and this report. Root
remains sole committer. No browser operations, subagents, installs, Python,
whole-suite reruns or builds were performed during this codec-only fix.

Addressed both Important findings:

- The grouped repeated Base64 regexp overflowed the V8 regexp stack for legal
  multi-megabyte data emitted by the encoder. `encodedBytes` now performs one
  bounded, constant-stack character traversal. It checks the exact alphabet,
  four-character alignment, terminal one/two-character padding, canonical unused
  final sextet bits, and exact decoded byte cap before any `atob` allocation.
  The existing raw/compressed/project byte limits are unchanged.
- The 2,000-character snapshot ID cap rejected IDs produced by the real ROI
  calculator. Non-null IDs must still be nonempty strings, while their size is
  governed by the existing **2 MiB total metadata budget**. Historical IDs are
  preserved verbatim; none are truncated, replaced or regenerated.

Added these meaningful covering tests in `saved-computation.test.mjs`:

- `legal multi-megabyte encoded classes round trip without regular-expression
  stack growth`: deterministic xorshift fixture with **24,000,000** class bytes,
  shape `[300,400,200]`, valid values 0–3, actual gzip output >6,000,000 bytes and
  Base64 length >8,000,000 characters. It runs the real encoder, encoded
  admission and bounded decoder, then compares every decoded class and the
  saved metrics/grid.
- `actual many-label ROI producer IDs survive project round trip and import
  staging unchanged`: the real `compareROIs` selects all 500 labels in two
  valid 500-voxel sources, producing Dice=1 and a >2,000-character ID. It checks
  unchanged ID, metrics and classes through usage admission, the sole project
  serialization/parse path and atomic import staging.
- `encoded admission rejects malformed padding alphabet and noncanonical final
  bits`: valid zero-pad/one-pad/two-pad forms remain admitted; bad lengths,
  embedded/excess padding, whitespace, URL alphabet, punctuation and nonzero
  discarded final bits are rejected before decode.
- `producer ID admission retains the existing bounded metadata budget and ID
  type checks`: oversized IDs and oversized aggregate metadata still fail
  `snapshot-metadata-budget`; empty/non-string IDs still fail `snapshot-id`.

Observed RED command:
`node --test src/lib/saved-computation.test.mjs`
→ **4 passed / 4 failed**, log `W3-fix1-red.log`.
The failures reproduced `RangeError: Maximum call stack size exceeded`, rejected
actual producer IDs (`snapshot-id`), accepted noncanonical `AB==`, and the
obsolete ID cap taking precedence over the existing metadata budget.

Targeted GREEN command:
`node --test src/lib/saved-computation.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-assets.test.mjs`
→ **52/52 passed**, zero failures/skips; log `W3-fix1-green.log`.
`git diff --check` passed. The earlier 187/187 full check and 1641-module build
are historical evidence, not fresh results of this fix. Browser acceptance and
later W6 UI/scene restoration remain pending as previously disclosed.

