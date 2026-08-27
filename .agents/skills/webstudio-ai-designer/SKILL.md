---
name: webstudio-ai-designer
description: Comprehensive guide and toolkit for designing, mutating, and syncing Webstudio projects using local fast-edit JSON mutations and cloud push (webstudio import). Use whenever creating new pages, editing styles, generating UI components, or syncing Webstudio designs.
---

# Webstudio AI Designer Skill

## 1. Architecture & Protocol

Webstudio stores the complete source of truth for an entire visual site inside `.webstudio/data.json` and assets inside `.webstudio/assets/`.

### 🚨 CORE DIRECTIVE FOR AI AGENTS:
1. **100% MCP Execution:** You MUST ALWAYS use the official Webstudio MCP tools (`npx webstudio mcp single-op-call <tool>`) to perform all project operations (creating pages, extracting slots, inserting UI fragments, modifying styles, creating variables, auditing, etc.).
2. **NEVER Edit `.webstudio/data.json` Manually:** The schema and immer patch trees are complex. Relying exclusively on native MCP tool execution ensures 100% data integrity and builder compatibility.
3. **Always Run Locally:** All 70+ MCP commands execute locally in <500ms via our local runtime bridge.

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
npx webstudio mcp single-op-call <tool-name> '<json-payload>'
# Or using an input file:
npx webstudio mcp single-op-call <tool-name> --input-file <payload.json>
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
* `apply-styles` — Apply CSS styles to an element on specific breakpoints.
* `list-styles` — List all applied styles across instances.
* `list-style-sources` — List style sources and rules.

### 💎 Design Tokens as CSS Classes (DRY Protocol)
* `list-design-tokens` — List all reusable design tokens (CSS classes).
* `create-design-token` — Create reusable class (`{"name":"btn-primary","style":{...}}`).
* `update-design-token` — Update styles inside a design token class.
* `delete-design-token` — Delete a design token.
* `define-css-variable` — Define project-level CSS variables (`--color-primary`).
* `delete-css-variable` — Delete CSS custom property definitions.
* `rewrite-css-variable-refs` — Rewrite `var(...)` references.

### ⚙️ Props & Event Bindings
* `bind-props` — Bind properties (`href`, `target`, `id`, `src`, `alt`) to an instance.
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

### 🔍 Audit & Project Health
* `audit` — Full project diagnostic audit (validates instance trees, broken refs, slot bindings, styles). Returns 0 errors when clean.
* `whoami` — Inspect active auth token.
* `permissions` — Inspect project permissions.
* `inspect` — Show project summary and version history.
* `snapshot` — Read full project snapshot.

---

## 4. UI Patterns & Best Practices

### Design Tokens as CSS Classes (DRY Protocol):
In Webstudio, Design Tokens function directly as **reusable CSS Classes**. Whenever styling repeating UI elements, ALWAYS declare and reuse tokens via `ws:tokens={[token('<class-name>', css`...`)]}` instead of hardcoded local styles. Do NOT prefix with `token-`.

Standard Class Taxonomy:
- `btn-primary`, `btn-secondary`, `btn-outline` (Buttons)
- `card-surface`, `card-feature`, `card-glass` (Cards & Containers)
- `badge-primary`, `badge-success`, `badge-warning` (Badges & Tags)
- `heading-xl`, `heading-lg`, `text-body`, `text-muted` (Typography)

Example:
```jsx
<ws.element ws:tag='button' ws:tokens={[token('btn-primary', css`background-color: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: 600; text-decoration: none; border: 0; cursor: pointer;`)]}>
  Click Me
</ws.element>
```

