# Final whole-branch review

Reviewed range: `ca00c0928b0c7b62c662636cddf3a8d1da374a15..dbac9ebd1a557876ff3f5167d314da964d8e5422`.

**Software verdict: WITH FIXES. Do not merge/release this candidate before the Important findings below are addressed.**

**Specification verdict: implementation is substantial but has concrete W2/W6/S3/X10/G1 composition gaps. Whole-plan acceptance remains incomplete independently of these software findings.** Scientific, human, browser/native accessibility, performance and publication gates cannot be closed by this review.

## Strengths

- The ordinary workspace write path has one admission boundary and a storage-first publication point. Candidate validation, quotas, stale revision checks and notification isolation are explicit (`workspace-session.js:45–84`). The findings below concern composition around that boundary, rather than a recommendation to replace it.
- Exact atlas references, explicit unknown spaces, original versus recomputed numerical results, canonical public result projection, and named human-review scope are separate concepts in the implementation. In particular, the public-result route is chosen before importing the private App, and public result exports are reconstructed from committed versions.
- The current S6 report remains partial, with human review false, 14 coverage gaps and zero eligible replacements. The original eight paper coordinates remain MNI-unspecified. There is no justification here for changing those verdicts.
- G1 now checks declared runtime data dependencies before creating release expectations and uses a narrowly verified pinned-cache exception for transformed-source attestation. The preserved G1 fix receipts explicitly say `clean=false` and `exactCommit=false`.
- Historical fixtures, failed observations, task receipts and versioned source excerpts are retained. The scoped `-text` rule for copied acceptance evidence is appropriate; normalizing historical receipt bytes to remove whitespace diagnostics would be wrong.

## Issues

### Critical (P0)

None established.

### Important — complete fix list

#### I1 — P1: The global atlas cache crosses local project ownership and rejects legitimate duplicate imports

**Files:** `src/lib/volume.js:98–107,121–137`; `src/lib/atlas-resource.js:16–18,37–45`; `src/lib/custom-volumes.js:29–33`.

**Trigger:** Load project A's `custom-a`, then open project B containing the same owned ID and the same filename/voxel-byte identity but different label/provenance metadata. This can occur naturally when two saved copies of a project have different label tables or alignment annotations. A related case is importing the same file twice: each entry receives a distinct `custom-*` ID but shares the filename-derived AssetIdentity.

**Observed:** The first trigger returned the exact cached A object under project B, including `Project A private label` and `Project A private provenance`. The second trigger threw `Atlas metadata changed without a new asset identity` for the second legitimate owned asset.

**Cause/impact:** The cache key contains the content identity but no project/owned-entry generation. `metadataSignature` includes `atlasId`, causing the duplicate-entry refusal, while omitting labels, provenance and alignment authority. Replacing `atlasMetadata` does not replace an already-ready `atlas-resource` value. Therefore local metadata and potentially source-alignment authority from A can be presented as B. This violates asset isolation and exact active-source semantics, even though the voxel bytes themselves match.

**Fix:** Separate reusable immutable byte data from project-owned metadata, or bind local resource lifetimes to the current project/entry generation. Distinct same-byte entries must remain usable, each with its own metadata; same-ID project replacement must retire old metadata and pending responses. Preserve the public version/hash checks and do not make a local content hash authorize another project's labels, provenance, or alignment declaration. Cover both witnesses and a delayed A response after B publication. The probe used only public module APIs and process-local synthetic data.

**Requirements:** R04, R11, R14, R28, R48; S3/W2/W4/X10 ownership composition.

#### I2 — P1: Whole-project merge mutates immutable source artifacts and drops provenance aliases

**Files:** `src/lib/workspace-session.js:102–117,127–155`; compare the immutable-artifact handling in `src/lib/evidence-workspace.js:35–60`.

**Trigger A:** Merge a valid exported Axelrod evidence project into a current project whose same reference ID has different content. The normal collision algorithm creates a new incoming reference ID.

