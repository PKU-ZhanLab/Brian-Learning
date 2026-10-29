# G0 report

Status: implementation complete within the assigned host boundary; root desktop CUA baseline passed. Authored automated browser suite remains pending CI execution. No commit created; root is sole committer.

## Changes

- `src/lib/research-contracts.js`: single JS/JSDoc definition for Hemisphere (L/R/M/B/U), AtlasRegionRef, AssetIdentity (nullable unknown space), QueryContext, GridSpec, TransformIdentity, ComputationThreshold, ComputationManifest, ResultLayerStyle, ResultLayer and bounded DraftRecord. Documentation only, no runtime behavior or TS dependency.
- `tests/fixtures/audit-20261029/`: sixteen historical text audit inputs copied without byte changes; SHA-256/source-path manifest; ten copied-plan hashes; actual five-label subset; lossless seven-voxel sparse AAL3 label 134 input with original source/target grids; live root/source comparison; README distinguishes historical faulty observations from future correct-behavior regressions.
- `playwright.config.mjs`, `tests/e2e/baseline.spec.mjs`: isolated Chromium contexts and private fixed-origin server, no existing-server reuse, zh/en page shell/navigation/data loading assertions, no user browser/profile attachment.
- `package.json`, `package-lock.json`: exact npm-registry development dependency `@playwright/test@1.64.1` and sole browser suite entry `npm run test:e2e -- <test-path>`. Transitive playwright and playwright-core are also 1.64.1. No global install or browser download on this host.
- `.github/workflows/research-ci.yml`: Ubuntu 24.04/Node 24.15.0, locked dependencies, code/data checks, build, matching Chromium installation and browser suite in CI; failure artifacts retained.
- `docs/IMPLEMENTATION_BASELINE.md`: scope, real revisions/differences, preservation, failures and validation boundaries.

## Actual validation

| Check | Result | Full local evidence |
|---|---|---|
| Primary source status/HEAD/worktrees | Clean main...origin/main; HEAD ca00c0928b0c7b62c662636cddf3a8d1da374a15; execution worktree on authorized branch | Tool output in G0 turn; baseline document |
| Root vs deployed source comparison | 85 shared code/config files matched; two non-cache root-only files | `output/g0-baseline.json`, tracked `tests/fixtures/audit-20261029/root-source-comparison.json` |
| npm registry exact dependency install | Added 3 project dev packages; zero audit vulnerabilities reported | Tool output; lockfile integrity/resolved metadata |
| `npm run check` | 65 tests passed, 0 failed | `output/g0-check.log` |
| `npm run build` | Exit 0; 1615 modules transformed; existing >500 kB chunk warning | `output/g0-build.log` |
| `npm run test:e2e -- --list` (after final harness edit) | 2 tests discovered in 1 file, no browser launched | `output/g0-browser-discovery.log` |
| Root desktop CUA baseline | Passed at isolated origin `http://127.0.0.1:4190/`: model loaded, loading indicator hidden, console errors `[]`, switched zh→en; Anatomy/Evidence library/ROI comparison and atlas options visible | Root's CUA tool evidence; `output/g0-browser-zh.png`; root server session 35136 |
| Original/copied fixture hashes | 16 audit originals/copies, 10 plan originals/copies and 3 derived files verified | `output/g0-fixture-verification.log` |
| Syntax | `node --check` contracts/config/browser spec passed | Tool output |
| Dependency tree | @playwright/test/playwright/playwright-core all 1.64.1 | Tool output |
| `git diff --check` | Passed | Tool output |

## Rulings and limits

- The brief explicitly prohibits running browser CLI interaction on this host. The e2e cases are authored and discoverable only; they have not passed a browser run. The CI workflow is authored but not dispatched by G0. Root separately verified the desktop CUA baseline on a new isolated origin; this is actual UI evidence but does not replace execution of the automated suite.
- G0 adds documentation and test configuration only, so there is no new production behavior requiring a RED→GREEN product test. No static implementation-mirroring assertions were added merely to test typedef prose. Future runtime modules must exercise correct behavior independently.
- Live `public/data/manifest.json` differs between root and source in seven distribution/license metadata paths. `asset-checksums.json` differs in 58 paths, including retained legacy/private assets, public license filenames and recorded hashes. Checkout matches deployed source, not the material-root checksum list. No original data were modified or synchronized.
- `output/` is ignored. The checkout's audit copy makes original plan links reachable locally; tracked fixture copies preserve all sixteen text materials for clones. Original screenshots are preserved externally and locally but are not duplicated into minimum regression fixtures.
- Preserved audit scripts keep original paths and old incorrect-behavior expectations. They were not executed or rewritten. Existing all-green checks do not resolve their findings.
- No UI copy changed, no Python used, no system browser installed, no external publish/push, no user storage opened.
- No anatomical human certification or exhaustive interaction/accessibility acceptance occurred in G0.

Suggested root commit: `test: establish research workflow regression baseline`.

## Preservation fix round 1 — S1/Q1 and S2/Q2

Base: `f6bdc85ba00a80703dc460bc8299cd2f6a110076`. Review findings were reproduced by reading raw Git blobs for every manifest entry. The original hashes in `manifest.json` were not changed.

- Added scoped `.gitattributes` `-text` rules for `tests/fixtures/audit-20261029/**` and `docs/superpowers/plans/2026-10-29-neuroatlas/**`; re-staged original bytes. This restores the original CRLF bytes in `preserved/anatomy-probes.json`, `preserved/engineering-probes.mjs`, and `01-spatial.md` instead of recording normalized substitutes.
- Added only two `.gitignore` exceptions for `tests/fixtures/audit-20261029/preserved/build.log` and `check.log`; both historical logs are staged with their declared bytes and hashes.
- Updated the baseline document to distinguish working-copy validation from portable Git-blob validation. No production code, browser suite, scientific data or original inputs changed.

Covering validator: `.superpowers/sdd/README/G0-verify-preservation.mjs` (local report artifact). It reads the manifest itself from the selected Git tree/index, fetches each declared entry through `git show` as an unmodified Buffer, computes SHA-256, checks every declared audit byte count, and verifies original audit/plan files still match. It never normalizes newline bytes. Git's index was staged explicitly with the scoped changes only; root retains sole commit responsibility.

Commands and actual output:

```text
node .superpowers/sdd/README/G0-verify-preservation.mjs f6bdc85ba00a80703dc460bc8299cd2f6a110076
Git blob verification (f6bdc85ba00a80703dc460bc8299cd2f6a110076): 24/29 passed; 5 failures.
```

The five failures were exactly the three normalized files plus two missing logs reported by review. Full output: `output/g0-preservation-before.log`.

```text
node .superpowers/sdd/README/G0-verify-preservation.mjs
Git blob verification (:): 29/29 passed; 0 failures.
```

Full per-file hashes and byte counts: `output/g0-preservation-staged.log`. This verifies staged blobs, not merely working-tree files. After root commits, the same validator accepts `HEAD` as its argument for independent verification of committed blobs. Broad suites/build/browser were not rerun for this preservation-only fix.
