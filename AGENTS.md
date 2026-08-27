# Webstudio AI Assistant Guide & Rules

## Project Architecture & Workflow
This repository contains the Webstudio visual web builder and an AI agent design workflow.

### AI Design & Cloud Sync Protocol:
1. **Local State Source of Truth:** All site pages, instances, and styles are stored in `.webstudio/data.json`.
2. **Assets:** All images and fonts reside in `.webstudio/assets/`.
3. **Design Tokens as CSS Classes (DRY Styles):** NEVER duplicate styles across repeating elements (buttons, cards, badges, headings). Always declare and attach reusable Design Tokens as CSS classes using `ws:tokens={[token('<class-name>', css`...`)]}` (e.g. `btn-primary`, `card-surface`, `badge-success` — do NOT prefix with `token-`).
4. **Execution Skill:** Always use the `webstudio-ai-designer` skill (`.agents/skills/webstudio-ai-designer/SKILL.md`) when creating or modifying Webstudio designs.
5. **Native MCP Tools (100% Local):** All 70+ official Webstudio MCP tools run locally via:
   ```bash
   npx webstudio mcp single-op-call <tool> --input-file <payload.json>
   # Setup once per project: npm i webstudio && node scripts/setup-local-mcp.mjs --local
   ```
6. **Asset Upload & Cloud Sync Protocol:**
   - When generating new local images in `.webstudio/assets/`, run:
     ```bash
     npm run upload-assets
     ```
     This automatically uploads images via the session cookie in `.webstudio/session.json`, remaps all image `src` props in `data.build.props`, and syncs with Webstudio Cloud.
   - To manually push project structure to Webstudio Cloud:
     ```bash
     npx webstudio import --to "<shareLink>"
     ```
7. **Strict Breakpoints & Responsive Design Rules:**
   - **ONLY Standard Webstudio Breakpoints:** Webstudio strictly supports 4 standard breakpoints:
     - `Base` (Desktop / default, no media query)
     - `@media (max-width: 991px)` (Tablet)
     - `@media (max-width: 767px)` (Mobile landscape / general mobile)
     - `@media (max-width: 479px)` (Mobile portrait)
   - **CRITICAL:** NEVER write arbitrary media queries (e.g. `@media (max-width: 768px)`, `@media (max-width: 640px)`, `@media (max-width: 575px)`). Any non-standard media query causes Webstudio to create unwanted custom breakpoints in the builder toolbar.
   - **Mandatory Responsiveness:** Every section must be 100% responsive:
     - Multi-column grids must collapse to 2 columns on Tablet (`max-width: 991px`) and 1 column on Mobile (`max-width: 767px`).
     - Buttons and CTAs must be full-width (`width: 100%`) or neatly stacked in `flex-direction: column` on mobile screens.
     - Headings must scale down on mobile (Hero H1: 28-32px, Section H2: 24-26px, Body: 14-15px).
     - Containers must have `width: 100%; box-sizing: border-box;` and responsive horizontal paddings (`16px` on mobile, `24px` on desktop) to prevent any horizontal scrolling.
8. **Strict Animation & Micro-Interactions Standard:**
   - **Hardware Acceleration:** Only animate `transform` and `opacity` for smooth 60 FPS rendering. Never animate geometry properties (`width`, `height`, `margin`, `padding`, `top`, `left`).
   - **Timing & Easing:** Micro-interactions (hover/tap) must be fast and responsive (`150ms-200ms`, `cubic-bezier(0.16, 1, 0.3, 1)`). Avoid sluggish >500ms floaty animations.
   - **Interactive States:** All buttons (`btn-primary`, `btn-secondary`) and cards (`card-surface`) must have explicit hover lift (`translateY(-2px)` or `-4px`) and active press feedback (`scale(0.98)`).
9. **CLI Toolkit:** Pre-built scripts are available in `scripts/ai-designer/` (`engine.mjs` and `cli.mjs`) and `scripts/upload-assets.mjs`.


