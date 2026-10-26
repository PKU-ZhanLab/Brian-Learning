# NeuroAtlas · Anatomy and Research Evidence

[中文](README.md) · [User guide](docs/USER_GUIDE.md#english) · [Finding curation workflow](docs/RESULTS_WORKFLOW.md)

A bilingual research workspace connecting 3D brain structures, atlas parcels, and published findings. Explore actual atlas labels, compare ROIs and statistical maps, curate findings with provenance, and save work in local project files.

**Online entry: [NeuroAtlas](https://pku-zhanlab.github.io/Brian-Learning/)** · This documentation describes the v4 workflow; check the site's version label for the deployed version.

## Start exploring

1. **Anatomy / Slices:** select structures, inspect anatomy and functional evidence, and move between the 3D model and orthogonal slices.
2. **Atlas label explorer:** browse labels present in a volume, search, isolate a parcel, or combine labels. Native atlases use an independent viewer. Single parcels show original voxel boundaries; overview rendering may be sampled.
3. **Evidence library:** find papers from regions, filter by topic and modality, look up DOI / title metadata, and edit structured findings, coordinate provenance, figures, and relations between findings.
4. **ROI comparison:** import local NIfTI labels, masks, probability maps, or statistical maps. Choose label unions, thresholds and tails; export overlap metrics and NIfTI masks.
5. **Projects & views:** save named views, export or open project files, and share a URL that reconstructs settings for public data.

The knowledge catalog contains **150 macroscopic structures, 118 sources, 21 topics, and 18 method categories**. A selected subset of **3 primary papers has 4 structured findings and 8 reported coordinates**, covering MEG, fMRI, and TMS. All retain an unspecified MNI variant as reported; source checking was AI-assisted, not human certification. Other papers can be extended with findings. Catalog entries and actual atlas labels are separate inventories.

## Space and evidence

The main brain reference is **FSL MNI152NLin6Asym**. Volumes, surfaces, streamlines, and paper coordinates retain their own provenance and spatial notes. AAL / AAL3 native data are distinct from derivatives registered with a transform estimated in this project; see the [AAL integration notes](docs/AAL_INTEGRATION.md).

- ROI comparison requires a shared reference frame. Labels and masks use nearest-neighbor sampling; continuous maps use trilinear sampling before thresholding. Resampling does not perform new anatomical registration.
- For an image with unverified alignment, use **ROI comparison → Import → View native volume**. An affine or the name “MNI” alone does not establish compatibility with the main template.
- Bibliographic metadata, literature summaries, structured findings, and source coordinates are separate. Metadata imports do not create conclusions or coordinates. Region links and figure clicks use explicitly recorded anatomical associations.

## Save and share

No account is required. Notes, local paper edits, and named views stay in the current browser. A project file also contains view state, notes, local evidence, and recoverable imported volume data. Share a project file to transfer custom images between devices.

View links preserve camera, display, slice, ROI, and filter settings for public data. They do not contain notes, free-text queries, local paper content, or image files. Evidence JSON merges paper and finding records; BibTeX supports reference management. See [Save and share](docs/USER_GUIDE.md#save-and-share).

## Run locally

With Node.js installed:

```sh
npm ci
npm run check
npm run build
npm run preview
```

Open the address shown in the terminal. Use `npm run dev` for development. Running the app does not require Python. Build the GitHub Pages package with `npm run build:public`, using the `/Brian-Learning/` deployment path.

## Data licenses

Third-party assets retain their upstream licenses, attribution, and modification records. Some assets have noncommercial-use conditions; the code license cannot replace data licenses. See the [data notice](public/data/licenses/NOTICE-DATA.md), [public-data scope](docs/PUBLIC_DATA_LICENSES.md), and [spatial documentation](docs/SPACE_ALIGNMENT.md).
