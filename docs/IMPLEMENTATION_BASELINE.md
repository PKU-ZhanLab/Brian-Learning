# Implementation baseline — 2026-10-29

Implementation uses `F:/project/brain-model/.worktrees/research-20261029`, branch `codex/research-workspace-20261029`, based on `ca00c0928b0c7b62c662636cddf3a8d1da374a15` (v4.1.0). The primary `.deployment/source` was clean on `main...origin/main` when checked; its HEAD matched the planned revision. The original working material root is not a Git repository. No product UI or scientific asset changed in G0.

## Preserved inputs

Original plans: `F:/project/brain-model/docs/superpowers/plans/2026-10-29-neuroatlas/`. All ten plan files were copied to this checkout and matched by SHA-256. Original audit: `F:/project/brain-model/output/audit-20261029/`. All sixteen text reports, probes, recorded JSON outputs and check/build logs were copied byte-for-byte to [tracked fixtures](../tests/fixtures/audit-20261029/README.md). Four original screenshots remain in the original audit and its checkout copy. Raw images, native T1, downloads and original audit outputs were not modified.

The [fixture manifest](../tests/fixtures/audit-20261029/manifest.json) records original paths, copied paths and SHA-256. The checkout's `output/audit-20261029/` keeps the plan's original relative source links reachable locally. `output/` is ignored by Git; use the tracked fixture copies when reading a clone without that local audit copy. Historical scripts retain their original byte content and paths; they must not be run in place to overwrite historical outputs.

Live comparison covered 85 shared `src/`, `scripts/` and root configuration files; none differed. The material root additionally has `src/i18n/ui-strings.json` and `scripts/integrate-workspace.mjs` (Python caches excluded). The root and deployed source have different `public/data/manifest.json` and `asset-checksums.json`: the deployed manifest adds distribution/license metadata and the deployed checksum list excludes retained private/legacy assets and uses publication-safe license filenames. The surface manifest and volume grid match. These differences remain preserved; implementation starts from the deployed source. [Comparison details and hashes](../tests/fixtures/audit-20261029/root-source-comparison.json).

| Input | Checkout/deployed SHA-256 |
|---|---|
| `public/data/manifest.json` | `25b9a2584a8db5849ca95b118321ed233731cf88673756018365a27d2bbd44d5` |
| `public/data/surface-v1/manifest.json` | `c9529c36628593442dcb5c416da6351748d3a9379e5a295a9bf0f1b6606391c6` |
| `public/data/asset-checksums.json` | `a1a85f03d04ffcb398331fdd959c0a211fa1833cdcc59d9f642a492965db908c` |
| `public/data/volume.json` | `f8942cfef8a973f7764b66cfc7ddcd10a01acf1ac48f25a64737225b95f18b66` |

## Known failing behavior

The preserved audits report wrong tissue/name-based atlas associations, inaccessible actual labels, seven source voxels of AAL3 label 134 lost on the coarse target grid, stale-query risks, import mutation before failure, project assets leaking into later exports, inconsistent label-table limits, evidence semantics and search gaps, and keyboard/layout risks. The precise observations, source hashes and confidence boundaries remain in the original reports and [preserved text copies](../tests/fixtures/audit-20261029/preserved/REVIEW.zh-CN.md).

The engineering reproduction recorded an invalid project import reducing existing evidence references from one to zero and replacing notes before throwing; opening project B re-exported project A's volume; an accepted 2001-character label then prevented project export. These are baseline failures, not assertions that future code should retain. New regressions must assert correct behavior separately.

## Shared contracts

[research-contracts.js](../src/lib/research-contracts.js) is the JS/JSDoc source for `AtlasRegionRef`, `AssetIdentity`, `QueryContext`, `GridSpec`, `ComputationManifest`, `ResultLayer` and `DraftRecord`. Hemisphere is exactly L/R/M/B/U. Unknown asset space remains null. Computation input/transform/A–B order is significant. Drafts are restricted to 30 records, 50,000 UTF-8 bytes per payload, and 1 MiB for the entire JSON collection; overflow must remain unsaved without truncation. Owner modules supply runtime validation. No TypeScript toolchain was added.

## Verification entry points

`npm run check` checks data, literature and Node regressions. `npm run build` builds the existing Vite application. `npm run test:e2e -- <test-path>` is the sole browser suite entry, with exact project dependency `@playwright/test@1.64.1` and a lockfile. No global runner or system browser was installed. No Python was used.

The browser configuration creates fresh test contexts, uses a fixed loopback server on port 4179, refuses to reuse an existing server, and never connects to a user's profile. The CI workflow uses Ubuntu 24.04, Node 24.15.0, `npm ci`, and the pinned runner's matching Chromium. It can retain failure traces and screenshots as CI artifacts. This host may enumerate tests with `npm run test:e2e -- --list`; actual desktop interactions use CUA. CI results and desktop CUA observations must be recorded when they occur.

| Command, this checkout | Actual result | Local log |
|---|---|---|
| `npm run check` | 65 tests passed; zero failed | `output/g0-check.log` |
| `npm run build` | Passed; existing large-chunk warning | `output/g0-build.log` |
| `npm run test:e2e -- --list` | Two zh/en page-load tests discovered; no browser launched | `output/g0-browser-discovery.log` |
| Actual isolated browser suite | Not run on this desktop; CI authored but not executed here | Pending CI evidence |
| Root desktop CUA baseline | Passed at new isolated origin `http://127.0.0.1:4190/`; model loaded, no console errors, zh→en switch and atlas/navigation options observed | Root's CUA evidence; `output/g0-browser-zh.png` |

Passing the original 65 tests establishes a code baseline. It does not resolve the audit findings or certify anatomical accuracy, accessibility, interaction completion, human review, or the two newly authored browser tests.
