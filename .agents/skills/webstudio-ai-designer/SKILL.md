---
name: webstudio-ai-designer
description: Comprehensive guide and toolkit for designing, mutating, and syncing Webstudio projects using local fast-edit JSON mutations and cloud push (webstudio import). Use whenever creating new pages, editing styles, generating UI components, or syncing Webstudio designs.
---

# Webstudio AI Designer Skill

## 1. Architecture & Protocol

Webstudio stores the complete source of truth for an entire visual site inside `.webstudio/data.json` and assets inside `.webstudio/assets/`.

### 🚨 CORE DIRECTIVE FOR AI AGENTS:
1. **100% MCP Execution:** You MUST ALWAYS use the official Webstudio MCP tools (`npx webstudio mcp single-op-call <tool> --input-file <payload.json>`) to perform all project operations (creating pages, extracting slots, inserting UI fragments, modifying styles, creating variables, auditing, etc.).
2. **NEVER Edit `.webstudio/data.json` Manually:** The schema and immer patch trees are complex. Relying exclusively on native MCP tool execution ensures 100% data integrity and builder compatibility.
3. **JSON-First Payload Pattern (`--input-file`):** Always save MCP tool arguments into a temporary JSON file (e.g. `.temp/payload.json`) and execute with `--input-file`. This completely eliminates Windows/POSIX shell escaping, quoting, and length limit issues.
4. **Always Run Locally:** All 70+ MCP commands execute locally in <500ms via our local runtime bridge.

### The Offline AI Protocol:
```
   [AI Assistant / LLM]
           │
           ▼
 [Local Webstudio MCP Tools] ──► mutates local `.webstudio/data.json` via official runtime
           │
           ▼
 [`webstudio import --to "<shareLink>"`] ──► commits state to Webstudio Cloud
```

---

## 2. Setting Up Local MCP in Any Project

To enable 100% offline MCP execution locally inside a project:
```bash
# 1. Install Webstudio locally in your project folder
npm i webstudio

# 2. Run the patcher for local node_modules
node scripts/setup-local-mcp.mjs --local
```

---

## 3. Complete 70+ Webstudio MCP Tool Dictionary

All tools are executed locally via:
```bash
npx webstudio mcp single-op-call <tool-name> --input-file <payload.json>
# Or for small payloads:
npx webstudio mcp single-op-call <tool-name> '<json-payload>'
```

### 📄 Pages & Project Routing
* `list-pages` — List all pages in the project.
* `get-page` — Get details of a specific page by `pageId`.
* `get-page-by-path` — Get page details by path (e.g. `{"path":"/hospital"}`).
* `create-page` — Create a new page (`{"name":"Hospital","path":"/hospital","title":"Hospital"}`).
* `update-page` — Update page title, description, path, or meta settings.
* `delete-page` — Delete a page by `pageId`.
* `duplicate-page` — Clone an existing page.
* `reorder-pages` — Change display order of pages.

### 🧩 Slots & Reusable Components
* `extract-slot` — Extract an existing component instance into a reusable slot (`{"instanceId":"<id>"}`).
* `attach-slot` — Attach a reusable slot to a container (`{"parentInstanceId":"<id>","slotId":"<id>","insertIndex":0}`).
* `detach-slot` — Detach slot and convert back to independent instances.
* `list-slots` — List all project slots and fragments.
* `get-slot` — Get slot details and root instance.
* `insert-fragment` — Insert full JSX UI fragment into container (`{"parentInstanceId":"<id>","fragment":"..."}`).
* `insert-component` — Insert a single system component (e.g. `Box`, `Heading`, `Paragraph`, `Button`).
* `insert-collection` — Insert dynamic data collection bound to variable.

### 🌳 Tree & Element Manipulation
* `list-instances` — List all element instances for a page (`{"pagePath":"/hospital"}`).
* `get-instance` — Get instance details and children by `instanceId`.
* `clone-instance` — Duplicate an element and its subtree.
* `reparent-instance` — Move an element into a new parent container.
* `reorder-instances` — Change order of child elements within a parent.
* `delete-instance` — Delete element instance and all its children.
* `find-instances` — Search elements by tag, component, or label.

### 🎨 Styles & Responsive Breakpoints
* `list-breakpoints` — List responsive breakpoints (`base`, `768px`, `1280px`, etc.).
* `create-breakpoint` — Add a custom media query breakpoint.
* `update-breakpoint` — Modify min/max width of a breakpoint.
* `delete-breakpoint` — Remove a custom breakpoint.
* `apply-styles` / `update-styles` — Apply CSS styles and state declarations (`:hover`, `:focus`) to an element.
* `list-styles` — List all applied styles across instances.
* `list-style-sources` — List style sources and rules.

