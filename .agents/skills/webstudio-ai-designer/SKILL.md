---
name: webstudio-ai-designer
description: Comprehensive guide and toolkit for designing, mutating, and syncing Webstudio projects using local fast-edit JSON mutations and cloud push (webstudio import). Use whenever creating new pages, editing styles, generating UI components, or syncing Webstudio designs.
---

# Webstudio AI Designer Skill

## 1. Architecture & Protocol

Webstudio stores the complete source of truth for an entire visual site inside `.webstudio/data.json` and assets inside `.webstudio/assets/`.

### The Offline AI Protocol:
```
   [AI Assistant / LLM]
           │
           ▼
 [Local Webstudio MCP Tools] ──► mutates local `.webstudio/data.json` in <500ms
           │
           ▼
 [`webstudio import --to "<shareLink>"`] ──► commits state to Webstudio Cloud
```

---

## 2. Setting Up Local MCP on Any Machine

To enable 100% offline MCP execution:
```bash
# 1. Install official Webstudio CLI
npm i -g webstudio

# 2. Run the patcher once
node scripts/setup-local-mcp.mjs
```

---

## 3. Official MCP Command Reference

Run any of the 70+ official Webstudio MCP tools locally:

### Reading Project Data:
```bash
webstudio mcp single-op-call list-pages "{}"
webstudio mcp single-op-call list-instances '{"pagePath":"/services"}'
webstudio mcp single-op-call list-breakpoints "{}"
webstudio mcp single-op-call list-assets "{}"
webstudio mcp single-op-call list-design-tokens "{}"
webstudio mcp single-op-call list-resources "{}"
```

### Mutating UI with JSX (`insert-fragment`):
Always prefer creating payloads in a temporary JSON file and passing `--input-file payload.json`:
```json
{
  "parentInstanceId": "<parent-instance-id>",
  "fragment": "<ws.element ws:tag='section' ws:tokens={[token('token-card', css`background-color: #fff; border-radius: 16px; padding: 24px;`)]} ws:style={css`max-width: 1200px; margin: 0 auto; display: flex; flex-direction: row; @media (max-width: 767px) { flex-direction: column; }`}><ws.element ws:tag='h2'>Title</ws.element></ws.element>"
}
```
Run:
```bash
webstudio mcp single-op-call insert-fragment --input-file payload.json
```

### Dynamic Data Resources & Collections:
1. **Create JSON Variable**:
```bash
webstudio mcp single-op-call create-variable --input-file var.json
```
`var.json`:
```json
{
  "scopeInstanceId": "<body-instance-id>",
  "name": "pricingPlans",
  "value": {
    "type": "json",
    "value": [
      { "title": "Starter", "price": "$49" },
      { "title": "Pro", "price": "$99" }
    ]
  }
}
```

2. **Insert Dynamic Collection**:
```bash
webstudio mcp single-op-call insert-collection --input-file collection.json
```
`collection.json`:
```json
{
  "parentInstanceId": "<grid-container-id>",
  "data": {
    "type": "expression",
    "value": "pricingPlans"
  },
  "itemFragment": "<ws.element ws:tag='div' style={{ padding: 24, backgroundColor: '#fff', borderRadius: 16 }}><ws.element ws:tag='h3'>{expression`collectionItem.title`}</ws.element><ws.element ws:tag='div'>{expression`collectionItem.price`}</ws.element></ws.element>"
}
```

### Radix UI Popups / Modals:
Structure:
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

### Animation Groups (`<animation.AnimateChildren>`):
Wrap any container or collection in `@webstudio-is/sdk-components-animation:AnimateChildren`:
```json
{
  "updates": [
    {
      "instanceId": "<anim-instance-id>",
      "name": "action",
      "type": "animationAction",
      "value": {
        "type": "view",
        "animations": [
          {
            "timing": {
              "duration": { "type": "unit", "value": 800, "unit": "ms" },
              "rangeStart": { "type": "unit", "value": 10, "unit": "%" },
              "easing": "ease-out",
              "fill": "backwards"
            },
            "keyframes": [
              { "offset": 0, "styles": { "opacity": "0", "transform": "translateY(40px)" } },
              { "offset": 1, "styles": { "opacity": "1", "transform": "translateY(0px)" } }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## 4. Cloud Push Highway

After generating or mutating your local design, push all pages, styles, assets, and variables directly into Webstudio Cloud:
```bash
webstudio import --to "https://p-<projectId>.apps.webstudio.is/?authToken=<token>"
```
* Bypasses all API key / Free tier write restrictions.
* Restores complete cloud state in 3-5 seconds.
