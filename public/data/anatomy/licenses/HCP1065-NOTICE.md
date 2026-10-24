# HCP1065-derived streamline data

Source: Fang-Cheng Yeh, HCP1065 Population-Averaged Tractography Atlas (2022).

- Author's data and license page: https://brain.labsolver.org/hcp_trk_atlas.html
- Original TRK archive: https://github.com/data-others/atlas/releases/download/hcp1065/hcp1065_avg_tracts_trk.zip
- Citation: Yeh FC. Population-based tract-to-region connectome of the human brain and its hierarchical topology. Nature Communications 13, 4933 (2022). https://doi.org/10.1038/s41467-022-32595-4
- Data license: Creative Commons Attribution-ShareAlike 4.0 International. The author's page explicitly applies this license to the population-averaged tractography atlas. The full license is included as `CC-BY-SA-4.0.txt` and is available at https://creativecommons.org/licenses/by-sa/4.0/legalcode .
- Additional HCP data-use terms: https://www.humanconnectome.org/study/hcp-young-adult/document/wu-minn-hcp-consortium-open-access-data-use-terms . An unmodified copy of the official page is included as `WU-Minn-HCP-data-use-terms.html.txt`.

The `hcp-*.json` files in this directory and its `registered-nlin6/` subdirectory are adaptations of that atlas. These adaptations remain under CC BY-SA 4.0 and retain the applicable WU-Minn HCP data-use terms. This data notice does not license unrelated application code or other datasets.

Changes made for this viewer: deterministic subsampling to at most 240 source streamlines per displayed structure; arc-length resampling to 40 points per streamline; conversion through the original TRK header to native RAS millimetres; coordinate rounding to 0.001 mm. Some catalog structures combine named source sub-bundles. The `registered-nlin6/` adaptations additionally apply this project's documented 2 mm template-to-template deformation from MNI152NLin2009aAsym to MNI152NLin6Asym. Source membership, file hashes and registration details are retained in `manifest.json` and `registered-point-validation.json`. The original authors do not endorse these adaptations. Streamlines and template registration are estimates and do not establish individual anatomy.

Required HCP acknowledgment:

Data were provided in part by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at Washington University.

Upstream statements checked on 2026-10-25. For the source data, the author's explicit data license—not a repository's software license—is the basis for this notice.
