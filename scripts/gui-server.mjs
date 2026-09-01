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

// SSE Client Registry
export const sseClients = new Set();

export function broadcastLog(text, type = 'stdout') {
  if (text === void 0 || text === null) return;
  // Clean up DEC mode control codes (\x1b[?25h, \x1b[?25l) and bare artifacts ([?25h, [?25l)
  const cleanedText = String(text)
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[\?[0-9;]+[a-zA-Z]/g, '');
  const timestamp = new Date().toISOString();
  const payload = `event: log\ndata: ${JSON.stringify({ text: cleanedText, type, timestamp })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function broadcastComplete(action, success, code = 0) {
  const timestamp = new Date().toISOString();
  const payload = `event: complete\ndata: ${JSON.stringify({ action, success, code, timestamp })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

let cachedLatestVersion = null;
let lastVersionCheck = 0;

export async function getLatestVersion(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedLatestVersion && (now - lastVersionCheck < 10 * 60 * 1000)) {
    return cachedLatestVersion;
  }
  try {
    const res = await fetch('https://registry.npmjs.org/webstudio/latest', {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        cachedLatestVersion = data.version;
        lastVersionCheck = now;
        return cachedLatestVersion;
      }
    }
  } catch {}
  return cachedLatestVersion;
}

export const TEMPLATE_PRESETS = {
  'react-router-cloudflare': ['react-router', 'react-router-cloudflare'],
  'cloudflare-new': ['react-router', 'react-router-cloudflare'],
  'remix-cloudflare': ['defaults', 'cloudflare'],
  'cloudflare': ['defaults', 'cloudflare'],
  'react-router-vercel': ['react-router', 'react-router-vercel'],
  'vercel': ['react-router', 'react-router-vercel'],
  'react-router-netlify': ['react-router', 'react-router-netlify'],
  'netlify': ['react-router', 'react-router-netlify'],
  'react-router-docker': ['react-router', 'react-router-docker'],
  'docker': ['react-router', 'react-router-docker'],
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
  const vercelJsonPath = path.join(rootDir, 'vercel.json');
  const netlifyTomlPath = path.join(rootDir, 'netlify.toml');
  const dockerfilePath = path.join(rootDir, 'Dockerfile');
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
  } else if (fs.existsSync(vercelJsonPath)) {
    configFile = 'vercel.json';
    detectedTemplate = 'react-router-vercel';
  } else if (fs.existsSync(netlifyTomlPath)) {
    configFile = 'netlify.toml';
    detectedTemplate = 'react-router-netlify';
  } else if (fs.existsSync(dockerfilePath)) {
    configFile = 'Dockerfile';
    detectedTemplate = 'react-router-docker';
  }

  let availableScripts = [];
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!projectName && pkg.name) {
        projectName = pkg.name;
      }
      if (!configFile) {
        configFile = 'package.json';
      }
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        availableScripts = Object.keys(pkg.scripts);
      }
      if (detectedTemplate === 'unknown') {
        if (pkg.dependencies?.['@react-router/cloudflare'] || pkg.devDependencies?.['@react-router/cloudflare']) {
          detectedTemplate = 'react-router-cloudflare';
        } else if (pkg.dependencies?.['@remix-run/cloudflare'] || pkg.devDependencies?.['@remix-run/cloudflare']) {
          detectedTemplate = 'remix-cloudflare';
        } else if (pkg.dependencies?.['@react-router/node'] || pkg.dependencies?.['react-router']) {
          detectedTemplate = 'react-router-docker';
        } else if (pkg.dependencies?.['vike'] || pkg.dependencies?.['vite-plugin-ssr']) {
          detectedTemplate = 'ssg';
        }
      }
    } catch {}
  }

  return {
    projectName: projectName || 'webstudio-app',
    configFile: configFile || 'none',
    detectedTemplate,
    hasWrangler: Boolean(fs.existsSync(wranglerJsoncPath) || fs.existsSync(wranglerTomlPath)),
    hasBuildDir: Boolean(fs.existsSync(path.join(rootDir, 'build')) || fs.existsSync(path.join(rootDir, 'dist'))),
    availableScripts
  };
}

