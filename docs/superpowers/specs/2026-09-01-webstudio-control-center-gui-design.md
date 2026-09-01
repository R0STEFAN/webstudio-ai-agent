# Webstudio Control Center GUI — Design Specification

**Author:** R0STEFAN & Antigravity  
**Date:** 2026-09-01  
**Status:** Ready for Review  

---

## 1. Overview & Objectives

The **Webstudio Control Center GUI** is an intuitive, zero-dependency, local web application designed to manage the Webstudio AI Agent toolkit directly from a browser. It enables developers and non-technical users to clone the repository, launch the GUI with a single click, and perform all lifecycle operations without touching the terminal.

### Key Capabilities:
1. **Two-Phase Adaptive Interface:**
   - **First-Run Mode (Onboarding):** If Webstudio and dependencies are not yet installed in `node_modules/`, the UI displays a clean setup wizard with a prominent **"Install Dependencies"** button and live console logs.
   - **Workspace Mode (Active):** Once dependencies are installed, the UI automatically transitions to the full control dashboard with project link, sync, draft sync by `buildId`, cookie management, asset upload, cloud import, and telemetry.
2. **Seamless Project Linking & Draft Syncing:**
   - Single **Share Link** input automatically parses `projectId`, `origin`, and `authToken`.
   - Dedicated **Build ID** input for unpublished draft projects (`npx webstudio sync --buildId <id> --origin <origin> --authToken <token>`).
3. **Session & Asset Management:**
   - Simple input fields for `Cookie` and `CSRF Token` that write safely to `.webstudio/session.json`.
4. **Version & Update Management:**
   - Live version indicator in the footer (`Webstudio: v0.296.0`).
   - "Check Updates" button fetching the latest version from the npm registry.
   - One-click "Update to Latest" action (`npm run update-webstudio`) with live log streaming.
5. **Full Internationalization (i18n):**
   - Native toggle between Ukrainian (UA 🇺🇦) and English (EN 🇬🇧) covering 100% of labels, tooltips, placeholders, and error messages.
6. **Real-Time Log Terminal:**
   - Server-Sent Events (SSE) streaming every line of command `stdout` and `stderr` directly into an interactive console window with autoscroll, clear, and copy features.

---

## 2. Architecture & Tech Stack

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CLIENT (GUI)                            │
│  gui/index.html + gui/app.js + gui/i18n.js + gui/styles.css (Dark Mode)   │
│  - Reactive state management                                              │
│  - SSE log subscriber (EventSource /api/logs)                             │
│  - Instant language switcher (UA / EN)                                    │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ HTTP REST + SSE Stream
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS LOCAL SERVER (NO EXTRA DEPS)                   │
│                         scripts/gui-server.mjs                            │
│  - Uses native node:http, node:child_process, node:fs, node:path          │
│  - Manages asynchronous spawned processes                                 │
│  - Streams stdout/stderr chunks via SSE                                   │
│  - Auto-opens browser on http://localhost:4200                            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ Executes native commands
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              LOCAL WORKSPACE SCRIPTS & WEBSTUDIO MCP RUNTIME              │
│  - npm install / npm run update-webstudio                                 │
│  - scripts/setup-local-mcp.mjs                                            │
│  - npx webstudio link / sync / import                                     │
│  - scripts/upload-assets.mjs                                              │
│  - .webstudio/data.json & .webstudio/session.json                         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Why Pure Node.js (No Heavy Dependencies)?
- Requires **zero external server packages** (no Express, no Fastify, no Electron).
- Works immediately upon cloning using Node.js `>=20.0.0` or `>=22.12.0`.
- Fast boot time (<100ms) on port `4200` (auto-fallback if busy).

---

## 3. Server Endpoints & API Contract

### `GET /api/status`
Returns the current workspace status:
```json
{
  "installed": true,
  "webstudioVersion": "0.296.0",
  "latestVersion": "0.296.0",
  "hasUpdate": false,
  "linked": true,
  "projectId": "bda39d1b-a8f1-4b2a-9677-9fe4ffb01079",
  "origin": "https://p-bda39d1b-a8f1-4b2a-9677-9fe4ffb01079.apps.webstudio.is",
  "hasSession": true,
  "projectStats": {
    "pages": 2,
    "instances": 302,
    "assets": 5
  }
}
```

