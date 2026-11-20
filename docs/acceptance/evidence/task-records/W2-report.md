# W2 implementation and handoff

Status: implementation ready for root review. Browser/desktop import acceptance
remains pending; this report does not mark the full acceptance scope complete.
Root is the sole committer. No staging, commits, subagents, browser CLI, package
installation, Python, user storage inspection, or real research-data operations
were performed.

## Owned changes

- `src/lib/workspace-session.js` and `.test.mjs`
- `src/lib/custom-volumes.js`
- `src/lib/workspace-project.js` and `.test.mjs` (root-authorized scope extension)
- `src/components/WorkspaceFiles.jsx` and `.css`
- `src/components/LiteratureWorkspace.jsx` (minimal transaction integration)
- `src/App.jsx` (released after S2 commit `15f0507`)
- `src/components/ROICompare.jsx` (released after S2 fix `51ff82f` and S5 work)
- `tests/e2e/workspace-import.spec.mjs`
- `tests/e2e/spatial-selection.spec.mjs` (root-authorized narrow envelope reads)

## Transaction boundary

`stageWorkspaceChange(candidate,{current,knownEvidence})` validates a complete
candidate without touching storage, the registry, React, or caller-owned view
objects. It consumes E2's `validateEvidence` migration/validation boundary and
W1's shared codec/admission. Asset counts/raw bytes are preflighted before
cloning binary input. Notes, view and evidence JSON and draft collections are
bounded; computation snapshots stay outside localStorage.

`stageProjectImport(text,{current,currentView?,mode,knownEvidence,makeId?})`
uses the single shared `parseProject` codec. Open replaces project ownership;
merge retains existing records and separates conflicting incoming records by
`(recordKind,id)`. A fixed-point pass also separates unchanged incoming children
whose parent references must change. Incoming paper/result/location/claim/
relation/source-artifact/review-subject/layer/ROI/explorer/manifest references
are remapped; prose and `legacyV1`/`legacyImports` originals are preserved.
Draft ownership and kind-specific record links are remapped. Ambiguous review
subjects are rejected instead of guessing across record kinds. No DOI overwrite
is performed by project merge.

`createWorkspaceSession({storage,initial,knownEvidence})` owns the current
snapshot and project registry. `commit(stage)` checks both its revision and the
exact base snapshot, writes `neuroatlas-workspace-current-v1` once, and only then
publishes the prepared snapshot/registry. Quota exceptions occur before state
or registry changes. Subscriber errors cannot undo publication or block peers;
reentrant commits are rejected while subscribers observe a revision. Unchanged
assets preserve the registry object identities and do not notify/cancel live
ROI consumers during a note/evidence save.

The persistent envelope has only schema, projectId, revision, notes, evidence,
view and drafts. All production note saves/deletes/imports, evidence editor/
metadata/JSON saves, and local NIfTI registration now use this boundary. Legacy
notes/evidence keys are read only; they are neither removed nor rewritten. A
valid authoritative envelope ignores corrupt legacy sentinels. Malformed legacy
data without one is reported and retained unchanged.

App guards asynchronous project opens with request generations and snapshot
identity. ROI/evidence imports also carry a project epoch, so reopening a file
with the same project ID still invalidates an older task. ROI imports retain
S5 byte provenance and S2's per-side `reselectRegion('B','source',...)` gate.
New files/label files and unmount invalidate a pending ROI import before its
registration commit. Camera restoration cancels superseded frame callbacks.
Failed saves retain the note/editor input; successful note saving does not clear
a newer edit typed while admission was pending.

## Shared codec and UI

The shared `workspace-project.js` now writes `neuroatlas-project-v2`, reads v1,
and marks imported v1 containers `missing-provenance`. It preserves project
identity, S2's complete atlas refs and queries, precise region notes, ROI region
refs/grid spacing, and bounded draft placeholders. No second v2-to-v1 adapter or
parallel serializer remains in the session module. W1's binary decoder, budget
rules and volume metadata normalization remain the common implementation.

WorkspaceFiles has separate Open and Merge triggers. `onStageProject` returns
the prepared Stage; the component displays record/asset counts, removals and
per-kind ID remaps. Only Confirm open/merge invokes `onCommitProject`; Cancel or
late staging completion leaves the workspace unchanged. X6's single DialogHost
continues to own modal/focus behavior and native picker cancellation returns to
the correct trigger. New private layer/custom atlas identities are removed from
public view links.

## Verification

- Initial RED: new session module absent; the existing codec/evidence tests still
  passed (34 passed / 1 failed file). Follow-up REDs demonstrated v1 output,
  leaked new private view fields, duplicate note acceptance, reentrant revision
  changes, missing draft record remapping, and registry initialization/change
  notification behavior. Each was corrected and rerun green.