**Observed A:** Staging succeeds, but `rewriteIncoming` changes the embedded source artifact's `referenceId` while retaining its old `recordSha256`. The real `verifySourceArtifact` changes from `{valid:true,errors:[]}` before merge to `{valid:false,errors:["artifact record SHA-256 mismatch"]}` afterward. Source field paths inside the artifact also remain bound to the original namespace; result/location collisions require equivalent care.

**Trigger B:** Merge a valid project that already carries E5's explicit `referenceAliases` into an empty current project.

**Observed B:** The incoming alias count is 1; the merged alias count is 0. `referenceAliases` is outside `EVIDENCE_COLLECTIONS`, and the result spreads `current.evidence` only. The active records still use the canonical reference ID while the immutable source uses its historical ID.

**Impact:** A successful ordinary project merge damages or loses the relationship to the original source evidence. Later export/audit cannot reconstruct the same provenance. This directly contradicts the existing E5 ruling in `progress.md:183`: do not rewrite immutable hashed artifacts or silently rehash the changed artifact.

**Fix:** Make project merge preserve immutable source objects and established alias snapshots, and explicitly reconcile active graph identifiers with their historical source bindings. A safe atomic refusal with an actionable conflict explanation is preferable for a collision that the current schema cannot represent losslessly. Do not solve this by dropping the artifact, silently omitting its content, resetting its historical hashes, or skipping its old field anchors. Add whole-project tests for E5 alias packages, reference/result/location collisions, source hash integrity and independent export closure after merge, including unchanged current state on refusal.

**Requirements:** R10, R11, R21, R22, R48; W2/E4/E5 composition.

#### I3 — P1: Merge silently overwrites the current project's saved computation history

**File:** `src/lib/workspace-session.js:152–156`.

**Trigger:** Current project A has `roiSnapshot.id='original-A'`; incoming project B has `roiSnapshot.id='original-B'`. Choose **Merge into current project**.

**Observed:** The accepted stage has `roiSnapshot='original-B'`, `recomputedSnapshot=null`, no occurrence of `original-A`, and no preview collision or replacement notice. `snapshotFor` selects every non-null incoming slot over the occupied current slot.

**Impact:** Confirming a merge discards A's original numerical history from the working project. The original-history guarantee is enforced for recomputation but bypassed by project merge. The existing regression only covers incoming null snapshots, which is why it misses this case.

**Fix:** Define lossless admission for occupied computation slots before staging. Preserve both existing histories and incoming histories where representable; otherwise reject the merge atomically with a clear recovery instruction or require an explicit separately previewed replacement operation. Do not silently turn Merge into Open for snapshots. Cover two occupied originals, occupied recomputed slots, identical histories, and their references in view/navigation state. A minimal fix can reject unsupported history collisions without expanding the project schema.

**Requirements:** R07, R10, R11, R48; W2/W6 and the reasonable expectation that merging does not silently discard existing research.

#### I4 — P2: Refresh leaves unavailable session images in live navigation history, blocking ordinary work

**Files:** `src/lib/workspace-session.js:88–95,27–39`; `src/App.jsx:286–311` (`getWorkspaceView`, restoration and navigation/history capture).

**Trigger:** Navigate through an imported image/ROI, so a navigation-history entry references `custom-a`; save the authoritative envelope, then refresh. Images are correctly session-only and are absent after refresh.

**Observed:** `restoreWorkspaceInitial` returns `volumes=[]` but retains a live history entry referencing `custom-a`. A normal change to `mode:'research'` through `stageWorkspaceChange` fails with `missing-asset: custom-a`. App always carries the saved navigation history into `getWorkspaceView`, so selecting an unrelated built-in task does not remove the blocking reference. A historical annotation referring to a custom asset has the same missing-identity problem unless its unavailable identity is retained explicitly.

**Impact:** The UI can show a fallback built-in view but cannot persist ordinary navigation, new notes or drafts through the canonical transaction while the stale live history remains. Requiring a full project to restore image bytes is expected; making unrelated work depend on those lost session bytes is not.

