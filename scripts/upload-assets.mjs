import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Uploads local assets to Webstudio Cloud using browser session cookies,
 * automatically binds image props in data.build.props and data.props,
 * and pushes the updated project to Webstudio Cloud.
 */
export async function uploadAssetsFromSession(options = {}) {
  const cwd = options.cwd || process.cwd();
  let baseDir = cwd;
  if (!fs.existsSync(path.resolve(baseDir, '.webstudio', 'data.json')) && fs.existsSync(path.resolve(baseDir, '..', '.webstudio', 'data.json'))) {
    baseDir = path.resolve(baseDir, '..');
  }

  const sessionPath = path.resolve(baseDir, '.webstudio', 'session.json');
  const authPath = path.resolve(baseDir, '.webstudio', 'auth.json');
  const dataPath = path.resolve(baseDir, '.webstudio', 'data.json');
  const assetsDir = path.resolve(baseDir, '.webstudio', 'assets');

  if (!fs.existsSync(dataPath)) {
    throw new Error(`data.json not found at: ${dataPath}`);
  }

  let session = {};
  if (fs.existsSync(sessionPath)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  const cookie = options.cookie || session.cookie;
  const csrfToken = options.csrfToken || session.csrfToken;
  const clientVersion = options.clientVersion || session.clientVersion || '9cc23be76d4d8518981cc83feba3f090440928e7';

  if (!cookie) {
    throw new Error('No browser session cookie provided. Create .webstudio/session.json or pass --cookie');
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const projectId = data.projectId || options.projectId || data.build?.projectId || (data.assets?.[0]?.projectId);
  if (!projectId) {
    throw new Error('Project ID not found in .webstudio/data.json');
  }

  const origin = `https://p-${projectId}.apps.webstudio.is`;
  console.log(`[Upload] Connecting to project ${projectId} at ${origin}...`);

  if (!fs.existsSync(assetsDir)) {
    console.log('[Upload] No .webstudio/assets directory found.');
    return;
  }

  const files = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.'));
  console.log(`[Upload] Found ${files.length} asset files in .webstudio/assets/`);

  const assetMap = {};
  const filenameToAssetId = {};
  const currentAssets = data.assets || [];

  for (const filename of files) {
    const filePath = path.join(assetsDir, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const baseName = path.parse(filename).name;
    const ext = path.extname(filename).slice(1).toLowerCase();
    const format = ext === 'png' ? 'png' : ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'svg' ? 'svg' : ext === 'woff2' || ext === 'woff' || ext === 'ttf' ? ext : 'jpeg';
    const type = ext === 'woff2' || ext === 'woff' || ext === 'ttf' || ext === 'otf' ? 'font' : 'image';

    const uploadUrl = new URL(`${origin}/rest/assets/uploads/${encodeURIComponent(filename)}`);
    uploadUrl.searchParams.set('projectId', projectId);
    uploadUrl.searchParams.set('type', type);
    uploadUrl.searchParams.set('format', format);
    uploadUrl.searchParams.set('force', 'true');

    console.log(`[Upload] Uploading ${filename} (${(stat.size / 1024).toFixed(1)} KB)...`);

    const fileData = fs.readFileSync(filePath);
    const headers = {
      'cookie': cookie,
      'x-webstudio-client': 'browser',
      'x-webstudio-client-version': clientVersion,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'origin': origin,
      'referer': `${origin}/`,
      'content-type': 'application/octet-stream',
      'x-webstudio-asset-meta': JSON.stringify({ width: 1280, height: 720 })
    };
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    try {
      const res = await fetch(uploadUrl.toString(), {
        method: 'POST',
        body: fileData,
        headers
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Upload] Error uploading ${filename}: ${res.status} ${res.statusText}`, errText);
        continue;
      }

      const json = await res.json();
      const uploaded = json.uploadedAssets?.[0];
      if (uploaded) {
        console.log(`[Upload] ✅ Uploaded ${filename} -> ID: ${uploaded.id}`);
        filenameToAssetId[filename] = uploaded.id;
        filenameToAssetId[baseName] = uploaded.id;

        const existingIdx = currentAssets.findIndex(a => a.name === filename || a.filename === filename || a.name?.startsWith(baseName));
        if (existingIdx !== -1) {
          assetMap[currentAssets[existingIdx].id] = uploaded.id;
          currentAssets[existingIdx] = uploaded;
        } else {
          currentAssets.push(uploaded);
        }

        if (uploaded.name && uploaded.name !== filename) {
          const newPath = path.join(assetsDir, uploaded.name);
          if (!fs.existsSync(newPath)) {
            fs.copyFileSync(filePath, newPath);
          }
        }
      }
    } catch (e) {
      console.error(`[Upload] Network error uploading ${filename}:`, e.message);
    }
  }

  data.assets = currentAssets;

  // Remap props in data.build.props (array of [key, propObj])
  const updateProp = (prop) => {
    if (!prop || prop.name !== 'src') return;

    // Handle prop.type === 'asset'
    if (prop.type === 'asset' && prop.value && assetMap[prop.value]) {
      prop.value = assetMap[prop.value];
    } else if (typeof prop.value === 'string') {
      // Handle string paths e.g. "assets/hospital_building.jpg" or "hospital_building"
      const cleanVal = prop.value.replace(/^assets\//, '').replace(/^\.\//, '');
      const cleanBase = path.parse(cleanVal).name;
      if (filenameToAssetId[cleanVal] || filenameToAssetId[cleanBase]) {
        const targetId = filenameToAssetId[cleanVal] || filenameToAssetId[cleanBase];
        prop.type = 'asset';
        prop.value = targetId;
        console.log(`[Remap] Bound image prop ${prop.id || prop.instanceId} to asset ID: ${targetId}`);
      }
    }
  };

  if (data.build && Array.isArray(data.build.props)) {
    for (const entry of data.build.props) {
      const prop = Array.isArray(entry) ? entry[1] : entry;
      updateProp(prop);
    }
  }

  if (Array.isArray(data.props)) {
    for (const prop of data.props) {
      updateProp(prop);
    }
  } else if (data.props && typeof data.props === 'object') {
    for (const prop of Object.values(data.props)) {
      updateProp(prop);
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log('[Upload] ✅ .webstudio/data.json successfully updated with all active asset IDs and bindings!');

  // Optional: Auto import to cloud if auth token exists
  let shareLink = options.shareLink;
  if (!shareLink && fs.existsSync(authPath)) {
    try {
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      if (auth.origin && auth.token && auth.projectId) {
        shareLink = `${auth.origin}/builder/${auth.projectId}?authToken=${auth.token}`;
      }
    } catch {
      // ignore
    }
  }

  if (shareLink || options.import !== false) {
    try {
      console.log('[Sync] Pushing project bundle to Webstudio Cloud...');
      const targetLink = shareLink || `${origin}/?authToken=${options.authToken || ''}&mode=design`;
      execSync(`npx webstudio import --to "${targetLink}"`, {
        cwd: baseDir,
        stdio: 'inherit'
      });
      console.log('[Sync] ✅ Cloud import completed successfully!');
    } catch (e) {
      console.log('[Sync Note] Automated import exited. You can run npx webstudio import --to "<shareLink>"');
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('upload-assets.mjs')) {
  uploadAssetsFromSession().catch(e => {
    console.error('[Upload Fatal]', e.message);
    process.exit(1);
  });
}
