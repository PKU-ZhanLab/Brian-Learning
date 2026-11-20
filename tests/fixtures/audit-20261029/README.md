# Audit inputs, 2026-10-29

`manifest.json` records SHA-256 and original paths. `preserved/` contains byte-identical text audit material from the original workspace. These scripts and JSON outputs describe the pinned old version, including observed incorrect behavior. They are evidence, not acceptance tests for corrected behavior; script-relative paths have deliberately not been rewritten. Do not execute preserved probes to regenerate their historical output.

`atlas-labels.json` extracts actual AAL 8121/8211 and AAL3 87/91/134 records from the deployed manifest. `roi-label134.json` preserves all seven positive linear indices for actual AAL3 label 134, the source affine/shape/order, the complete source-byte hash, and the recorded target grid. Reconstruct the source mask with zeros elsewhere; do not infer that the target sampling preserves this label.

`root-source-comparison.json` records the live implementation preflight, including intentional public-distribution metadata differences between the working material root and deployed source. Source code and scientific inputs are not copied back over the originals.

Correct-behavior regressions belong in the relevant module tests or `tests/e2e/`. Browser acceptance must use a permitted isolated runner or desktop CUA; no test should attach to a user's browser profile or existing study storage.