**Fix:** Add an explicit startup recovery state for absent session assets: detach or quarantine unavailable *live* view/history references through the canonical ownership rules, retain historical notes/evidence and truthful missing-input identities, and preserve recovery information/original envelope bytes. Allow safe built-in navigation and new research without fabricating image restoration. Do not weaken ordinary file-import missing-asset rejection. Test a genuine persist → startup restore → canonical navigation/save sequence, not only the envelope parser in isolation.

**Requirements:** R10, R13, R32, R33, R41, R48; W2/W3/X2/X5 recovery composition.

#### I5 — P2: A verified project image loses comparison-link eligibility after roundtrip

**Files:** `src/lib/workspace-project.js:228–234,329–337`; `src/lib/comparison-link.js:23–34`.

**Trigger:** Import an explicitly user-declared aligned local image, save its complete project, and reopen it in a fresh session before opening source comparison.

**Observed:** The original volume has `identityVerification='received-bytes'` and `canLinkCoordinates(original,original).allowed===true`. The parsed volume passes `verifyVolumeProvenance` but has no `identityVerification`; the same comparison now returns false with `Recorded reference evidence is required`. Warm cache reuse can conceal this problem, so testing must use fresh module/session state.

**Impact:** Saved pair state cannot restore the linking behavior of the same accepted image, although the actual embedded derivative bytes and grid were checked successfully.

**Fix:** Publish a freshly earned verification state only after the existing derived-byte/grid checks succeed. Keep this explicitly scoped to received project-entry/derived bytes; it must not certify that original raw NIfTI bytes were embedded or independently verify a user's spatial declaration. Tampered payload, mismatched grid/hash, unknown space and missing alignment evidence must remain rejected or un-linkable.

**Requirements:** R07, R28, R48; W6/X10 composition.

#### I6 — P2: A required G1 journey asserts a two-input manifest although the real contract produces fifteen

**File:** `tests/e2e/research-journeys.spec.mjs:34`; related async helper at line 13.

**Trigger:** The authored two-atlas journey computes DK versus registered AAL3 and exports/reopens the project.

**Observed:** The real `makeComparisonManifest` with the committed catalog and that journey's operands returns 15 inputs: 2 operands plus 13 unique source dependencies. The test asserts `inputs` has length 2. This will fail after successful browser behavior. The known sampling helper also tests `confirm.isVisible()` immediately after Compute, before asynchronous preflight can show the confirmation, so its loss branch can time out awaiting the result.

**Fix:** Assert the first two operand identities and the required source dependency closure, rather than deleting valid provenance to satisfy a length assertion. Have the helper await either the confirmation state or final result before branching, with failure/cancellation handled explicitly. Keep the genuine browser run not-run until actually permitted and executed. The direct manifest probe establishes the deterministic test defect; it is not a browser execution.

**Requirements:** R06, R45, R46; G1 acceptance validity.

### Minor

#### M1 — P3: Imported-image detail action is enabled even when its exact label reference cannot be made

**File:** `src/components/AtlasExplorer.jsx:39` (the long JSX return containing `aria-label="Use atlas label"`); `src/lib/atlas-identity.js:30–31`.

Imported image metadata receives an `atlasVersion` from its observed identity in App, which is sufficient to show **Use atlas label**. Imported label rows do not have the required source-label/space dictionary provenance. The component already computes `selection.error` and displays a warning, but this separate button still calls `makeAtlasRegionRef` without a guard/catch, producing an uncaught event error. Gate this action on the same valid exact-reference result or present the unavailable reason. Do not invent provenance for user-supplied names. This is a code-path finding; no new UI execution was performed.

#### M2 — P3: Dense lifecycle code raises maintenance cost

**Files:** `src/components/ComparisonViewport.jsx:19–61`, `src/components/AtlasCanvas.jsx:9–32` and other compressed JSX handlers.

The previously deferred X10 readability observation remains valid. Named handlers and ordinary formatting would make generation/identity checks easier to audit. It is non-blocking by itself; do not perform an unrelated formatting sweep as part of the correctness fixes.

