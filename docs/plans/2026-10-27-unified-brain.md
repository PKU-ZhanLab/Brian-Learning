# Unified atlas display

Use the existing FSL MNI152NLin6Asym pial geometry for DK, AAL and AAL3. Keep the saved Colin27-to-FSL transform and all source volumes unchanged. Display the AAL registration as a project estimate. Sample categorical cortical labels at 11 depths between paired pial and white vertices, choose the most frequent positive allowed ID, keep uncovered ribbons and the medial wall unlabelled. Deep nuclei and cerebellum remain in the full label volumes and slice/ROI views.

Keep the main camera and visibility settings when switching cortical atlases. Default AAL entries to their registered variants; provide a separate original-space button. The label explorer retains its boundary model and adds orthogonal T1 slices for verified atlas/template pairs. Original AAL/AAL3 use Colin27; registered and other eligible atlases use FSL T1. Slice coordinates remain local to each reference. Save view type, crosshair and overlay opacity in project files and view links.

Verify source hashes, projection coverage and label membership, identical pial geometry, picking, coordinate orientation, view serialization, browser display and public deployment asset hashes.
