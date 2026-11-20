# S3 implementation handoff

Implementation ready for root review and desktop acceptance. No staging, commit,
subagent, Python, package install, browser automation, browser storage inspection,
or file-upload attempt was performed. Root remains sole committer. The assigned
brief was read first; executing-plans and test-driven-development skills governed
the implementation. This report is the S3 ledger; shared task indices/plans were
not edited.

## Files

- New: `src/lib/query-state.js`, `src/lib/query-state.test.mjs`.
- New: `src/lib/atlas-resource.js`, `src/lib/atlas-resource.test.mjs`.
- New: `tests/e2e/spatial-query.spec.mjs`.
- Modified: `src/App.jsx`, `src/components/BrainScene.jsx`,
  `src/components/SliceViews.jsx`, `src/lib/volume.js`,
  `src/lib/volume.test.mjs`, `src/lib/atlas-slices.test.mjs`.
- Root-authorized narrow scope extension:
  `src/lib/computation-manifest.test.mjs` (S5 cache/refetch regression adaptation).

## Behavior and contracts

`beginQuery(previous, context)`, `invalidateQuery(previous, reason)` and
`acceptQueryResult(current, context, result)` replace complete state. Beginning
or invalidating clears results; acceptance requires the same request ID, atlas,
version, decimal coordinate and method. Result region/source/version/space must
agree. App additionally binds result source ID/version/hash/space to the current
queryable volume before displaying it. App supplies optional `context.spaceId`
for an explicit expected-space check (the required five context fields remain
supported). Query results carry the required region/source/mapping/space fields,
plus the direct sampled `label` used by the UI. Background has `region:null`.

`queryableAtlasVolume(volume, atlasId, identity)` is the common App/Scene/Slices
gate. It requires current atlas ID plus matching asset ID/version/hash/space,
explicit target-overlay permission, and a known space. Native, null-space and
MNI-unspecified inputs cannot gain overlay/query permission from a flag alone.

`loadAtlasVersion(identity, {signal}?)` returns the same identity with the loaded
volume. All callers share the resource transfer; a consumer AbortSignal cancels
only that consumer's wait. Resource retry aborts its obsolete shared transfer,
and generation checks reject completion even if fetch ignores cancellation.
`loadAtlasVersionData` and `loadAnatomyVolumeData` are resource-loader entries,
not separate UI caches. `loadAtlas` remains the atlas-ID adapter. Existing
received-byte, probability-byte, asset-catalog and transform/source-byte digest
checks remain mandatory. Metadata changes without a new asset identity fail
instead of silently reusing cached geometry/grid settings.

`atlasIdentityFor(metadata)` supplies the common key identity. Imported volumes
derive atlasVersion/hash/space fields from their existing verified AssetIdentity;
no upstream release or registration is fabricated. Unknown imported space stays
null and non-queryable. Stored source-bound region refs, multi-selection IDs,
notes/evidence and W2 transactional writers remain intact. Active query/highlight
is separate and clears when input/source changes. Moving a slice clears the
active cortical result, then samples the new voxel coordinate. Slice clicks no
longer round coordinates. Saved label details remain source dictionary details
when the active spatial query is invalidated.

The shared resource API is `getResourceState`, `subscribe`, `ensureResource`,
`retry`, `atlasResourceKey`, plus `resourceValue` (throws on a failed resource).
Required constants are exported unchanged:

- `MAIN_MANIFEST_RESOURCE = 'manifest:main'`
- `ANATOMY_MANIFEST_RESOURCE = 'manifest:anatomy'`
- `BA_COVERAGE_RESOURCE = 'manifest:ba-coverage'`
- Additional shared T1 key: `ANATOMY_VOLUME_RESOURCE = 'volume:anatomy'`.

Failed requests are released, remain observable, and require explicit retry.
The prior error stays in state and in App's alert while recovery is loading,
then clears only on success. All three consumers share main/atlas/T1 resources;
Scene and App also share the anatomy manifest. Subscriptions clean up on exit.
Reentrant subscription during loading receives the already-published same
Promise. Retrying a manifest/T1 remounts Scene to reinitialize failed geometry
loads, with the prior camera staged for restoration; it does not reset research
records or call a project import/change writer. Atlas retry refreshes the current
resource generation without remounting the scene. `onReady` now receives loading
status only; cortical query data travels with `onRegionSelect`, independently
of incremental geometry readiness. Other hit status uses optional
`onQueryStatus`, which does not enter App's loading state.

## TDD and verification

