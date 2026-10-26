# AAL source and modification notice

AAL116: Tzourio-Mazoyer N, Landeau B, Papathanassiou D, Crivello F, Étard O,
Delcroix N, Mazoyer B, Joliot M (2002). *Automated Anatomical Labeling of
Activations in SPM Using a Macroscopic Anatomical Parcellation of the MNI MRI
Single-Subject Brain*. NeuroImage 15:273–289. DOI:10.1006/nimg.2001.0978.

AAL3: Rolls ET, Huang CC, Lin CP, Feng J, Joliot M (2020). *Automated anatomical
labelling atlas 3*. NeuroImage 206:116189. DOI:10.1016/j.neuroimage.2019.116189.

The atlas authors are the Neurofunctional Imaging Group (GIN), Bordeaux, and
the cited collaborators. Retain their attribution. This project does not claim
ownership of their anatomical labels.

## Permission and exact distributions

The preserved 2015 AAL SPM12 `readme_aal_for_SPM12.txt` grants the package under
the GNU General Public License. The mirrored source includes ROI_MNI_V4 NIfTI,
label definitions, MATLAB source and metadata. It was downloaded from
https://github.com/Neurita/std_brains/tree/master/atlases/aal_SPM12/aal;
it is described as a mirror, not a fresh author-server download.

The GIN April 2024 AAL3 guide also states GNU GPL and explains that the v2
release adds the license notice without changing the atlas; its atlas files
remain AAL3v1. The original atlas files used here come from the NIH AFNI
distribution at https://afni.nimh.nih.gov/pub/dist/atlases/aal/AAL3_dist.tgz.
The 2mm NIH image is voxel-for-voxel and affine-for-affine identical to the
previous local AAL3v2 image. The author guide evidence and access limitation
are recorded in `AAL3-GPL-EVIDENCE.json`; the 2024 author archive and its README
were not successfully downloaded during this work.

These author statements do not specify a GPL version. This distribution elects
GPL version 3, whose full text is in `GNU-GPL-3.0.txt` (see section14 for a
program that specifies no version). The original notices are preserved. This
is a source-based redistribution determination, not author certification.

## Changes made by this project on 2026-10-26

Native assets: lossless orientation reorder to RAS and export to x-fastest
binary arrays, with original numeric IDs. No native anatomical boundary was
redrawn. Label voxel counts and centers were computed from the exported data.

Registered assets: a project-estimated SPM Colin27 to FSL MNI152NLin6Asym
transform was fitted to T1 images using DIPY affine and symmetric diffeomorphic
registration at2mm. Original labels were sampled once using nearest-neighbour
interpolation onto a1mm target grid; this preserves116/166 labels but does not
establish1mm registration accuracy. These are derivative atlases, not official
GIN or FSL registrations. Native originals remain available.

Original NIfTI/source archives, transform parameters, reports and transformation
scripts accompany this distribution in `sources/` or the project source package.
The derivative atlas labels remain GPLv3. SPM and original Colin27 template
notices are preserved separately. FSL reference T1 data and QC images containing
FSL pixels retain the separately supplied FSL terms; this notice does not
relicense those assets or add restrictions to the GPL atlas labels.

Native and registered boundaries describe template anatomy, not an individual's
histology or precise small-nucleus location. AI visual review covers three
central planes only; there is no human anatomical certification.
