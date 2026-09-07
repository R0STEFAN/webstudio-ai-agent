# Webstudio GitHub Cloud Sync & Encrypted Vault Implementation Plan

> **Note for implementation:** Follow this structured plan when building the GitHub Cloud Synchronization & Cloud Backups system. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable secure, bidirectional cloud synchronization of all Webstudio projects and backup snapshots to a private GitHub repository (e.g., `webstudio-projects`), featuring zero-knowledge AES-256-GCM encryption for credentials (`session.json`, `auth.json`, tokens) and full Webstudio Control Center GUI integration.

**Architecture:**
- **Backend Service (`scripts/github-sync-manager.mjs`):** Interacts with GitHub REST API via native Node.js `fetch` and local `git` CLI (using Windows Git Credential Manager or Personal Access Token). Encrypts sensitive credentials before committing to the private repository.
- **API Extension (`scripts/gui-server.mjs`):** Exposes `/api/github/status`, `/api/github/connect`, `/api/github/sync`, `/api/github/pull`, `/api/github/backup`.
- **UI Extension (`gui/`):** Adds a "GitHub Cloud Sync" card inside Tab 3 (Projects Hub) with connection status, repository selector, Push/Pull buttons, Passphrase modal, and live sync logs.
- **Testing (`test/test-github-sync.mjs`):** Mocked & integration test suite verifying encryption/decryption integrity, git repo initialization, push/pull serialization, and HTTP API endpoints.

**Tech Stack:** Node.js standard libraries (`node:crypto`, `node:child_process`, `node:fs`, `node:path`), GitHub REST API v3, Git Porcelain CLI, Vanilla ES6+ GUI with SSE log streaming.

---

## 1. Security & Encryption Standard (Zero-Knowledge)

Even in a **Private** GitHub repository, raw credentials (`.webstudio/session.json`, `auth.json`, auth cookies, CSRF tokens) must never be committed in plaintext to immutable git history.

- **Algorithm:** AES-256-GCM with PBKDF2 key derivation (100,000 iterations, SHA-512, 16-byte random salt, 12-byte initialization vector).
- **Encrypted Files:** Any `.webstudio/session.json` or sensitive tokens are converted into `.webstudio/session.enc` before git staging.
- **Plaintext Files:** Design data (`data.json`, pages, components, tokens, `assets/`, `config.json`) are committed as plaintext JSON/binary to allow standard git diffing, version history, and visual commit inspection on GitHub.
- **Passphrase Management:** The encryption passphrase is stored in the local OS session / memory only, never committed to git.

---

## 2. Repository Structure in GitHub (`webstudio-projects`)

The private repository `username/webstudio-projects` maintains a clean, multi-project directory layout:

```text
webstudio-projects/
├── registry.json                    # Project metadata & IDs
├── projects/
│   ├── tattoo-v3-test/
│   │   ├── .webstudio/
│   │   │   ├── config.json          # Project ID
│   │   │   ├── data.json            # Design tree, pages, styles, tokens
│   │   │   ├── session.enc          # AES-256 encrypted session & auth cookies
│   │   │   └── assets/              # Local images, SVG icons, fonts
│   │   └── .webstudio-backups/      # Local backup snapshots & manifests
│   └── test-mcp-project/
│       ├── .webstudio/
│       │   ├── config.json
│       │   ├── data.json
│       │   └── assets/
│       └── .webstudio-backups/
└── README.md
```

---

## 3. Implementation Tasks

### Task 1: GitHub Sync Engine & Cryptographic Vault (`scripts/github-sync-manager.mjs`)

- [ ] **Step 1.1: Cryptographic Vault:** Implement `encryptPayload(data, passphrase)` and `decryptPayload(encryptedObj, passphrase)` using Node.js `node:crypto` AES-256-GCM with PBKDF2.
- [ ] **Step 1.2: GitHub API & Git Auth:** Detect Git Credential Manager or accept GitHub Personal Access Token (PAT with `repo` scope). Implement `checkAuth()` and `ensurePrivateRepo(repoName = 'webstudio-projects')`.
- [ ] **Step 1.3: Project Staging & Commit:** Implement `stageProjectForCloud(projectDir, passphrase)`:
  - Copies `.webstudio/` and `.webstudio-backups/` into a git staging directory.
  - Encrypts `session.json` to `session.enc` and deletes plaintext `session.json` from the staging area.
  - Commits with descriptive message: `backup(test-mcp-project): snapshot at 2026-09-08T...`.
- [ ] **Step 1.4: Push & Pull Synchronization:**
  - `pushToCloud(options)`: Pushes local commits to the private remote repository.
  - `pullFromCloud(options)`: Fetches remote changes, decrypts `session.enc` back to `session.json`, and updates local `projects/`.

---

### Task 2: GUI Server REST API Endpoints (`scripts/gui-server.mjs`)

- [ ] **Step 2.1:** Implement `GET /api/github/status`:
  - Returns authenticated username (`R0STEFAN`), connected repo (`webstudio-projects`), private status (`true`), last sync timestamp, and unpushed local changes count.
- [ ] **Step 2.2:** Implement `POST /api/github/connect`:
  - Accepts token/config, validates credentials with GitHub REST API, and initializes/clones the private repository.
- [ ] **Step 2.3:** Implement `POST /api/github/sync`:
  - Dispatches `push` or `pull` action, streaming real-time progress via Server-Sent Events (SSE) to the terminal widget.
- [ ] **Step 2.4:** Implement `POST /api/github/backup`:
  - Directly attaches and pushes a specific backup snapshot to GitHub with a git tag or dedicated commit.

---

### Task 3: Control Center GUI Integration (`gui/`)

- [ ] **Step 3.1:** Add "GitHub Cloud Sync" card to Tab 3 (Projects Hub) in `gui/index.html`:
  - Auth indicator: `🟢 Connected: @R0STEFAN (Private: webstudio-projects)`.
  - Buttons:
    - `☁️ Push to GitHub`: Sync all local projects & snapshots.
    - `📥 Pull from GitHub`: Download new or updated projects.
    - `🔒 Set Vault Password`: Configure local AES-256 master key.
    - `🔄 Auto-Sync Toggle`: Automatically push on every backup snapshot.
- [ ] **Step 3.2:** Wire action handlers in `gui/app.js`:
  - Bind click events to `dispatchAction('github-sync-push')`, `dispatchAction('github-sync-pull')`.
  - Add passphrase modal dialog for secure key entry on first sync.
- [ ] **Step 3.3:** Add Ukrainian and English localization strings in `gui/i18n.js`:
  - All labels, tooltips, error banners, and action titles localized across UA/EN.

---

### Task 4: Automated Test Suite (`test/test-github-sync.mjs`)

- [ ] **Step 4.1:** Unit tests for AES-256-GCM encryption/decryption roundtrip.
- [ ] **Step 4.2:** Integration tests for git staging and sanitization (verifying `session.json` is never staged unencrypted).
- [ ] **Step 4.3:** API endpoint tests (`GET /api/github/status`, `POST /api/github/sync`).

---

## 4. Disaster Recovery Scenarios Covered

1. **New Machine / Laptop Onboarding:** Install repo, open GUI, click "📥 Pull from GitHub", enter AES passphrase $\rightarrow$ all sites, pages, assets, and backups are restored instantly.
2. **Accidental Local Project Deletion:** Select project in GUI $\rightarrow$ "Restore from Cloud" $\rightarrow$ pulls latest state from GitHub history.
3. **Multi-Device Synchronization:** Working on desktop in office, push before leaving; pull on laptop at home $\rightarrow$ continue designing offline with 0 API limits.
