# E5 implementation report

Status: implementation and automated verification complete; desktop CUA and independent review owned by root remain pending. Edits are unstaged. No commit, push, deployment, dependency installation or browser execution was performed by this worker.

Base: `281ec2372b46b1e5cf5288ea035cbf944a833f14`.

## Implementation

- Added `evidence-package.js` with authoritative canonical public bundle construction, faithful existing v1 reading migration, independent reading-card reconstruction, selected-paper closure export and independent validation.
- `buildEvidencePackage({paperIds,bundle,includePrivate=false})` selects committed canonical contents for public mode; caller flags and same-ID overrides never confer public status. Local file mode explicitly opts into selected private evidence. Top-level arbitrary data, notes, image payloads, package-wide migration snapshots and unreferenced source rows are omitted. Cross-paper relations omitted by selection carry exclusion reasons without a dangling endpoint.
- Reading-only Kanwisher output has one reference, one reading, one reading claim, two original mappings, zero structured results/locations; bilingual summary/limitations/method provenance, source URL, support/species/side and version survive JSON round trips. Concept links retain null atlas identity.
- UI `allEvidence` now includes the canonical reading graph. Cards consume imported readings/claims/mappings, including a synthetic non-built-in ID, through the same adapter. Single-paper and filtered-set file export use one builder. The filtered list action exports its current matching papers. File import uses `validateEvidenceImport` (pure v1 migration then independent closure validation) before the existing merge/save transaction.
- Selected source edges, including historical events, retain exact approved source versions. Nonapproved/restricted source content becomes a resolvable `source-reference-v1` stub with omitted-content/offline-unavailable limitations; original hashes explicitly identify absent originals, never stub bytes.
- Root authorized narrow E4/E5 reconciliation in `evidence-schema.js`/test and `source-artifact.js`/test: optional validated `referenceAliases` preserve the immutable source record while active DOI-deduplicated edges use canonical paper IDs. Alias snapshots require valid bibliography, normalized DOI agreement, one existing target, no duplicate/conflicting/cyclic/chain bindings, and no alias row in visible bibliography. Required aliases survive selected export/import; removal cleans associated aliases/artifacts.
- E4 auditing resolves old reference paths against current canonical metadata, records canonical coverage and cannot silently skip author/URL/DOI differences. Title changes are flagged against the historical bibliography snapshot, explicitly distinguished from primary-source title-cell checking.
- Schema documentation updated; isolated CI e2e authored for actual single-paper download, renamed non-built-in reading import/card display/re-export. No desktop browser was driven from shell.

## RED/GREEN evidence

1. `node --test src/lib/evidence-package.test.mjs`
   - Initial RED: 0/5 passed; package-builder API absent (`self-contained package builder must exist`).
   - First implementation: 4/5 passed. Remaining fixture had renamed an artifact without updating existing sourceRefs; corrected the fixture to retain its identity while changing restricted content.
   - GREEN after import wiring: 5/5 package cases passed within the 25-test combined run.
2. `node --test src/lib/evidence-package.test.mjs src/lib/evidence-workspace.test.mjs`
   - Import-boundary RED: 24/25 passed; `validateEvidenceImport` absent.
   - GREEN: 25/25 passed after boundary implementation.
3. `node --test src/lib/evidence-package.test.mjs`
   - Additional privacy RED: 6/7 passed; unreferenced same-paper private artifact was selected (`1 !== 0`).
   - Removed ownership-only source selection. GREEN combined package/workspace: 27/27 passed.
4. `node --test src/lib/source-artifact.test.mjs src/lib/evidence-schema.test.mjs`
   - Alias reconciliation RED: 21/23 passed; malformed alias bindings accepted and real artifact referenceId rewritten (`canonical-axelrod` versus `axelrod2015`).
   - Implemented validated aliases, immutable artifact merge and alias-aware semantic audit. Expanded four-file GREEN: 50/50 passed.
5. `node --test --test-name-pattern='real hashed artifact' src/lib/source-artifact.test.mjs`
   - Added title drift case; RED 0/1 because title drift was not surfaced.
   - GREEN 1/1 after explicit historical bibliography title mismatch handling.
   - Real source test also verifies canonical experiment/claim/mapping references, original artifact deep equality, excerpt and record hash verification, independent file import/export, successful offline audit, and changed canonical metadata detection.
6. `node --test --test-name-pattern='removing a canonical' src/lib/evidence-schema.test.mjs`
   - RED 0/1: alias binding remained after canonical paper deletion.
   - Updated dependent artifact/alias removal. Final focused four-file GREEN: 51/51 passed.

## Final verification

- `npm run check`: 254/254 passed, exit 0. Full output: `.superpowers/sdd/README/E5-final-check.log`.
- `npm run build`: exit 0. Full output: `.superpowers/sdd/README/E5-final-build.log`. Existing Vite volume static/dynamic import and >500 kB chunk advisories remain.
- Earlier pre-alias broad checks were 251/251 then 253/253; final repetition was justified by root-authorized schema/audit extension and deletion consistency fix. The final saved logs describe the final implementation.
- `npm run test:e2e -- tests/e2e/evidence.spec.mjs --grep export` was deliberately NOT executed: desktop browser execution is CUA-only and owned by root. The isolated CI test is authored, not accepted as browser evidence.

