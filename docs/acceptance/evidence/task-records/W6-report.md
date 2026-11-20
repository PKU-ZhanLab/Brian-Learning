# W6 implementation report

Status: **DONE_WITH_CONCERNS** — source implementation, focused Node checks and one integration check/public build passed. Root owns independent review, staging/commit and permitted CUA acceptance. The isolated e2e file was authored and syntax checked only; no browser runner, browser upload, browser storage or UI operation was performed by this implementer. No subagents, installs or Python were used. Base: `bf1d5f19a445b7974f3530fcb26178a037bb9429`.

## APIs and final behavior

The existing W3 `saved-computation.js` bounded gzip/base64 Uint8 codec remains the sole snapshot serializer. Its actual producer ID support, 2 MiB metadata cap, exact class counts/domain, bounded streams and aggregate original/recomputed byte admission remain in place.

New APIs in that same module:

- `restoreComputation(saved,{currentManifest=null,decision='inspect-saved',geometry=true})` returns `{saved,status,canRecompute,shouldRecompute,differences,missingAssetIds,comparison,geometryError,overlayUnavailableReason}`. `saved` is the unmodified original object; status uses S5 `makeComputationManifest` and the sole `compareComputationManifest`. Incomplete history remains `missing-provenance`; tombstones take precedence as `missing-input`; complete history without current identity is `unverified`; otherwise S5 determines `matched` or `mismatch`. Only the explicit `recompute` decision with an admitted current manifest sets `shouldRecompute`. The helper never loads source data, resamples source voxels or constructs a Worker.
- Inspection reconstructs masks and surfaces only from saved classes using the existing `attachROISurfaces`. Stored z-fastest cells are reordered only in a derived display copy. Raw snapshot classes/grid/metrics/manifests/IDs remain unchanged. A grid outside `MNI152NLin6Asym` returns no main-brain geometry and `overlayUnavailableReason:'saved-space-not-main'`; saved numerical values remain available. No `roi.js`, `roi.worker.js`, or `volume.js` change was needed.
- `createComputationSnapshot(result)` creates a fresh `computation-<UUID>` for every explicit run, retains the actual calculator's deterministic ID as `producerId`, and validates through the existing storage preflight. It never changes historical IDs.
- `retainComputation(history,result)` fills an empty original slot once and puts later distinct computations in `recomputedSnapshot`, retaining `roiSnapshot` verbatim. Identity reuse fails.

`ROICompare` has `savedSnapshot`, `recomputedSnapshot`, `provenanceStatus` and `onComputedResult(result,guard)` integration props. The old `computed` auto-worker effect has been removed; both v1 and v2 restoration remain inspect-only. Restore no longer silently substitutes unavailable source/label selections. Current identity observation loads the actual source/target and calls S5's existing manifest preparation and decoded-byte verification, without ROI resampling. Essential status text, unavailable IDs, full saved/current field differences, saved raw facts, and original/recomputed inspection controls are present. Inspection preserves restored display settings and does not refocus/change the main camera. Outside-main-space history explicitly explains why geometry is unavailable. Complete metrics/CSV+JSON provenance exports continue through S5; incomplete history exports its recorded raw metrics and null/incomplete manifest without inventing current historical versions.

App captures history independently from the displayed comparison. `onComputedResult` admits the distinct result with both existing snapshots through W2 `stageWorkspaceChange`, then checks project identity, project epoch and the live ROI request before the existing atomic session commit. Budget/quota/stale failure cannot publish the new history. Overlay clearing, inspection and display adjustments do not replace original numerical history. Completed results therefore survive a subsequent merge/removal/save instead of being held only as an unsaved scene overlay.

`migrateProjectV1(value)` is exported from the sole project codec. It assigns only a new container ID, delegates evidence to E2 `migrateEvidence` (null evidence uses `emptyEvidence`), sets drafts empty and both snapshots null, clears the old computed trigger and marks historical provenance missing. Legacy selection/display settings survive.

`provenanceStatus` is retained on project v2, with only the five admitted states. Storage alone never certifies a complete snapshot matched against current data. Missing-input and incomplete historical facts take precedence.

`view.roi.snapshot` is the single displayed-slot selector: `original|recomputed|none`. It contains no computation ID or data. New exports preserve the actual inspected slot; older full-project files infer the available original/latest slot without computing. Named history references require the originating project, alongside the retained W5 named-layer origin guard. Public projection removes the slot and decode forces `none` plus `computed:false`, preventing even a crafted public URL from attaching local private history. Old named views without a history slot inspect no local computation. W5's canonical `view.resultLayers` remains untouched.

