# X9 fix round 1 independent re-review

Scope: `cd7e10e..6248f7cce19e046b478bdd85cda0e0e2475f5ef3`, the exact seven-file fix delta. Read the prior X9 review, appended round 1 report, review package and bounded exact Git hunks. Original brief/context remain authority. HEAD was checked at `6248f7c`; source working tree was clean. No source edits, test/build reruns, browser, installs, Python or subagents were used. Root reports actual RED reproductions for both original defects; corrected actual CUA GREEN remains root-owned and in progress.

## Finding 1: ADDRESSED

The lazy import task now retains a unique intent instead of assuming its input exists on the next frame. `App.jsx:117–128,259–264` creates a project/epoch-scoped handoff and opens/focuses only the connected, non-inert real input after readiness. `ROICompare.jsx:127–128,413` supplies the real input ref and layout-effect readiness for both first and repeated visits. `roi-import-state.js:10–22` retains the token across empty frames, accepts only the current matching scope and consumes it once; cancellation also removes a scheduled frame.

Unrelated navigation/restores/history cancel at `App.jsx:285–286,305–308,314`; mode/scope departure and App unmount cancel at lines 120–121. Late readiness cannot revive an old token. The scheduled frame follows DialogHost's existing return-focus microtask. No alternate persistence/navigation codec or change to scientific identity was added.

The four added handoff tests cover delayed and warm readiness, once-only consumption, departure before readiness or scheduled focus, and stale visit/project identity. Two authored browser cases cover delayed cold entry, warm re-entry, and departure followed by ordinary ROI navigation. These are meaningful checks of the original failure, though browser discovery is not execution.

## Finding 2: ADDRESSED

`ROICompare.jsx:161–164` centralizes scientific comparison replacement through `replaceComparison`, which first invalidates the outstanding export. Recompute now calls it synchronously at line 268 before awaiting new work, so the old Cancel control can disappear only after its task has been aborted. Initial-state change, automatic selection/registry invalidation, saved inspection and new result publication also invalidate at lines 177–179,217–222,258,296. Display-only edits at line 306 intentionally retain the existing scientific mask.

`roi-region-state.js:7–16` captures one comparison/AbortSignal per task; invalidation both aborts and removes current eligibility. `ROICompare.jsx:349–356` downloads or reports an error only for the mounted current task; `finish(task)` prevents an old finally from clearing a newer task's busy state. Explicit Cancel and unmount use the same invalidation. Worker parser/export and W1/W2 admission remain untouched.

The two added task tests establish no download after delayed old completion, successful subsequent current export, and immunity of the newer busy/current task to late completion. The authored browser case follows the actual old failure sequence (export delayed, recompute, no old download, successful new export). Root's actual corrected browser observation is still required to close the visual/integration acceptance.

## Verdicts

- **Spec implementation for this fix round: PASS.** Both requested corrections are present and within the reviewed lifecycle scope. No additional actionable regression was established in the delta.
- **Code/task quality for this fix round: PASS.** The small transient helpers provide explicit ownership and cancellation without duplicating codecs or broadening W1/W2/S3. The tests check externally relevant late-work behavior; the report distinguishes authored/discovered browser cases from actual execution. Root/implementer evidence is 28/28 focused, 353/353 full checks and successful build; this reviewer did not rerun them.
- **Full X9 acceptance: still pending the previously declared actual browser measurements/checks.** This re-review does not turn Node tests into CUA GREEN or establish cold/warm browser timings, interaction p95, rendered cancel feedback or worker-inclusive peak memory. The measured near-limit ~1.1-second canonical W2 staging remains disclosed performance debt under the exact plan's limitation clause, not a passed performance gate.

No new change request from this scoped delta review.
