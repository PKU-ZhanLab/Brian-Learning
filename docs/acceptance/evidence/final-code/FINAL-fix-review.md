# Final fix wave — scoped re-review

Range: `dbac9ebd1a557876ff3f5167d314da964d8e5422..cdeb6ed550733b13fb0cb3c24ccf41f0f80bcbd2`.

**Verdict: WITH FIXES — two bounded Important cases remain.** The original destructive merge behavior, provenance mutation, recovery dead end, missing earned verification and invalid journey assertion are corrected. The ready-cache continuation still has an ownership gap, and the new navigation-history merge has a historyless-incoming edge case.

This is the requested scoped re-review of the 21-file fix wave, not a second broad branch review.

## Finding verdicts

| Finding | Verdict | Scoped assessment |
|---|---|---|
| I1 — project-owned cache | **NOT ADDRESSED in full** | The primary sequential replacement and duplicate-entry cases are corrected by registry-derived owner generations, retirement and owner-aware consumers. The slow pending-loader case is covered. A warmed ready-cache promise can still resolve A metadata after B publication; R1 below is the remaining P2 path. |
| I2 — immutable artifacts and aliases | **ADDRESSED** | `workspace-session.js` leaves immutable source-artifact/reference objects unchanged, rejects unsupported namespace collisions before publication, preserves established alias snapshots and validates the resulting aliases. Valid alias-bearing projects and canonical-reference remaps have real artifact hash/audit/independent closure coverage. The fix does not rehash changed evidence or drop old field anchors. |
| I3 — overwritten computation slots | **ADDRESSED for the original finding** | Occupied differing original/recomputed slots now refuse atomically with export/open guidance; identical normalized history and non-overlapping slots survive. Explicit snapshot IDs are checked against retained slots. The additional navigation-history merge introduced a distinct P2 composition issue, R2 below. |
| I4 — refresh and recovery | **ADDRESSED** | Startup detaches unavailable live asset references using the existing asset rules, retains notes/evidence/drafts and saved numerical metadata, records missing identities, and keeps the original envelope opaque and exact. Normal import remains strict. Archive/download/acknowledgement/commit uses the canonical Stage and does not bypass normal project admission. |
| I5 — earned derivative verification | **ADDRESSED** | `parseProject` assigns `received-project-derived-bytes` only after actual payload/grid/encoding/hash checks. Linking requires a matching project-entry observation and consistent user-declared alignment; serialized flags alone, unknown space, missing evidence and contradictory declarations do not grant eligibility. Original raw source bytes are explicitly not claimed embedded. |
| I6 — journey manifest and async helper | **ADDRESSED** | The shared assertion checks ordered operands plus the complete unique dependency closure. Node tests reject missing/swapped/extra/corrupted inputs. The helper now waits for confirmation/result/error/cancellation rather than checking visibility immediately. The three browser journeys were only discovered, not executed. |
| M1 — invalid imported-label action | **ADDRESSED** | The button uses a prevalidated selected detail reference, is disabled without it, and no longer invokes the throwing reference constructor from an unguarded event callback. No provenance is invented. Rendered behavior remains unrun. |
| M2 — dense lifecycle formatting | **Retained, non-blocking** | The scoped fix did not add an unrelated formatting sweep. |

## Remaining Important cases

### R1 — P2, residual I1: recheck local ownership after a ready-cache promise resolves

**File:** `src/lib/volume.js:118–132`, especially `const promise=resourceValue(...)` and `if(!signal)return promise` at lines 126–127.

The new checks cover ownership before requesting the resource and after the *loader's* asynchronous work. They do not cover an already-ready resource: `resourceValue` itself awaits `ensureResource`, so there is still a microtask boundary before the result is delivered. Retirement updates the resource record, but the already-resolved ready-state object can be retained by that continuation.

**Concrete trigger and observed result:** Warm A's `custom-a`; start a second `loadAtlas('custom-a')`; queue B's registry replacement before the ready-resource continuation resumes. The outstanding load resolves `A private label`, with `ownerScope.projectId='A'`, after B owns the registry. A subsequent new load correctly returns B. This is narrower than the original sequential-cache defect, but it still violates the requested late/current ownership boundary and can deliver an obsolete source to a waiting consumer. The probe demonstrates the module/API result; it does not claim a newly rendered browser leak.