## Root-approved volume-provenance integration ruling

Discovery: W1's generic `validateVolumeMetadata` deliberately omitted S5 runtime identity fields, so a correct local-file calculation could be exported but its loaded project assets could no longer explicitly recompute. Root authorized a bounded project-entry envelope rather than widening generic NIfTI header metadata or constructing fake two-operand manifests.

The project entry now optionally carries `volumeProvenance={identity,sourceIdentities,sourceGrid,transforms,encoding,spatialEvidence}`. It is bounded to 2 MiB, retains the exact recorded fields, contributes to the raw/project aggregate admission on both export and import, and never changes the historical snapshots. Generic unknown header metadata is still excluded.

S5's existing identity and grid validators are exported as `validateAssetIdentity` and `validateGridSpec`; its transform validation is exposed as `validateTransformIdentity` and consumed by its own manifest builder. No alternate hash or identity comparator was implemented. The project codec uses these APIs plus `encodeDerivedVolume`, `makeAssetIdentity` and `compareComputationManifest` to verify the actual decoded voxel bytes, dtype/order and source-grid declarations on export/read. False digests, false grids, invalid encoding and oversized envelopes reject before publication.

For entries with no recorded envelope, S5 `prepareLocalVolumeProvenance` hashes the actual received compressed project entry and its decoded voxel bytes under an explicit `project-entry:<id>` identity. `projectEntryObservation={scope:'current-project-entry',derivedIdentity,originalSourceBytesEmbedded:false}` identifies the current observation. These observations never backfill a historical snapshot or upgrade its missing provenance.

Original input-file hashes in `sourceIdentities` remain preserved provenance: original source files are **not embedded** and their raw hashes cannot be newly verified from a repackaged project NIfTI. The checked bytes are the explicitly encoded decoded voxels. All eight existing voxel types, both supported voxel orders, supported metre/micron NIfTI imports and precise decoded affines now round-trip through the lossless layout described below. The initial strict affine/order rejection was incorrect and has been removed; the pre-review correction supersedes that earlier implementation and report.

## Files

Changed: `src/lib/saved-computation.js`, its test, `src/lib/workspace-project.js`, its test, `src/components/ROICompare.jsx`, `src/App.jsx`. Root-authorized narrow S5 extension: `src/lib/computation-manifest.js` and its focused test. New: `tests/e2e/workspace-reproducibility.spec.mjs`. All edits remain unstaged; root is sole committer.

## Verification evidence

Observed RED logs:

- `W6-red.log`: four new restore/status/identity cases failed because the new APIs did not exist; existing focused cases passed.
- `W6-migration-red.log`: the explicit v1 migration API did not exist.
- `W6-provenance-red.log`: actual local-NIfTI identities disappeared across the project codec; unknown-space history still produced geometry.
- `W6-validators-red.log`: canonical S5 runtime validators were not exported.
- `W6-display-red.log`: the saved displayed historical slot was dropped.

The expanded suite also exposed the legacy null-evidence case during integration; E2 empty-evidence admission corrected that without bypassing validation. A later all-dtype fixture initially inherited binary-mask kind while using label values 2/3; the fixture was corrected to label kind (no production validator weakened).

Final focused command:

`node --test src/lib/computation-manifest.test.mjs src/lib/saved-computation.test.mjs src/lib/workspace-project.test.mjs src/lib/roi.test.mjs src/lib/workspace-limits.test.mjs src/lib/workspace-session.test.mjs src/lib/workspace-assets.test.mjs src/lib/roi-import-state.test.mjs src/lib/result-layers.test.mjs`

Initial result before the layout correction: **113/113 passed**, zero failures/skips, `W6-green.log`. This covers actual field-level changes to algorithm, each input digest, transform ID/hash, source/target affine, interpolation, threshold/tail and label sets; no-worker historical inspection; same-operands deterministic metrics with distinct run IDs; unchanged original/recomputed round trips; combined payload admission; z-fastest display copying; unknown-space geometry safeguards; v1 migration; real local-NIfTI producer→project→explicit manifest/recompute; digest/grid/encoding/budget rejection; all eight existing voxel types; named-view origin and public history isolation. Existing W1/W2/W3/W4/W5 regressions remain green.

Initial full integration command, `npm run check`: **225/225 passed**, zero failures/skips, with source/data/hash and literature validators passing. Log: `W6-check.log`.

