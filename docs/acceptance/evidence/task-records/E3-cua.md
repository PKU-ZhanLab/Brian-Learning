# E3 desktop acceptance — 2026-10-29

Root tested the actual fresh source package at `output/e3-package-fix1/green-source`, served at localhost:4203. Its 99 source/build inputs match the canonical Git blobs at `45e35ac`; receipt E3-package-source-commit.json records every comparison. Later `0842373` changes only packaging ignore semantics and its regression, with no client/search/source-data changes.

## Actual UI results

- The old pinned 5ef95be baseline returned zero matches for both pre-SMA and BA44 with unrestricted filters. Those DOM records and screenshot remain in `output/e3-cua/baseline-*`.
- All six required queries were entered in English and Chinese: pre-SMA, pre SMA, BA44, BA44/45, 停止, inhibitory. Each included Schaum; both languages returned exactly the same complete reference-ID sets, equal to the separately evaluated production index. Changing language with inhibitory already entered preserved both query text and IDs. See observed-45e35ac.json, expected-2644ab3.json and acceptance-receipt.json.
- With pre-SMA + control + paper method fMRI, Schaum remained the single hit. The actual detail displayed paper MEG/fMRI and recorded-result MEG separately; the Schaum result's method tag remained MEG (脑磁图 in Chinese).
- Selecting recorded-result fMRI removed Schaum; selecting recorded-result MEG restored it. Changing back to English preserved query, control topic, paper fMRI and result MEG separately.
- An actual project download retained `paperModality:fMRI`, `resultModality:MEG`, and legacy `modality:fMRI`. Parsing that downloaded artifact with the packaged project codec preserved the same values. No browser file import was attempted.
- Actual Tab presses moved from search to topic, paper methods, then recorded-result methods. All three controls expose the expected accessible labels. The inspected page had no captured error/warning console messages.

## Source and scope

Root independently re-read the publisher's [Version of Record](https://elifesciences.org/articles/61679): its Methods has separate fMRI and MEG experiment subsections. This supports the paper-level two-method record; it does not relabel the existing MEG table result, establish NLin6Asym for its coordinates, or count as human certification. E4 still owns complete field-level source-artifact audit.

All UI receipts, DOM text, screenshots and actual downloaded copies are in `output/e3-cua/`. The real missingness-state rendering is covered by the worker's React SSR regression, not a fabricated desktop import. The fresh source-package build and isolated Git inclusion tests are separately recorded in E3-report.md and its logs.

Actual project-file reopen, narrow-screen/200% layout and the authored isolated CI browser suite remain later integration gates. The prior browser file-upload denial remains respected; no alternate import route was used.
