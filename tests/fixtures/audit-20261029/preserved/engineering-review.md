# NeuroAtlas engineering audit — 2026-10-29

Scope: current workspace `F:/project/brain-model`, data loading, project persistence, import/export, failure recovery and reproducibility. No production source was modified. No package installation, full test rerun, browser interaction, publishing, or Python execution was performed by this reviewer.

Evidence: `engineering-probes.mjs` extracts the current `App.jsx` project import and restore handlers and executes them with in-memory storage/state setters. It also exercises the actual NIfTI, label-table, registry and project serialization functions. `engineering-probes.json` records three reproduced failures. These are component-handler/unit reproductions, not full-browser acceptance results.

## Confirmed defects

### E1 · P1 · A failed project import overwrites existing research content

- Location: `F:/project/brain-model/src/App.jsx:147`; dependency check at `F:/project/brain-model/src/App.jsx:135`–`137`.
- Trigger: an otherwise valid `.neuroatlas` file whose view references `custom-missing` while its volume list does not supply it.
- Observed in the extracted current handlers: the import rejects with “This view uses imported data that are not loaded”, but the previous persisted evidence package has already been replaced (one existing reference becomes zero), and incoming notes have already been set. The notes persistence effect at line 105 subsequently writes the replacement notes in the real app.
- Cause: `saveEvidence`, `registerCustomVolume`, `setLocalEvidence`, and `setNotes` all occur before `restoreWorkspaceView` validates required volume references. `parseProject` validates individual records without validating cross-record references.
- Fix: construct and validate a complete staged workspace, including view dependencies, before committing any storage, registry or React state mutation. Commit atomically or restore a saved snapshot if persistence fails.
- Acceptance: missing-volume references, invalid evidence, and simulated storage failures must leave current notes, evidence, registered volumes and view byte-for-byte unchanged; valid imports must change them together.

### E2 · P1 · Opening another project retains and re-exports the previous project's images

- Location: `F:/project/brain-model/src/App.jsx:146`–`147`; registry at `F:/project/brain-model/src/lib/custom-volumes.js:10`.
- Trigger: open project A containing an imported private image; then open project B containing no imported images; export B.
- Observed: B's notes replace A's, but B's re-export still contains the image named `Project A private map`. The registry only receives additional entries, while `exportWorkspace` serializes every registered volume.
- Effect: independent project boundaries are lost, unrelated images consume memory and project capacity, and a file shared as B can include A's data.
- Fix: define a project-scoped volume registry and replace it as part of the import transaction. If merging is desired, make “merge” an explicit operation and preview included assets before export.
- Acceptance: after A → B, B's exported volume IDs exactly match B's project assets; an explicit merge has an independently tested, visible behavior.

### E3 · P2 · Accepted imports can make the entire session impossible to export

- Location: `F:/project/brain-model/src/components/ROICompare.jsx:229`–`235`; `F:/project/brain-model/src/lib/nifti.js:171`; export gates at `F:/project/brain-model/src/lib/workspace-project.js:81`, `88`, `99`–`106`.
- Reproduced trigger: import a valid small NIfTI with a JSON label table containing a 2,001-character name. The table and registry accept it, but full-project export rejects it with `Invalid volume metadata: label name` (export permits 2,000).
- Other code-confirmed mismatches: the reference-space/provenance inputs have no lengths matching the export limits of 160/20,000; individual imports allow 64 million float64 voxels (512 MB decoded), while all project volumes together are limited to 256 MiB; session imports have no total count/decoded-size admission limit.
- Effect: export always includes all session volumes. The UI at `ROICompare.jsx:265` offers only viewing imported volumes, and `removeCustomVolume` has no caller, so the user cannot remove an offending volume to recover project export.
- Fix: share one import/export metadata validator and perform total project-capacity checks before registration. Add asset removal and scoped export, or a storage/archive format that supports the advertised import capacity.
- Acceptance: every admitted file/table/provenance input and aggregate session must be exportable and re-importable. Exercise exact boundary lengths, >256 MiB aggregate decoded data, and removing one rejected/oversize asset without losing notes.

