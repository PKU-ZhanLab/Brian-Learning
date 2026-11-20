# S6 correction round 1 — scoped independent review

Reviewed `fbfa0fe..fe498c3`, commit `fe498c3` (`fix: bind spatial reviews to exact comparison evidence`): eight changed files, 154 insertions and 41 deletions. Read the original three findings in `S6-review.md`, the appended correction report, and every section of `S6-fix1-review-package.md`. Scope is closure of those findings and new breakage introduced by this delta; this is not a fresh open-ended audit of unchanged code.

**Specification verdict: APPROVED for the S6 software correction.**

**Code-quality verdict: APPROVED for the reviewed delta.**

No new blocking finding was identified. Independent anatomical validation, source replacement and real UI acceptance are not approved by this software review.

## Finding closure

| Original finding | Verdict | Evidence in the correction |
| --- | --- | --- |
| 1. Original-asset evidence could qualify a distinct derived output | **ADDRESSED** | `validateSegmentationSource` supplies only the proposed output in measurable `assets`, with original/intermediate input identities separately passed as `lineageAssets` for reference-independence exclusion. Caller-supplied regional values cannot override these final arguments. Eligibility additionally checks each covered structure's accepted measurement against the proposed asset ID and SHA-256. The regression contains the original distinct-output witness, a positive output-scoped review control, and rejection of a reference derived from the original source. |
| 2. Human review could survive a change of reference or comparison context | **ADDRESSED** | `makeSpatialReviewContext` copies and deeply freezes the exact asset identity, full reference record, ordered transform identities/hashes and supplied version/space endpoints, complete measurement/evidence record, and protocol version/hash/full threshold record. Human acceptance requires canonical equality with a context generated from the currently accepted comparison. Protocol and threshold evidence are required and locked at admission. Regressions keep independent comparisons passing while changing reference bytes/version, asset version, transform identity/order, metric/evidence, protocol or threshold; old human review remains pending, while a fresh matching synthetic context passes. Protocol and algorithm versions advance explicitly to v2. |
| 3. Overall assessment consumed unlocked review files/evidence without an audit trail | **ADDRESSED** | `loadLockedReviews` rejects duplicate/unlisted paths before consuming a review, verifies consumed bytes against their lock again, and requires human review evidence to resolve to verified locked input bytes. `buildAssessment` consumes only these admitted records and retains their path, digest and raw record in `reviewRecords`. Source-package closure now rejects review paths without input locks, and existing locked-input traversal covers packaging. Tests cover unlisted `output/` paths, missing evidence, retained audit records and changed review bytes under an old lock. |

## Preservation and acceptance limits

- The generated v2 assessment remains `partial`, `humanValidated=false`, with 14 missing coverage items and no eligible replacement. Its only consumed review is the existing `public/data/aal-v3/root-review.json`, explicitly identifying `Root AI agent`; no genuine human record was added. Including that raw historical record does not upgrade its status.
- The delta updates the protocol lock, registry/report digests and new assessment as expected. It does not change historical review bytes, raw candidate files, source URLs, download behavior, geometry, camera behavior or UI code. The preparation-script change is solely the review-path packaging closure check.
- The appended report supplies **28/28 focused tests passed**, both required QC checks passed in the working checkout and updated source package, explicit stale-output rejection before regeneration, **23/23 protected files unchanged** around read-only checks, and unchanged historical/fact/source bytes. These are supplied execution results, not checks performed again by this reviewer.
- Real UI acceptance remains **not run**. The optional strict legacy anatomy validation failure remains unresolved and outside this fix. Licence resolution, independent measurements and genuine scoped human review remain pending; neither this approval nor software test success closes those scientific requirements.

No tests, builds, browser actions, downloads, installs, Python, subagents or source edits were performed in this scoped review. Only this review report was written.