Initial `npm run build:public`: passed, **1643 modules**, **173 hashed data assets**, **36 official-source descriptors**, no bundled PAM50 meshes. Log: `W6-build-public.log`. Existing static/dynamic volume-import and >500 kB chunk advisories remain.

`node --check tests/e2e/workspace-reproducibility.spec.mjs` passed. `git diff --check` passed (existing CRLF normalization notices only).

The authored isolated e2e cases cover matched versus changed identities; zero ROI workers on restoration; explicit recompute followed by actual project download and exact original/new snapshot comparison; restored display settings; legacy computed=true without provenance fabrication; and removed-source inspection preserving saved classes/metrics. **No e2e case was executed by this worker.** Root has since reported direct human authorization for synthetic localhost file imports and owns the permitted CUA path. Genuine human review remains pending per the user's explicit choice; this work makes no human-certification or scientific registration claim.

## Pre-review correction: lossless decoded geometry and layout

Root supplied an ordinary supported metre-unit NIfTI counterexample: sform `.001f` converted to mm gives `1.0000000474974513`, which the initial implementation rejected on export. That rejection narrowed supported input admission and was a real implementation error. Root authorized a small versioned lossless entry representation. No new source hash, identity comparison, worker, volume registry or generic header-validator implementation was added.

Each new project volume entry now has a bounded **16 KiB** `layout={schema:'neuroatlas-volume-layout-v1',grid,storageGrid,negativeZeroAffineIndices?}`. `grid` preserves the exact decoded affine, shape, space and x-/z-fastest order. It exists independently of source identity, including unknown-space geometry while `identity.spaceId` and `sourceGrid` remain null. The optional finite index list preserves IEEE negative-zero affine entries which JSON alone would normalize. `storageGrid` documents this writer's actual NIfTI representation: mm units, float32 sform and x-fastest voxel storage. Layout bytes contribute to the same aggregate raw and JSON admission on export/import.

Both grids are admitted through the existing S5 grid validator. The sole S5 comparator checks that the declared storage grid is precisely the documented serialization of the exact grid. At read, the decoded embedded NIfTI must match that storage grid and the writer's little-endian/mm/sform-only/unit-scaling header declaration. Only then does the codec reconstruct exact geometry and, for z-fastest data, reorder the embedded x-fastest voxels into the original asymmetric layout. Both `data` aliases refer to that restored array. S5's existing derived-byte/hash and recorded source-grid checks run **after** reconstruction. Contradictory sourceGrid, exact-grid, storage-grid, space, header-affine or unit declarations reject before project publication. Original snapshot grids, IDs and manifests are not rounded or rewritten. Older entries without this layout retain their legacy read/current-observation path.

RED evidence: `node --test src/lib/workspace-project.test.mjs` → new metre/micron producer rejected by `project-volume-grid-not-lossless`, z-fastest producer rejected by `project-volume-identity-order`, and layout absent. `W6-layout-red.log`. A second real-NIfTI negative-zero fixture exposed loss during JSON metadata admission; `W6-layout-signedzero-red.log` records that failure before the bounded signed-zero representation was added.

GREEN evidence:

- Project codec tests: **36/36**, `W6-layout-green.log`.
- Same nine-file focused command listed above: **117/117**, zero failures/skips, `W6-layout-focused-retry.log`.
- A first focused attempt stalled in an existing `roi.test.mjs` process. Only the exact own test parent/child processes were stopped after verifying their command lines; no unrelated process was touched. The ROI file passed independently **17/17** (`W6-layout-roi-isolated.log`), then the unchanged focused command passed **117/117** on retry. The stalled attempt remains `W6-layout-focused.log`; its runtime cause is not established and is not claimed fixed.
- Because the format changed, root authorized a fresh integration run: `npm run check` → **229/229**, zero failures/skips; all data/hash/literature validators passed. `W6-layout-check.log`.
- Fresh sole `npm run build:public` → passed, **1643 modules**, **173 hashed assets**, **36 official-source descriptors**. Existing chunk advisories remain. `W6-layout-build-public.log`.
- The isolated e2e syntax check and `git diff --check` passed again. No browser operation or e2e execution was performed.

The new regressions use actual metre- and micron-unit NIfTI producers, repeated save/read of their exact decoded mm affines, a nontrivial precision/shear/translation affine, asymmetric z-fastest Uint16 cells, unknown-space precision/order with null space identity, actual signed-zero header entries, source/storage/grid/header-unit tampering, unchanged historical snapshot facts, and the existing eight supported voxel types. The earlier strict affine/order limitations are removed. Original source file bytes remain absent; retained original hashes are provenance records, while decoded voxel bytes are verified.
