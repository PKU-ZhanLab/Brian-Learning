# W4 actual desktop file-declaration acceptance

After the user's explicit synthetic localhost file authorization, root used CUA on pinned `bf1d5f1` at localhost:4205. All inputs were generated tiny synthetic images/label tables; no real research data were read or uploaded.

- Selected file A `shared.nii`, attached `only-A.csv`, chose binary-mask type, declared the exact main template, filled synthetic provenance, and checked alignment.
- Selected a different-content file B also named `shared.nii`. The actual form reset to integer-label type, native-unverified space, empty provenance, no alignment control, and an empty label-file DOM value. The identical basename did not reuse A's declaration.
- Imported B. The UI explicitly reported no label table and unverified alignment, with main-template comparison disabled. Its actual downloaded project contains values `[2,0]`, empty labels/provenance and no overlay eligibility; A was never registered.
- Selected an image with values `[-1,2]` while the default type was labels. Import failed with the meaningful nonnegative-label/type message while preserving the selected file and entered provenance. Changed only the type to Statistical map and retried. It succeeded with that same provenance and still-unverified native space. The real downloaded data remain exactly `[-1,2]`.

Evidence: `output/w4-cua/same-name-reset.json`, `retry-state.json`, `imported-images.neuroatlas` and `receipt.json`; originals remain in Downloads. These are actual file-chooser/UI paths and offline checks of the actual export. Late-task races remain covered by the focused module/host-guard tests; actual native-picker cancellation and final W6 lossless-envelope integration are separate acceptance items.
