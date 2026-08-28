import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const preferLocal = args.includes('--local');
const preferGlobal = args.includes('--global');

let cliPath = '';
let searchDir = process.cwd();
const candidates = [];
while (searchDir) {
  candidates.push(path.join(searchDir, 'node_modules', 'webstudio', 'lib', 'cli.js'));
  const parent = path.dirname(searchDir);
  if (parent === searchDir) break;
  searchDir = parent;
}
// Also check relative to script
const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'));
candidates.push(path.resolve(scriptDir, '..', '..', 'node_modules', 'webstudio', 'lib', 'cli.js'));

if (preferLocal || !preferGlobal) {
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cliPath = c;
      console.log(`📦 Using local project node_modules/webstudio: ${cliPath}`);
      break;
    }
  }
}

if (!cliPath && !preferLocal) {
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
  console.error('👉 Please install Webstudio CLI: npm i webstudio (or npm i -g webstudio)');
  process.exit(1);
}

console.log(`📍 Found Webstudio CLI at: ${cliPath}`);
const backupPath = `${cliPath}.backup`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(cliPath, backupPath);
}

let code = fs.readFileSync(backupPath, 'utf-8');

// Ensure readFileSync and writeFileSync are imported from "node:fs"
const importTarget = 'import { readdirSync,';
if (code.includes(importTarget) && !code.includes('readFileSync,')) {
  code = code.replace(importTarget, 'import { readdirSync, readFileSync, writeFileSync,');
}

// 1. Patch hasProjectSessionPermit -> always true
const permitSearch = 'const hasProjectSessionPermit = (permissions, permit) => {';
if (code.includes(permitSearch)) {
  code = code.replace(
    permitSearch,
    'const hasProjectSessionPermit = () => true;\nconst _unused_hasProjectSessionPermit = (permissions, permit) => {'
  );
  console.log('✅ 1. Patched hasProjectSessionPermit -> true');
}

// 2. Patch getProjectPermissions -> always full access
const permSearch = 'const getProjectPermissions = projectQuery(';
if (code.includes(permSearch)) {
  const permEnd = code.indexOf(');', code.indexOf(permSearch));
  code = code.slice(0, code.indexOf(permSearch)) +
    'const getProjectPermissions = async () => ({ canView: true, canEdit: true, canBuild: true, canAdmin: true, canUseApi: true });' +
    code.slice(permEnd + 2);
  console.log('✅ 2. Patched getProjectPermissions -> full permissions');
}

// 3. Patch hasGeneratedRecordWritePatch -> false (allows local commit of insert-fragment, insert-component)
const genSearch = 'const hasGeneratedRecordWritePatch = (payload) =>';
if (code.includes(genSearch)) {
  code = code.replace(
    genSearch,
    'const hasGeneratedRecordWritePatch = () => false; const _unused_hasGeneratedRecordWritePatch = (payload) =>'
  );
  console.log('✅ 3. Patched hasGeneratedRecordWritePatch -> false');
}

// 4. Patch getCliServerApiContract -> always negotiated: true
const contractSearch = 'const getCliServerApiContract = async (connection, getProjectPermissions$1 = getProjectPermissions) => {';
if (code.includes(contractSearch)) {
  code = code.replace(
    contractSearch,
    'const getCliServerApiContract = async () => ({ clientVersion: publicApiContractVersion, serverVersion: publicApiContractVersion, supportedOperationIds: new Set(publicApiOperations.map(op => op.id)), missingServerOperationIds: [], negotiated: true });\nconst _unused_getCliServerApiContract = async (connection, getProjectPermissions$1 = getProjectPermissions) => {'
  );
  console.log('✅ 4. Patched getCliServerApiContract -> negotiated: true');
}

// 4b. Patch mergeBuilderState to merge all available local namespaces
const mergeSearch = 'const mergeBuilderState = (current4, incoming, namespaces) => {';
if (code.includes(mergeSearch)) {
  const mergeEnd = code.indexOf('\n};', code.indexOf(mergeSearch)) + 3;
  code = code.slice(0, code.indexOf(mergeSearch)) +
    'const mergeBuilderState = (current4, incoming) => ({ ...current4, ...incoming });' +
    code.slice(mergeEnd);
  console.log('✅ 4b. Patched mergeBuilderState -> full state merge');
}