## Deferred-item triage

| Parked item / ruling | Current disposition |
|---|---|
| S3 T1 refresh-only/mixed error feedback | Current `SliceViews` consumes the shared T1 error and offers `retry(ANATOMY_VOLUME_RESOURCE)`; BrainScene defers that error to App. Code addressed; final rendered acceptance still open. |
| W3 preview incorrectly implied zero-byte whole export | `describeProjectExport` and WorkspaceFiles distinguish exact project download bytes from raw image bytes. Code addressed. |
| W5 internal named-view error prefix | `normalizeWorkspaceError` maps the specific mismatch to a bilingual originating-project instruction. Code addressed. |
| E5 stale success/error and vague share omission feedback | WorkspaceFiles clears prior status for new actions; App's public-link result names omitted categories and full-project recovery. Code addressed. |
| X1 reference-space length/escaped namespace | `parseCoordinateInput` validates the exact mapped storage context against `validateViewState` before navigation. Code addressed; no silent clipping is requested. |
| X2 undefined label in async basket | `selectionLabel` uses recorded names then atlas/label ID fallback. Code addressed. |
| X2 missing tree/explorer scroll contexts | App's selector map includes tree, atlas details/slices/workspace; history codec admits these keys. Code addressed; refresh recovery I4 is a separate remaining integration issue. |
| X2/X7 ResizeObserver-after-dispose | AtlasCanvas uses a captured container and `createAtlasCanvasResizeGuard`, disposes before disconnect, and suppresses inactive/disconnected callbacks. Prior errors remain historical evidence; no new final-browser pass claimed. |
| X4/X7 small result text and crowded overlays | Current result panel CSS has 15px body, 14px table text, wrapping and scroll provisions; compact layer disclosure defaults closed, and model controls were moved to their own layout row. Code provisions and earlier scoped receipts exist; final visual/200% acceptance remains open. |
| X7 sticky long comparison heading | Recorded fix and scoped CUA pass remain version-bound. This review does not replace final viewport acceptance. |
| X9 repeated staging near limit / chunk warnings | Explicitly disclosed measured Node limitation; no unsafe mutable-buffer cache was introduced. Browser p95/heap/GPU acceptance remains unmeasured. No new performance claim made. |
| X9 worker 503 blamed a valid image | ROICompare now distinguishes module failure through `imageProcessingError`; text-only follow-up remains visually unrun. |
| E6 six English values in zh limitations | Current upstream-assets lines 151 onward are translated while English meaning/source gaps remain intact. Addressed. |
| X11 English public directory destination | `publicResultDirectoryHref` chooses `index.en.html` for English. Addressed. |
| X10 compressed new lifecycle/components | Retained as M2, non-blocking. |
| G1 async sampling-loss helper | Included in I6's acceptance correction; do not silently drop it. |
| E5 immutable source alias ruling | Still binding; whole-project merge violates it (I2). |
| Original computation/history preservation | Still binding; whole-project merge violates it (I3). |

## Checks performed and evidence scope