1. Initial RED:
   `node --test src/lib/query-state.test.mjs src/lib/atlas-resource.test.mjs`
   failed because both new modules were absent. The initial implementation passed
   7/7. Later focused REDs reproduced missing versioned load/abort support,
   unknown-space overlay permission, lost error during retry, duplicate loading
   requests from reentrant subscribers, and imported identity metadata absence.
   Each was followed by its focused GREEN run.
2. Broader run `npm run check` reached **163 passed / 1 failed** (164 tests).
   Failure: S5 `actual loaded bytes receive verified identity; corruption cannot
   borrow the expected hash`, at the old query-string-import refetch assertion.
   Log: `S3-check.log`. A cross-module shared resource intentionally reuses a
   verified same-identity entry, so changing only the module import URL cannot
   force a new fetch. Root authorized updating that single test to use public
   `retry(atlasResourceKey(loaded.identity))`. It still mutates actual DK bytes
   and actual transform bytes; both failed generations must expose a digest
   error and `value:null`, and `loadAtlas` must reject. Cleanup retries with
   correct bytes before restoring fetch. No digest enforcement was weakened.
3. Final directed command:
   `node --test src/lib/query-state.test.mjs src/lib/atlas-resource.test.mjs src/lib/volume.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs src/lib/computation-manifest.test.mjs`
   passes **23/23**, no failures/skips. Log: `S3-targeted.log`.
   Coverage includes stale request/coordinate/method/version rejection,
   background, complete-identity gates, three-consumer sharing, errors/retry/
   generation races, reentrant sharing, native T1-only overlay, unknown-space
   blocking, RAS/fractional coordinates, view-link preservation, camera framing,
   native versus target volumes, aligned/unknown imported identity bridges,
   cache identity changes, and actual byte/transform corruption.
4. `npm run build` passes (existing >500 kB chunk advisory remains).
   Log: `S3-build.log`; last production edit was included. The final additional
   unknown-import assertion changed tests only and passed in the directed run.
5. `node --check tests/e2e/spatial-query.spec.mjs` passes.
   `git diff --check` passes (repository CRLF-to-LF notice only).

The broader check was not rerun after the authorized S5 test adaptation, per
root's instruction to leave the next full integration gate to root. Historical
163/164 is reported explicitly; it is not a full-suite green claim.

## Desktop/CI acceptance anchors

The actual browser is root-owned. This worker did **not** run
`npm run test:e2e -- tests/e2e/spatial-query.spec.mjs`, start a test browser, or
operate CUA. The authored e2e file uses isolated configured storage and covers
first-main-manifest 503 with session retry and note/evidence preservation;
AAL→DK→BA delayed transfers; cortical-hit→slice movement; fractional slice clicks;
and clicking while a new atlas loads without reading the previous volume.
These tests are syntax-checked, not browser-passed. Root's separate red baseline
and upcoming green CUA evidence must remain distinct from these Node results.

Use `/?lang=en` for these exact controls/anchors:

- Main source: `select[aria-label="Choose an atlas"]` (translated accessible
  label), or `#atlas`; values `aal-registered`, `dk`, `ba`.
- Failure alert: `[role="alert"]` containing `manifest:main` and `503`.
  Retry button text: **Retry data loading** / **重试加载数据**. It is disabled
  during recovery and the alert remains until recovery succeeds.
- Query panel: `.right-panel .voxel-info` is always present, including while
  exact source-label details are shown. Attributes:
  `data-query-status` (`idle|loading|ready|error`), `data-query-atlas`,
  `data-query-version`, `data-query-source`, `data-query-label`,
  `data-query-method`, `data-query-coordinate` (full decimal JSON array).
  During source loading the source/label/method attributes are empty.
- A ready BA query has `data-query-atlas="ba"` and
  `data-query-source="public/data/ba-v2/talairach-ba.bin"`.
- A ready registered AAL query has
  `data-query-source="public/data/aal-v3/aal-fsl1mm.bin"`; cortical hits use
  `data-query-method="cortical-ribbon"`; slice movement replaces it with
  `data-query-method="voxel"` and a new decimal coordinate.
- Slice slider: accessible label **Axial slice position**; click canvases in
  `.slice-card` for noninteger coordinates.
- Existing concept-note button: **Add a note for this structure**; editor
  `#note-draft`; save button **Save note**. W2 envelope remains
  `neuroatlas-workspace-current-v1`; no new storage key was introduced.

## Rulings and limits

- Ruling: shared manifests/volumes retain error until explicit retry rather than
  silently retrying on every mount. This prevents a second consumer from hiding
  an initial 503 and provides X8 a stable shared failure/recovery contract.
- Ruling: retain source-bound selections as dictionary identities while clearing
  their active spatial query/highlight. Deleting those refs on slice movement
  would lose the user's source-bound selection and annotation target.
