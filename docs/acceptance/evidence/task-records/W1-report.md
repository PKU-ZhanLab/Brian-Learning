# W1 report

Status: implemented in assigned files, ready for root review and commit. No staging or commits performed.

## Files

- `src/lib/workspace-limits.js`, `src/lib/workspace-limits.test.mjs`
- `src/lib/nifti.js`, `src/lib/nifti.test.mjs`
- `src/lib/workspace-project.js`, `src/lib/workspace-project.test.mjs`

## Behavior and interfaces

`validateVolumeMetadata(input)` preserves the existing metadata whitelist and returns a detached normalized object. Unknown fields are omitted. `validateLabelRows(rows)` validates positive unique safe-integer IDs and name/zh strings without mutating input. Character overflow errors contain stable codes such as `name-too-long`, `space-too-long`, `provenance-too-long`, `label-name-too-long`, and `label-zh-too-long`; invalid string types use `*-type`. Existing callers expecting `Invalid` in metadata failures remain supported. Label count is 50,000, source file UTF-8 limit 2 MiB, normalized JSON limit 4 MiB, checked incrementally before constructing an oversized aggregate label JSON string. CSV name whitespace normalization cannot hide an overlong original name.

`assertWorkspaceBudget({assetCount,rawPayloadBytes,compressedAssetBytes=[],projectUtf8Bytes=0})` checks inclusive safe-integer boundaries and throws stable codes `asset-count`, `decoded-budget`, `compressed-asset-budget`, `project-json-budget`. Constants exported:

- `MAX_WORKSPACE_ASSETS = 50`
- `MAX_WORKSPACE_RAW_PAYLOAD_BYTES = 256*1024*1024`
- `MAX_COMPRESSED_ASSET_BYTES = 128*1024*1024`
- `MAX_PROJECT_UTF8_BYTES = 180*1024*1024`
- `MAX_LABEL_FILE_BYTES = 2*1024*1024`, `MAX_LABEL_ROWS = 50000`, `MAX_LABEL_JSON_BYTES = 4*1024*1024`, `MAX_LABEL_TEXT_CHARS = 2000`
- `utf8ByteLength(text)`

Consumers W2/W6/X5 must use the same budget entry point for edits and staging. `rawPayloadBytes` must count **352 + actual target typed-array byteLength per volume**, plus W6's saved-computation payloads. The helper does not infer snapshot sizes; W6 must add them when its schema exists. `projectUtf8Bytes` must be the final encoded whole-project bytes, not character count. The optional defaults permit staged checks before compression or final JSON exists; final admission must populate all fields.

`parseNifti(input,{...existingOptions,maxDecodedVoxelBytes,maxInflatedBytes})` validates metadata before stream decoding, admits the first 352 decoded bytes against dimensions, geometry, offset, scaling, actual target type, and required inflated source length, then continues bounded reading. Scaled targets use 8 bytes/voxel. Caller decoded-byte budget is clamped to the 256 MiB raw-project budget less 352; default inflated bound is 256 MiB and explicit inflated options cannot exceed the prior structural hard maximum. Both stream errors and header admission failures cancel the reader; truncated, malformed and unsupported inputs retain their existing NIfTI errors. The PAM50 `parseNifti1` and crop API are unchanged.

`prepareProjectPayload(workspace) -> Promise<{text,usage,encodedAssets}>` preflights all asset metadata and raw sizes before exporting the first binary, reads compression streams with a 128 MiB ceiling, calculates exact projected UTF-8 JSON size before base64 allocation, then verifies final UTF-8 bytes. `usage` has exactly the budget helper fields. Each `encodedAssets` entry is `{id,metadata,niftiGzip,rawPayloadBytes,compressedBytes}`. `serializeProject` delegates and returns `.text`.

`parseProject` preflights all metadata and encoded lengths, decodes each volume with the remaining aggregate budget (including each 352-byte export header), then passes the restored candidate through `prepareProjectPayload` before returning. It does not touch storage or the custom-volume registry. Notes and evidence use exact UTF-8 limits on both paths. Public-view handling and current v1 schema remain unchanged for W5/W6's ordered schema work.

## Verification evidence

1. Initial RED command:

   `node --test src/lib/workspace-limits.test.mjs src/lib/nifti.test.mjs src/lib/workspace-project.test.mjs`

   Captured in `W1-red.txt`: missing shared module/preparation export; expected `decoded-budget` instead produced `nifti-truncated-data` / `nifti-decoded-too-large`; inflated option was ignored. These were the intended failures. No original assertions were deleted.

2. Refinement RED, same command, captured in `W1-red-refinement.txt`: **27 pass / 2 fail**. A trailing space allowed an overlong CSV name through; split gzip stream consumed one payload chunk despite an impossible inflated header budget. Both received focused fixes.

