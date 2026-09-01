# Webstudio Control Center 2-Tab GUI & Deployment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Webstudio Control Center GUI with a seamless 2-Tab interface: Tab 1 (Project Workspace) and Tab 2 (Build & Deploy), supporting all Webstudio templates (React Router v7, Remix, SSG, Vercel, Netlify, Docker), multi-config project naming (`wrangler.jsonc`, `wrangler.toml`, `package.json`), hosting auth checks, and universal lifecycle buttons (`npm run build`, `npm run preview`, `npm run deploy`).

**Architecture:** Extended Node.js HTTP server (`scripts/gui-server.mjs`) managing template generation, configuration file editing, and npm lifecycle command execution. The browser GUI (`gui/index.html`, `gui/app.js`, `gui/i18n.js`, `gui/styles.css`) is updated with a reactive tab bar, preset template selectors, project name modifier, hosting auth status, and lifecycle buttons.

**Tech Stack:** Native Node.js, Vanilla ES6+, Server-Sent Events (SSE), Modern CSS3 (Dark Theme).

**Spec:** `docs/superpowers/specs/2026-09-01-webstudio-deploy-tab-design.md`

## Global Constraints

- **Zero External Dependencies:** Must use only Node.js standard libraries (`node:http`, `node:fs`, `node:child_process`, `node:path`, `node:url`).
- **Bilingual Coverage:** 100% of new tabs, presets, buttons, placeholders, and tooltips must exist in Ukrainian (`ua`) and English (`en`).
- **Standard NPM Scripts:** Buttons must execute universal commands (`npm run build`, `npm run preview`, `npm run deploy`, `npm install`).
- **Multi-Config Naming Support:** Project name edits must intelligently detect and update `wrangler.jsonc` (React Router), `wrangler.toml` (Remix), and `package.json` (all targets).

---

### Task 1: Server Backend Deployment Endpoints & Template Dispatcher

**Files:**
- Modify: `scripts/gui-server.mjs`
- Test: `test/test-deploy-server.mjs`

**Interfaces:**
- Consumes: Workspace root configuration files (`wrangler.jsonc`, `wrangler.toml`, `package.json`, `vercel.json`, `netlify.toml`).
- Produces: 
  - `GET /api/status` with `deploy` metadata (`detectedTemplate`, `projectName`, `configFile`, `availableScripts`).
  - `POST /api/action` handlers: `generate-template`, `update-project-name`, `check-auth`, `login-auth`, `build-project`, `preview-project`, `deploy-project`.

- [ ] **Step 1: Write template mapping dictionary and config reader/writer in `scripts/gui-server.mjs`**

