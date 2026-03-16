# Research, discoveries, constraints
## Reference Website Analysis (https://karpathy.ai/jobs/)
- **Theme**: High-contrast Dark Mode (e.g. #0B0F19 background).
- **Typography**: Modern sans-serif (Inter/system-ui).
- **Color Palette**: Muted colors (Emerald Green #2D5A27, Maroon/Red #8B2D2D, Brown/Gold #5E4A2B) with bright white text for high contrast.
- **Layout**: Header with GitHub link and intro text; Layer toggles (BLS Outlook, Median Pay, etc.); Dashboard cards for stats; Main Treemap visualization taking most of the viewport space.
- **Treemap functionality**: Hierarchical grouping by categories, proportional sizing, smooth color transitions across cells when toggling layers. Tooltips on hover, click to open BLS page.
- **Constraint**: We need to match this behavior and copy closely in the `app.js`, `index.html`, and `styles.css`.