### E4 · P2 · Saved views and projects lose displayed research-coordinate markers

- Location: `F:/project/brain-model/src/App.jsx:132`, `138`, `152`; `F:/project/brain-model/src/lib/workspace-project.js:20`–`27`.
- Trigger: overlay a paper's source-checked coordinates in the main brain, then save/share/export and restore the view.
- Code-confirmed result: `getWorkspaceView` does not serialize `activeResult` or `studyMarkers`; restoration explicitly clears both. `validateViewState` has no field for the displayed research-result layer.
- Effect: the research finding highlighted by the author disappears from the saved/shared scene, despite the UI calling the operation a complete view link/project restore.
- Fix: serialize stable result/coordinate identifiers plus display settings, resolve them against the packaged evidence, and preserve the same public/private allowlist used for reference links. Project files may include local evidence; public links must omit private identifiers with an explicit omission message.
- Acceptance: round-trip a public result-marker layer through a link and a local result-marker layer through a project; positions, identifiers and visible/hidden state must match. This overlaps the evidence review and can be consolidated there.

### E5 · P2 · A transient manifest request failure leaves workspace features permanently uninitialized

- Location: `F:/project/brain-model/src/App.jsx:99`–`102`.
- Trigger: fail the App's initial `/data/manifest.json` request while the separate `volume.js`/scene requests succeed, then restore the network.
- Code-confirmed behavior: the failed response becomes `null`, errors are swallowed, and the effect has an empty dependency list and no retry action. The 3D scene can work while the workspace `manifest` remains null; ROI/atlas controls cannot recover in-session.
- Fix: use a shared manifest resource with explicit loading/error/ready state and a retry path. Preserve the research workspace while retrying failed assets.
- Acceptance: fail the first manifest fetch, permit the retry, and verify all controls recover without page reload or loss of imported volumes/notes. Also test a terminal failure with a visible actionable error.

## Risky design requiring a research reproducibility contract

### E6 · P2 · A project records selections, but does not pin the data or calculation that produced the result

- Location: `F:/project/brain-model/src/lib/workspace-project.js:109`; `F:/project/brain-model/src/components/ROICompare.jsx:201`, `204`, `210`–`218`; `F:/project/brain-model/src/lib/roi.js:111`, `215`–`216`.
- Evidence: serialized project top-level keys are only `schema, createdAt, view, notes, evidence, volumes`. Built-in atlases are represented by IDs; ROI state records `computed: true`, and restoration re-runs the current calculation. The worker serialization drops atlas hashes, and exported metrics include descriptive source/space/provenance strings without application/algorithm version or source/target content hashes.
- Trigger/risk: reopen the same research project after a release changes an atlas binary, registration, shared grid or interpolation implementation. A syntactically successful restore can produce a different result without identifying the original inputs/calculation. No such historical change was simulated; this is a design gap, not a claim that current outputs are wrong.
- Fix: store a reproducibility manifest with app/build/algorithm versions, exact source and target hashes, alignment/transform identifiers and computation parameters; preserve the original quantitative result and mark recalculation separately. Compare these identities on restore and require an explicit migration/recompute decision on mismatch.
- Acceptance: change one source byte, transform identifier or algorithm version in a test fixture and confirm that restoration reports the mismatch before recomputation; unchanged inputs reproduce the saved counts/metrics.

## Validation priorities

The three probes demonstrate failure paths not covered by the current pure project round-trip tests. Prioritize an integration contract around import transaction boundaries, workspace asset ownership, and import-to-export invariants. Follow with browser acceptance for persisted research-marker layers and transient network failure recovery. Existing successful numerical/unit checks are complementary evidence and do not test these interactions.

Additional performance observation, not promoted to a defect: NIfTI parsing/export loops run on the UI thread (`nifti.js:112`–`119`, `143`–`146`; called by `ROICompare.jsx:229`), despite imports allowing 64 million voxels. The existing ROI worker is a good starting point for a cancellable import/export worker with a measured responsiveness budget. No browser timing benchmark was performed here.
