# W5 report

Status: DONE_WITH_CONCERNS — implementation and Node/build validation complete; browser acceptance remains unrun under the coordinator's explicit permission ruling.

Checkout: `F:/project/brain-model/.worktrees/research-20261029`.
Assigned base: `e379fdeb442cc3387570ea59a16485a3015b1f5d`.
Changes are unstaged; no commit, push, deployment, browser interaction, upload, dependency installation or Python execution was performed.

## Contract and APIs

- `src/lib/result-layers.js` is the only layer validator/resolver/projection implementation. A layer remains exactly `{layerId,resultId,coordinateIds,sourceReferenceId,spaceId,visible,style}`; coordinates are resolved through E2 `getResultViewModel` rather than saved in a second point store.
- `validateResultLayers(layers, options?)` returns canonical reference-only layers. With `{evidence,publicEvidence}` it checks source/result/location ownership, exact source space, unique layer/location IDs and reference existence. Without context it performs shape admission for the project/view codecs; full reference admission still happens in W2 staging. Styles allow only hexadecimal six-digit color, opacity 0..1 and size 1..20. Existing two MiB codec budget remains in force; additional defensive limits are 1,000 layers and 10,000 selected locations per layer.
- `resolveResultLayers(layers,{evidence,publicEvidence})` returns `{layers,markers,unavailable}`. Markers contain layer, result, coordinate and reference identities, plus the actual E2 coordinate and display style. Hidden layers yield no markers. Unavailable entries are `{layerId,coordinateId,reason}` with `unavailable-space` or `source-not-checked`; the layer survives and missing coordinates instead throw validation errors.
- `resultCoordinateOverlayReason(coordinate)` is shared by the resolver and ResultCoordinates button. It extracts the existing exact `MNI152NLin6Asym` + E2 source-check permission; no historical source state is upgraded or review event synthesized by restoration.
- `projectPublicResultLayers(layers,{publicReferenceIds,publicResults,publicEvidence,evidence})` returns `{layers,omitted}`. `publicResults` accepts a canonical E2 bundle or an existing display-model list through E2 `migrateEvidence`; `publicEvidence` explicitly supplies the canonical bundle. Local evidence takes precedence for current resolution, but public projection compares actual references, result records, locations and the E2 display model against their canonical public equivalents. Public paper IDs do not authorize local results or changed records. Eligible IDs are rewritten to `public-layer-1`, etc. A collision/changed coordinate/source/result fails closed with `omitted:['resultLayers']`.
- `encodeView(input,{publicReferenceIds,publicResults,publicEvidence,evidence})` now writes `neuroatlas-view-v2` and applies that projection. The optional evidence contexts are the coordinator-approved extension needed to detect equal-ID/different-content local overrides without storing duplicate coordinates. `decodeView` and `readSavedViews` keep v1 compatibility with empty layers. Projects retain their v2 schema and full local stable layer references.

## Integration and files

- Added `src/lib/result-layers.js` and `src/lib/result-layers.test.mjs`.
- Updated `src/lib/workspace-project.js` and its test: v2 views, safe public projection, full project layer identity/visibility, legacy empty layers and bounded layer JSON.
- Narrow approved integration in `src/lib/workspace-session.js` and its test replaces the old independent layer-reference loop with the canonical validator. Staging/open/merge validate before publication; existing W2 remapping remains authoritative. Startup envelope reads validate result references before returning to React. Existing W3 saved-computation codec and both `roiSnapshot`/`recomputedSnapshot` are retained without replacement.
- `src/App.jsx`: sole layer authority is `workspaceSession.getSnapshot().view.resultLayers` (React subscribes to that same snapshot). `studyMarkers` is derived, with no setter or second layer store. Opening a result or switching paper no longer clears explicit layers. Named/shared restore resolves and stages before storage/UI mutation; project restore consumes its already committed view. Share uses explicit current and canonical public evidence, explains omitted local result layers, and public-link restoration rejects collisions with local evidence before mutation. `knownWorkspaceEvidence` now carries full canonical curated E2 evidence rather than reconstructing it from display models.
- `src/components/ResultCoordinates.jsx`: basic save-layer action for the selected reported space; unresolved/unknown-space results can be retained without a main-brain overlay. X4 list/hide/remove UI remains its separate task.
- Root-authorized narrow `src/components/WorkspaceFiles.jsx` change awaits named-view restoration and closes only after success. A failed restore retains the dialog, unfinished view-name input and storage.
- Root-authorized narrow `src/components/BrainScene.jsx` change honors opacity (including 0) and size 1..20 for derived markers, retaining default color/opacity/radius behavior and the existing scene eligibility check.
- Added `tests/e2e/result-layers.spec.mjs`: isolated synthetic two-point plus hidden-layer project/named-view restore; source identity and position equality; project download/open round trip; private contents excluded from decoded public JSON; missing-coordinate named-view failure preserves dialog/input/storage; bundled public layer restoration uses neutral identity and retains unavailable frame.

## Verification evidence