**Timing and consuming guards:** A second probe used the actual `createComparisonSourceLoader(loadAtlas)` adapter. Its event order was `A cache ready → A consumer request invoked → B registry published → A consumer request delivered`. At delivery, the registry scope was B/generation 2, the returned scope was A/generation 1, and the adapter's `isCurrent()` still returned true. `SourcePanel` checks that request-generation predicate and its effect-local alive/generation flags (`ComparisonViewport.jsx:22–24`); these become invalid only on a subsequent effect cleanup/run, not synchronously when registry ownership changes. Same owned ID and same byte identity pass its other checks. App also has effect-local alive flags, but its ready-resource/query gate prevents some stale-query presentations; therefore this report does **not** assert that every consumer necessarily paints A under B. The missing loader/publication owner check is the demonstrated defect, distinct from a value that completed before a later project change.

**Bounded fix:** In `loadAtlasVersion`, validate the captured local owner scope again on successful resolution, before returning/delivering the volume, in both the signal and no-signal paths. Ensure the publication guard for a local result still checks its owner scope when used, rather than relying solely on the request generation if ownership can change between async boundaries. Keep the existing public cache behavior and cancellation semantics. Add a warmed-cache microtask-replacement negative test and a current-owner positive test; do not weaken hash/version validation or fabricate new byte identities.

### R2 — P2, introduced in I3's history fix: make the merged active view its own selected visit when the incoming project has no history

**File:** `src/lib/workspace-session.js:199–209`; consuming checkpoint at `src/App.jsx:307–311`.

When current A has history but incoming B has none (or an empty history), the merged state activates B's `view` while retaining A's old selected history index. App's next `checkpointNavigation` calls `replaceNavigationEntry` at that index with the active B view. It therefore overwrites the A visit that this fix just retained.

**Concrete trigger and observed result:** A's selected visit is coordinate `[10,20,30]` with a saved reading scroll; B has view `[99,98,97]` and no navigation history. Immediately after merge, the history contains A. After the exact `replaceNavigationEntry` step used by App, the only history entry is B and `originalVisitRetained` is false.

**Impact:** Ordinary next navigation after a successful merge silently removes A's prior visit, including its ROI/source/view/scroll context. The two-history test passes because it selects an incoming entry; it does not cover this normal historyless project input.

**Bounded fix:** Preserve all current entries and add/select an incoming active-view visit when there is no incoming selected entry representing that view. Respect the existing 50-entry bound; refuse an unrepresentable capacity case atomically instead of replacing an old visit. Cover merge → actual checkpoint → push/back behavior with missing and empty incoming history, retaining A's exact view/scroll and both computation-slot bindings.

## New Critical/Important breakage in the fix

- **Critical:** none established.
- **Important:** R2 is introduced by the new navigation-history composition. R1 is a residual path of I1 rather than a separate broad-review finding.
- No other Critical/Important issue was established in this fix diff.

## Recovery and preservation assessment

The chosen recovery path matches the final root ruling. `planRecoveryArchive` removes the embedded recovery field only in a proposed candidate. `stageWorkspaceChange` still validates normal project payload, metadata and browser-envelope budgets. `downloadRecoveryArchive` records initiation separately from `acknowledgeRecoveryArchive`; `commit` requires acknowledgement, the same current revision, and successful storage write before publishing. The App/WorkspaceFiles wiring has an explicit **I saved it; continue** action. Cancel, no acknowledgement, download exceptions and quota failure retain the original state. Pending draft-manager records remain available and are flushed after the acknowledged commit.

The near-limit regression uses a genuinely large escaped old envelope, preserves original storage during refused ordinary staging, then exercises archive → acknowledgement → canonical commit → pending draft flush → continued notes/navigation → ordinary export → parse → `stageProjectImport`. Public views and evidence exports omit opaque recovery content. Partial-image export refuses while an embedded recovery context could smuggle deliberately excluded material. Distinct unreconcilable recovery originals refuse merge. No general export-only admission bypass was added.

The extra computation metadata in the envelope does not recreate lost image/class bytes or certify historical computations. Old envelopes lacking that metadata still need their full project files. The original envelope is retained without recursive nesting. These are correct explicit limits.