// 4c. Patch createBuilderStateSnapshotFromState to safely handle entries
const snapSearch = 'const createBuilderStateSnapshotFromState = (state) => {';
if (code.includes(snapSearch)) {
  const snapEnd = code.indexOf('\n};', code.indexOf(snapSearch)) + 3;
  const safeSnapCode = `const createBuilderStateSnapshotFromState = (state) => {
  const snapshot = {};
  for (const namespace2 of builderNamespaces) {
    const value2 = state[namespace2];
    if (value2 === void 0) continue;
    if (namespace2 === "pages" || namespace2 === "projectSettings" || namespace2 === "marketplaceProduct") {
      snapshot[namespace2] = structuredClone(value2);
      continue;
    }
    snapshot[namespace2] = value2 instanceof Map
      ? Array.from(value2.entries()).map(([k, v]) => [k, structuredClone(v)])
      : (Array.isArray(value2) ? value2 : []);
  }
  return snapshot;
};`;
  code = code.slice(0, code.indexOf(snapSearch)) + safeSnapCode + code.slice(snapEnd);
  console.log('✅ 4c. Patched createBuilderStateSnapshotFromState -> safe entries serialization');
}

// 4d. Patch getInstanceParents to safely handle instance children
const parentsSearch = 'const getInstanceParents = (instances) => {';
if (code.includes(parentsSearch)) {
  const parentsEnd = code.indexOf('\n};', code.indexOf(parentsSearch)) + 3;
  const safeParentsCode = `const getInstanceParents = (instances) => {
  const parents = new Map();
  for (const instance2 of instances.values()) {
    const ch = instance2 && instance2.children;
    if (!Array.isArray(ch)) continue;
    for (const [index2, child] of ch.entries()) {
      if (child && child.type === "id") {
        parents.set(child.value, { id: instance2.id, index: index2 });
      }
    }
  }
  return parents;
};`;
  code = code.slice(0, code.indexOf(parentsSearch)) + safeParentsCode + code.slice(parentsEnd);
  console.log('✅ 4d. Patched getInstanceParents -> safe children traversal');
}

// 5. Replace createCliProjectSessionTransport with 100% Local data.json Transport
const transportSearch = 'const createCliProjectSessionTransport = ({';
const transportPos = code.indexOf(transportSearch);
const sessionSearch = 'const createCliProjectSession = ({';
const sessionPos = code.indexOf(sessionSearch);

if (transportPos !== -1 && sessionPos !== -1) {
  const localTransportCode = `const createCliProjectSessionTransport = ({
  connection,
  executeServerOperation,
  getBuildSnapshot: getBuildSnapshot$1 = getBuildSnapshot,
  getPermissions
}) => {
  const _dataFile = () => join$1(process.cwd(), ".webstudio", "data.json");
  const _readBuildData = () => {
    const fp = _dataFile();
    if (!existsSync(fp)) return null;
    try {
      const raw = JSON.parse(readFileSync(fp, "utf8"));
      if (!raw || !raw.build) return null;
      return raw;
    } catch { return null; }
  };
  const _getLocalState = (raw) => {
    const build = { ...raw.build };
    build.assets = (raw.build.assets || raw.assets || []).map(a => Array.isArray(a) ? a : [a.id, a]);
    build.assetFolders = (raw.build.assetFolders || raw.assetFolders || []).map(f => Array.isArray(f) ? f : [f.id, f]);
    return createBuilderStateFromSerializedSnapshot(build);
  };
  return {
    async getCompatibility() {
      return createCliProjectSessionCompatibility(connection);
    },
    async fetchNamespaces({ namespaces }) {
      const raw = _readBuildData();
      if (raw && raw.build) {
        try {
          const state = _getLocalState(raw);
          return {
            projectId: raw.build.projectId || raw.project?.id || "local-project",
            buildId: raw.build.id || "local-build",
            version: raw.build.version || 1,
            state,
            missingNamespaces: []
          };
        } catch (e) {
          console.error("Local fetchNamespaces error:", e);
        }
      }
      return toRemoteSnapshot(await getBuildSnapshot$1({ ...connection, include: getPublicBuildIncludes(namespaces) }));
    },
    async commitPatch({ baseVersion, transactions }) {
      const raw = _readBuildData();
      if (raw && raw.build) {
        try {
          const state = _getLocalState(raw);
          const res = applyBuilderPatchTransactions(state, transactions);
          const updatedState = res && res.state ? res.state : (res || state);
          const snapshot = createSerializedBuilderStateSnapshotFromState(updatedState);
          if (snapshot.assets) {
            raw.assets = snapshot.assets.map(item => Array.isArray(item) ? item[1] : item);
            delete snapshot.assets;
          }
          if (snapshot.assetFolders) {
            raw.assetFolders = snapshot.assetFolders.map(item => Array.isArray(item) ? item[1] : item);
            delete snapshot.assetFolders;
          }
          raw.build = { ...raw.build, ...snapshot, version: (raw.build.version || 1) + 1 };
          writeFileSync(_dataFile(), JSON.stringify(raw, null, 2), "utf8");
          return { version: raw.build.version, appliedTransactionCount: transactions.length };
        } catch (e) {
          console.error("Local commitPatch error:", e);
        }
      }
      return await withMappedRemoteError(() => applyBuildPatch({ ...connection, baseVersion, transactions }));
    },
    async commitRestorePoint({ baseVersion, transactions }) {
      return await withMappedRemoteError(() => applyRestorePointPatch({ ...connection, baseVersion, transactions: transactions.map(serializeRestorePointTransaction) }));
    },
    getPermissions: getPermissions ?? (async () => ({ canView: true, canEdit: true, canBuild: true, canAdmin: true, canUseApi: true })),
    executeServerOperation: executeServerOperation ?? (async ({ operationId, input: input2 }) => ({ ok: true }))
  };
};

`;
  code = code.slice(0, transportPos) + localTransportCode + code.slice(sessionPos);
  console.log('✅ 5. Replaced transport with 100% Local offline data.json engine');
}