- Directed command:
  `node --test src/lib/workspace-session.test.mjs src/lib/workspace-project.test.mjs src/lib/evidence-workspace.test.mjs`
  passes **50/50**, including all-key storage equality, exact snapshot identity,
  missing assets/evidence/coordinate failures, quota rollback, ownership swap,
  dependency remapping, stale/foreign stages, legacy preservation and draft
  50,000-byte/30-record/1-MiB bounds. Log: `W2-targeted.log`.
- S2/S5 guard command:
  `node --test src/lib/workspace-session.test.mjs src/lib/roi-region-state.test.mjs src/lib/computation-manifest.test.mjs`
  passed **20/20** at that point; subsequent full checks include these files.
- Final `npm run check`: **153/153 passed**, no failures or skips; source and
  data/hash validators passed. Log: `W2-check.log`.
- Final `npm run build`: passed, **1631 modules**. Existing >500 kB chunk-size
  advisory remains. Log: `W2-build.log`.
- `node --check` passes both touched e2e files. `git diff --check` passes (only
  the repository's CRLF-to-LF conversion notices).
- Browser tests were authored for synthetic isolated storage only: failure and
  preview cancel keep all keys/ongoing note editing/canvas identity, A→B removes
  A's private volume ownership, explicit merge retains records, quota failure
  retains the input. Existing S2 assertions now poll/read the authoritative
  envelope while keeping exact ref/label/subject assertions and its supplemental
  per-side mismatch scenario intact.

## Rulings and remaining acceptance

- Root expanded W2 ownership to the shared codec to centralize new v2 container
  fields and S2 round trips. This supersedes the earlier proposed wrapper codec;
  W5/W6 will extend this same shared file for their specific semantics.
- Project merge adopts the incoming view/ROI settings after explicit confirmation
  while combining existing and incoming result layers and research records.
  Existing record contents are never replaced. A same-ID dependency change may
  require remapping a dependent record even when its original text is identical.
- W2 retains session ROI snapshots and applies shared aggregate budgets; W6 owns
  historical snapshot file encoding, manifest restoration and explicit recompute
  decisions. W2 does not claim those later acceptance cases are implemented.
- X5 owns stricter draft kinds/editor autosave integration. W2 supplies their
  single envelope and payload/count/ownership bounds; it creates no draft key.
- Existing legacy registry mutators remain for old unit/component fixtures;
  production App/ROI writers no longer call them. W3 asset removal must use a
  staged workspace change rather than those mutators.
- Root reported actual CUA file import was denied by browser authority. No
  workaround or import attempt was made here. CI Playwright execution and actual
  desktop file/open/merge/cancel acceptance remain pending. No browser-green or
  completed desktop import is claimed from source syntax checks or Node tests.

## Fix round 1 — W2 review P1 findings

Read `W2-review.md` against HEAD `604abd6`; the review names these two blockers:

- `[P1] Public links retain private identities nested in ROI region refs`
- `[P1] Merge rewrites the current computation snapshots using incoming collision maps`

Only `workspace-project.js`/`.test.mjs`, `workspace-session.js`/`.test.mjs` and
this report changed in the fix. No staging/commit, broad checks, build, browser
execution or subagents were used.

The public projection now uses one region-identity filter for both top-level
selections and all three nested ROI collections (`aRegionRefs`, `bRegionRefs`,
`unresolvedRegionRefs`). A built-in ROI source ID cannot authorize a custom
identity nested beneath it. Mixed collections retain their valid built-in refs
without changing source atlas IDs, and omission reporting names each sanitized
collection. The regression includes all five collections, checks every custom
ID/version/space is absent, verifies built-in refs survive verbatim and confirms
the caller's input remains unchanged.

Merge now selects each snapshot's origin before applying remapping. A retained
current `roiSnapshot` or `recomputedSnapshot` is kept intact; only a non-null
incoming snapshot passes through the incoming collision map. The pure merge
planner is exported as `mergeWorkspace` so the explicit incoming-snapshot branch
can be tested without introducing a file codec or changing W6's ownership. Its
output still requires `stageWorkspaceChange` before publication. The normal
project-import regression proves original `custom-a` voxel `[1]`, ROI descriptor,
manifest input and recomputed volume ID all remain associated with the original
asset while incoming `custom-a` voxel `[2]` becomes `custom-incoming`. Separate
mixed-origin cases supply each incoming snapshot in turn: its descriptor and
manifest are remapped, its values/hash remain unchanged, and the other current
snapshot retains the original identity. Neither workspace input is mutated.

RED command:
`node --test src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs`
→ **33 passed / 3 failed**. Failures reproduced the private nested refs, both
retained-snapshot redirections and the mixed incoming/current snapshot case.
Log: `W2-fix1-red.log`.

GREEN: the same focused command → **36/36 passed**, no failures or skips.
Log: `W2-fix1-green.log`. `git diff --check` passed. The earlier 153/153 full
check/build and partial desktop checks are historical evidence, not fresh
verification of this fix; file import acceptance remains pending as disclosed.
