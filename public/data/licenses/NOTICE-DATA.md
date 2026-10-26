# Data licenses and attributions

This viewer contains separately licensed third-party neuroimaging data and adaptations. The application's code license does not replace the data terms below. Redistribution of an asset must retain its relevant notice, license, attribution and modification record. No original author or institution endorses this viewer or its adaptations.

## CBIG / FreeSurfer / FSL MNI152 paired cortical reconstruction

`dk-v2/` contains the complete DK68 atlas and paired pial/white surfaces derived from [CBIG FSL_MNI152_FS4.5.0](https://github.com/ThomasYeoLab/CBIG/tree/634f676630929a71297852d01dd92a287103e861/data/templates/volume/FSL_MNI152_FS4.5.0), commit `634f676630929a71297852d01dd92a287103e861`.

- CBIG copyright (c) 2016 Computational Brain Imaging Group. Its provided component is accompanied by [CBIG-MIT.txt](CBIG-MIT.txt).
- The underlying FreeSurfer attribution and applicable terms are retained in [FreeSurfer-Part-B-NOTICE.txt](FreeSurfer-Part-B-NOTICE.txt), including the required introductory notice and all of Part B, and the [complete agreement](FreeSurfer-Software-License-2011.txt). These provisions cover only rights the licensors can grant and preserve third-party rights.
- The source reconstruction used the FSL MNI152 T1 template. Credit MNI/McGill, Andrew Janke and FSL/Oxford. The FSL-distributed template and applicable derivatives retain [FSL-License-bundled-5.0.1.txt](FSL-License-bundled-5.0.1.txt) and [FSL-License-current.txt](FSL-License-current.txt). This package's distribution is noncommercial; it does not grant a separate commercial license to FSL material.
- DK citation: Desikan RS et al. An automated labeling system for subdividing the human cerebral cortex on MRI scans into gyral based regions of interest. NeuroImage 31:968–980 (2006). [DOI](https://doi.org/10.1016/j.neuroimage.2006.01.021).

Modifications: source labels resampled by nearest-neighbour interpolation to a 2 mm RAS grid; tkregister-RAS surface coordinates converted using the paired MRI header; topology-preserving surface simplification retaining original vertices and annotation assignments; decimal rounding; JSON/binary export and Chinese display names. These are modified template-based reference derivatives, not original FreeSurfer releases or individually verified anatomy.

## Harvard–Oxford and Diedrichsen cerebellar atlas derivatives

According to the [FSL atlas-specific license statement](https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html), the Harvard–Oxford and Cerebellum atlases are licensed under **Creative Commons Attribution-ShareAlike 4.0 International**. The corresponding atlas-derived data in this viewer are distributed under the same [CC BY-SA 4.0 terms](CC-BY-SA-4.0.txt). Preserve source attribution and this change notice. This ShareAlike declaration is for the dataset adaptations and does not relicense unrelated code or other datasets.

Credit the Harvard Center for Morphometric Analysis / Harvard–Oxford atlas contributors and FSL, including the atlas references listed on the [FSL data page](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html). Credit Jörn Diedrichsen and collaborators for the [probabilistic cerebellar atlas](https://www.diedrichsenlab.org/imaging/propatlas.htm); Diedrichsen J et al., NeuroImage 46:39–46 (2009), [DOI](https://doi.org/10.1016/j.neuroimage.2009.01.045).

Modifications: maximum-probability labels at the published 25% threshold; array reorientation; surface extraction, smoothing, simplification and rounding. Some brainstem and cerebellar display subdivisions are project-defined geometric partitions, not additional original atlas labels. Original source provenance and construction parameters are retained with the assets. The older FSL distribution's noncommercial license is also preserved as historical provenance; it does not remove rights granted under the current CC BY-SA license.

## JHU, Jülich and FSL-distributed Talairach labels

These components are distributed for noncommercial reference use under the [FSL license](FSL-License-current.txt), with the [original distribution's text](FSL-License-bundled-5.0.1.txt) retained. The full conditions apply, including the absence of financial return and the provision of original/amended source materials when redistributed. This is not a CC or MIT grant for these datasets.

- JHU ICBM-DTI-81: credit Susumu Mori and collaborators, Johns Hopkins University; see the original references on the [FSL atlas page](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html). The exported label volume is a white-matter parcellation, not a tractogram.
- Jülich: credit the original cytoarchitectonic atlas authors and the [region-specific publications](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/julich.html). The viewer selects only explicitly BA-named regions from the published 25% maximum-probability atlas and retains the selected probability values.
- Talairach: credit Jack Lancaster, Diana Tordesillas Gutiérrez and the Research Imaging Center / UTHSCSA; Talairach and Tournoux (1988), Lancaster et al. (2000), and Lancaster et al. (2007). The source is the FSL-distributed, already affine-mapped atlas, covered by the distribution's licensing route stated on its [atlas index](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html#talairach-atlas). No public-domain status is asserted for the separate original atlas or book.

Modifications: RAS reorientation, selected-label extraction, compact browser data formats, display metadata and translations. No FSL executable code is included by this data notice. Original atlas inputs, hashes and the project's conversion scripts accompany the source distribution.

## HCP1065 and registration references

HCP1065 source and registered streamline adaptations remain **CC BY-SA 4.0**. The [dedicated HCP1065 notice](../anatomy/licenses/HCP1065-NOTICE.md) supplies Yeh (2022) attribution, the required WU-Minn HCP acknowledgment and all streamline processing changes.

The exact ICBM2009aAsym template used for registration retains [MNI-2009a-TemplateFlow-LICENSE.txt](MNI-2009a-TemplateFlow-LICENSE.txt): copyright Louis Collins / McConnell Brain Imaging Centre / Montreal Neurological Institute / McGill University. Credit Fonov et al., NeuroImage 54:313–327 (2011), [DOI](https://doi.org/10.1016/j.neuroimage.2010.07.033), and the [source template collection](https://nist.mni.mcgill.ca/icbm-152-nonlinear-atlases-2009/). Registration QC images also contain the FSL target image and retain its conditions. Registration estimates and modified streamlines are identified as project derivatives.

## AAL116, AAL3 and estimated registration derivatives

`aal-v3/` provides 116 original AAL labels and 166 AAL3 labels in their native
Colin27 space, plus separately identified project registration estimates in
FSL MNI152NLin6Asym. Credit GIN and the cited authors: Tzourio-Mazoyer et al.
(2002), NeuroImage 15:273–289, [DOI](https://doi.org/10.1006/nimg.2001.0978);
Rolls et al. (2020), NeuroImage 206:116189,
[DOI](https://doi.org/10.1016/j.neuroimage.2019.116189).

The preserved [original AAL SPM12 README](../aal-v3/licenses/readme_aal_for_SPM12.txt)
and the [GIN April 2024 AAL3 guide](https://www.gin.cnrs.fr/wp-content/uploads/AAL3_UserGuide_April2024.pdf)
state GNU GPL. The guide explains that v2 adds a license notice without changing
the atlas geometry. The AAL3 source used here is the preserved
[NIH AFNI distribution](https://afni.nimh.nih.gov/pub/dist/atlases/aal/AAL3_dist.tgz).
The exact 2024 archive could not be downloaded; this limitation and the primary
guide evidence are recorded in [AAL3-GPL-EVIDENCE.json](../aal-v3/licenses/AAL3-GPL-EVIDENCE.json).
The author statements specify no GPL version; this distribution elects
[GPLv3](../aal-v3/licenses/GNU-GPL-3.0.txt). Original data/source archives and
transformation scripts accompany the distribution. Preserve the detailed
[AAL notice](../aal-v3/licenses/AAL-NOTICE.md) and
[source input list](../aal-v3/source-package-allowlist.json).

Changes: lossless RAS reordering for native exports; source T1/mask pairing;
project-estimated affine and diffeomorphic registration at 2 mm; one nearest-neighbour
sampling of original labels onto a 1 mm FSL-space grid; computed counts/centers and
browser export. The 1 mm grid retains all 116/166 labels but does not establish 1 mm
registration accuracy. AI visual review covers three central planes, not every
region or individual anatomical accuracy. The two registered label datasets
retain GPLv3. The [SPM template license](../aal-v3/licenses/SPM12-LICENCE.txt),
[original Colin27 notice](../aal-v3/licenses/Colin27-LICENSE.txt), and separate FSL
conditions remain attached to their respective inputs; QC images containing FSL
pixels retain FSL conditions. This does not add noncommercial restrictions to
the GPL atlas labels or relicense FSL images under GPL.

## Data not redistributed in the public package

Local PAM50-derived meshes are excluded pending verified data redistribution terms; see its [license-status notice](../anatomy/licenses/PAM50-LICENSE-STATUS.md). Inactive legacy BrainNet / Neuroparc binaries, including old `aal.bin`, `aal3.bin`, `ba.bin`, `dk.bin` and old cortical meshes, are excluded. The new licensed `aal-v3/` assets above remain included. Legacy BA retains a terminology/source entry only while its exact paired template and source terms remain unresolved. Retained software licenses and provenance notices are reference material, not a claim that those software licenses independently grant rights to every borrowed dataset.

License statements were checked against the upstream sources on 2026-10-25 and updated for AAL on 2026-10-26. Full source URLs and hashes of retained evidence are recorded in [license-evidence.json](license-evidence.json) and the AAL source/permission records linked above. Article PDFs and full-text caches are omitted from the source release; curated result records retain source URLs, extraction notes and verification metadata.