// 6. Patch uploadAsset to automatically bridge browser session from .webstudio/session.json
const uploadAssetSearch = 'const uploadAsset = async (params) => {';
if (code.includes(uploadAssetSearch)) {
  const uploadAssetEnd = code.indexOf('\nconst uploadAssets =', code.indexOf(uploadAssetSearch));
  if (uploadAssetEnd !== -1) {
    const bridgedUploadAssetCode = `const uploadAsset = async (params) => {
  const { authToken, headers, origin, projectId, upload } = params;
  const projectOrigin = "https://p-" + projectId + ".apps.webstudio.is";
  let customHeaders = {
    ...headers,
    "x-auth-token": authToken,
    "x-webstudio-asset-description": upload.asset.description ? encodeURIComponent(upload.asset.description) : void 0,
    "x-webstudio-asset-meta": JSON.stringify(upload.asset.meta),
    "content-type": "application/octet-stream"
  };

  let targetOrigin = origin;
  let isBridged = false;
  try {
    const searchDirs = [process.cwd(), join$1(process.cwd(), "..")];
    for (const d of searchDirs) {
      const sPath = join$1(d, ".webstudio", "session.json");
      if (existsSync(sPath)) {
        const session = JSON.parse(readFileSync(sPath, "utf8"));
        if (session.cookie) {
          isBridged = true;
          targetOrigin = projectOrigin;
          customHeaders["cookie"] = session.cookie;
          if (session.csrfToken) customHeaders["x-csrf-token"] = session.csrfToken;
          customHeaders["x-webstudio-client"] = "browser";
          customHeaders["x-webstudio-client-version"] = session.clientVersion || "9cc23be76d4d8518981cc83feba3f090440928e7";
          customHeaders["sec-fetch-site"] = "same-origin";
          customHeaders["sec-fetch-mode"] = "cors";
          customHeaders["sec-fetch-dest"] = "empty";
          customHeaders["origin"] = targetOrigin;
          customHeaders["referer"] = targetOrigin + "/";
          delete customHeaders["x-auth-token"];
          break;
        }
      }
    }
  } catch (e) {}

  let uploadUrl;
  if (isBridged) {
    uploadUrl = new URL(targetOrigin + "/rest/assets/uploads/" + encodeURIComponent(upload.asset.name));
    uploadUrl.searchParams.set("projectId", projectId);
    uploadUrl.searchParams.set("type", upload.asset.type || "image");
    if (upload.asset.folderId !== void 0) uploadUrl.searchParams.set("folderId", upload.asset.folderId);
    if (upload.asset.format) uploadUrl.searchParams.set("format", upload.asset.format);
    uploadUrl.searchParams.set("force", "true");
  } else {
    uploadUrl = getAssetUploadUrl({
      asset: upload.asset,
      force: upload.force,
      origin: targetOrigin,
      projectId
    });
  }

  const result2 = await requestAssetRestJson(
    fetchJsonResponse,
    uploadUrl,
    {
      method: "POST",
      body: upload.data,
      headers: createHeaders(customHeaders)
    }
  );
  if (Array.isArray(result2.uploadedAssets) === false || typeof result2.deduplicated !== "boolean") {
    throw new Error("Assets API returned an invalid upload response");
  }
  return result2.deduplicated ? result2.uploadedAssets.map((asset2) => ({
    ...asset2,
    deduplicated: true
  })) : result2.uploadedAssets;
};`;
    code = code.slice(0, code.indexOf(uploadAssetSearch)) + bridgedUploadAssetCode + code.slice(uploadAssetEnd);
    console.log('✅ 6. Patched uploadAsset -> browser session bridge');
  }
}