```javascript
const TEMPLATE_PRESETS = {
  'react-router-cloudflare': ['react-router', 'react-router-cloudflare'],
  'remix-cloudflare': ['cloudflare'],
  'react-router-vercel': ['react-router', 'react-router-vercel'],
  'react-router-netlify': ['react-router', 'react-router-netlify'],
  'react-router-docker': ['react-router', 'react-router-docker'],
  'ssg': ['ssg'],
  'ssg-vercel': ['ssg', 'ssg-vercel'],
  'ssg-netlify': ['ssg', 'ssg-netlify']
};

export function getDeployConfig(rootDir) {
  let projectName = '';
  let configFile = '';
  let detectedTemplate = 'unknown';

  const wranglerJsoncPath = path.join(rootDir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(rootDir, 'wrangler.toml');
  const packageJsonPath = path.join(rootDir, 'package.json');

  if (fs.existsSync(wranglerJsoncPath)) {
    try {
      const content = fs.readFileSync(wranglerJsoncPath, 'utf8');
      const match = content.match(/"name"\s*:\s*"([^"]+)"/);
      if (match) projectName = match[1];
      configFile = 'wrangler.jsonc';
      detectedTemplate = 'react-router-cloudflare';
    } catch {}
  } else if (fs.existsSync(wranglerTomlPath)) {
    try {
      const content = fs.readFileSync(wranglerTomlPath, 'utf8');
      const match = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (match) projectName = match[1];
      configFile = 'wrangler.toml';
      detectedTemplate = 'remix-cloudflare';
    } catch {}
  }

  if (!projectName && fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      projectName = pkg.name || '';
      if (!configFile) configFile = 'package.json';
    } catch {}
  }

  let availableScripts = [];
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      availableScripts = Object.keys(pkg.scripts || {});
    } catch {}
  }

  return {
    projectName: projectName || 'webstudio-app',
    configFile: configFile || 'none',
    detectedTemplate,
    availableScripts
  };
}

export function updateProjectNameOnDisk(rootDir, newName) {
  if (!newName || typeof newName !== 'string') return false;
  const safeName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  
  const wranglerJsoncPath = path.join(rootDir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(rootDir, 'wrangler.toml');
  const packageJsonPath = path.join(rootDir, 'package.json');

  let updated = false;

  if (fs.existsSync(wranglerJsoncPath)) {
    try {
      let content = fs.readFileSync(wranglerJsoncPath, 'utf8');
      content = content.replace(/"name"\s*:\s*"[^"]+"/, `"name": "${safeName}"`);
      fs.writeFileSync(wranglerJsoncPath, content, 'utf8');
      updated = true;
    } catch {}
  }

  if (fs.existsSync(wranglerTomlPath)) {
    try {
      let content = fs.readFileSync(wranglerTomlPath, 'utf8');
      content = content.replace(/^name\s*=\s*"[^"]+"/m, `name = "${safeName}"`);
      fs.writeFileSync(wranglerTomlPath, content, 'utf8');
      updated = true;
    } catch {}
  }

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      pkg.name = safeName;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      updated = true;
    } catch {}
  }

  return { updated, safeName };
}
```

- [ ] **Step 2: Add deploy action handlers in `POST /api/action`**

Handle `generate-template`, `update-project-name`, `check-auth`, `login-auth`, `build-project`, `preview-project`, `deploy-project`.

- [ ] **Step 3: Create automated unit test `test/test-deploy-server.mjs`**

- [ ] **Step 4: Commit**

```bash
git add scripts/gui-server.mjs test/test-deploy-server.mjs
git commit -m "feat(deploy): implement server deployment actions and multi-config project naming"
```

---

### Task 2: Bilingual Dictionaries for Deploy Tab

**Files:**
- Modify: `gui/i18n.js`

**Interfaces:**
- Consumes: `gui/i18n.js`.
- Produces: Complete Ukrainian (`ua`) and English (`en`) dictionary keys for Tab 1 & Tab 2 navigation, all 8 template presets, and deploy lifecycle actions.

- [ ] **Step 1: Add tab navigation keys in `gui/i18n.js`**

```javascript
tabs: {
  workspace: "⚡ Керування проєктом",
  deploy: "🚀 Деплой та Шаблони"
}
```

- [ ] **Step 2: Add deployment section keys in `gui/i18n.js`**

Include:
- `templateSection`: `title`, `presetLabel`, `presets` (for all 8 targets), `generateBtn`, `generating`
- `nameSection`: `title`, `projectNameLabel`, `placeholder`, `applyBtn`, `applied`, `detectedConfig`
- `authSection`: `title`, `statusLabel`, `checkStatusBtn`, `loginBtn`, `checking`, `authorized`, `notAuthorized`
- `lifecycleSection`: `title`, `installBtn`, `buildBtn`, `previewBtn`, `deployBtn`, `installing`, `building`, `previewing`, `deploying`
- `deployTelemetry`: `title`, `currentTemplate`, `targetHosting`, `configFiles`, `lastBuild`

- [ ] **Step 3: Commit**

```bash
git add gui/i18n.js
git commit -m "feat(i18n): add comprehensive bilingual dictionaries for deployment tab"
```

---

### Task 3: Client Tab Controller & Deployment State Manager

**Files:**
- Modify: `gui/app.js`

**Interfaces:**
- Consumes: `gui/i18n.js`, `/api/status`, `/api/action`.
- Produces: Reactive tab switching (`currentTab`), template selection, project name dispatch, and lifecycle action event listeners.

- [ ] **Step 1: Add tab switching logic in `gui/app.js`**

