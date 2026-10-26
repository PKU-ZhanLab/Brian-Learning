# Brain model and evidence workspace

User scope: remove the emphasis on teaching; continue the published feature audit; support local files and shareable views, without accounts. Keep the spine out of the viewer.

## Implementation boundaries

- Atlas data: author packages, licenses and exact native frames; common-space derivatives only with documented transforms. An unknown transform must not prevent independent native viewing.
- Atlas explorer: complete actual label directory, search, individual and combined 3D boundaries, visible-label controls, source-space information. It must operate independently from the fixed macroscopic structure list.
- ROI workflow: local NIfTI import, explicit reference frame, label unions and thresholded maps, separate probability metrics, NIfTI masks and CSV export. No silent conversion from an unknown frame to MNI.
- Evidence: DOI metadata import, editable findings and spatial provenance, figure viewing, source-checked example coordinates, comparison and explicit agreement/disagreement annotations. Imported metadata does not imply verified results.
- Persistence: local project files including imported data and notes; named local views; URL view state for public built-in data. Restore camera, atlas, selected structures, slices, opacity, ROI configuration and literature filters. No accounts or automatic data uploads.
- Product copy: brain models, anatomical regions, papers and findings. Keep scientific representation limits; remove educational positioning from navigation and branding.

## Delivery checks

- [ ] Atlas files, actual positive labels, license texts, hashes and transforms checked.
- [ ] NIfTI malformed headers, endian, sform/qform, units, affine, threshold and export round trips covered.
- [ ] Native atlas viewing never displays the unrelated FSL T1 or computes cross-space overlap.
- [ ] Project import validates size, schema, finite camera/coordinates and typed-array lengths before applying changes.
- [ ] URLs omit user data; local projects preserve it and can restore on a fresh browser session.
- [ ] DOI records and source-checked coordinates retain their distinct verification status.
- [ ] Desktop and narrow-screen workflows, imports, exports and restored state exercised in the browser.
- [ ] Public package built, sources pushed and published site verified.

Features that require scientific evidence rather than software work (complete literature coverage, source anatomical measurements or human review) remain explicitly bounded; no fabricated precision or completeness.