1. Initial RED: `node --test src/lib/result-layers.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs` failed because the new result-layers module did not exist. Existing session tests passed.
2. An initial synthetic reference omitted its required URL; corrected the fixture (not production validation). Targeted run then passed 43/43.
3. Full public/local project round-trip and style/ownership cases expanded targeted coverage to 44/44 PASS.
4. `npm run check`: PASS, data/hash checks and literature validation passed; 208/208 Node tests, no failures. This was run once, after core App/session/component integration.
5. `npm run build`: PASS after component integration and again after the explicitly authorized BrainScene style integration. Existing warnings remain for the static/dynamic volume import and bundle chunks over 500 kB.
6. Final review found the new shape validator had bypassed the pre-existing two MiB codec budget. Added `layer serialization retains the existing two MiB view payload budget`; observed RED (`Missing expected exception`), restored bounded JSON admission, and re-ran the requested targeted suite: 45/45 PASS. Full data/hash suite was not blindly repeated after this narrow budget correction.
7. `node --check tests/e2e/result-layers.spec.mjs`: PASS after all three authored scenarios.
8. `git diff --check`: PASS (Git emitted only CRLF-to-LF working-copy notices for App and WorkspaceFiles).

## Rulings and limits

- Ruling: preserve one canonical W2 layer store and make view restoration asynchronous — staging/capacity/storage failures must precede UI changes; a second React layer store would diverge. Root approved the corresponding one-handler WorkspaceFiles change.
- Ruling: explicit local/public evidence contexts extend the proposed public serializer options — stable references alone cannot detect local equal-ID/different-content collisions. Root approved fail-closed canonical comparison.
- Ruling: preserve existing coordinate eligibility as one helper — no separate spatial-policy module exists in this checkout for these evidence coordinates; exact frame plus actual E2 source-check state is retained, never manufactured. Root approved this extraction.
- Ruling: keep unavailable-space reasons distinct from missing-coordinate errors — the former preserves the layer; the latter rejects staging.
- Ruling: honor W5 style in the scene with a narrow approved change — storing an allowed size of 20 or opacity of 0 while rendering the old 8/opaque default would fail display restoration.
- Browser tests were authored and syntax-checked only. No `npm run test:e2e`, Playwright browser, localhost upload, CI or desktop browser action was run. An earlier synthetic upload denial and pending permission path remain the coordinator's responsibility; this report is not browser acceptance.
- X4 list/hide/remove UI and W6 historic-result presentation/recompute UI remain separate. The module already returns canonical layers and unavailable reasons for that integration.
- Author performed source self-review; root owns independent task review, all commits and actual CUA verification.

## Fix round 1 — named-view project ownership (base `b6f50ed`)

Read `.superpowers/sdd/README/W5-review.md`. Accepted its Important finding: the global named-view list passed only `s.view`, permitting A's stable references to resolve against independent project B records with the same IDs and different coordinates.

Changes (unstaged, root remains sole committer):

- `WorkspaceFiles.jsx` now saves `projectId` in the named-view envelope and passes the entire saved entry to its restore callback. Existing read/write codecs retain that metadata without guessing an owner for historical entries.
- `validateViewState(input,{savedProjectId,projectId}={})` adds the named-view origin gate. When a current project context is supplied, a layer-bearing v2 named view requires the same saved project ID. Foreign or unknown origin throws `named-view-project-mismatch` before any reference lookup, staging or storage write. Legacy v1 views still migrate to empty layers; empty layer views remain portable.
- `App.jsx` introduces `restoreNamedWorkspaceView`, which supplies saved and current ownership to that gate before calling the existing async restore function. The separate canonical-public URL restoration path does not use named-view ownership and remains portable.
- There is no fallback that classifies unknown-origin historical named views as public merely because current public IDs match. An unknown-origin layer-bearing named view is refused even when its IDs currently correspond to canonical public records.
- Existing await/error handling retains the save dialog, unfinished view-name input and current project/storage on refusal.

Observed verification:

1. Added focused tests, then ran `node --test --test-name-pattern="named view" src/lib/workspace-session.test.mjs src/lib/workspace-project.test.mjs` before production changes: **RED**, two failures (`Missing expected exception`, `Missing expected rejection`). The session regression saved A's layer under paper/result/point, created independent B with point `[99,2,3]`, and observed the old path accepting the restore instead of refusing it.
2. Applied the ownership gate and envelope integration, then ran `node --test src/lib/result-layers.test.mjs src/lib/workspace-project.test.mjs src/lib/workspace-session.test.mjs`: **GREEN, 47/47**. Coverage checks foreign/unknown origin refusal, unchanged B storage and snapshot, same-project admission, unknown-origin IDs matching public records still refused, legacy v1 empty-layer compatibility, and separate public URL round trips.
3. `npm run build`: **PASS**, run once in this fix round; same pre-existing volume-import and chunk-size warnings.
4. `node --check tests/e2e/result-layers.spec.mjs` and `git diff --check`: **PASS**, only CRLF-to-LF notices.

Authored e2e adjustments: assert saved origin, retain same-project missing-coordinate error coverage, add A→B reused-ID and unknown-origin named-view refusal with dialog/input/storage preservation, and make the canonical public URL case restore into a different project to exercise portability. These four browser scenarios remain **unrun**; no browser/upload/CI action was attempted and no full suite was repeated.
