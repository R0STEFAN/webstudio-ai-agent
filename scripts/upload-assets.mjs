import fs from 'fs';
import path from 'path';

/**
 * Uploads local assets to Webstudio Cloud using browser session cookies
 * and automatically updates .webstudio/data.json asset descriptors.
 */
export async function uploadAssetsFromSession(options = {}) {
  const cwd = options.cwd || process.cwd();
  let baseDir = cwd;
  if (!fs.existsSync(path.resolve(baseDir, '.webstudio', 'data.json')) && fs.existsSync(path.resolve(baseDir, '..', '.webstudio', 'data.json'))) {
    baseDir = path.resolve(baseDir, '..');
  }

  const sessionPath = path.resolve(baseDir, '.webstudio', 'session.json');
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
  const projectId = data.projectId || options.projectId || (data.assets?.[0]?.projectId);
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
  const currentAssets = data.assets || [];

  for (const filename of files) {
    const filePath = path.join(assetsDir, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const ext = path.extname(filename).slice(1).toLowerCase();
    const format = ext === 'png' ? 'png' : ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'svg' ? 'svg' : 'jpeg';
    const type = 'image';

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
        console.log(`[Upload] Successfully uploaded ${filename} -> ID: ${uploaded.id}`);
        const existingIdx = currentAssets.findIndex(a => a.name === filename || a.filename === filename || a.name?.startsWith(path.parse(filename).name));
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

  const propsList = Array.isArray(data.props) ? data.props : Object.values(data.props || {});
  for (const prop of propsList) {
    if (prop.name === 'src' && prop.value && prop.value.type === 'asset') {
      if (assetMap[prop.value.value]) {
        prop.value.value = assetMap[prop.value.value];
      }
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log('[Upload] .webstudio/data.json successfully updated with all uploaded asset IDs!');
}

if (process.argv[1] && process.argv[1].endsWith('upload-assets.mjs')) {
  uploadAssetsFromSession().catch(e => {
    console.error('[Upload Fatal]', e.message);
    process.exit(1);
  });
}