- Read `FINAL-review-context.md` first and the supplied reviewer template. Confirmed live HEAD is `dbac9ebd1a557876ff3f5167d314da964d8e5422`; `git status --short` was empty before writing this ignored report.
- Used the supplied whole-branch package and index; did not regenerate the log/stat/diff. A read-only Node index check found 415 entries and all 415 diff headers at their indexed offsets. The package is 138,046 LF-separated lines. Node UTF-8 `split('\n')` was used for indexed passes after noticing PowerShell's physical line splitting differs in preserved content.
- Read the specification, total plan, relevant spatial/workspace/evidence/experience task sections and the 50-requirement/31-task acceptance matrix. Inspected deferred rulings in `progress.md` rather than treating earlier verdicts as a substitute for composition review.
- Manually traced current App/session/project/assets/draft/undo/navigation integration; exact atlas selection and shared-resource/load boundaries; BrainScene source switching; ROI manifest/retained computation/import/export lifetimes; comparison display/link/source lifetimes; evidence schema/editor/merge/package/source-artifact boundaries; public route/version/export/static page generation; spatial QC/candidate gating; public/source packaging and release verification. Read associated targeted tests and current status/receipt documents where they established a contract or prior fix.
- Inspection is **risk-based whole-range review**, not a claim that every repeated row of the 8.5 MB diff was manually read. Large generated literature/manifest JSON, repeated immutable publication snapshots, preserved recon-all/audit logs, and all historical receipt copies were not individually re-audited line by line. Generated data semantics were assessed through their producers, consumers, validators, selected source records and explicit scope records. Unread/truncated output was not treated as positive evidence. No exhaustive fresh source transcription, asset hashing, or source-package rebuild was performed in this review.
- Focused Node probes were run only for the named unresolved concerns I1–I6; complete reproduction code and observed output follow. They used process-local synthetic volumes/in-memory storage or committed public metadata and wrote no files. They are witnesses of code behavior, not browser substitutes.
- Read the actual retained G1 fix covering receipt (19/19), package-closure receipt (1/1), QC check (partial/human false/14 gaps), and transformed-package verifier receipt (pass, empty missing/extra/changed). G1's report records the real prepare → QC → build → 222-file verification sequence. Its verifier receipt is bound to the transformed working snapshot rooted at `645a0c3`, **not** a clean final `dbac9eb` source release.
- The full 414-test check is recorded at the initial G1 scope. I did not rerun it or describe it as a final-head run. No broad suite, install, server, browser, desktop/CUA, Playwright, network/remote operation, push, source/index/HEAD edit or helper-agent dispatch occurred.
- Sole review write: this file. Original application/data/history/receipts were not changed.

## Recommendations for the single fix wave

1. Correct I1–I5 at the shared contracts, with focused negative and positive tests exercising the actual project/session/load functions. Preserve strict hash/grid/unknown-space admission and exact original evidence bytes.
2. Correct I6 and the small enabled-but-invalid action M1 while touching their narrow owners. Keep M2 as a maintainability note unless a bounded relevant cleanup helps the fix.
3. Submit one scoped re-review package with all findings mapped to changes and preserved RED/GREEN witnesses. Then perform the root-owned clean final-source package/build/archive reproduction. Prior dirty/transformed candidates do not establish that final source binding.

## Declined to judge

- Final rendered layout, actual 200% browser zoom, native picker cancellation, touch interaction and screen-reader behavior: within plan, but **not adjudicated as passed** because same-turn UI execution is forbidden and final integrated execution is absent. This is an evidence limit, not removal from scope.
- Independent researcher task success/timing and human source/anatomical certification: within plan, but no real participant/reviewer records exist; remains pending-review.
- Whole-brain/small-nucleus anatomical accuracy, replacement segmentation eligibility beyond the recorded current gaps, or new source-to-exact-template scientific conclusions: no independent measurements/human evidence available; keep S6/E6 partial conclusions.
- NiiVue rendered equivalence, browser p95/heap/GPU performance and low-end device behavior: provisional implementation/evaluation only; no matched runtime evidence.
- Public deployment, remote final source binding, fresh-install final candidate and final rollback package reproduction: root/external gates not performed by this read-only review. The workflow-scope rejection is not permission to retry through another route.
- Unrelated baseline reconstruction-log messages and a fresh scientific transcription audit of all retained literature/source cells: not new software behavior established by this review; original bytes and recorded limitations remain evidence, not a claim of fresh certification.

No confirmed in-scope correctness defect was set aside merely because an earlier task review passed.

## Assessment

**Ready to merge? With fixes.** Six Important findings require one correction wave. I1–I3 can misattribute project metadata, damage source provenance, or discard numerical history; I4–I5 break valid recovery paths; I6 makes an intended acceptance journey fail despite correct provenance.