```javascript
function switchTab(tabId) {
  state.currentTab = tabId;
  localStorage.setItem('ws_active_tab', tabId);
  
  if (tabId === 'workspace') {
    dom.tabBtnWorkspace?.classList.add('active');
    dom.tabBtnDeploy?.classList.remove('active');
    dom.tabViewWorkspace?.classList.remove('hidden');
    dom.tabViewDeploy?.classList.add('hidden');
  } else {
    dom.tabBtnWorkspace?.classList.remove('active');
    dom.tabBtnDeploy?.classList.add('active');
    dom.tabViewWorkspace?.classList.add('hidden');
    dom.tabViewDeploy?.classList.remove('hidden');
  }
}
```

- [ ] **Step 2: Add deploy action event listeners**

Bind click listeners for:
- `#btn-generate-template`: reads selected preset, dispatches `generate-template`
- `#btn-update-project-name`: reads `#input-project-name`, dispatches `update-project-name`
- `#btn-check-auth`: dispatches `check-auth`
- `#btn-login-auth`: dispatches `login-auth`
- `#btn-deploy-install`: dispatches `install`
- `#btn-deploy-build`: dispatches `build-project`
- `#btn-deploy-preview`: dispatches `preview-project`
- `#btn-deploy-publish`: dispatches `deploy-project`

- [ ] **Step 3: Update `renderView()` to sync deployment telemetry and inputs**

- [ ] **Step 4: Commit**

```bash
git add gui/app.js
git commit -m "feat(gui): implement reactive tab controller and deploy lifecycle manager"
```

---

### Task 4: 2-Tab Layout & Deployment UI Components

**Files:**
- Modify: `gui/index.html`
- Modify: `gui/styles.css`

**Interfaces:**
- Consumes: `gui/app.js`, `gui/i18n.js`.
- Produces: 2-tab navigation bar, `#tab-view-workspace`, `#tab-view-deploy` with 4 action cards and Deploy Telemetry.

- [ ] **Step 1: Update `gui/index.html`**

- Add Navigation Tab Bar inside `#workspace-view`.
- Wrap workspace controls in `#tab-view-workspace`.
- Add `#tab-view-deploy` with:
  - Card 1: Template Selection (Select dropdown with 8 presets + Generate button)
  - Card 2: Project Naming (Input + Apply button + detected config file badge)
  - Card 3: Hosting Auth (Status pill + Check Status + Login buttons)
  - Card 4: Lifecycle Action Grid (`Install`, `Build`, `Preview`, `Deploy`)
  - Deploy Telemetry Card

- [ ] **Step 2: Update `gui/styles.css`**

- Add styles for tab buttons (`.tab-btn`, `.tab-btn.active`, `.tab-nav`).
- Add grid styling for deployment action button matrix.
- Ensure responsive collapse on tablet and mobile viewports.

- [ ] **Step 3: Commit**

```bash
git add gui/index.html gui/styles.css
git commit -m "feat(gui): implement 2-tab HTML5 layout and modern styling for deployment center"
```

---

### Task 5: End-to-End Verification & Automated Test Suite

**Files:**
- Create: `test/test-deploy-tab.mjs`

- [ ] **Step 1: Write integration test suite `test/test-deploy-tab.mjs`**

Verify:
1. Template preset mapping accuracy for all 8 presets.
2. Project name updater for `wrangler.jsonc`, `wrangler.toml`, `package.json`.
3. Server REST endpoints (`GET /api/status` deploy metadata, `POST /api/action` deploy actions).
4. DOM ID and i18n key consistency across both tabs.

- [ ] **Step 2: Run all project test suites**

Run: `node test/test-i18n-app.mjs && node test/test-dom-layout.mjs && node test/test-e2e-gui.mjs && node test/test-deploy-tab.mjs`
Expected: All 4 test suites pass with exit code `0`.

- [ ] **Step 3: Commit and Push to GitHub**

```bash
git add test/test-deploy-tab.mjs
git commit -m "test(deploy): add comprehensive automated integration suite for 2-tab deploy system"
git push origin master
```