### Mutating UI with JSX (`insert-fragment`):
```json
{
  "parentInstanceId": "<parent-instance-id>",
  "fragment": "<ws.element ws:tag='section' ws:tokens={[token('card-surface', css`background-color: #fff; border-radius: 16px; padding: 24px;`)]} ws:style={css`max-width: 1200px; margin: 0 auto; display: flex; flex-direction: row; @media (max-width: 767px) { flex-direction: column; }`}><ws.element ws:tag='h2'>Title</ws.element></ws.element>"
}
```

### Radix UI Popups / Modals:
```jsx
<radix.Dialog>
  <radix.DialogTrigger>
    <ws.element ws:tag='button'>Open Modal</ws.element>
  </radix.DialogTrigger>
  <radix.DialogOverlay ws:style={css`position: fixed; inset: 0; z-index: 50; background: rgb(0 0 0 / 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;`}>
    <radix.DialogContent ws:style={css`background: #fff; border-radius: 20px; padding: 32px; max-width: 500px; width: 100%; position: relative;`}>
      <$.Box>
        <radix.DialogTitle>Modal Title</radix.DialogTitle>
        <radix.DialogDescription>Modal description</radix.DialogDescription>
      </$.Box>
      <radix.DialogClose>✕</radix.DialogClose>
    </radix.DialogContent>
  </radix.DialogOverlay>
