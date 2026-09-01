# Webstudio Control Center — 2-Tab GUI & Deployment System Design Specification

**Author:** R0STEFAN & Antigravity  
**Date:** 2026-09-01  
**Status:** Ready for Review  

---

## 1. Executive Summary & Objectives

The goal is to expand the **Webstudio Control Center GUI** into a modular **2-Tab Application**:
* **Tab 1: ⚡ Керування проєктом (Workspace & Cloud Sync)** — Existing full-featured workspace (Link, Sync, Sync Draft by BuildID, Cookie management, Asset upload, Cloud Import, Real-time logs, Telemetry).
* **Tab 2: 🚀 Деплой та Шаблони (Build & Deploy)** — Complete code generation, project naming, hosting authentication, and deployment automation for all Webstudio-supported frameworks and hosting platforms.

---

## 2. Universal NPM Lifecycle Architecture

Webstudio templates configure standard, uniform npm scripts inside `package.json`. Rather than executing fragmented custom commands, the GUI leverages standard npm lifecycle scripts:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    TAB 2: BUILD & DEPLOY WORKFLOW                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ 1. [ 🏗️ Згенерувати шаблон ] ──► npx webstudio build --template ...         │
│                                                                            │
│ 2. [ 💾 Зберегти назву ]     ──► Auto-updates wrangler.jsonc/toml & pkg    │
│                                                                            │
│ 3. [ 📦 Встановити ]         ──► npm install                               │
│                                                                            │
│ 4. [ 🔨 Зібрати (Build) ]    ──► npm run build                             │
│                                                                            │
│ 5. [ 👁️ Прев'ю (Preview) ]  ──► npm run preview                           │
│                                                                            │
│ 6. [ 🚀 Опублікувати ]       ──► npm run deploy                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported Webstudio Templates & Overlay Matrix

Webstudio CLI uses an overlay model for hosting targets:

| Preset Name (UA / EN) | CLI Template Flags | Config File for Project Name | Primary Target |
|---|---|---|---|
| ⚡ **React Router v7 + Cloudflare** | `--template react-router --template react-router-cloudflare` | `wrangler.jsonc` + `package.json` | Cloudflare Workers |
| ⚡ **Remix + Cloudflare Pages** | `--template cloudflare` | `wrangler.toml` + `package.json` | Cloudflare Pages |
| ▲ **React Router v7 + Vercel** | `--template react-router --template react-router-vercel` | `vercel.json` + `package.json` | Vercel Serverless |
| 🌐 **React Router v7 + Netlify** | `--template react-router --template react-router-netlify` | `netlify.toml` + `package.json` | Netlify Functions |
| 🐳 **React Router v7 + Docker** | `--template react-router --template react-router-docker` | `Dockerfile` + `package.json` | Self-hosted Docker |
| 📄 **Static Site (SSG / Vike)** | `--template ssg` | `package.json` | Any Static Host |
| ▲ **SSG + Vercel** | `--template ssg --template ssg-vercel` | `vercel.json` + `package.json` | Vercel Static |
| 🌐 **SSG + Netlify** | `--template ssg --template ssg-netlify` | `netlify.toml` + `package.json` | Netlify Static |

---

## 4. UI/UX Layout & Components (Tab 2: Build & Deploy)

### Top Navigation:
- Tab 1 Button: `[ ⚡ Керування проєктом / Project Workspace ]`
- Tab 2 Button: `[ 🚀 Деплой та Шаблони / Build & Deploy ]`
- Language Toggle (`UA | EN`) and Status Indicator.

### Tab 2 Structure (2-Column Grid):
1. **Left Column (Configuration & Lifecycle Actions):**
   - **Card 1: Вибір шаблону фреймворку (Template Selection):**
     - Select Dropdown or Visual Radio Cards for all 8 presets.
     - Action button: **`[ 🏗️ Згенерувати код за шаблоном / Generate Code ]`**.
   - **Card 2: Назва проєкту для хостингу (Project Name):**
     - Input field `Project Name` (defaults to current project title or directory name).
     - Action button: **`[ 💾 Застосувати назву / Update Project Name ]`** (auto-detects and updates `wrangler.jsonc`, `wrangler.toml`, `package.json`).
   - **Card 3: Авторизація хостингу (Hosting Authentication):**
     - Cloudflare Wrangler / Hosting status check (`npx wrangler whoami`).
     - Buttons: `[ 🔍 Перевірити статус / Check Status ]`, `[ 🔑 Увійти / Login ]` (`npx wrangler login`).
   - **Card 4: Послідовні кроки деплою (Deploy Lifecycle):**
     - 4 Action Buttons in sequence:
       - `[ 📦 Встановити залежності / Install ]` (`npm install`)
       - `[ 🔨 Зібрати проєкт / Build ]` (`npm run build`)
       - `[ 👁️ Попередній перегляд / Preview ]` (`npm run preview`)
       - `[ 🚀 Опублікувати / Deploy ]` (`npm run deploy`)
2. **Right Column (Terminal & Deploy Telemetry):**
   - Shared Real-Time Terminal output streaming logs across both tabs.
   - **Deploy Status Card:**
     - Current Template detected (`React Router v7`, `Remix`, `SSG`, etc.).
     - Target Hosting (`Cloudflare`, `Vercel`, `Netlify`, `Docker`, `Static`).
     - Config Files Detected (`wrangler.jsonc`, `wrangler.toml`, `vercel.json`, `netlify.toml`).
     - Last Build Status & Timestamp.

---

## 5. Server API Enhancements (`scripts/gui-server.mjs`)

### `GET /api/status` additions:
```json
{
  "deploy": {
    "detectedTemplate": "react-router-cloudflare",
    "projectName": "webstudio-app",
    "configFile": "wrangler.jsonc",
    "hasWrangler": true,
    "hasBuildDir": true,
    "availableScripts": ["build", "preview", "deploy", "typecheck"]
  }
}
```

### `POST /api/action` additions:
- `generate-template`: receives `{ templatePreset }`, executes `npx webstudio build --template <t1> [--template <t2>]`.
- `update-project-name`: receives `{ projectName }`, safely updates `wrangler.jsonc`, `wrangler.toml`, `package.json`.
- `check-auth`: executes `npx wrangler whoami`.
- `login-auth`: executes `npx wrangler login`.
- `build-project`: executes `npm run build`.
- `preview-project`: executes `npm run preview`.
- `deploy-project`: executes `npm run deploy`.

---

## 6. Verification & Acceptance Criteria

1. **Tab Navigation:** Seamless switching between Workspace (Tab 1) and Deploy (Tab 2) without losing form state or terminal logs.
2. **Multi-Template Generation:** Selecting any of the 8 presets correctly invokes `webstudio build --template ...` with overlay parameters.
3. **Multi-Config Naming:** Changing project name updates `wrangler.jsonc` (React Router), `wrangler.toml` (Remix), and `package.json` (Vercel/Netlify/SSG).
4. **Lifecycle Execution:** `npm install`, `npm run build`, `npm run preview`, and `npm run deploy` stream live output to the console.
5. **i18n Coverage:** 100% of new buttons, descriptions, and preset names available in Ukrainian and English.
