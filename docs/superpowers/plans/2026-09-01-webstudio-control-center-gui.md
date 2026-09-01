# Webstudio Control Center GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency, lightweight, bilingual (UA/EN) local Web GUI Control Center for managing the Webstudio AI Agent toolkit, onboarding new installs, linking/syncing projects (including unpublished drafts by `buildId`), managing session credentials, and streaming real-time command logs.

**Architecture:** A native Node.js HTTP server (`scripts/gui-server.mjs`) serving a single-page dark-mode dashboard (`gui/index.html`, `gui/app.js`, `gui/i18n.js`, `gui/styles.css`). The server dispatches workspace commands via `child_process.spawn()` and broadcasts live terminal `stdout`/`stderr` logs through Server-Sent Events (SSE).

**Tech Stack:** Native Node.js (`node:http`, `node:child_process`, `node:fs`, `node:path`, `node:url`), Vanilla JS (ES6+), Server-Sent Events (SSE), Modern CSS3 (Dark Theme, Grid/Flexbox).

**Spec:** `docs/superpowers/specs/2026-09-01-webstudio-control-center-gui-design.md`

## Global Constraints

- **Zero External Dependencies:** Must run purely on Node.js built-ins (`node:http`, `node:fs`, `node:child_process`, `node:path`, etc.). No Express, Fastify, or Electron packages.
- **Node.js Compatibility:** Must work smoothly on Node.js `>=20.0.0` and `>=22.12.0` across Windows, macOS, and Linux.
- **Bilingual Guarantee:** 100% of visible UI elements, buttons, badges, errors, and tooltips must exist in both Ukrainian (`ua`) and English (`en`).
- **Two-Phase Adaptive UI:** When `node_modules/webstudio` is absent or unpatched, show only the Setup Wizard; upon successful installation, transition smoothly to the Active Workspace Dashboard without requiring a server restart.

---

### Task 1: Server Core & Static Asset Handler

**Files:**
- Create: `scripts/gui-server.mjs`
- Test: `scripts/gui-server.mjs` (Smoke test via Node.js invocation)

**Interfaces:**
- Consumes: Node.js standard libraries (`node:http`, `node:fs`, `node:path`, `node:url`).
- Produces: HTTP Server listening on port `4200` (auto-fallback if occupied) serving files from `./gui/` with appropriate MIME types (`text/html`, `text/javascript`, `text/css`, `image/svg+xml`, `application/json`).

- [ ] **Step 1: Write static file server in `scripts/gui-server.mjs`**

```javascript
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const guiDir = path.join(rootDir, 'gui');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

export function createGuiServer(port = 4200) {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;

    // Static file serving
    if (!pathname.startsWith('/api/')) {
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      const filePath = path.join(guiDir, pathname);
      
      // Prevent directory traversal
      if (!filePath.startsWith(guiDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
  });

  return { server, port };
}
```

- [ ] **Step 2: Add browser auto-open helper and CLI startup block**

```javascript
function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('gui-server.mjs')) {
  const DEFAULT_PORT = 4200;
  const { server } = createGuiServer(DEFAULT_PORT);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = DEFAULT_PORT + 1;
      console.log(`⚠️ Port ${DEFAULT_PORT} is busy, trying ${fallbackPort}...`);
      server.listen(fallbackPort, () => {
        console.log(`🚀 Webstudio Control Center running at http://localhost:${fallbackPort}`);
        openBrowser(`http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(DEFAULT_PORT, () => {
    console.log(`🚀 Webstudio Control Center running at http://localhost:${DEFAULT_PORT}`);
    openBrowser(`http://localhost:${DEFAULT_PORT}`);
  });
}
```

- [ ] **Step 3: Test server startup and static routing**

Run: `node -e "import('./scripts/gui-server.mjs').then(m => { const s = m.createGuiServer(4299); s.server.listen(4299, () => { console.log('OK'); s.server.close(); }); })"`
Expected: Prints `OK` and closes cleanly.

- [ ] **Step 4: Commit**

```bash
git add scripts/gui-server.mjs
git commit -m "feat(gui): scaffold native http server and static asset router"
```

---

### Task 2: REST Status API & SSE Real-Time Process Runner

**Files:**
- Modify: `scripts/gui-server.mjs`

**Interfaces:**
- Consumes: `rootDir` files (`.webstudio/config.json`, `.webstudio/auth.json`, `.webstudio/session.json`, `.webstudio/data.json`, `node_modules/webstudio/lib/cli.js`).
- Produces: 
  - `GET /api/status` -> JSON object containing system state.
  - `GET /api/logs` -> Server-Sent Events stream.
  - `POST /api/action` -> Command executor streaming output to all active SSE clients.

- [ ] **Step 1: Implement SSE client registry and broadcaster in `scripts/gui-server.mjs`**

```javascript
const sseClients = new Set();