The broad software design largely follows the plan, but these cross-module defects prevent a software-complete verdict. Even after their scoped re-review passes, whole-plan scientific/runtime/publication acceptance must retain the explicit outstanding gates.

## Appendix A — focused witness programs and observed output

Run from the reviewed checkout with Node's existing runtime, using `node --input-type=module` and the code below on stdin. Each block was a separate process. These are retained reproduction witnesses, not a request to add broad test runs.

### I1 / I5: duplicate owned entries and verified-volume roundtrip

```js
import {prepareLocalVolumeProvenance} from './src/lib/computation-manifest.js';
import {serializeProject,parseProject,validateViewState} from './src/lib/workspace-project.js';
import {emptyEvidence} from './src/lib/evidence-schema.js';
import {canLinkCoordinates} from './src/lib/comparison-link.js';
import {replaceCustomVolumes} from './src/lib/custom-volumes.js';
import {loadAtlas} from './src/lib/volume.js';
const base={name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'Label one'}],alignmentStatus:'user-declared',canOverlayOnTarget:true,provenance:'Synthetic declared alignment'};
const original=await prepareLocalVolumeProvenance(base,Uint8Array.of(1),{id:'same.nii'});
const ws={projectId:'review',view:validateViewState({}),notes:[],evidence:emptyEvidence(),volumes:[{...original,id:'custom-a'}]};
const restored=(await parseProject(await serializeProject(ws))).volumes[0];
console.log(JSON.stringify({probe:'verified-volume-roundtrip',before:original.identityVerification,after:restored.identityVerification??null,linkBefore:canLinkCoordinates(original,original),linkAfter:canLinkCoordinates(restored,restored)}));
replaceCustomVolumes('review',[{...original,id:'custom-a'},{...original,id:'custom-b'}]);
await loadAtlas('custom-a');let second;
try {const value=await loadAtlas('custom-b');second={returnedId:value.id};}catch(error){second={error:error.message};}
console.log(JSON.stringify({probe:'same-file-two-owned-assets',first:'custom-a',second}));
```

```json
{"probe":"verified-volume-roundtrip","before":"received-bytes","after":null,"linkBefore":{"allowed":true,"reason":"User-declared alignment; not independently verified / 用户声明对齐，未经独立核验"},"linkAfter":{"allowed":false,"reason":"Recorded reference evidence is required / 缺少参考空间依据"}}
{"probe":"same-file-two-owned-assets","first":"custom-a","second":{"error":"Atlas metadata changed without a new asset identity"}}
```

### I1: project metadata crosses ownership

```js
import {prepareLocalVolumeProvenance} from './src/lib/computation-manifest.js';
import {replaceCustomVolumes} from './src/lib/custom-volumes.js';
import {loadAtlas} from './src/lib/volume.js';
const base={id:'custom-a',name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'Project A private label'}],alignmentStatus:'user-declared',canOverlayOnTarget:true,provenance:'Project A private provenance'};
const a=await prepareLocalVolumeProvenance(base,Uint8Array.of(1),{id:'same.nii'});
replaceCustomVolumes('project-A',[a]);const first=await loadAtlas('custom-a');
const b={...a,labels:[{id:1,name:'Project B label'}],provenance:'Project B provenance',spatialEvidence:{...a.spatialEvidence,provenance:'Project B provenance'}};
replaceCustomVolumes('project-B',[b]);const second=await loadAtlas('custom-a');
console.log(JSON.stringify({probe:'same-owned-id-project-replacement',sameObject:first===second,expected:b.labels[0].name,actual:second.labels[0].name,expectedProvenance:b.provenance,actualProvenance:second.provenance}));
```

```json
{"probe":"same-owned-id-project-replacement","sameObject":true,"expected":"Project B label","actual":"Project A private label","expectedProvenance":"Project B provenance","actualProvenance":"Project A private provenance"}
```

### I2: source artifact and alias damage through the real project staging API

