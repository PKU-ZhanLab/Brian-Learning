# W6 actual desktop history acceptance

Pinned source `a30cc08c33d449db65d85c031a1c5b63693411ff`, built in `output/cua-history-a30cc08`. Vite serves localhost:4206; a passive HTTP-only proxy at localhost:4207 records requests with no-store responses and no injected faults. Root used CUA normal UI and the user's authorized local test-file chooser. The proxy does not automate or inject browser/application state.

## Passed

- Opened the actual earlier W3 export containing registered AAL3 label 134 on both sides at 1 mm. Before current source data finished loading, the saved 7/7 voxels and Dice=1 were already inspectable. Once identities loaded, the UI reported a match. The fresh-origin HTTP log contains zero ROI-worker script requests before any explicit recompute.
- Changed the current grid to 2 mm. The UI retained historical values and listed six precise target-grid differences (three dimensions, three affine diagonal values). It did not silently replace the saved result.
- Explicitly chose recompute, read the source-label loss warning, and confirmed it. The recomputed result has zero voxels, missing ratios shown as dashes and the sampling-loss warning. The UI identifies it as the recomputed result with matching current settings.
- Chose Inspect original saved ROI result. The original 1 mm grid, 7/7 voxels and Dice=1 returned, while the current controls remained at 2 mm and the difference list stayed explicit.
- Exported the full project. The original snapshot is deeply equal to the earlier W3 snapshot, including every stored class byte, all numerical values, original ID and manifest. The new result has a distinct computation UUID, a 91×109×91 grid, zero counts and null undefined ratios. The stored view selects the original slot while retaining current 2 mm settings.
- Reopened that actual downloaded project and exported it again. Both snapshots/IDs and every other decoded project field are exact except the camera's position vector, whose maximum absolute floating-point drift is 2.8421709430404007e-13 (below the recorded 1e-9 camera tolerance). Target, zoom and other camera fields remain exact. The original slot is visibly selected after reopen.
- The passive HTTP log records one ROI-worker script fetch after the explicit computation and no additional worker fetch during reopen. This network observation complements the no-resampling source/unit checks; it is not presented as instrumentation of every worker message. Browser warning/error logs were empty.

## Evidence and remaining checks

`output/w6-cua/receipt.json`, `restore-network-receipt.json`, `before-reopen.json`, HTTP events, captured UI text/screenshots and actual downloaded projects record the assertions. Originals remain in Downloads as (17) and (18). The initial exact-all-fields comparison correctly caught the tiny camera-vector floating-point difference; only camera position uses tolerance, never scientific grids, values, identities or snapshot bytes.

## Local NIfTI, removed input and legacy acceptance

These three scenarios were subsequently completed on the same pinned build with normal CUA file/UI operations. Evidence is in `output/w6-cua/local-legacy-receipt.json`; actual Downloads (19)–(22) and retained copies are hashed there.

- Imported a generated 360-byte binary-mask NIfTI whose metre-unit sform decodes to exactly `1.0000000474974513` mm. The synthetic provenance explicitly says this is a software fixture, not anatomical validation. The actual exported project's geometry and voxels match the decoded source exactly, and its recorded source identity matches the original file hash.
- Opened that export. All volume fields remain exact, and the page reports matching inputs. Explicit recomputation preserves the original snapshot byte-for-byte, creates a new computation ID, and reproduces the same manifest and metrics. Both outcomes are 1 target voxel / 8 mm³ / Dice=1.
- Removed the synthetic input through the dependency preview. Both complete snapshots, class arrays, IDs, manifests and numbers survive exactly apart from the intended missing-input status and missing-asset list. Reopening the actual download still permits inspection of both results and disables recomputation until inputs are supplied.
- Opened a synthetic v1 project carrying only `computed:true`, with no numerical snapshot. The UI states that no historical numerical result was saved and exposes no numerical-export or snapshot-inspection controls. Its actual re-export has two null snapshot slots, missing-provenance status and `computed:false`; no history was fabricated.
- Browser warning/error logs remain empty. Final X/G1 integration remains separate. Genuine domain human review remains pending by the user's explicit choice.