## Checks and evidence

- Read the complete `FINAL-fix-brief.md`, `FINAL-fix-report.md` and final root rulings in `progress.md`.
- Read all 1,595 LF-separated lines of the supplied indexed `FINAL-fix-review-package.md` in bounded Node UTF-8 passes, including all 21 files and all new/changed tests. The index's 21 diff headers match their declared offsets. No diff package was regenerated; no omitted/truncated output was treated as inspected.
- Checked current HEAD: `cdeb6ed550733b13fb0cb3c24ccf41f0f80bcbd2`. `git status --short` was empty before writing this ignored review report.
- Inspected canonical source/consumer composition for owner-aware loads/subscriptions, immutable evidence collision/alias handling, occupied computation slots and selected history indices, startup detach/archive paths, project producer/consumer budgets, earned project-byte verification and the corrected journey contract.
- Read the retained worker receipts: `output/final-fix/covering-final.txt` records 189/189, zero failures/skips; `covering-message-final.txt` records 46/46; static E2E discovery lists three journeys; `jsx-syntax-final.txt` records six successful transforms. These are existing recorded executions, not new runs by this reviewer.
- Read root's `output/release-candidate/neuroatlas-4.2.0-20261030-root-final/verification/final-worktree-check.txt`, ending in 442 tests, 442 pass, zero fail/cancel/skip. The root reports data/literature validation passed on these fixed bytes. Those passing suites do not cover the two exact residual witnesses above.
- Ran three focused process-local Node probes, justified by R1 and R2 (the third resolves the explicitly requested consumer/publication timing question). Their exact source and output are preserved below. No suite reruns, source writes, installs, browser/CUA/desktop/Playwright runtime, servers, network/remote operations or helper agents occurred.
- Sole write: `.superpowers/sdd/README/FINAL-fix-review.md`. Original sources, index, HEAD, evidence and existing receipts were untouched.

## Out-of-scope observations / Declined to judge

- The original broad-review limits remain unchanged. This review did not reopen unrelated branch code, generated scientific content or the complete 50-requirement acceptance matrix.
- New recovery preview/download/acknowledgement UI, exact native download cancellation, guarded label-button rendering and corrected E2E journeys still require permitted browser/native/accessibility execution. Code and Node receipts do not mark those gates passed.
- Native 200% zoom, screen reader/touch behavior, browser performance and NiiVue rendered equivalence remain unrun/unverified.
- Human source/anatomical review and independent researcher acceptance remain pending; S6 stays partial/human=false/14 gaps/0 eligible replacements. No source-space gap was closed by these fixes.
- Final clean-source package/build/fresh-install/rollback reproduction and public publication are root/external gates. This report is not a release attestation or authorization to retry the blocked workflow push.
- M2 remains the already recorded non-blocking maintainability observation. No additional cosmetic findings are being promoted into blockers.

## Assessment

**Ready to merge this fix wave? With fixes.** I2–I6 and M1's original defects are addressed, and I1's main cases are corrected, but the two narrow R1/R2 witnesses prevent a clean scoped verdict. They require bounded ownership-continuation and selected-history corrections rather than another broad implementation or review pass.

## Appendix — exact focused witnesses

Each block ran in a separate existing Node process using `node --input-type=module` on stdin from the checkout. Neither wrote files or used a browser.

### R1: warmed resource resolves after its project ownership expires

```js
import {prepareLocalVolumeProvenance} from './src/lib/computation-manifest.js';
import {replaceCustomVolumes} from './src/lib/custom-volumes.js';
import {loadAtlas} from './src/lib/volume.js';
const base={id:'custom-a',name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'A private label'}],alignmentStatus:'user-declared',canOverlayOnTarget:true,provenance:'A private provenance'};
const a=await prepareLocalVolumeProvenance(base,Uint8Array.of(1),{id:'same.nii'});
replaceCustomVolumes('A',[a]);await loadAtlas('custom-a');
const pending=loadAtlas('custom-a');
queueMicrotask(()=>replaceCustomVolumes('B',[{...a,labels:[{id:1,name:'B label'}],provenance:'B provenance'}]));
let old;try{const v=await pending;old={resolved:v.labels[0].name,owner:v.ownerScope?.projectId};}catch(e){old={rejected:e.message};}
console.log(JSON.stringify({probe:'ready-cache-late-publication',pendingResult:old,currentResult:(await loadAtlas('custom-a')).labels[0].name}));
```