```js
import {buildEvidencePackage,getBuiltinEvidenceBundle} from './src/lib/evidence-package.js';
import {mergeEvidence} from './src/lib/evidence-workspace.js';
import {emptyEvidence} from './src/lib/evidence-schema.js';
import {stageProjectImport} from './src/lib/workspace-session.js';
import {serializeProject,validateViewState} from './src/lib/workspace-project.js';
import {verifySourceArtifact,sourceExcerptBytes,auditTranscription} from './src/lib/source-artifact.js';
const project=(id,evidence)=>({projectId:id,revision:0,view:validateViewState({}),notes:[],drafts:[],evidence,volumes:[],roiSnapshot:null,recomputedSnapshot:null});
const original=buildEvidencePackage({paperIds:['axelrod2015'],bundle:getBuiltinEvidenceBundle()});
const current=project('A',{...emptyEvidence(),references:original.references.map(r=>({...r,title:'A distinct existing title'}))});
let n=0;const merged=await stageProjectImport(await serializeProject(project('B',original)),{current,mode:'merge',makeId:kind=>kind+'-remapped-'+(++n)});
const artifact=merged.next.evidence.sourceArtifacts[0];
console.log(JSON.stringify({probe:'project-merge-source-artifact-integrity',accepted:true,before:verifySourceArtifact(original.sourceArtifacts[0],sourceExcerptBytes(original.sourceArtifacts[0])),after:verifySourceArtifact(artifact,sourceExcerptBytes(artifact)),beforeReference:original.sourceArtifacts[0].referenceId,afterReference:artifact.referenceId}));
const base={...emptyEvidence(),references:original.references.map(r=>({...r,id:'canonical-axelrod'}))};
const aliases=mergeEvidence(base,original);
const stage=await stageProjectImport(await serializeProject(project('B',aliases)),{current:project('A',emptyEvidence()),mode:'merge'});
console.log(JSON.stringify({probe:'project-merge-provenance-alias',before:aliases.referenceAliases?.length,after:stage.next.evidence.referenceAliases?.length??0,missingSourcePaper:auditTranscription(stage.next.evidence).integrityErrors.filter(x=>x.includes('reference'))}));
```

```json
{"probe":"project-merge-source-artifact-integrity","accepted":true,"before":{"valid":true,"errors":[]},"after":{"valid":false,"errors":["artifact record SHA-256 mismatch"]},"beforeReference":"axelrod2015","afterReference":"references-remapped-1"}
{"probe":"project-merge-provenance-alias","before":1,"after":0,"missingSourcePaper":[]}
```

The final empty filtered `integrityErrors` array is not evidence that aliases survived: the alias count directly shows the lost map, and that filter did not inspect `unavailableArtifacts`/semantic gaps.

### I3: occupied original history silently replaced

```js
import {stageProjectImport} from './src/lib/workspace-session.js';
import {serializeProject,validateViewState} from './src/lib/workspace-project.js';
import {emptyEvidence} from './src/lib/evidence-schema.js';
const project=(id,snapshot)=>({projectId:id,revision:0,view:validateViewState({}),notes:[],drafts:[],evidence:emptyEvidence(),volumes:[],roiSnapshot:snapshot,recomputedSnapshot:null});
const current=project('A',{id:'original-A',metrics:{dice:.25},status:'missing-provenance'}),incoming=project('B',{id:'original-B',metrics:{dice:.75},status:'missing-provenance'});
const merged=await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'});
console.log(JSON.stringify({probe:'project-merge-snapshot-history',before:current.roiSnapshot.id,after:merged.next.roiSnapshot.id,recomputed:merged.next.recomputedSnapshot,preview:merged.preview,originalRetained:JSON.stringify(merged.next).includes('original-A')}));
```

```json
{"probe":"project-merge-snapshot-history","before":"original-A","after":"original-B","recomputed":null,"preview":{"mode":"merge","includedAssetIds":[],"removedAssetIds":[],"collisions":[],"remap":{"volumes":{},"notes":{},"drafts":{},"resultLayers":{},"references":{},"readings":{},"experiments":{},"results":{},"locations":{},"claims":{},"mappings":{},"sourceArtifacts":{},"reviewEvents":{},"relations":{}},"changedReferenceCounts":{}},"originalRetained":false}
```