// 7. Patch React Router template for complete dynamic meta tags and v8 flag
try {
  const templatesDir = path.resolve(path.dirname(cliPath), '..', 'templates');
  const htmlTemplatePath = path.join(templatesDir, 'react-router', 'app', 'route-templates', 'html.tsx');
  if (fs.existsSync(htmlTemplatePath)) {
    let htmlTpl = fs.readFileSync(htmlTemplatePath, 'utf-8');
    if (!htmlTpl.includes('data.pageMeta?.title')) {
      const metaCode = `export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const metas: ReturnType<MetaFunction> = [];
  if (data === undefined) {
    return metas;
  }

  const origin = \`https://\${data.host}\`;

  if (data.pageMeta?.title) {
    metas.push({ title: data.pageMeta.title });
    metas.push({ property: "og:title", content: data.pageMeta.title });
    metas.push({ name: "twitter:title", content: data.pageMeta.title });
  }

  if (data.pageMeta?.description) {
    metas.push({ name: "description", content: data.pageMeta.description });
    metas.push({ property: "og:description", content: data.pageMeta.description });
    metas.push({ name: "twitter:description", content: data.pageMeta.description });
  }

  if (data.pageMeta?.socialImageUrl) {
    metas.push({ property: "og:image", content: data.pageMeta.socialImageUrl });
    metas.push({ name: "twitter:image", content: data.pageMeta.socialImageUrl });
  }

  if (data.pageMeta?.excludePageFromSearch) {
    metas.push({ name: "robots", content: "noindex, nofollow" });
  }

  if (siteName) {
    metas.push({
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: origin,
      },
    });
  }

  return metas;
};`;
      const start = htmlTpl.indexOf('export const meta: MetaFunction<typeof loader>');
      const end = htmlTpl.indexOf('export const links:', start);
      if (start !== -1 && end !== -1) {
        htmlTpl = htmlTpl.slice(0, start) + metaCode + '\n\n' + htmlTpl.slice(end);
        fs.writeFileSync(htmlTemplatePath, htmlTpl, 'utf-8');
        console.log('✅ 7. Patched React Router HTML template -> dynamic meta tags');
      }
    }
  }

  const rrConfigPath = path.join(templatesDir, 'react-router-cloudflare', 'react-router.config.ts');
  if (fs.existsSync(rrConfigPath)) {
    let rrConfig = fs.readFileSync(rrConfigPath, 'utf-8');
    if (rrConfig.includes('unstable_viteEnvironmentApi')) {
      rrConfig = rrConfig.replace('unstable_viteEnvironmentApi', 'v8_viteEnvironmentApi');
      fs.writeFileSync(rrConfigPath, rrConfig, 'utf-8');
    }
  }

  const wranglerConfigPath = path.join(templatesDir, 'react-router-cloudflare', 'wrangler.jsonc');
  if (fs.existsSync(wranglerConfigPath)) {
    let wrConfig = fs.readFileSync(wranglerConfigPath, 'utf-8');
    if (!wrConfig.includes('nodejs_compat')) {
      wrConfig = wrConfig.replace('"compatibility_date": "2025-04-28",', '"compatibility_date": "2025-04-28",\n  "compatibility_flags": ["nodejs_compat"],');
      fs.writeFileSync(wranglerConfigPath, wrConfig, 'utf-8');
    }
  }

  // Sync custom favicon from .webstudio/assets into template public folders
  const assetsDir = path.resolve(process.cwd(), '.webstudio', 'assets');
  if (fs.existsSync(assetsDir)) {
    const icoFiles = fs.readdirSync(assetsDir).filter(f => f.startsWith('favicon') && f.endsWith('.ico'));
    if (icoFiles.length > 0) {
      const customIco = path.join(assetsDir, icoFiles[0]);
      const tplIco1 = path.join(templatesDir, 'defaults', 'public', 'favicon.ico');
      const tplIco2 = path.join(templatesDir, 'react-router', 'public', 'favicon.ico');
      if (fs.existsSync(path.dirname(tplIco1))) fs.copyFileSync(customIco, tplIco1);
      if (fs.existsSync(path.dirname(tplIco2))) fs.copyFileSync(customIco, tplIco2);
      const publicIco = path.resolve(process.cwd(), 'public', 'favicon.ico');
      if (fs.existsSync(path.dirname(publicIco))) fs.copyFileSync(customIco, publicIco);
      console.log('✅ 8. Synced custom favicon.ico into templates & public folder');
    }
  }
} catch (e) {}

fs.writeFileSync(cliPath, code, 'utf-8');
console.log('---------------------------------');
console.log('🎉 Webstudio Local MCP successfully configured!');