### `POST /api/action`
Dispatches a background task with live SSE log output.
Payload format:
```json
{
  "action": "install" | "update" | "link" | "sync" | "sync-draft" | "save-session" | "upload-assets" | "import" | "check-updates",
  "params": {
    "shareLink": "https://p-...",
    "buildId": "a173613c-2453-4ebe-b2ea-a10d304741cf",
    "cookie": "...",
    "csrfToken": "..."
  }
}
```

### `GET /api/logs`
Server-Sent Events endpoint emitting live progress:
- `event: log`, `data: { "text": "...", "type": "stdout" | "stderr" | "system" }`
- `event: complete`, `data: { "action": "...", "success": true, "code": 0 }`

---

## 4. UI/UX Workflow & Components

### Phase 1: First-Run Setup (When `node_modules/webstudio` is missing)
- Centered Hero card explaining the initial setup.
- Big action button: **`[ ⚡ Встановити Webstudio та залежності / Install Dependencies ]`**.
- Real-time terminal log viewer streaming `npm install` and `postinstall` patches.
- Upon completion, the UI automatically transitions to Phase 2.

### Phase 2: Active Workspace Dashboard
Organized into a clean 2-column layout:
1. **Left Column (Actions & Forms):**
   - **Section 1: Project Connection**
     - Share Link input (extracts `projectId`, `origin`, and `token`).
     - Build ID input (optional, with clear tooltip explaining draft sync).
     - Buttons: `[ 🔗 Прив'язати / Link ]`, `[ 🔄 Синхронізувати / Sync ]`, `[ ⚡ Синхронізувати чернетку / Sync Draft ]`.
   - **Section 2: Asset Session Bridge**
     - Cookie & CSRF token inputs with 10-second DevTools copy guide.
     - Button: `[ 💾 Зберегти сесію / Save session.json ]`.
   - **Section 3: Cloud Synchronization**
     - Buttons: `[ 📤 Завантажити картинки / Upload Assets ]`, `[ ☁️ Імпортувати в хмару / Cloud Import ]`.
2. **Right Column (Telemetry & Logs):**
   - Interactive Terminal Viewer with dark ANSI color parsing, auto-scroll, clear, and copy buttons.
   - Project Statistics Card showing live page count, instance count, and local data status.
3. **Footer Bar:**
   - Left: Installed Webstudio CLI version + status badge.
   - Center: `[ 🔄 Перевірити оновлення / Check Updates ]` button.
   - Right: Update banner `[ ⚡ Оновити до v... / Update to v... ]` (appears only when newer version exists on npm).

---

## 5. File Structure to Add

```text
webstudio-ai-agent/
├── scripts/
│   └── gui-server.mjs           # Native Node.js HTTP server & process runner
├── gui/
│   ├── index.html               # Semantic HTML5 SPA layout
│   ├── app.js                   # Client controller, state & SSE handler
│   ├── i18n.js                  # UA & EN dictionary
│   └── styles.css               # Modern dark-mode industrial design system
├── start-gui.bat                # Windows double-click quick launcher
└── package.json                 # Added "gui": "node scripts/gui-server.mjs"
```

---

## 6. Verification & Acceptance Criteria

1. **First-run verification:** Starting with deleted `node_modules` displays the setup wizard, clicking Install successfully runs `npm install`, patches Webstudio, and transitions to the main dashboard.
2. **Link & Sync verification:** Entering a Share Link runs `webstudio link` and `webstudio sync`, displaying live logs in the console.
3. **Draft Sync verification:** Entering `buildId` and Share Link correctly constructs and executes `webstudio sync --buildId <id> --origin <origin> --authToken <token>`.
4. **Session verification:** Entering cookie/csrf token saves `.webstudio/session.json` and reflects in status.
5. **Update check verification:** Clicking "Check Updates" queries npm registry, compares semantic versions, and shows update banner when applicable.
6. **i18n verification:** Switching between UA and EN immediately updates 100% of visible text elements without page reload.
