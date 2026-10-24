# NeuroAtlas · Anatomy and Research Evidence

[中文](README.md) · [User guide](docs/USER_GUIDE.md#english)

A bilingual 3D workspace for neuroscience and medical teaching. Find studies from anatomical structures, return from papers to linked regions, and compare the actual spatial overlap of atlas ROIs.

**GitHub Pages address: [NeuroAtlas](https://pku-zhanlab.github.io/Brian-Learning/)**

## Start exploring

1. Select **中文 / EN** to switch the interface and knowledge content.
2. Select a structure in the model or catalog. Read its anatomy, physiology, cognition, and clinical associations; expand **Evidence and scope** for sources and limitations.
3. Choose **Explore papers for this region**, or open the **Evidence library** and filter by topic, method, author, or DOI. Open a paper to locate linked regions and compare up to three studies.
4. Open **ROI comparison**, choose two eligible atlas labels, and compute their intersection, exclusive regions, Dice, and Jaccard. Adjust opacity and inspect linked slices to check interior overlap.

The collection contains **188 structures, 115 sources, 21 topics, 18 method categories, 3 research debates, and 6 verified source-figure links**. Figure links open the original publication. Region links support discovery and anatomical orientation; exact experimental locations require verified coordinates and reference spaces.

Notes stay in the current browser and can be imported or exported. Export views as PNG and references as BibTeX or GB/T 7714 text. **Share view** preserves language, atlas, selected structure, and workspace mode; camera position and notes require separate saving.

## Data scope

- **Brain reference:** FSL MNI152NLin6Asym. DK68 surfaces and labels come from a matched reconstruction. The 31 HCP1065 pathway / cranial-nerve entries use a template transform estimated in this project.
- **ROI comparison:** Actual binary label masks are sampled on a shared 2 mm grid using their existing affines and nearest-neighbor sampling. This does not estimate new anatomical registration. Comparisons use built-in atlas labels; arbitrary NIfTI import is not provided.
- **Spinal cord:** The public app loads PAM50 on demand from a pinned official GitHub source. A browser Worker generates boundary surfaces from 0.5 mm voxels. The site does not mirror these data. PAM50 retains its independent, straightened native reference; it does not represent normal spinal curvature or a jointly registered brain-and-cord template.
- **Unaligned atlases:** The public package retains catalog and provenance metadata for AAL, AAL3, and legacy BA. Their volumes are unavailable for overlay or overlap calculation. Uncovered structures retain knowledge entries; teaching schematics are hidden by default.

Functional regions, gyri, BA areas, lesions, and animal recording sites have different definitions. Spatial overlap does not establish shared function. Bibliographic verification is not full-text review or clinical certification. See the [user guide](docs/USER_GUIDE.md#english), [literature scope](docs/LITERATURE_RESEARCH.md), [regional evidence](docs/EVIDENCE_COVERAGE.md), and [spatial documentation](docs/SPACE_ALIGNMENT.md).

## Run locally

With Node.js installed, run these commands in the project directory:

```sh
npm ci
npm run check
npm run build
npm run preview
```

Open the address shown in the terminal. Use `npm run dev` for development. Running the app does not require Python. The first on-demand PAM50 load requires access to its official data source.

Build the public GitHub Pages package with:

```sh
npm run build:public
```

This applies the `/Brian-Learning/` deployment path and public-data packaging rules. The ordinary local build and public package have different data coverage.

## Data licenses

This teaching package is assembled for noncommercial use. Third-party assets retain their respective upstream terms, attribution, and modification notices; the project’s code license cannot replace those data licenses. Before reuse or redistribution, read the [data notice](public/data/licenses/NOTICE-DATA.md) and [public-data scope](docs/PUBLIC_DATA_LICENSES.md).

