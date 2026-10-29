# S5 desktop acceptance — 2026-10-29

Pinned source `955c37cda809b04a19d5f9590f95db693827d404`; actual CUA calculations/downloads on localhost:4194.

A/B both registered AAL3 label134. Actual 1mm result retains source7/target7, Dice1. Actual2mm preflight reports source7/target0 and lost label134 on both sides; explicitly confirmed, result Dice null. Grid change removed the prior export/result before recompute.

Downloaded JSON and CSV at both spacings. Offline assertions over those original downloaded bytes prove exact manifest/metrics/probabilityMetrics/sampling agreement, ordered A/B identities and source grids, expected target grids, original label sets, nearest-neighbour interpolation, actual derived-volume hash, both ordered actual transform hashes, and all9 per-volume source dependency hashes (including register_volume.py). Receipt and four original downloads retained in output/s5-cua; original user Downloads files untouched.

Acceptance found an authored E2E expectation defect: roi-provenance.spec.mjs expects threshold0 while the production UI initializes both thresholds to0.5 and explicitly passes them to normalizeROISelection. Discrete label masks use membership and ignore thresholds; the recorded manifest truthfully preserves the configured0.5. Initial offline assertion failed, source trace confirmed expected-value defect, corrected independent verification passed. S5 author must fix the authored test narrowly; do not alter production behavior just to match its erroneous expected0. The initial failure is preserved in conversation evidence and this report.

Full-project snapshot persistence/recompute remains W6; no full-project acceptance is implied. Source-builder catalog is a recorded-input integrity check, not independent anatomical certification or a re-executed registration. Desktop file import remains denied; none was used in this CUA run.
