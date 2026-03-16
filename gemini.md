# Project Constitution (Data schemas, Behavioral rules, Architectural invariants)

## Discovery Answers
1. **North Star:** Make the JobViz app look and act exactly like the reference US Job Market Visualizer at https://karpathy.ai/jobs/.
2. **Integrations:** None required (static web app).
3. **Source of Truth:** `data.json` located at the project root.
4. **Delivery Payload:** Static files (`index.html`, `styles.css`, `app.js`, `data.json`) deployed via GitHub Pages from the `main` branch.
5. **Behavioral Rules:** 
    - Use a muted treemap color palette (e.g. muted emerald green/maroon/brown) with strong text contrast.
    - Match behavior and copy of the reference website closely.
    - Handle `git add/commit/push` end-to-end when asked.

## Architectural invariants
- Static web app served from `index.html`, `styles.css`, `app.js`, and `data.json` at the project root.