function broadcastLog(text, type = 'stdout') {
  const data = JSON.stringify({ text, type, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    client.write(`event: log\ndata: ${data}\n\n`);
  }
}

function broadcastComplete(action, success, code) {
  const data = JSON.stringify({ action, success, code, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    client.write(`event: complete\ndata: ${data}\n\n`);
  }
}
```

- [ ] **Step 2: Implement `/api/status` handler**

```javascript
async function getSystemStatus() {
  const cliPath = path.join(rootDir, 'node_modules', 'webstudio', 'lib', 'cli.js');
  const isInstalled = fs.existsSync(cliPath);
  
  let currentVersion = 'Not installed';
  if (isInstalled) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'node_modules', 'webstudio', 'package.json'), 'utf8'));
      currentVersion = pkgJson.version || 'unknown';
    } catch {}
  }

  let latestVersion = currentVersion;
  try {
    const npmInfo = await new Promise((resolve) => {
      exec('npm view webstudio version', { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout) resolve(stdout.trim());
        else resolve(currentVersion);
      });
    });
    latestVersion = npmInfo;
  } catch {}

  const configPath = path.join(rootDir, '.webstudio', 'config.json');
  const authPath = path.join(rootDir, '.webstudio', 'auth.json');
  const sessionPath = path.join(rootDir, '.webstudio', 'session.json');
  const dataPath = path.join(rootDir, '.webstudio', 'data.json');

  let projectId = '';
  let origin = '';
  let authToken = '';
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      projectId = cfg.projectId || '';
    } catch {}
  }
  if (fs.existsSync(authPath)) {
    try {
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      authToken = auth.authToken || '';
    } catch {}
  }
  if (projectId) {
    origin = `https://p-${projectId}.apps.webstudio.is`;
  }

  let stats = { pages: 0, instances: 0, assets: 0 };
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const pages = Array.isArray(data.pages) ? data.pages : (data.build?.pages ? Object.keys(data.build.pages) : []);
      const instances = Array.isArray(data.instances) ? data.instances : (data.build?.instances ? Object.keys(data.build.instances) : []);
      const assets = Array.isArray(data.assets) ? data.assets : (data.build?.assets ? Object.keys(data.build.assets) : []);
      stats = { pages: pages.length, instances: instances.length, assets: assets.length };
    } catch {}
  }

  return {
    installed: isInstalled,
    webstudioVersion: currentVersion,
    latestVersion,
    hasUpdate: currentVersion !== 'Not installed' && latestVersion !== currentVersion,
    linked: Boolean(projectId),
    projectId,
    origin,
    hasAuthToken: Boolean(authToken),
    hasSession: fs.existsSync(sessionPath),
    projectStats: stats
  };
}
```

- [ ] **Step 3: Implement `POST /api/action` process runner**

Handle `install`, `update`, `link`, `sync`, `sync-draft`, `save-session`, `upload-assets`, `import`, and `check-updates`.

```javascript
function executeCommand(command, args, actionName) {
  broadcastLog(`> ${command} ${args.join(' ')}\n`, 'system');
  const child = spawn(command, args, { cwd: rootDir, shell: true, env: process.env });

  child.stdout.on('data', (chunk) => {
    broadcastLog(chunk.toString(), 'stdout');
  });

  child.stderr.on('data', (chunk) => {
    broadcastLog(chunk.toString(), 'stderr');
  });

  child.on('close', (code) => {
    const success = code === 0;
    broadcastLog(`\n[Process completed with code ${code}]\n`, success ? 'system' : 'stderr');
    broadcastComplete(actionName, success, code);
  });
}
```

- [ ] **Step 4: Connect REST and SSE routes inside `http.createServer`**

- [ ] **Step 5: Verify status endpoint and action routing via test**

Run: `node -e "import('./scripts/gui-server.mjs').then(async m => { const s = m.createGuiServer(4298); s.server.listen(4298, async () => { const res = await fetch('http://localhost:4298/api/status'); const data = await res.json(); console.log('STATUS_OK:', data.installed); s.server.close(); }); })"`
Expected: `STATUS_OK: true`

- [ ] **Step 6: Commit**

```bash
git add scripts/gui-server.mjs
git commit -m "feat(gui): implement REST status API, action dispatcher and SSE log streaming"
```

---

### Task 3: Bilingual Dictionary & Reactive Client State Controller

**Files:**
- Create: `gui/i18n.js`
- Create: `gui/app.js`

**Interfaces:**
- Consumes: `/api/status`, `/api/logs` (SSE), `/api/action`.
- Produces: Reactive UI state, language switching mechanism, live log appending, two-phase screen toggle.

- [ ] **Step 1: Create `gui/i18n.js` with comprehensive UA/EN dictionary**

Include 100% of strings:
- Header, Language switch (`UA | EN`)
- First-Run screen: Title, description, "Install Dependencies", live logs info
- Workspace screen:
  - Project Link & Sync section (Share Link, Build ID, Link, Sync, Sync Draft)
  - Tooltip: "Build ID is used to sync unpublished draft revisions from Builder"
  - Session & Cookie section (Cookie, CSRF Token, Save session.json, 10-sec guide)
  - Cloud Actions (Upload Assets, Import to Cloud)
  - Telemetry Card (Pages, Instances, Assets, Status)
- Footer: Version, Check Updates, Update Available, Update to Latest.

- [ ] **Step 2: Create `gui/app.js` with reactive controllers**

```javascript
// State structure
const state = {
  lang: localStorage.getItem('ws_lang') || 'ua',
  status: null,
  logs: [],
  isRunning: false,
  autoScroll: true
};

