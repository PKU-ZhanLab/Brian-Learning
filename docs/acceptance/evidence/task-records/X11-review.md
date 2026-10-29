# X11 independent task review

Range: `3f2325643b60698727008e46d81294d6d8bc106f..b73910b22f7b44d49a7ec0bd692682349372ccef`.

## Spec compliance

- ✅ Implementation is spec compliant within the reviewed scope; no blocking missing or unauthorized behavior found. The authorized `src/main.jsx` boundary replaces the originally suggested App edit: routing occurs at line 10, while private App import/mount occurs only at lines 43–44. App itself remains unchanged.
- ⚠️ Acceptance remains incomplete: the 13 dedicated browser cases have only been discovered, not executed. Direct-open/refresh, actual storage isolation, narrow-screen scrolling, no-script browser navigation and App-chunk recovery are authored at `tests/e2e/public-result-page.spec.mjs:16–105`, not demonstrated runtime results. Real human scientific review, desktop/keyboard/200% zoom/assistive acceptance and publication remain separate gates.

## Strengths

- `src/lib/public-result-route.js:18–50`: workspace absence and invalid public input are distinct; only an actually omitted version selects latest and produces a redirect. Explicit empty/unknown/duplicate versions cannot reach a latest-version fallback. Canonical resolution accepts no private bundle. The preliminary bounded-name scan avoids decoding oversized public values while retaining workspace-only links.
- `src/main.jsx:10–17,28–44`: routing precedes lazy App import and private startup; valid URLs lose extra query fields/fragments, and omitted-version routes replace to an explicit version before rendering result content. The lazy import has a bilingual reload boundary without storage deletion.
- `src/lib/public-result-route.js:43–46` and `scripts/build-result-pages.mjs:21–37`: the canonical E6 getter remains content authority. The focused E6 check confirms explicit version membership in `src/lib/result-publication.js:28–39`; old-version record projections are separate from the additive current correction chain. This diff does not modify immutable snapshots.
- `scripts/build-result-pages.mjs:9–17,25–37,40–57`: escaped, script-free pages carry citation, result/version/content identity, source snapshot identity, source locations/rights, original spatial uncertainty and scoped review limits. A manifest records generated file hashes; no browser evidence is an input. `index.html:13` supplies a base-aware no-script discovery entry.
- `src/components/ResultRecordPage.jsx:17–23,35`: standalone headings/citation and exact-version navigation are added while embedded heading behavior is retained; version/correction links preserve English.
- `playwright.config.mjs:10`, `tests/e2e/public-result-page.config.mjs:5–11`, `.github/workflows/research-ci.yml:28–37`: ordinary discovery excludes the built-page file, the dedicated config clears that exclusion and uses the built Pages subpath, and CI orders public build before that suite and includes separate artifacts. These are coherent authored integrations, not a successful CI run.
- `src/lib/public-result-route.test.mjs:12–85`: tests cover canonical old hashes, malformed/private identities, omission versus explicit version, bounded decoding, deterministic output, escaping and internal generated targets. Reported 410 full / 5 focused / 14 portable passes were not rerun.

## Issues

### Critical

None found.

### Important

None found.

### Minor

1. `src/main.jsx:35` and `scripts/build-result-pages.mjs:29`: “All public results” always targets `${base}results/`, whose directory document is Chinese, even when the current record is English. Both language directories already exist (`scripts/build-result-pages.mjs:50–53`). Select `results/index.en.html` for English so users keep their chosen language when discovering other records. This does not affect fixed result identity or privacy.
2. Existing build warnings remain in the implementation evidence: mixed static/dynamic import of `volume.js` and a large bundle warning (`.superpowers/sdd/README/X11-report.md`, verification item 4). No new import-attribute warning remains according to the report. These are not new X11 blockers; the roughly 1.84 MB public entry bundle still needs real loading/performance assessment, and this review makes no performance acceptance claim.

## Focused checks and limits

- Read the brief first, integration context, implementation report and supplied review package; recovered tool-truncated diff portions from that package. No git commands, source/index/HEAD edits, browser/desktop/Playwright execution, server launch, installs or repeated suites were performed.
- Named risk: a seemingly public import could reach private persistence. Checked `result-publication.js` and the directly relevant imports in `evidence-package.js`, `evidence-schema.js`, `evidence-mapping.js` and their static data dependencies. The inspected path uses committed data and pure projections; no private storage call was found. Actual runtime isolation remains unverified.
- Named risk: private-return test assumes URL-selected English and persisted notes. Checked App startup/language handling at `src/App.jsx:102–116,136,416`; explicit `lang=en` is supported. No App changes were made.
- Named risk: imported global CSS could suppress document scrolling outside App. Checked global root/body/app-shell selectors in `src/styles.css:9,12` and the omitted first rule of `ResultRecordPage.css:1`; overflow confinement is on `.app-shell`, not the public root. Rendered scrolling remains unverified.
- Named risk: dedicated config path/base and inherited isolation. Checked the root config tail omitted from its diff hunk, package scripts and Vite base/preview configuration. Existing fresh storage and `reuseExistingServer:false` are inherited; the dedicated server points to `dist-public` and `/Brian-Learning/`. An optional lookup of local Playwright internal source paths found those paths absent; no inferred runtime success is claimed from that lookup.
- Canonical citation author strings were checked in the fixed 2026-10-29.2 snapshot; no source or publication files were changed. Existing E6 scientific/human-review limitations remain in force.

## Assessment

**Task quality: Approved with minor follow-up.** The implementation keeps the public identity boundary separate from private workspace startup and provides a deterministic static publication path. This is approval of the reviewed code, not completed browser acceptance, human certification, CI execution or release approval; G1 retains version 4.2, packaging, publication and live verification.