</radix.Dialog>
```

### Strict Breakpoints & Responsiveness Standard:

Webstudio provides 4 official standard breakpoints out-of-the-box:
1. `Base` — Desktop / default styles (no media query)
2. `Tablet` — `@media (max-width: 991px)`
3. `Mobile landscape` — `@media (max-width: 767px)`
4. `Mobile portrait` — `@media (max-width: 479px)`

> 🚨 **CRITICAL RULE:**
> **NEVER** write arbitrary media queries (such as `@media (max-width: 768px)`, `@media (max-width: 640px)`, `@media (max-width: 600px)`, or `@media (max-width: 575px)`).
> If you use arbitrary pixel numbers, Webstudio's JSX compiler will create unwanted custom breakpoints in the builder toolbar.
> **ONLY** use `max-width: 991px`, `max-width: 767px`, and `max-width: 479px`.

#### Responsiveness Checklist for Every Component:
- **Grids & Layouts:**
  - Desktop: Multi-column (e.g. `grid-template-columns: repeat(4, 1fr)` or `1.2fr 0.8fr`).
  - Tablet (`max-width: 991px`): 2-columns (e.g. `grid-template-columns: repeat(2, 1fr)`).
  - Mobile (`max-width: 767px`): 1-column (`grid-template-columns: 1fr; width: 100%;`).
- **Flex Containers & Actions:**
  - Multi-button strips must switch to `flex-direction: column; width: 100%;` on mobile (`max-width: 767px`).
  - All CTA buttons must have full width or centered content on mobile screens.
- **Typography Scale:**
  - Hero H1: Desktop `46-52px` ➔ Tablet `36-38px` ➔ Mobile `28-30px`.
  - Section H2: Desktop `32-36px` ➔ Tablet `28-30px` ➔ Mobile `24-26px`.
  - Body Text: Desktop `16-18px` ➔ Mobile `14-15px`.
- **Containers & Paddings:**
  - Sections must have `width: 100%; box-sizing: border-box;`.
  - Padding: Desktop `64px 24px` ➔ Mobile `36px 16px`. No horizontal scrollbars!

### 🎬 Native Webstudio Animation Standard:

Webstudio provides first-class native components for scroll-driven and viewport intersection animations via the `animation` namespace (`@webstudio-is/sdk-components-animation:`).

#### 1. Available Animation Components:
* `<animation.AnimateChildren action={...}>` — **Animation Group**: The parent wrapper that defines the trigger timeline and keyframe animation rules via the `action` prop.
* `<animation.StaggerAnimation slidingWindow={1} easing="easeOut" ws:style={css`...`}>` — **Stagger Animation**: Wraps multiple child elements (cards, list items, bento blocks) to animate them in a smooth sequence. It also acts as the layout container (Grid/Flex).
* `<animation.AnimateText slidingWindow={1} easing="linear" splitBy="char">` — **Text Animation**: Splits headings or paragraphs by character, word, or symbol for typewriter and staggered text reveals.
* `<animation.VideoAnimation action={...}>` — **Video Animation**: Controls video playback timeline on scroll.

#### 2. Animation Types (`action.type`):
* `type: "view"` — **Viewport Intersection**: Triggers when the element enters/exits the browser screen.
* `type: "scroll"` — **Scroll Timeline**: Progresses proportionally as the user scrolls the page.

#### 3. Standard Built-in Range Presets (`rangeStart` & `rangeEnd`):
Webstudio uses CSS Scroll-Driven Animation range phases:
1. `["cover", { type: "unit", value: 0, unit: "%" }]` (or `entry 0%`) — **Bottom of Viewport**: When the element just begins to appear at the bottom of the screen.
2. `["contain", { type: "unit", value: 0, unit: "%" }]` (or `entry 100%`) — **Fully Visible Bottom**: When the element has fully entered the viewport.
3. `["contain", { type: "unit", value: 50, unit: "%" }]` — **Center of Viewport**: When the element is centered in the screen.
4. `["contain", { type: "unit", value: 100, unit: "%" }]` — **Starts Leaving Top**: When the element begins to leave the top of the viewport but is still fully visible.
5. `["cover", { type: "unit", value: 100, unit: "%" }]` (or `exit 100%`) — **Top of Viewport**: When the element has completely exited the top of the screen.

#### 4. Timing, Duration & Easing:
* **Fixed Duration (Optional):** `duration: { type: "unit", value: 400, unit: "ms" }` — sets a fixed time transition once triggered by `rangeStart` instead of relying purely on scroll distance.
* **Fill:** `"backwards"` (prevents flash of unstyled content before entering), `"forwards"`, or `"both"`.
* **Easing:** `"ease-out"`, `"ease"`, `"linear"`, `"easeInOutCubic"`, or `"cubic-bezier(0.16, 1, 0.3, 1)"`.

#### 5. Code Pattern Example (Staggered Cards):
```jsx
<animation.AnimateChildren
  action={{
    type: "view",
    animations: [
      {
        name: "Cards Stagger Entrance",
        timing: {
          fill: "backwards",
          duration: { type: "unit", value: 400, unit: "ms" },
          rangeStart: ["cover", { type: "unit", value: 0, unit: "%" }],
          rangeEnd: ["contain", { type: "unit", value: 0, unit: "%" }],
          easing: "ease-out"
        },
        keyframes: [
          {
            offset: 0,
            styles: {
              opacity: { type: "unit", value: 0, unit: "number" },
              transform: { type: "unparsed", value: "translateY(24px)" }
            }
          },
          {
            offset: 1,
            styles: {
              opacity: { type: "unit", value: 1, unit: "number" },
              transform: { type: "unparsed", value: "translateY(0px)" }
            }
          }
        ]
      }
    ]
  }}
>
  <animation.StaggerAnimation slidingWindow={1} easing="easeOut" ws:style={css`display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; box-sizing: border-box; @media (max-width: 991px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 767px) { grid-template-columns: 1fr; }`}>
    <ws.element ws:tag="div" ws:tokens={[token('card-surface', css`background: #fff; padding: 24px; border-radius: 16px;`)]}>
      Card 1
    </ws.element>
    <ws.element ws:tag="div" ws:tokens={[token('card-surface', css`background: #fff; padding: 24px; border-radius: 16px;`)]}>
      Card 2
    </ws.element>
  </animation.StaggerAnimation>
</animation.AnimateChildren>
```



## 5. Cloud Push Highway

After generating or mutating your local design, push all pages, styles, assets, and variables directly into Webstudio Cloud:
```bash
npx webstudio import --to "https://p-<projectId>.apps.webstudio.is/?authToken=<token>"
```
* Automatically uploads new assets via session bridge.
* Restores complete cloud state in 3-5 seconds.
