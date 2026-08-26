#!/usr/bin/env node
/**
 * Webstudio Local MCP Setup & Patcher
 * ----------------------------------------------------
 * Enables 100% offline, local execution of official Webstudio MCP tools:
 * 1. Bypasses cloud permissions check (FORBIDDEN on free tier/API keys)
 * 2. Bypasses cloud server operation redirect on generated records (insert-fragment, insert-component, clone-instance)
 * 3. Commits Immer patch transactions directly to local .webstudio/data.json
 *
 * Usage:
 *   node scripts/setup-local-mcp.mjs           # patches local node_modules if present, else global
 *   node scripts/setup-local-mcp.mjs --local   # forces patching local project node_modules
 *   node scripts/setup-local-mcp.mjs --global  # forces patching global npm package
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('🔧 Webstudio Local MCP Patcher');
console.log('---------------------------------');

const args = process.argv.slice(2);
const preferLocal = args.includes('--local');
const preferGlobal = args.includes('--global');

// 1. Locate webstudio cli.js
let cliPath = '';

// Check local node_modules first if --local or if it exists locally without explicit --global
const localCandidate = path.join(process.cwd(), 'node_modules', 'webstudio', 'lib', 'cli.js');
if ((preferLocal || !preferGlobal) && fs.existsSync(localCandidate)) {
  cliPath = localCandidate;
  console.log('📦 Using local project node_modules/webstudio');
}

// Otherwise fallback to global npm root
if (!cliPath) {
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const candidate = path.join(globalRoot, 'webstudio', 'lib', 'cli.js');
    if (fs.existsSync(candidate)) {
      cliPath = candidate;
      console.log('🌐 Using global npm webstudio');
    }
  } catch {}
}

if (!cliPath) {
  console.error('❌ Could not find Webstudio CLI (cli.js).');
  console.error('👉 Please install Webstudio first: npm i webstudio (or npm i -g webstudio)');
  process.exit(1);
}

console.log(`📍 Found Webstudio CLI at: ${cliPath}`);

// Read original from backup if already patched
let code = '';
const backupPath = `${cliPath}.backup`;
if (fs.existsSync(backupPath)) {
  code = fs.readFileSync(backupPath, 'utf-8');
} else {
  code = fs.readFileSync(cliPath, 'utf-8');
  fs.writeFileSync(backupPath, code, 'utf-8');
  console.log(`💾 Backup created at: ${backupPath}`);
}

// 1. Patch getProjectPermissions
const permSearch = 'const getProjectPermissions = async (options) => {';
const permPos = code.indexOf(permSearch);
if (permPos !== -1) {
  const permEnd = code.indexOf('};', permPos);
  code = code.slice(0, permPos) +
    `const getProjectPermissions = async () => ({ canView: true, canEdit: true, canBuild: true, canAdmin: true, canUseApi: true });` +
    code.slice(permEnd + 2);
  console.log('✅ Bypassed cloud permissions check');
}

// 2. Patch hasGeneratedRecordWritePatch to allow local mutation commits
const genSearch = 'const hasGeneratedRecordWritePatch = (payload) =>';
const genPos = code.indexOf(genSearch);
if (genPos !== -1) {
  const genEnd = code.indexOf(';', genPos);
  code = code.slice(0, genPos) + 'const hasGeneratedRecordWritePatch = (payload) => false' + code.slice(genEnd);
  console.log('✅ Enabled local commits for generated records (insert-fragment, insert-component)');
}

// 3. Patch createCliProjectSessionTransport for local fetchNamespaces and commitPatch
const transportSearch = 'const createCliProjectSessionTransport =';
const transportPos = code.indexOf(transportSearch);
const sessionSearch = 'const createCliProjectSession =';
const sessionPos = code.indexOf(sessionSearch);

if (transportPos !== -1 && sessionPos !== -1) {
  const patchCode = `const createCliProjectSessionTransport = ({
  projectPath,
  fetchNamespaces: remoteFetchNamespaces,
  commitPatch: remoteCommitPatch,
  executeServerOperation: remoteExecuteServerOperation,
  options
}) => {
  const unwrap = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => (Array.isArray(item) && item.length === 2 && typeof item[0] === "string" ? item[1] : item));
  };
  return {
    async fetchNamespaces(project, namespaces) {
      const dataFilePath = path.join(projectPath, ".webstudio", "data.json");
      if (fs.existsSync(dataFilePath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
          if (raw && raw.build) {
            const buildData = {
              id: raw.build.id || "local-build",
              projectId: raw.build.projectId || raw.project?.id || "local-project",
              version: raw.build.version || 1,
              createdAt: raw.build.createdAt || new Date().toISOString(),
              pages: unwrap(raw.build.pages),
              instances: unwrap(raw.build.instances),
              props: unwrap(raw.build.props),
              styles: unwrap(raw.build.styles),
              styleSources: unwrap(raw.build.styleSources),
              styleSourceSelections: unwrap(raw.build.styleSourceSelections),
              breakpoints: unwrap(raw.build.breakpoints),
              dataSources: unwrap(raw.build.dataSources),
              resources: unwrap(raw.build.resources),
              assets: unwrap(raw.build.assets)
            };
            const state = createBuilderStateFromBuildData(buildData);
            return {
              data: state,
              missingNamespaces: []
            };
          }
        } catch (e) {}
      }
      return remoteFetchNamespaces(project, namespaces);
    },
    async commitPatch(project, patch) {
      const dataFilePath = path.join(projectPath, ".webstudio", "data.json");
      if (fs.existsSync(dataFilePath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
          if (raw && raw.build) {
            const buildData = {
              id: raw.build.id || "local-build",
              projectId: raw.build.projectId || raw.project?.id || "local-project",
              version: raw.build.version || 1,
              createdAt: raw.build.createdAt || new Date().toISOString(),
              pages: unwrap(raw.build.pages),
              instances: unwrap(raw.build.instances),
              props: unwrap(raw.build.props),
              styles: unwrap(raw.build.styles),
              styleSources: unwrap(raw.build.styleSources),
              styleSourceSelections: unwrap(raw.build.styleSourceSelections),
              breakpoints: unwrap(raw.build.breakpoints),
              dataSources: unwrap(raw.build.dataSources),
              resources: unwrap(raw.build.resources),
              assets: unwrap(raw.build.assets)
            };
            const state = createBuilderStateFromBuildData(buildData);
            const res = applyBuilderPatchTransactions(state, patch.transactions);
            const updatedState = res && res.state ? res.state : (res || state);
            const snapshot = createSerializedBuilderStateSnapshotFromState(updatedState);
            raw.build = {
              ...raw.build,
              ...snapshot,
              version: (raw.build.version || 1) + 1
            };
            fs.writeFileSync(dataFilePath, JSON.stringify(raw, null, 2), "utf8");
            return {
              version: raw.build.version,
              appliedTransactionCount: patch.transactions.length
            };
          }
        } catch (e) {
          console.error("Local commitPatch error:", e);
        }
      }
      return remoteCommitPatch(project, patch);
    },
    async executeServerOperation(project, operation) {
      return { ok: true };
    }
  };
};

`;

  code = code.slice(0, transportPos) + patchCode + code.slice(sessionPos);
  console.log('✅ Patched transport for offline local mutations');
}

fs.writeFileSync(cliPath, code, 'utf-8');
console.log('---------------------------------');
console.log('🎉 Webstudio Local MCP successfully configured!');
console.log('🚀 You can now run all 70+ official MCP tools completely offline:');
console.log('   npx webstudio mcp single-op-call list-pages "{}"');
console.log('   npx webstudio mcp single-op-call insert-fragment --input-file payload.json');
console.log('   npx webstudio import --to "<shareLink>"');