## Self-review and limits

- Compared the final UI/data flow to E5 baseline failure: export now receives the actual reading graph instead of only metadata/results. Independent validation is done with empty known references/results and no region catalog. Synthetic non-built-in reading proves the adapter does not depend on the legacy dictionary.
- Public selection uses committed content as authority. JSON with caller public flags/private replacements cannot override it. Local export preserves only selected graph records; notes/volumes/unrelated papers are excluded.
- Source closure validity remains separate from rights, unavailable offline material, source semantic agreement, spatial suitability and human review. Original coordinate spaces remain `MNI-unspecified` (8), derived spatial identities stay unchanged, direct coordinate overlays remain zero, human review remains pending.
- Historical fixtures/artifacts and generated literature/result files were not edited. Canonical source records are compared and copied without hash rewriting.
- Independent reviewer and CUA acceptance remain pending. No claim of successful desktop import/export interaction is made here.
- Root should include the four additionally authorized schema/source-artifact files in the eventual commit alongside the seven original E5 files. Report/logs are coordination evidence, not public product documentation.

Whitespace follow-up: removed only surplus EOF blank lines from evidence-workspace.js and source-artifact.test.mjs; normalized the 11 owned modified source/doc/test files to LF. git diff --check passed (exit 0). No tests rerun for whitespace-only changes; edits remain unstaged.

## E5 fix round 1/5

Review base: `ef814661dd2a2e2b3d90f774b278eeac2a75f496`. Read Important E5-R1, E5-R2 and E5-R3 from E5-review.md in full. Only package/workspace production code and their/source-artifact regression tests were changed; no schema or audit production extension was necessary.

- E5-R1: incoming aliases are normalized against the final chosen bibliography. Obsolete self/identity bindings are removed, while the reverse canonical alias needed by immutable source provenance remains. The regression exports actual Axelrod source evidence through `canonical-axelrod` then imports into both the built-in graph and an empty local graph with UI-equivalent known reference/result context. It verifies no self alias, canonical active refs, exact original artifact body, input immutability and a further independent export.
- E5-R2: subject selection, review-event inclusion and explicit source-artifact dependency selection now iterate to a fixed point before rights projection. A three-artifact event chain with a cycle retains all historical events and required source identities while leaving an unrelated same-paper private source unselected. Ownership alone still selects no material.
- E5-R3: the first established alias originalReference snapshot wins for a repeated same-target binding; incoming metadata may update the active bibliography but cannot replace that comparison baseline. A real hashed source regression repeats the changed-title import, verifies the original snapshot/artifact are unchanged, and observes the expected title drift from auditTranscription.
- Combined R1/R3 self-review: a reverse import must not discard a self-binding when that would erase the only historical title baseline. Such a title conflict now rejects before publication rather than silently losing historical identity; ordinary unchanged-title reverse import succeeds. This stays within the review's permitted preserve-or-reject policy.

Exact RED/GREEN commands and results:

1. `node --test --test-name-pattern='E5-R[123]' src/lib/evidence-workspace.test.mjs src/lib/evidence-package.test.mjs src/lib/source-artifact.test.mjs`: RED 0/3, with `referenceAliases: unique absent alias and existing canonical target required` (R1), `history-review-1.sourceRefs: source must resolve to an artifact or an http(s) anchor` (R2), and changed-versus-original title snapshot inequality (R3). After fixes, identical command GREEN 3/3.
2. `node --test src/lib/evidence-package.test.mjs src/lib/evidence-workspace.test.mjs src/lib/source-artifact.test.mjs src/lib/evidence-schema.test.mjs`: GREEN 54/54 before combined-path self-review.
3. `node --test --test-name-pattern='E5-R1/R3' src/lib/evidence-workspace.test.mjs`: RED 0/1 (`Missing expected exception`) for loss of the original title baseline during reverse import.
4. Added the narrow identity-alias title conflict check. Final `node --test src/lib/evidence-package.test.mjs src/lib/evidence-workspace.test.mjs src/lib/source-artifact.test.mjs src/lib/evidence-schema.test.mjs`: GREEN 55/55, zero failed/skipped/cancelled.
5. `git diff --check`: passed, exit 0 after LF normalization of the five changed source/test files.

No full check/build was rerun because this fix round changes no broad/shared contract. Existing build advisories remain tracked under X9. No browser/storage operations, commit, push, deployment, dependencies or subagents. Root's CUA acceptance of the non-built-in reading and reproduction of the original alias failure remain separate evidence; this worker does not claim a new browser acceptance. All immutable source artifacts, generated data, v1 originals, coordinate identities and review states remain unchanged. Changes are unstaged.