export function updateProjectNameOnDisk(rootDir, newName) {
  if (!newName || typeof newName !== 'string') return { updated: false, safeName: '' };
  const safeName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (!safeName) return { updated: false, safeName: '' };

  const wranglerJsoncPath = path.join(rootDir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(rootDir, 'wrangler.toml');
  const packageJsonPath = path.join(rootDir, 'package.json');

  let updated = false;

  if (fs.existsSync(wranglerJsoncPath)) {
    try {
      let content = fs.readFileSync(wranglerJsoncPath, 'utf8');
      if (/"name"\s*:\s*"[^"]+"/.test(content)) {
        content = content.replace(/"name"\s*:\s*"[^"]+"/, `"name": "${safeName}"`);
      } else {
        content = content.replace(/\{/, `{\n  "name": "${safeName}",`);
      }
      fs.writeFileSync(wranglerJsoncPath, content, 'utf8');
      updated = true;
    } catch {}
  }

  if (fs.existsSync(wranglerTomlPath)) {
    try {
      let content = fs.readFileSync(wranglerTomlPath, 'utf8');
      if (/^name\s*=\s*"[^"]+"/m.test(content)) {
        content = content.replace(/^name\s*=\s*"[^"]+"/m, `name = "${safeName}"`);
      } else {
        content = `name = "${safeName}"\n` + content;
      }
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

export async function getProjectStatus() {
  const cliPath = path.join(rootDir, 'node_modules', 'webstudio', 'lib', 'cli.js');
  const pkgPath = path.join(rootDir, 'node_modules', 'webstudio', 'package.json');
  
  let installed = false;
  let webstudioVersion = null;
  
  if (fs.existsSync(cliPath) && fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      webstudioVersion = pkg.version || null;
      installed = true;
    } catch {}
  }

  const latestVersion = await getLatestVersion();

  let config = null;
  const configPath = path.join(rootDir, '.webstudio', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }

  let auth = null;
  const authPath = path.join(rootDir, '.webstudio', 'auth.json');
  if (fs.existsSync(authPath)) {
    try {
      auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    } catch {}
  }

  let session = null;
  const sessionPath = path.join(rootDir, '.webstudio', 'session.json');
  if (fs.existsSync(sessionPath)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {}
  }

  let data = null;
  const dataPath = path.join(rootDir, '.webstudio', 'data.json');
  if (fs.existsSync(dataPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch {}
  }

  const projectId = config?.projectId || data?.projectId || data?.build?.projectId || null;
  const origin = (projectId ? `https://p-${projectId}.apps.webstudio.is` : data?.origin) || 'https://apps.webstudio.is';
  
  let authToken = auth?.authToken || auth?.token || '';
  if (!authToken && auth?.routes) {
    for (const route of Object.values(auth.routes)) {
      if (route && route.authToken) {
        authToken = route.authToken;
        break;
      }
    }
  }
  const hasAuthToken = Boolean(authToken || data?.authToken);
  const hasSession = Boolean(session?.cookie && session?.csrfToken);

  let savedShareLink = '';
  if (projectId && authToken) {
    savedShareLink = `https://p-${projectId}.apps.webstudio.is/?authToken=${authToken}`;
  } else if (projectId) {
    savedShareLink = `https://p-${projectId}.apps.webstudio.is`;
  }

  let pagesCount = 0;
  if (Array.isArray(data?.pages)) {
    pagesCount = data.pages.length;
  } else if (Array.isArray(data?.build?.pages?.pages)) {
    pagesCount = data.build.pages.pages.length;
  }

  let instancesCount = 0;
  if (data?.build?.instances) {
    if (Array.isArray(data.build.instances)) {
      instancesCount = data.build.instances.length;
    } else if (typeof data.build.instances === 'object') {
      instancesCount = Object.keys(data.build.instances).length;
    }
  }

  let assetsCount = 0;
  if (Array.isArray(data?.assets)) {
    assetsCount = data.assets.length;
  } else {
    const assetsDir = path.join(rootDir, '.webstudio', 'assets');
    if (fs.existsSync(assetsDir)) {
      try {
        assetsCount = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.')).length;
      } catch {}
    }
  }

  return {
    installed,
    webstudioVersion,
    latestVersion,
    updateAvailable: Boolean(installed && webstudioVersion && latestVersion && webstudioVersion !== latestVersion),
    projectId,
    origin,
    hasAuthToken,
    hasSession,
    savedShareLink,
    sessionData: session ? { cookie: session.cookie || '', csrfToken: session.csrfToken || '' } : null,
    projectStats: {
      pages: pagesCount,
      instances: instancesCount,
      assets: assetsCount
    },
    deploy: getDeployConfig(rootDir)
  };
}

export const getSystemStatus = getProjectStatus;

export function executeShellCommand(action, command) {
  broadcastLog(`$ ${command}`, 'stdout');
  const child = spawn(command, {
    cwd: rootDir,
    shell: true,
    env: process.env
  });

  child.stdout.on('data', (chunk) => {
    broadcastLog(chunk.toString(), 'stdout');
  });

  child.stderr.on('data', (chunk) => {
    broadcastLog(chunk.toString(), 'stderr');
  });

  child.on('error', (err) => {
    broadcastLog(`Process error: ${err.message}`, 'stderr');
    broadcastComplete(action, false, 1);
  });

  child.on('close', (code) => {
    const success = code === 0;
    if (success) {
      broadcastLog(`Action "${action}" completed successfully.`, 'stdout');
    } else {
      broadcastLog(`Action "${action}" exited with code ${code}.`, 'stderr');
    }
    broadcastComplete(action, success, code ?? 0);
  });

  return child;
}

export function handleAction(action, params = {}) {
  switch (action) {
    case 'install': {
      executeShellCommand('install', 'npm install');
      break;
    }
    case 'update': {
      executeShellCommand('update', 'npm run update-webstudio');
      break;
    }
    case 'link': {
      const shareLink = (params.shareLink || '').replace(/"/g, '\\"');
      executeShellCommand('link', `npx webstudio link --link "${shareLink}"`);
      break;
    }
    case 'sync': {
      executeShellCommand('sync', 'npx webstudio sync');
      break;
    }
    case 'sync-draft': {
      let shareLink = params.shareLink || '';
      let buildId = params.buildId || '';
      let origin = '';
      let authToken = '';

      if (shareLink) {
        try {
          const url = new URL(shareLink);
          authToken = url.searchParams.get('authToken') || '';
          if (!buildId && url.searchParams.get('buildId')) {
            buildId = url.searchParams.get('buildId');
          }
          const pMatch = url.hostname.match(/^p-([a-zA-Z0-9-]+)\./);
          if (pMatch) {
            origin = `${url.protocol}//${url.hostname}`;
          } else {
            const pathMatch = url.pathname.match(/\/project\/([a-zA-Z0-9-]+)/);
            if (pathMatch) {
              origin = `https://p-${pathMatch[1]}.apps.webstudio.is`;
            }
          }
        } catch {}
      }

      if (!authToken) {
        const authPath = path.join(rootDir, '.webstudio', 'auth.json');
        if (fs.existsSync(authPath)) {
          try {
            const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
            authToken = authData.authToken || authData.token || '';
          } catch {}
        }
      }

      if (!origin) {
        const configPath = path.join(rootDir, '.webstudio', 'config.json');
        const dataPath = path.join(rootDir, '.webstudio', 'data.json');
        let pid = null;
        if (fs.existsSync(configPath)) {
          try {
            pid = JSON.parse(fs.readFileSync(configPath, 'utf8')).projectId;
          } catch {}
        }
        if (!pid && fs.existsSync(dataPath)) {
          try {
            const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            pid = d.projectId || d.build?.projectId;
          } catch {}
        }
        if (pid) {
          origin = `https://p-${pid}.apps.webstudio.is`;
        } else {
          origin = 'https://apps.webstudio.is';
        }
      }

      let cmd = 'npx webstudio sync';
      if (buildId) cmd += ` --buildId "${buildId.replace(/"/g, '\\"')}"`;
      if (origin) cmd += ` --origin "${origin.replace(/"/g, '\\"')}"`;
      if (authToken) cmd += ` --authToken "${authToken.replace(/"/g, '\\"')}"`;

      executeShellCommand('sync-draft', cmd);
      break;
    }
    case 'save-session': {
      try {
        const webstudioDir = path.join(rootDir, '.webstudio');
        if (!fs.existsSync(webstudioDir)) {
          fs.mkdirSync(webstudioDir, { recursive: true });
        }
        const sessionPath = path.join(webstudioDir, 'session.json');
        const sessionData = {
          cookie: params.cookie || '',
          csrfToken: params.csrfToken || ''
        };
        fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
        broadcastLog('✅ session.json saved successfully.', 'stdout');
        broadcastComplete('save-session', true, 0);
      } catch (err) {
        broadcastLog(`❌ Failed to save session: ${err.message}`, 'stderr');
        broadcastComplete('save-session', false, 1);
      }
      break;
    }
    case 'upload-assets': {
      executeShellCommand('upload-assets', 'node scripts/upload-assets.mjs');
      break;
    }
    case 'import': {
      const shareLink = (params.shareLink || '').replace(/"/g, '\\"');
      executeShellCommand('import', `npx webstudio import --to "${shareLink}"`);
      break;
    }
    case 'check-updates': {
      broadcastLog('🔍 Checking for Webstudio updates...', 'stdout');
      (async () => {
        try {
          const pkgPath = path.join(rootDir, 'node_modules', 'webstudio', 'package.json');
          let currentVersion = 'unknown';
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            currentVersion = pkg.version;
          }
          broadcastLog(`Current installed version: ${currentVersion}`, 'stdout');
          
          const latest = await getLatestVersion(true);
          if (latest) {
            broadcastLog(`Latest available version: ${latest}`, 'stdout');
            if (currentVersion !== latest && currentVersion !== 'unknown') {
              broadcastLog(`💡 Update available! Run update to upgrade to ${latest}.`, 'stdout');
            } else {
              broadcastLog(`✨ You are on the latest version (${currentVersion}).`, 'stdout');
            }
            broadcastComplete('check-updates', true, 0);
          } else {
            broadcastLog('⚠️ Could not determine latest version from registry.', 'stderr');
            broadcastComplete('check-updates', false, 1);
          }
        } catch (err) {
          broadcastLog(`❌ Error checking updates: ${err.message}`, 'stderr');
          broadcastComplete('check-updates', false, 1);
        }
      })();
      break;
    }
    case 'generate-template': {
      const preset = params.templatePreset || params.template || 'react-router-cloudflare';
      const templates = TEMPLATE_PRESETS[preset] || (Array.isArray(preset) ? preset : [preset]);
      let cmd = 'npx webstudio build';
      for (const t of templates) {
        cmd += ` --template ${t}`;
      }
      executeShellCommand('generate-template', cmd);
      break;
    }
    case 'update-project-name': {
      const newName = params.projectName || params.name || '';
      const result = updateProjectNameOnDisk(rootDir, newName);
      if (result.updated || result.safeName) {
        broadcastLog(`✅ Project name updated to: ${result.safeName}`, 'stdout');
        broadcastComplete('update-project-name', true, 0);
      } else {
        broadcastLog('❌ Failed to update project name: invalid name provided', 'stderr');
        broadcastComplete('update-project-name', false, 1);
      }
      break;
    }
    case 'check-auth': {
      executeShellCommand('check-auth', 'npx wrangler whoami');
      break;
    }
    case 'login-auth': {
      executeShellCommand('login-auth', 'npx wrangler login');
      break;
    }
    case 'build-project': {
      executeShellCommand('build-project', 'npm run build');
      break;
    }
    case 'preview-project': {
      executeShellCommand('preview-project', 'npm run preview');
      break;
    }
    case 'deploy-project': {
      executeShellCommand('deploy-project', 'npm run deploy');
      break;
    }
    default: {
      broadcastLog(`Unknown action requested: ${action}`, 'stderr');
      broadcastComplete(action, false, 1);
      break;
    }
  }
}

export function createGuiServer(port = 4200) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
      // GET /api/logs -> SSE Stream
      if (pathname === '/api/logs' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders
        });

        const timestamp = new Date().toISOString();
        res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Webstudio Control Center logs stream', timestamp })}\n\n`);

        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        res.on('error', () => {
          sseClients.delete(res);
        });
        return;
      }

      // GET /api/status -> JSON status object
      if (pathname === '/api/status' && req.method === 'GET') {
        try {
          const status = await getProjectStatus();
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders
          });
          res.end(JSON.stringify(status));
        } catch (err) {
          res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders
          });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/action -> Execute process & stream logs
      if (pathname === '/api/action' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          let payload = {};
          try {
            payload = JSON.parse(body || '{}');
          } catch (e) {
            res.writeHead(400, {
              'Content-Type': 'application/json; charset=utf-8',
              ...corsHeaders
            });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            return;
          }

          const { action, params = {} } = payload;
          if (!action) {
            res.writeHead(400, {
              'Content-Type': 'application/json; charset=utf-8',
              ...corsHeaders
            });
            res.end(JSON.stringify({ error: 'Action is required' }));
            return;
          }

          handleAction(action, params);

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders
          });
          res.end(JSON.stringify({ ok: true, action }));
        });
        return;
      }

      // Unknown API endpoint
      res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders
      });
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
      return;
    }

    // Static file serving
    let staticPath = pathname;
    if (staticPath === '/' || staticPath === '') staticPath = '/index.html';
    const filePath = path.join(guiDir, staticPath);

    // Prevent directory traversal
    if (!filePath.startsWith(guiDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
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

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('File Not Found');
  });

  return { server, port };
}

if (process.argv[1] && (process.argv[1].endsWith('gui-server.mjs') || path.resolve(process.argv[1]) === __filename)) {
  if (process.argv.includes('--test-exit')) {
    console.log('🚀 Webstudio Control Center CLI test flag detected. Exiting successfully.');
    process.exit(0);
  }

  const noOpen = process.argv.includes('--no-open');
  const DEFAULT_PORT = 4200;
  const { server } = createGuiServer(DEFAULT_PORT);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = DEFAULT_PORT + 1;
      console.log(`⚠️ Port ${DEFAULT_PORT} is busy, trying ${fallbackPort}...`);
      server.listen(fallbackPort, () => {
        console.log(`🚀 Webstudio Control Center running at http://localhost:${fallbackPort}`);
        if (!noOpen) openBrowser(`http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(DEFAULT_PORT, () => {
    console.log(`🚀 Webstudio Control Center running at http://localhost:${DEFAULT_PORT}`);
    if (!noOpen) openBrowser(`http://localhost:${DEFAULT_PORT}`);
  });
}