### 💎 Design Tokens & Native States (DRY Protocol)
* `list-design-tokens` — List all reusable design tokens (CSS classes).
* `create-design-token` — Create reusable token class (`{"tokens":[{"name":"btn-primary","styles":{...}}]}`).
* `update-design-token-styles` — Create or update declarations and native states (`state: ":hover"`) on a token.
* `delete-design-token` — Delete a design token.
* `define-css-variable` — Define project-level CSS variables (`--color-primary`).
* `delete-css-variable` — Delete CSS custom property definitions.
* `rewrite-css-variable-refs` — Rewrite `var(...)` references.

### ⚙️ Props & Event Bindings
* `bind-props` — Bind properties (`href`, `target`, `id`, `src`, `alt`, `class`) to an instance.
* `update-props` — Update values of bound props.
* `delete-props` — Delete prop bindings from an instance.

### 📊 Dynamic Data Variables & API Resources
* `list-variables` — List all data variables.
* `create-variable` — Create JSON/String variable (`{"scopeInstanceId":"...","name":"items","value":{...}}`).
* `update-variable` — Update variable value or schema.
* `delete-variable` — Remove a data variable.
* `list-resources` — List external API / GraphQL resources.
* `create-resource` — Create an API / HTTP data resource.
* `update-resource` — Update endpoint URL, headers, or body.
* `delete-resource` — Delete an external resource.

### 📁 Assets & Folder Management
* `list-assets` — List all images, videos, and files.
* `get-asset` — Get metadata and URLs for a specific asset.
* `list-asset-folders` — List Asset Manager folders.
* `create-asset-folder` — Create folder in Asset Manager.
* `update-asset-folder` — Rename or move folder.
* `delete-asset-folder` — Delete folder and contained assets.
* `list-fonts` — List uploaded web fonts and system fonts.
* `find-asset-usage` — Find where an asset is used across pages.
* `replace-asset` — Replace all references to an asset with a new one.
* `delete-asset` — Delete asset by ID.

### 🔍 Audit & Visual Inspection
* `audit` — Full project diagnostic audit (validates instance trees, broken refs, slot bindings, styles). Returns 0 errors when clean.
* `screenshot` — Capture full-page or above-the-fold PNG screenshot (`{"path":"/","fullPage":true}`) for visual inspection.
* `verify-bindings` — Verify dynamic data bindings and static integrity.
* `whoami` — Inspect active auth token.
* `permissions` — Inspect project permissions.
* `inspect` — Show project summary and version history.
* `snapshot` — Read full project snapshot.

---

## 4. UI Patterns & Best Practices

### 💎 Design Tokens as Native CSS Classes & States:
In Webstudio, Design Tokens function directly as **reusable CSS Classes**. Whenever styling repeating UI elements, ALWAYS declare and reuse tokens via `ws:tokens={[token('<class-name>', css`...`)]}` instead of hardcoded local styles.

> 🚨 **CRITICAL SYNTAX RULES FOR TOKENS & STYLES:**
> 1. **`token()` always takes 2 arguments:** `token('<token-name>', css\`<base-styles>\`)`. Never pass a single argument.
> 2. **NO pseudo-selectors inside `css\`...\``:** Webstudio's CSS compiler parses `ws:style={css\`...\`}` and `token(..., css\`...\`)` strictly as property declarations and `@media` rules. Writing `&:hover`, `.class:hover`, or `@keyframes` inside `css\`...\`` will trigger compilation errors.
> 3. **Setting Native `:hover` States on Tokens:** Use `update-design-token-styles` with `"state": ":hover"` to register hover styles directly in Webstudio's native style system:
>    ```json
>    {
>      "designTokenId": "<tokenId>",
>      "updates": [
>        { "property": "--card-translate-y", "value": "0px" },
>        { "property": "--card-translate-y", "state": ":hover", "value": "-6px" },
>        { "property": "--img-scale", "value": "1" },
>        { "property": "--img-scale", "state": ":hover", "value": "1.08" },
>        { "property": "--img-grayscale", "value": "100%" },
>        { "property": "--img-grayscale", "state": ":hover", "value": "0%" }
>      ]
>    }
>    ```
>    This makes all custom properties appear in the **Style panel (Advanced section)** and **State (:hover) dropdown** of the Webstudio Builder!