### I4: persist → startup restore → ordinary navigation

```js
import {createWorkspaceSession,stageWorkspaceChange,restoreWorkspaceInitial} from './src/lib/workspace-session.js';
import {emptyEvidence} from './src/lib/evidence-schema.js';
import {validateViewState} from './src/lib/workspace-project.js';
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const volume={id:'custom-a',name:'a',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],kind:'label',space:'native-unverified',labels:[]};
const fallback={projectId:'A',revision:0,view:validateViewState({atlas:'dk'}),notes:[],evidence:emptyEvidence(),drafts:[],volumes:[],roiSnapshot:null,recomputedSnapshot:null};
const history={projectId:'A',index:0,entries:[{view:validateViewState({atlas:'dk',roi:{aAtlas:'custom-a',bAtlas:'dk'}}),scroll:{}}]};
const session=createWorkspaceSession({storage,initial:{...fallback,volumes:[volume],view:validateViewState({atlas:'dk',navigationHistory:history})}});
session.commit(await stageWorkspaceChange(session.getSnapshot(),{current:session.getSnapshot()}));
const restored=restoreWorkspaceInitial({storage,fallback}),after=createWorkspaceSession({storage,initial:restored});
let outcome;try{await stageWorkspaceChange({...after.getSnapshot(),view:validateViewState({...after.getSnapshot().view,mode:'research'})},{current:after.getSnapshot()});outcome='accepted';}catch(e){outcome=e.message;}
console.log(JSON.stringify({probe:'refresh-history-with-session-only-asset',volumes:restored.volumes.length,historyEntries:restored.view.navigationHistory.entries.length,outcome}));
```

```json
{"probe":"refresh-history-with-session-only-asset","volumes":0,"historyEntries":1,"outcome":"missing-asset: custom-a"}
```

A separate historical-note variant, with the same volume/fallback/storage helpers, initialized `notes:[{id:'note',text:'retained research',regionRef:{atlasId:'custom-a',atlasVersion:'v1',labelId:1,hemisphere:'U',spaceId:'native-unverified'}}]`, committed, restored, and staged a second ordinary note with a default DK view. Its exact output was:

```json
{"probe":"refresh-annotation-with-session-only-asset","notes":1,"volumes":0,"missingAssetIds":[],"outcome":"missing-asset: custom-a"}
```

The navigation-history witness above is the primary natural UI path; the note variant checks an already admitted historical project record, without claiming the current imported-label detail action can author that reference.

### I6: real manifest contract for the authored G1 journey

```js
import fs from 'node:fs';
import {makeComparisonManifest} from './src/lib/computation-manifest.js';
import {makeComparisonGrid} from './src/lib/roi-grid.js';
const manifest=JSON.parse(fs.readFileSync('public/data/manifest.json','utf8'));
const assets=JSON.parse(fs.readFileSync('public/data/asset-identities.json','utf8')).assets;
const vol=id=>({...manifest.atlases[id],...assets[manifest.atlases[id].data]});
const target=makeComparisonGrid(JSON.parse(fs.readFileSync('public/data/volume.json','utf8')),1);
const m=makeComparisonManifest(vol('dk'),{kind:'label',labels:[1,2],threshold:0,tail:'positive'},vol('aal3-registered'),{kind:'label',labels:[133,134],threshold:0,tail:'positive'},target);
console.log(JSON.stringify({probe:'G1-journey-input-contract',expectedByTest:2,actualInputs:m.inputs.length,operands:m.inputs.slice(0,2).map(x=>x.id),dependencyCount:m.inputs.length-2}));
```

```json
{"probe":"G1-journey-input-contract","expectedByTest":2,"actualInputs":15,"operands":["public/data/dk-v2/dk68.bin","public/data/aal-v3/aal3-fsl1mm.bin"],"dependencyCount":13}
```
