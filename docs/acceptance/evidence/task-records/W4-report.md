# W4 implementation report

Base supplied by coordinator: `ee4af54018b2506eb4a57aa1143cddb3e409b788`.
Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Implementation is unstaged; root alone commits. No Python, dependency installation,
browser operation, file upload, CI execution, publication, or user-storage probe ran.

Used the executing-plans, test-driven-development, and
verification-before-completion skills. The W4 brief was read in full first.

## Files

- Added `src/lib/roi-import-state.js`.
- Added `src/lib/roi-import-state.test.mjs`.
- Integrated `src/components/ROICompare.jsx`.
- Added compact responsive summary styling to `src/components/ROICompare.css`.
- Added `tests/e2e/roi-import.spec.mjs` for later permitted isolated execution.
- Added this report. No App, session, codec, asset, or historical-result files changed.

## Behavior and interfaces

`newImportDraft(fileToken)` returns exactly the proposed default declaration:
`{fileToken,kind:'label',spaceId:'native-unverified',otherSpace:'',aligned:false,provenance:'',labelFile:null}`.
Every image picker change gets a fresh UUID, including the same filename with
different contents. The image input is cleared after retaining its File in React
state, so reselecting the same file can trigger another change; the selected
filename remains visible in the import summary. New-image selection also clears
the actual label-input DOM value, not only its state.

`reduceImportDraft(state, action)` supports `file-changed` (`fileToken`),
`kind-changed`, `space-changed`, `other-space-changed`, `alignment-changed`,
`provenance-changed` (`value`), and `label-file-changed` (`file`, optional
`fileToken`). Label selections are wrapped as `{fileToken,file}` and late actions
from another token are ignored. Both space actions revoke alignment; only the
explicit NLin6Asym choice can receive the checkbox declaration. Changing any
declaration invalidates an in-flight request synchronously, before React renders.

`prepareImportSummary(draft,{file,labelFile})` returns
`{fileToken,fileName,kind,spaceId,labelFileName,provenance,alignmentStatus}`.
The optional table defaults to the draft's bound File; mismatched, old-token,
or silently omitted bound tables are rejected. W1 `validateVolumeMetadata`
checks raw lengths before trimming; no metadata is silently truncated. Accepted
NLin6Asym alignment requires this draft's nonempty source/alignment evidence.
Other spaces remain unverified. The pre-read UI presents file, type, reference
space and table together, with the current evidence and checkbox immediately
above it. The import button confirms that captured immutable declaration.

`stageVolumeImport(draft,{file,labelFile,current,signal,isCurrent,stage,knownEvidence})`
uses W1 bounded NIfTI/table decoding and S5 local byte identities. It checks the
guard before reading and after each image read, decode, table read, and hash
preparation. Aborted or stale requests fail before delegation. Without `stage`,
it passes the complete candidate to W2 `stageWorkspaceChange` and returns a real,
uncommitted W2 Stage. It checks staleness again after W2 admission; the caller
still must use the existing session's commit method.

Ruling: Keep App's existing host adapter as the sole commit boundary — root
explicitly approved this compatibility integration. ROI uses the optional
`stage(volume, summary, {isCurrent})` adapter to call the existing
`onImportVolume(volume,{projectId,epoch,isCurrent})`. App still performs W2
revision admission, project/epoch validation, and the final token/declaration
guard immediately before atomic commit. The adapter's optional third-argument
guard returns true or throws for stale/aborted work; adapters that commit must
retain that check through commit. No alternate registration, persistence key,
history storage, or per-project asset boundary was introduced. Cost if changed
incorrectly later: an adapter that ignores the final guard could publish stale
work; the contract and regression explicitly cover that obligation.

ROI A/B are changed only after successful registration returns and the captured
declaration remains current. Failed reads/admission retain the current file and
all declaration fields for correction and retry. Editing a declaration permits
a fresh request; an old request cannot clear a newer request's busy state or
report a success/error over it. The success message uses the actual prepared
summary (filename, type, space, table) and registered affine-conflict metadata.

## Verification evidence

RED command:

`node --test src/lib/roi-import-state.test.mjs src/lib/workspace-limits.test.mjs`

Observed: `ERR_MODULE_NOT_FOUND` for `src/lib/roi-import-state.js`;
**5 tests, 4 pass, 1 fail**. The shared W1 tests passed while the missing W4
interface failed. This was run before writing the implementation.

First GREEN after implementation: the same command, **12 tests, 12 pass,
0 fail/cancelled/skipped/todo**. Additional edge coverage then produced final
GREEN: **14 tests, 14 pass, 0 fail/cancelled/skipped/todo**. Final run covered:

- changing image resets alignment and table;
- same filename is a new declaration;
- space changes revoke alignment; target confirmation requires current evidence;
- summary uses shared metadata limits without truncation;
- stale file, declaration, and project after a late image read never register;
- host adapter retains the declaration guard through pending W2 admission;
- aborted reads and mismatched table arguments never reach admission;
- late table read cannot apply an old table or publish into another project;
- successful import stages the actual declared bytes/table through W2 without
  publishing until the genuine session commit;
- failed decode preserves the draft and can be retried;
- all four existing W1 shared metadata/budget/label/JSON tests.

`npm run build` — **exit 0**, Vite 7.3.7, 1,642 modules transformed, built in
2.91 seconds. Existing warnings remain: `volume.js` has both static/dynamic
imports; some output chunks exceed 500 kB. No build failure.

`node --check tests/e2e/roi-import.spec.mjs` — **exit 0**.
`git diff --check` — **exit 0**, with Git's informational CRLF-to-LF warning
for ROICompare.jsx. This is syntax/whitespace evidence, not browser acceptance.

## Limits and unrun acceptance

The module consumes existing W1 limits (including 128 MiB image file,
64,000,000 voxels, 2 MiB label file, 160-character space, 20,000-character
provenance), actual label-row/text limits, and W2 aggregate/project admission.
No synthetic large-buffer allocation or default-environment package changes
were used. Signal cancellation prevents publication at await boundaries; the
existing synchronous decoder cannot be interrupted in the middle of its loop.
W6 explicit historical-restoration UI remains later work.

The isolated e2e source covers a confirmed A followed by B and by same-name
different-content B; verifies type/space/checkbox/table DOM/provenance reset;
imports B as unverified with no A table; and covers missing evidence and failed
decode preserving the current draft. **It was not executed.**

Root reported a prior browser synthetic upload denial with an unanswered async
permission question. Per root's instruction, no browser/upload/CI workaround
was attempted. `npm run test:e2e -- tests/e2e/roi-import.spec.mjs`, actual desktop
same-file chooser behavior/cancel, visible summary layout, and full desktop
end-to-end import acceptance remain unrun and owned by the coordinator using
the permitted CUA path. No browser-green, completed desktop import, human
alignment verification, or full-plan completion is claimed.
