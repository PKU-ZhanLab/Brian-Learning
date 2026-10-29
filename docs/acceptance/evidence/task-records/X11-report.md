# X11 — canonical versioned public result entry and static pages

Implementation base: `3f2325643b60698727008e46d81294d6d8bc106f` in `F:/project/brain-model/.worktrees/research-20261029`. Consumes reviewed E6 `1a773a1` and reviewed X10 through the base commit. Root is sole committer. Implementation and available non-browser verification are complete; independent review, actual browser acceptance and publication remain separate gates.

## Changes and boundaries

- `main.jsx` resolves public routing before importing or mounting `App.jsx`. Public, invalid and omitted-version redirect states never mount private workspace hooks. Normal workspace startup dynamically imports the existing App without changing its code. A startup error boundary provides a readable bilingual reload button if that split module fails; it does not clear or rewrite saved work.
- `parsePublicResultRoute(search)` returns null only for links without a result parameter, returns `{resultId,dataVersion}` with null for an actually omitted version, and throws for malformed public input. Result/version/language duplicates, empty versions, malformed percent encoding/UTF-8, unsupported languages and oversized public queries are rejected. A bounded name scan precedes value decoding; long workspace-only view links retain workspace routing. Only the E6 canonical getter admits result/version identities.
- `resolvePublicResultRoute` yields fixed result, explicit redirect, or unavailable. Only actual version omission may select the registered latest, then `location.replace` goes to a fully versioned address before any result is displayed. Explicit old versions keep their old content hashes. Unknown/private/free-text/image identifiers never fall through to workspace or private evidence. Supported English unavailable pages retain English. Canonical public links contain only result, exact version and optional supported language; extra query text and fragments are removed. Return-to-workspace links use the configured base and do not delete storage.
- The standalone E6 result view keeps its existing canonical source/statistics/space/review/export behavior, adds a top-level heading, original citation, exact version navigation and language-preserving correction links. Existing embedded use remains a section with its previous heading level. No editable/private bundle is an input.
- `build-result-pages.mjs` enumerates only E6's canonical publication registry and uses its trusted record, source-detail, correction and public-export getters. It generates semantic, escaped, script-free bilingual pages with finding, citation, exact data/content/snapshot identity, source locations/rights, original independent spatial limits, review scopes, limitations and correction navigation. No images, article full text, local paths, external font/CDN assets or private input are accepted. Static pages link to the interactive exact-version entry.
- Default build base is `/Brian-Learning/`. Paths are `results/<resultId>/<dataVersion>/index.html` and `index.en.html`; bilingual directories are `results/index.html` and `results/index.en.html`. `results/manifest.json` lists each record's exact file, language, result/version, content hash, source-snapshot hash and generated HTML SHA-256, plus directory hashes. Output has no timestamp and is deterministic for the same canonical input/correction chain. Later current-chain additions may change landing HTML/page hashes; E6 fixed record and snapshot identities remain unchanged and pages explain that distinction.
- `index.html` has a base-aware no-script directory entry. The remote Google Fonts stylesheet was removed so public entry documents do not request that external asset; existing system-font fallbacks remain.
- Build integration generates pages after public data packaging. Existing source packaging already copies all scripts/src plus E6's explicit canonical inputs; a fresh package was exercised without changing its whitelist. Root G1 retains responsibility for the 4.2.0 version change and release packaging.
- Root approved the bounded dedicated public-page test config and CI plumbing. The ordinary suite excludes the generated-page spec; its dedicated config checks the actual built Pages base with a fresh isolated preview and storage context, no reused user server/profile. CI builds public output then runs that dedicated suite and uploads separate evidence folders. No CI push was attempted; workflow-scope permission remains root's separate gate.

## RED → GREEN and verification