- Ruling: extend QueryContext with optional `spaceId` and QueryResult with direct
  `label` presentation data; required fields retain their original meanings.
- Root-authorized S5 regression refetch change is limited to one test file;
  root-authorized imported-volume bridge derives fields only from existing
  verified AssetIdentity. Neither action grants spatial validation.
- Browser/desktop acceptance remains pending; no scientific registration,
  independent anatomy validation, human certification, or file-import acceptance
  is claimed from unit tests/build. No unresolved implementation failure remains
  in the focused checks; root's review and pinned CUA should assess actual UI
  initialization, late-response behavior and source text.

## Fix round 1 — unmapped paper clears an independent coordinate query

Read `S3-fix1-findings.md` verbatim. Root's actual CUA RED on pinned `2912228`
is retained at `output/s3-cua/paper-query-regression.json` and `.png`.
The observed AAL cortical result was label **2201**, `Frontal_Mid_L`, at exact
coordinate `[-41.85976236116528,34.97901880135413,37.769516603784666]`.
Opening the Schaum paper left atlas/version/coordinate unchanged but cleared
the query and falsely showed background plus indefinite `loading`.

Cause: the empty permitted-mapping branch in `locatePaperRegions` called
`invalidateActiveQuery('unmapped paper')`. Because no spatial input changed,
the sampling effect had no changed dependency to produce another result.
The presentation then treated missing current query state as loading and used
the empty-label fallback even without a completed sample.

The unmapped-paper branch now clears only selections/highlights. It leaves the
unchanged independent spatial query intact. It still adds no paper-to-region
mapping and performs no sampling, coordinate move or source change on behalf of
that paper. Existing real coordinate/source/version/method/space invalidation
paths are unchanged. Stored refs, notes and their source identities are not
rewritten. The matched-paper path still changes coordinates through `setPoint`.

`queryDisplayState(query, {blocked,resourceStatus,hasVolume})` now distinguishes
idle, loading, error and completed ready results. A ready source volume with an
absent/invalidated query is **idle**, with no result. Actual resource/query work
remains loading; failed/blocked inputs retain their separate states. Only a
completed ready result may reach the background text. App displays
**Coordinate not queried** / **尚未查询当前坐标** for a genuine idle state.
This also prevents a transient cleared coordinate query from masquerading as
background while its replacement sample has not yet completed.

Files changed in this fix only: `src/App.jsx`, `src/lib/query-state.js`,
`src/lib/query-state.test.mjs`, `tests/e2e/spatial-query.spec.mjs`, and this report.
No Literature/E3/codec/resource/volume production file changed. No staging,
commit, subagent, browser operation, install or broad suite run was performed.

Verification:

- Existing integrated RED is the root CUA evidence above. New presentation tests
  first ran with `node --test src/lib/query-state.test.mjs` and failed because
  `queryDisplayState` did not exist. Log: `S3-fix1-red.log`.
- New unit regressions prove a valid result retains its exact object/source;
  invalidation or an absent result on a ready volume yields idle rather than
  loading/background; a completed background sample alone is ready with
  `region:null`; pending, failure and blocked inputs are distinct.
- Final command:
  `node --test src/lib/query-state.test.mjs src/lib/atlas-resource.test.mjs src/lib/volume.test.mjs src/lib/atlas-slices.test.mjs src/lib/scene-frame.test.mjs src/lib/computation-manifest.test.mjs`
  passes **25/25**, no failures/skips. Log: `S3-fix1-targeted.log`.
- `npm run build` passes, existing chunk-size advisory only.
  Log: `S3-fix1-build.log`.
- `node --check tests/e2e/spatial-query.spec.mjs` and `git diff --check` pass
  (repository CRLF-to-LF notice only).
- Authored browser regression obtains a real nonempty AAL cortical hit, opens
  Evidence library → search `Schaum` → `.paper-card .paper-open`, and asserts all
  seven query attributes (status/atlas/version/source/label/method/coordinate)
  plus visible result text are unchanged. After closing the library it checks
  the same query again and verifies no selected atlas-region details or concept
  rows were attributed to the paper. This regression is syntax-checked only;
  root owns the actual CUA GREEN recheck. No browser pass is claimed here.

Ruling: a paper with no permitted direct mapping changes its paper selection and
highlights, not the independently valid spatial query. Clearing that query would
need either a new spatial request or an honest idle state; it cannot justify
claiming an observed background voxel. The display now preserves that boundary.

## Root review addendum
The independent review and pinned build also identify the mixed static/dynamic volume.js import warning at S3-build.log:9-10. The dynamic import does not provide a separate chunk. This is recorded as Minor build hygiene for X9; the build is successful but not warning-clean. No production blocker was established. Actual CUA source/record-retention results are recorded separately.