### ⚡ Cascading CSS Custom Properties Pattern on Parent Elements:
When building rich interactive cards (with image zooms, grayscale reveals, rotating arrow buttons, and floating pill badges):
1. Declare CSS variables (`--var`) on the parent Design Token (`card-project`, `card-marquee`).
2. Register the `:hover` variations on the parent token using `update-design-token-styles`.
3. Consume the variables on child tokens/instances:
   - **Image:** `filter: grayscale(var(--img-grayscale, 100%)) contrast(var(--img-contrast, 100%)); transform: scale(var(--img-scale, 1)); transition: filter 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1);`
   - **Floating Badge:** `opacity: var(--badge-opacity, 0); transform: translateY(var(--badge-translate-y, 10px)); transition: opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1);`
   - **Top-Right Arrow:** `background-color: var(--arrow-bg, #ffffff); color: var(--arrow-color, #000000); transform: scale(var(--arrow-scale, 1)); transition: background-color 400ms cubic-bezier(0.16, 1, 0.3, 1), color 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1);`

### 🏷️ Assigning CSS Classes via Element Props (Settings Panel):
> 🚨 **NEVER write `class: ...` inside `ws:style={css\`...\`}`.**
> To attach class names to an element in Webstudio JSX, ALWAYS use standard JSX attribute `className="..."`:
> ```jsx
> <ws.element ws:tag="div" className="interactive-target marquee-card" ws:tokens={[token('card-marquee', css`...`)]} ws:style={css`...`}>
> ```
> Webstudio automatically converts `className` into native element `class` props in the Settings panel.

### 🪟 Native Radix UI Modals & Navigation Drawers (`<radix.Dialog>`):
For fullscreen overlays, creative menus, and modal dialogs, ALWAYS use native `<radix.Dialog>` components:
```jsx
<radix.Dialog>
  <radix.DialogTrigger>
    <ws.element ws:tag="button" className="interactive-target" ws:tokens={[token('btn-nav', css`display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 0; cursor: pointer;`)]}>
      MENU +
    </ws.element>
  </radix.DialogTrigger>
  <radix.DialogOverlay ws:style={css`position: fixed; inset: 0; z-index: 99999; background: rgba(10, 10, 10, 0.96); backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center;`}>
    <radix.DialogContent ws:style={css`position: fixed; inset: 0; width: 100vw; height: 100vh; background-color: #0A0A0A; color: #FFFFFF; display: flex; flex-direction: column; justify-content: space-between; padding: 100px 48px 48px; box-sizing: border-box; overflow-y: auto;`}>
      <radix.DialogTitle ws:style={css`display: none;`}>Menu</radix.DialogTitle>
      <radix.DialogDescription ws:style={css`display: none;`}>Navigation</radix.DialogDescription>
      <radix.DialogClose className="interactive-target" ws:tokens={[token('btn-nav', css`...`)]} ws:style={css`position: absolute; top: 28px; right: 32px; background: transparent; border: 0; color: #ffffff; ...`}>
        CLOSE ✕
      </radix.DialogClose>
      {/* Navigation Matrix */}
    </radix.DialogContent>
  </radix.DialogOverlay>