1. `node --test src/lib/public-result-route.test.mjs`: initial RED at missing route implementation (`ERR_MODULE_NOT_FOUND`). Route/static behavior then passed 4/4.
2. Author self-review found the initial implementation allocated `URLSearchParams` before checking the public-query size. The new oversized-input regression was observed RED: 4 pass/1 fail, 3 oversized decodes versus expected 0. The bounded name scan now rejects oversized public values before decoding while retaining long workspace-only links. Final focused route/static suite: **5/5**. Its generator tests check all 16 pages, canonical/base paths, semantic headings/citations/navigation, original space limits, identities, no script/image/iframe/private/local/CDN material, HTML escaping, complete internal generated link targets, SHA-256 and deterministic rebuilds.
3. `npm run check`: initial integration **409/409**; final after the bounded-parser regression/fix **410/410**. Data and literature validation passed: 118 references, 115 reading records, four results, original eight `MNI-unspecified` coordinates. No new spatial authority or human review is claimed.
4. `npm run build:public`: final success; **174 hashed data assets**, **36 official-source descriptors**, **16 fixed language/version pages** plus two directories and manifest. A first build identified an introduced inconsistent JSON import-attribute warning; the component import was corrected. Final build has no such warning. Existing `volume.js` static/dynamic import and >500 kB chunk warnings remain. Public root bundle is about 1.84 MB uncompressed (253 kB gzip); performance/rendered acceptance is unverified. Builds were refreshed only after material final changes/self-review, not treated as browser acceptance.
5. `node scripts/public-package.mjs output/x11-source-package`: success with existing source-package rules. In that fresh package, `node --test src/lib/public-result-route.test.mjs src/lib/result-publication.test.mjs`: final **14/14**. This exercises the generator and canonical record/source/export closure without original output/raw-source caches. `node scripts/build-result-pages.mjs output/x11-portable-pages` in the package also successfully generated 16 pages (before the final parser-only refinement; final package tests regenerate pages using the final parser).
6. A read-only Node check of actual final `dist-public` verified SHA-256 for **16 record pages + 2 directory pages**, the `/Brian-Learning/results/` no-script entry, no eager `App-` module preload in the built root HTML and byte-identical packaged E6 snapshots. No server or browser was launched for this check.
7. `npm run test:e2e -- --list`: **137 tests in 20 files**; excludes the public-build spec. `npm run test:e2e -- --config tests/e2e/public-result-page.config.mjs --list`: final **13 tests in one file**. Dedicated authored cases cover fixed direct-open/refresh and hashes, query/fragment cleanup, language/base, blocked private storage/startup, omitted-version replacement, empty/unknown/duplicate/private/untrusted routes, script-free generated pages/corrections/language/version navigation, actual private note persistence across return, App-chunk failure/reload and long-record scrolling at 390 px. Discovery only: none of these browser cases were executed.
8. `git diff --check`: clean. E6 snapshot SHA-256 remains `7a87e8cb8af331d0f1830793217e0db1ee0e9e5b68422ac4eeea7c1d31c08bce` for `2026-10-29.2`, and `234a04a803e9dfcb2dfd38f33bc7fc247ba3cd14e9c0245f14d6c165c051e208` for `2026-10-30.1`. No snapshot/registry/source-authority edits were made.

## Exact changed files

Tracked/new implementation files relative to this checkout:

- `.github/workflows/research-ci.yml`
- `index.html`
- `playwright.config.mjs`
- `scripts/build-public.mjs`
- `scripts/build-result-pages.mjs` (new)
- `src/components/ResultRecordPage.css`
- `src/components/ResultRecordPage.jsx`
- `src/lib/public-result-route.js` (new)
- `src/lib/public-result-route.test.mjs` (new)
- `src/main.jsx`
- `tests/e2e/public-result-page.config.mjs` (new)
- `tests/e2e/public-result-page.spec.mjs` (new)

This ignored task report is `.superpowers/sdd/README/X11-report.md`. Generated/ignored outputs include `dist-public/`, `output/x11-source-package/`, the package's portable-page output and discovery report folders. No other source files were changed; in particular `App.jsx`, `DialogHost`, private workspace/history/draft implementations and E6 immutable publications were preserved.

## Remaining gates

- Root's independent implementation review and commit.
- Permitted isolated CI execution of both browser suites. Same-turn native URL guard remains respected: no browser, desktop, Playwright test execution, alternate automation route or server run occurred here. Listing tests, Node/build success and escaped HTML checks do not establish rendered, keyboard, mobile, 200% zoom, assistive, private-storage-isolation or refresh acceptance.
- Actual final release/version bump, workflow permission, publication, live Pages HTTP/hash verification and rollback receipts belong to G1. Registry continues `prepared-local-not-deployed`; generated files do not establish deployment.
- E6's scientific provenance limits, original unknown precise MNI frames, pending human review and source→exact-template→ROI/image scientific closure remain unchanged.

No installs, Python, subagents, commits, pushes, deployment or destructive cleanup occurred. Worktree and generated evidence are preserved for root.
