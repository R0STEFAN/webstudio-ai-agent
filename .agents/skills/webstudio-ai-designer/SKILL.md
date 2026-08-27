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

### 💎 Design Tokens & CSS Variables (DRY Protocol)
* `list-design-tokens` — List all reusable design tokens.
* `create-design-token` — Create reusable token (`{"name":"token-btn-primary","style":{...}}`).
* `update-design-token` — Update styles inside a design token.
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

### Design Token First Protocol:
Whenever styling repeating UI elements, ALWAYS declare and reuse Design Tokens via `ws:tokens={[token('token-<name>', css`...`)]}` instead of hardcoded local styles.

Standard Token Taxonomy:
- `token-btn-primary`, `token-btn-secondary`, `token-btn-outline` (Buttons)
- `token-card-surface`, `token-card-feature` (Cards & Containers)
- `token-badge-<color>` (Badges & Tags)
- `token-text-heading`, `token-text-muted` (Typography)

### Mutating UI with JSX (`insert-fragment`):
```json
{
  "parentInstanceId": "<parent-instance-id>",
  "fragment": "<ws.element ws:tag='section' ws:tokens={[token('token-card', css`background-color: #fff; border-radius: 16px; padding: 24px;`)]} ws:style={css`max-width: 1200px; margin: 0 auto; display: flex; flex-direction: row; @media (max-width: 767px) { flex-direction: column; }`}><ws.element ws:tag='h2'>Title</ws.element></ws.element>"
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

---

## 5. Cloud Push Highway

After generating or mutating your local design, push all pages, styles, assets, and variables directly into Webstudio Cloud:
```bash
npx webstudio import --to "https://p-<projectId>.apps.webstudio.is/?authToken=<token>"
```
* Automatically uploads new assets via session bridge.
* Restores complete cloud state in 3-5 seconds.