3. Final GREEN, same command, captured in `W1-green.txt`: **29 tests, 29 pass, 0 fail, 0 skipped**, duration 470.7563 ms.

   Coverage includes metadata limits at 2000/2001, space 160/161, provenance 20000/20001, preserved whitelist bounds, 50/51 assets, 128 MiB/+1 compressed limit, 256 MiB/+1 raw limit, 180 MiB/+1 JSON limit, invalid safe-integer descriptors, 50,000/50,001 label rows, exact 4 MiB normalized label JSON/+1, exact 2 MiB label source/+1, import/export/import labels, uncompressed and gzip 64M float64/scaling header rejection before full allocation, split/injected stream cancellation, and inflated-size admission. Large capacity cases use number descriptors and 352-byte headers, not 512 MB arrays. The largest intentional boundary fixture is a 4 MiB label JSON value.

4. Full `npm run check`, captured in `W1-check.txt`: data and literature checks passed; **81 tests pass / 1 fail**. The sole failure was parallel S1 work in `src/lib/volume.test.mjs:28`, `atlas cache separates version, content digest and declared space while preserving source metadata`, assertion at line 45. Root was notified and confirmed this is concurrent intermediate state; no S1 files were changed and no second full check was run.

5. `git diff --check -- src/lib/nifti.js src/lib/nifti.test.mjs src/lib/workspace-project.js src/lib/workspace-project.test.mjs`: no output / no whitespace errors.

## Rulings and limits

- Root's sole-committer instruction overrides the plan's per-task commit command. All six files remain unstaged for root review.
- Re-encoding restored imports is intentional: added truthful provenance and re-compressed data can change exact JSON length. The same preparation boundary now proves the restored candidate is exportable. Cost: one extra bounded compression pass on import; worker scheduling/cancellation remains later interaction work.
- Snapshot byte counting and project v2 fields are future W6 integration. This task exposes the shared entry point, but does not invent a parallel snapshot schema.
- No Python, dependency installation, browser operation, storage mutation, real user data, or deployment was used.

## Fix round 1 — review `b551e70`, working base `f6ae1d1`

Addressed both P2 findings in `W1-review.md`; changes stay within the same six source/test files. No staging, commits, browser operations, broad checks, dependency installation, Python, or changes to concurrent tasks.

### Shared voxel domains

Added `assertNiftiVoxelValue(value,kind)` in `nifti.js`. The parser and exporter call this same implementation for finiteness and absolute magnitude `<=1e30`, nonnegative safe-integer labels, binary masks, and probability `[0,1]`. `exportNifti(volume,{kind=volume.kind}={})` accepts an optional kind; project preparation passes its **normalized metadata kind**, so aliases (`labels`, `prob`, `stat`) receive the same constraints as import. No second full decode or voxel allocation is added.

New small-volume cases reject mask `2`, fractional/negative labels, negative/above-one probabilities, and finite `1e31` statistics before prepared text is returned; each candidate is checked unchanged after failure. Valid masks, labels, probability endpoints, and statistics at `-1e30` / `1e30` prepare and reopen successfully. The shared scalar validator also has direct exact-boundary tests.

### JSON admission before aggregate serialization

Added `boundedJsonStringify(input,maxBytes,message='json-budget')` in `workspace-limits.js`. It walks and normalizes JSON data while counting exact UTF-8 JSON bytes (including punctuation, escaped quotes, backslashes, controls, surrogate pairs and lone surrogate escapes), rejecting immediately above the inclusive budget. It constructs the complete aggregate string only after the normalized candidate has passed. It preserves normal JSON omission/null rules, calls `toJSON` once, rejects circular values, and does not mutate plain input objects. The clone stabilizes the counted values before the final native serializer.

Evidence uses this boundary through `safeObject`, keeping the prior `View state is too large` error. Notes normalize and admit one entry at a time with the remaining 8 MiB budget, including `[]` and commas, before adding it to the admitted list. Notes therefore do not create a complete over-limit aggregate JSON document either.

The allocation spy instruments `JSON.stringify` for 84 valid 100,000-character notes and a 210-entry evidence array, independently. Both are rejected with **zero complete over-limit JSON strings constructed**. The evidence source entries share a small repeated string; no giant source voxel arrays are involved. An exact 8 MiB normalized note payload succeeds, and one extra byte fails. A smaller mixed-Unicode/helper fixture verifies exact inclusive escaped UTF-8 counting and unchanged input after rejection.

### Commands and observed output

RED command:

`node --test src/lib/workspace-limits.test.mjs src/lib/nifti.test.mjs src/lib/workspace-project.test.mjs > .superpowers/sdd/README/W1-fix1-red.txt`

Observed intended failures: missing `boundedJsonStringify` export; mask preparation did not reject `2`; notes and evidence allocation spies each observed **1** complete over-limit serialization instead of **0**. Full output remains in `W1-fix1-red.txt`.

Final GREEN command:

`node --test src/lib/workspace-limits.test.mjs src/lib/nifti.test.mjs src/lib/workspace-project.test.mjs > .superpowers/sdd/README/W1-fix1-green.txt`

Observed: **36 tests, 36 pass, 0 fail, 0 skipped**, duration **729.1689 ms**. Includes the two notes/evidence subtests.

`git diff --check -- src/lib/workspace-limits.js src/lib/workspace-limits.test.mjs src/lib/nifti.js src/lib/nifti.test.mjs src/lib/workspace-project.js src/lib/workspace-project.test.mjs`: no output, no whitespace errors.

No broad check was rerun, as root requested. Scoped diff at handoff: six files, 136 insertions and 12 deletions.
