# Retinal card models

The imaging cards now render actual WebGL geometry instead of the sample scan photographs:

- OCT: ten closed tissue volumes with rounded margins, independently undulating boundaries, layers converging at the central depression, cellular material detail, and surface vessels.
- Fundus: a sculpted posterior retinal cup and scleral cut edge, macular pigmentation, an integrated cupped optic nerve head, and branching arterial and venous trees.

The vascular geometry is projected onto each curved surface and tapers from the main arcades into fine branches. Each tree is merged into two draw calls. Softer reflections and irregular tissue boundaries avoid polished plastic surfaces and uniform stacked bands. Card-specific geometry and material refinements are isolated from the main scrolling eye.

These are illustrative anatomical models, not reconstructions of patient scans. Both reuse the generated tissue material atlas documented in `eye-texture-notes.md`. The original demo scans and upload functions remain unchanged.

`oct-model-poster.webp` and `fundus-model-poster.webp` are transparent captures of the respective rendered models. They provide matching loading/context-loss fallbacks. WebGL initializes near the viewport, renders only on changes while visible, respects reduced motion, and disposes its resources when leaving the landing view.