</radix.Dialog>
```
* **Benefit:** Radix Dialog is hidden by default in the visual builder canvas and opens as a high-contrast modal when triggered, preventing accidental layout spills over the Hero section.

---

### 📐 Flexbox-First Layout Principle (Avoid CSS Grid Where Possible):

> 🎯 **RULE OF THUMB:** **Always prefer Flexbox over CSS Grid.**
> Flexbox is cleaner, more predictable, and dramatically easier to adapt on mobile devices.
> **Use CSS Grid ONLY for inherently complex 2D layouts** (e.g. complex asymmetric Bento Grids or calendar matrices).
> **If a layout can be accomplished with Flexbox, NEVER use CSS Grid.**

#### Standard Flexbox Layout Patterns:

1. **Card Container / Multi-Column Lists (Features, Doctors, Reviews, Pricing):**
   - **Container:**
     ```css
     display: flex;
     flex-wrap: wrap;
     gap: 24px;
     width: 100%;
     box-sizing: border-box;
     @media (max-width: 767px) {
       flex-direction: column;
       gap: 16px;
     }
     ```
   - **Child Cards:**
     ```css
     flex: 1 1 calc(33.333% - 16px);
     min-width: 280px;
     max-width: 100%;
     box-sizing: border-box;
     @media (max-width: 991px) {
       flex: 1 1 calc(50% - 12px);
     }
     @media (max-width: 767px) {
       flex: 1 1 100%;
       width: 100%;
     }
     ```

2. **Two-Column Split (Hero, About, Booking Funnel):**
   - **Container:**
     ```css
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 48px;
     width: 100%;
     box-sizing: border-box;
     @media (max-width: 991px) {
       flex-direction: column;
       gap: 32px;
       align-items: stretch;
     }
     ```
   - **Columns:** `flex: 1 1 50%; width: 100%; max-width: 100%; box-sizing: border-box;`

3. **Stats / Metrics Bar:**
   - **Container:**
     ```css
     display: flex;
     justify-content: space-between;
     align-items: center;
     gap: 24px;
     flex-wrap: wrap;
     width: 100%;
     box-sizing: border-box;
     @media (max-width: 767px) {
       flex-direction: column;
       gap: 20px;
     }
     ```
   - **Child Stat Item:** `flex: 1 1 200px; text-align: center;` ➔ Mobile: `width: 100%;`

---

### 📱 Strict Breakpoints & Responsive Design Standard:

Webstudio provides 4 official standard breakpoints out-of-the-box:
1. `Base` — Desktop / default styles (no media query)
2. `Tablet` — `@media (max-width: 991px)`
3. `Mobile landscape` — `@media (max-width: 767px)`
4. `Mobile portrait` — `@media (max-width: 479px)`

> 🚨 **CRITICAL BREAKPOINT RULE:**
> **NEVER** write arbitrary media queries (such as `@media (max-width: 768px)`, `@media (max-width: 640px)`, `@media (max-width: 600px)`, or `@media (max-width: 575px)`).
> If you use arbitrary pixel numbers, Webstudio's JSX compiler will automatically create unwanted custom breakpoints in the builder toolbar.
> **ONLY** use `max-width: 991px`, `max-width: 767px`, and `max-width: 479px`.

---

### 🎬 Native Webstudio Animation Standard:

Webstudio provides first-class native components for scroll-driven and viewport intersection animations via the `animation` namespace (`@webstudio-is/sdk-components-animation:`).

#### Available Animation Components:
* `<animation.AnimateChildren action={...}>` — **Animation Group**: The parent wrapper that defines the trigger timeline and keyframe animation rules via the `action` prop.
* `<animation.StaggerAnimation slidingWindow={1} easing="easeOut" ws:style={css`...`}>` — **Stagger Animation**: Wraps multiple child elements (cards, list items, bento blocks) to animate them in a smooth sequence.
* `<animation.AnimateText slidingWindow={1} easing="linear" splitBy="char">` — **Text Animation**: Splits headings or paragraphs by character, word, or symbol for typewriter and staggered text reveals.
* `<animation.VideoAnimation action={...}>` — **Video Animation**: Controls video playback timeline on scroll.

---

### 📊 Native Dynamic Data & Collections Standard (`ws.collection` & `Variable`):

* **Data Scoping to `Body`:** Dynamic data variables (JSON arrays, objects) are **declared and scoped to the `Body` instance (`scopeInstanceId = bodyId`)** so they are globally accessible across the entire page.
* **Collections (`<ws.collection>`):** Use `<ws.collection data={expression`${variableName}`} item={itemParam}>` to dynamically iterate through JSON arrays and render repeated cards/items.
* **Binding Verification:** Run `npx webstudio mcp single-op-call verify-bindings` to confirm complete static integrity and 0 broken data references.

---

### 👁️ Visual AI Inspection Loop (`screenshot`):
Before finishing any visual task, ALWAYS run a visual check using MCP screenshot:
```bash
npx webstudio mcp single-op-call screenshot '{"path":"/","fullPage":true}'
```
Read the resulting image path using the `read` tool to visually verify layout balance, spacing, contrast, and responsive integrity.

---

## 5. Cloud Push Highway

After generating or mutating your local design, push all pages, styles, assets, and variables directly into Webstudio Cloud:
```bash
npx webstudio import --to "https://p-<projectId>.apps.webstudio.is/?authToken=<token>"
```
* Automatically uploads new assets via session bridge.
* Restores complete cloud state in 3-5 seconds.

---

## 6. Automated Google Indexing API & Instant Search Push

Whenever new pages, articles, or tattoo works are created or updated, notify Googlebot immediately to crawl and index them within minutes instead of weeks:

```bash
# 1. Submit entire sitemap to Googlebot
npm run index

# 2. Submit specific URLs
npm run index -- https://tattoozp.com/pricing.md https://tattoozp.com/gallery/men
```

* **Service Account:** Uses `indexing-bot-*.json` key in the project root.
* **Standard:** Links in `/llms.txt` must always be formatted as Markdown links `[Title](https://...)` per `llmstxt.org` specification.
