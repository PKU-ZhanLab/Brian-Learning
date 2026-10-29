# NeuroAtlas

[中文](README.md) · Application **4.2.0 (local candidate; unpublished)**

Start with coordinates, atlas labels, an image or a paper. Confirm reference space and provenance, compare ROIs, return to the source, and save the research project.

- [User guide / 使用指南](docs/USER_GUIDE.md): navigation, selection, projects and recovery.
- [Results and evidence](docs/RESULTS_WORKFLOW.md): search, source records, standalone evidence and fixed versions.
- [Spaces and methods](docs/SPACE_ALIGNMENT.md) · [Shared brain geometry](docs/UNIFIED_BRAIN.md) · [Data licences](docs/PUBLIC_DATA_LICENSES.md).
- [Current acceptance](docs/acceptance/STATUS.md) · [Three research journeys](docs/acceptance/RESEARCH_WORKFLOWS.md) · [Build and rollback](docs/acceptance/RELEASE_CHECKLIST.md).

Use Node 22 or newer. Run `npm ci`, then `npm run dev`. Validate with `npm run check`; create a public build with `npm run build:public`. Browser suites require a permitted isolated CI runner.

A project file carries this project's images, evidence, notes, drafts, views and numerical history. Public view links omit private content. Images stay local by default. Open and merge are separate operations; a failed import preserves the active study.

A generic MNI label, 1 mm sampling or display coverage does not establish registration accuracy. Native Colin27 remains separate from the main template; unknown spaces cannot be overlaid by assumption. Human anatomical/source review and some final browser checks remain pending; consult the current acceptance record.
