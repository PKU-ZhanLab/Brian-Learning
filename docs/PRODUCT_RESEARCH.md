# Research behind the workspace

Reviewed 25 October 2026. This note distinguishes observed features, design choices, and remaining extensions.

## The supplied NEURO·AXIS example

[NEURO·AXIS](https://dbgaxc56iznqc.ok.kimi.link/) was inspected in a browser and through its public HTML. The visible page offers anatomical layers, a structure catalogue, networks, five cortical atlas choices, opacity, six teaching presets, standard camera views, selection, three-plane slices, a quiz, notes, references, and image export. It marks Brodmann mapping as approximate and several neural/spinal structures as schematic. Its initial description also mentions nearest-label completion on the cortical surface.

The new workspace keeps the useful interaction patterns: searchable bilingual anatomy, layer controls, presets, linked slices, notes and export. The evidence library and ROI comparison are original additions. No source code or proprietary visual assets from the reference site are included.

The public HTML embeds a platform analytics SDK although the interface says there is no online tracking. This project does not embed that SDK or add analytics. Browser-stored notes remain local; an external article link opens its publisher's website.

## Research workflows that informed the design

| Source | Useful principle | Application here |
|---|---|---|
| [siibra: atlas elements](https://siibra-explorer.readthedocs.io/en/latest/getstarted/atlas_elements/) | Keep reference space, parcellation and terminology distinct; data may be linked by a semantic region or by coordinates. | A paper-to-region link is identified separately from a measured peak coordinate. Same-name regions are not assumed to be identical masks. |
| [siibra: local overlays](https://siibra-explorer.readthedocs.io/en/latest/advanced/superimposing_local_files/) | Local overlays and explicit spatial context support inspection. | ROI comparison displays the reference grid and transformation status. Unverified atlases cannot participate. |
| [NiiVue](https://niivue.com/) | Browser rendering makes anatomical imaging accessible without a desktop installation. | The published app opens in a modern browser and does overlap computation locally in a worker. |
| [NeuroVault](https://neurovault.org/) | Statistical maps and parcellations are research objects with provenance and persistent URLs. | Results and figures retain source links; a region association does not fabricate a statistical map. |

## Implemented decisions

- Two directions of discovery: select a region to filter its literature, or filter by topic/modality and open a paper to locate associated structures.
- Evidence cards carry findings, study design, population, mapping scope and exact source/figure links where verified. EEG, MEG, fMRI, iEEG and single-unit evidence retain distinct method labels. Cross-species and context-only links are disclosed.
- Up to three papers can be compared side by side. Curated debate entries explain differences in task, measurement or region definition before calling findings inconsistent.
- Two real voxel labels can be compared on a common 2 mm reference grid. Intersection and exclusive parts have separate colors and opacity. Dice/Jaccard are descriptive spatial measures, not evidence of equal function.
- Chinese and English switch in place. Stable structure IDs survive translation and support shared region links, notes and machine-readable exports.

## Limits and next extensions

The library is curated, not an exhaustive or continuously updated systematic review. Anatomical labels and maximum-probability maps are supported; arbitrary statistical-map upload, probabilistic-map threshold sweeps, automated paper extraction and formal meta-analysis remain separate extensions. A source figure link is not a result-coordinate map. No peak marker is created without a verified coordinate and identified reference space.

The project estimates one HCP-template transform for teaching display. It does not offer a general registration service for individual scans. PAM50 remains an independent straightened reference; the full CNS view is an overview, not a jointly registered subject.