// EventSource listener
function initSSE() {
  const es = new EventSource('/api/logs');
  es.addEventListener('log', (e) => {
    const data = JSON.parse(e.data);
    appendLog(data.text, data.type);
  });
  es.addEventListener('complete', (e) => {
    const data = JSON.parse(e.data);
    state.isRunning = false;
    updateStatus();
  });
}
```

- [ ] **Step 3: Implement language switcher and DOM binder in `gui/app.js`**

- [ ] **Step 4: Implement action triggers with validation**

Validate inputs (e.g. check that Share Link starts with `https://` before calling `/api/action`).

- [ ] **Step 5: Commit**

```bash
git add gui/i18n.js gui/app.js
git commit -m "feat(gui): add bilingual i18n dictionary and reactive client controller"
```

---

### Task 4: Semantic HTML5 Layout & Modern Dark Theme Styling

**Files:**
- Create: `gui/index.html`
- Create: `gui/styles.css`

**Interfaces:**
- Consumes: `gui/i18n.js`, `gui/app.js`.
- Produces: Responsive, high-contrast dark industrial dashboard with interactive terminal viewer.

- [ ] **Step 1: Build `gui/index.html`**

Structure:
- Navbar: App title, version badge, Language Toggle (UA/EN).
- `#first-run-view`: Centered Onboarding Card (shown when `!status.installed`).
- `#workspace-view`: 2-column layout (shown when `status.installed`):
  - Left: Accordion / Cards for Project Connection, Asset Session, Cloud Operations.
  - Right: Real-time Terminal with Action Bar (Clear, Copy, AutoScroll toggle) + Stats Card.
- Footer: Webstudio CLI Version indicator, Check Updates button, Update badge/button.

- [ ] **Step 2: Create `gui/styles.css`**

- Visual style: Industrial Dark UI (`#121214` background, `#18181B` cards, `#27272A` borders, `#0066FF` accent blue, `#22C55E` success green, `#F59E0B` warning amber).
- Terminal style: Monospace font (`Fira Code`, `JetBrains Mono`, `Consolas`), dark background (`#09090B`), colored stream outputs.
- Smooth transitions between first-run and workspace views.

- [ ] **Step 3: Verify rendering and layout in browser**

- [ ] **Step 4: Commit**

```bash
git add gui/index.html gui/styles.css
git commit -m "feat(gui): create responsive HTML5 layout and modern dark industrial CSS"
```

---

### Task 5: Launcher Scripts, NPM Integration & Documentation

**Files:**
- Create: `start-gui.bat`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `scripts/gui-server.mjs`.
- Produces: `"npm run gui"` script, one-click Windows batch launcher, updated documentation.

- [ ] **Step 1: Add `"gui": "node scripts/gui-server.mjs"` to `package.json`**

- [ ] **Step 2: Create `start-gui.bat` for Windows quick-launch**

```batch
@echo off
title Webstudio Control Center
cd /d "%~dp0"
echo Starting Webstudio Control Center...
node scripts\gui-server.mjs
pause
```

- [ ] **Step 3: Update `README.md` to highlight GUI launcher as the primary visual workflow**

- [ ] **Step 4: Commit**

```bash
git add package.json start-gui.bat README.md
git commit -m "feat(gui): add npm gui script, start-gui.bat launcher, and update README"
```

---

### Task 6: End-to-End Verification & Interactive Smoke Test

**Files:**
- All created and modified files.

- [ ] **Step 1: Test server launch and API endpoints**

Run: `node scripts/gui-server.mjs` in background -> verify HTTP 200 on `/`, `/api/status`, `/api/logs`.

- [ ] **Step 2: Verify First-Run vs Workspace switching**

Test simulation of missing install vs installed state.

- [ ] **Step 3: Verify draft sync with `buildId` and `origin` parsing**

Verify that submitting `buildId` correctly parses Share Link and executes the custom sync parameters.

- [ ] **Step 4: Verify language switcher**

Verify that clicking UA and EN updates all UI strings in real-time.

- [ ] **Step 5: Final git status check and push**