```json
{"probe":"ready-cache-late-publication","pendingResult":{"resolved":"A private label","owner":"A"},"currentResult":"B label"}
```

The additional timing/consumer probe used the actual comparison request adapter:

```js
import {prepareLocalVolumeProvenance} from './src/lib/computation-manifest.js';
import {replaceCustomVolumes,getCustomVolume,getCustomVolumeScope} from './src/lib/custom-volumes.js';
import {loadAtlas} from './src/lib/volume.js';
import {createComparisonSourceLoader} from './src/lib/comparison-link.js';
const v=await prepareLocalVolumeProvenance({id:'custom-a',name:'same.nii',data:Uint8Array.of(1),shape:[1,1,1],affine:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],order:'x-fastest',kind:'label',space:'MNI152NLin6Asym',labels:[{id:1,name:'A label'}],canOverlayOnTarget:true,alignmentStatus:'user-declared',provenance:'A'},Uint8Array.of(1),{id:'same.nii'});
replaceCustomVolumes('A',[v]);await loadAtlas('custom-a');
const events=['A cache ready'],loader=createComparisonSourceLoader(loadAtlas);
const pending=loader.run({assetId:'custom-a',identity:v.identity});events.push('A consumer request invoked');
queueMicrotask(()=>{replaceCustomVolumes('B',[{...v,labels:[{id:1,name:'B label'}],provenance:'B'}]);events.push('B registry published');});
const result=await pending;events.push('A consumer request delivered');
console.log(JSON.stringify({probe:'ready-cache-consumer-timing',events,requestStillCurrent:result.isCurrent(),returnedOwner:result.volume.ownerScope,currentOwner:getCustomVolumeScope('custom-a'),returnedLabel:result.volume.labels[0].name,registryLabel:getCustomVolume('custom-a').labels[0].name}));
```

```json
{"probe":"ready-cache-consumer-timing","events":["A cache ready","A consumer request invoked","B registry published","A consumer request delivered"],"requestStillCurrent":true,"returnedOwner":{"projectId":"A","entryId":"custom-a","generation":1},"currentOwner":{"projectId":"B","entryId":"custom-a","generation":2},"returnedLabel":"A label","registryLabel":"B label"}
```

### R2: the next canonical checkpoint overwrites the retained old visit

```js
import {stageProjectImport} from './src/lib/workspace-session.js';
import {serializeProject,validateViewState} from './src/lib/workspace-project.js';
import {replaceNavigationEntry} from './src/lib/navigation-history.js';
import {emptyEvidence} from './src/lib/evidence-schema.js';
const project=(id,view)=>({projectId:id,revision:0,view:validateViewState(view),notes:[],drafts:[],evidence:emptyEvidence(),volumes:[],roiSnapshot:null,recomputedSnapshot:null});
const visit=validateViewState({coordinate:[10,20,30],mode:'research'});
const current=project('A',{...visit,navigationHistory:{projectId:'A',index:0,entries:[{view:visit,scroll:{reading:123}}]}});
const incoming=project('B',{coordinate:[99,98,97],mode:'anatomy'});
const stage=await stageProjectImport(await serializeProject(incoming),{current,mode:'merge'});
const captured=structuredClone(stage.next.view);delete captured.navigationHistory;
const checkpointed=replaceNavigationEntry(stage.next.view.navigationHistory,{view:captured,scroll:{}});
console.log(JSON.stringify({probe:'merge-with-historyless-incoming',active:stage.next.view.coordinate,beforeCheckpoint:stage.next.view.navigationHistory.entries.map(e=>e.view.coordinate),afterCheckpoint:checkpointed.entries.map(e=>e.view.coordinate),originalVisitRetained:checkpointed.entries.some(e=>e.view.coordinate.join()===visit.coordinate.join())}));
```

```json
{"probe":"merge-with-historyless-incoming","active":[99,98,97],"beforeCheckpoint":[[10,20,30]],"afterCheckpoint":[[99,98,97]],"originalVisitRetained":false}
```
