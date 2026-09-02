import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
export function cleanFrameworkArtifacts(rootDir, preset) {
  const pkgPath = path.join(rootDir, 'package.json');
  let pkg = null;
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {}
  }

  const isRemix = preset.includes('remix') || preset === 'cloudflare';
  const isReactRouter = preset.includes('react-router') || preset === 'cloudflare-new' || preset === 'docker';

  const removePaths = [];
  const depsToRemove = [];

  if (isRemix) {
    removePaths.push(
      path.join(rootDir, 'app', 'entry.server.tsx'),
      path.join(rootDir, 'app', 'routes.ts'),
      path.join(rootDir, 'workers'),
      path.join(rootDir, 'react-router.config.ts'),
      path.join(rootDir, 'wrangler.jsonc'),
      path.join(rootDir, 'vercel.json'),
      path.join(rootDir, 'netlify.toml'),
      path.join(rootDir, 'Dockerfile')
    );
    depsToRemove.push(
      '@react-router/dev',
      '@react-router/fs-routes',
      '@react-router/node',
      '@react-router/serve',
      'react-router',
      '@webstudio-is/sdk-components-react-router',
      '@cloudflare/vite-plugin'
    );
  } else if (isReactRouter) {
    removePaths.push(
      path.join(rootDir, 'functions'),
      path.join(rootDir, 'wrangler.toml'),
      path.join(rootDir, 'vercel.json'),
      path.join(rootDir, 'netlify.toml')
    );
    depsToRemove.push(
      '@remix-run/cloudflare',
      '@remix-run/cloudflare-pages',
      '@remix-run/node',
      '@remix-run/react',
      '@remix-run/server-runtime',
      '@remix-run/dev',
      '@webstudio-is/sdk-components-react-remix'
    );
  }

  for (const p of removePaths) {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {}
    }
  }

  if (pkg) {
    let modified = false;
    for (const dep of depsToRemove) {
      if (pkg.dependencies?.[dep]) {
        delete pkg.dependencies[dep];
        modified = true;
      }
      if (pkg.devDependencies?.[dep]) {
        delete pkg.devDependencies[dep];
        modified = true;
      }
    }
    if (modified) {
      try {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      } catch {}
    }
  }
}
export function cleanAllTemplateGenerations(rootDir) {
  const pathsToRemove = [
    path.join(rootDir, 'app'),
    path.join(rootDir, 'functions'),
    path.join(rootDir, 'workers'),
    path.join(rootDir, 'public'),
    path.join(rootDir, 'build'),
    path.join(rootDir, 'dist'),
    path.join(rootDir, '.wrangler'),
    path.join(rootDir, 'wrangler.jsonc'),
    path.join(rootDir, 'wrangler.toml'),
    path.join(rootDir, 'vercel.json'),
    path.join(rootDir, 'netlify.toml'),
    path.join(rootDir, 'Dockerfile'),
    path.join(rootDir, 'vite.config.ts'),
    path.join(rootDir, 'react-router.config.ts'),
    path.join(rootDir, 'worker-configuration.d.ts')
  ];

  for (const p of pathsToRemove) {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {}
    }
  }

  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const templateDeps = [
        '@react-router/dev',
        '@react-router/fs-routes',
        '@react-router/node',
        '@react-router/serve',
        'react-router',
        '@remix-run/cloudflare',
        '@remix-run/cloudflare-pages',
        '@remix-run/node',
        '@remix-run/react',
        '@remix-run/server-runtime',
        '@remix-run/dev',
        '@cloudflare/vite-plugin',
        '@cloudflare/workers-types',
        '@webstudio-is/sdk-components-react-remix',
        '@webstudio-is/sdk-components-react-router',
        'isbot',
        'react',
        'react-dom',
        'shiki',
        '@shikijs/langs',
        '@shikijs/themes',
        '@types/react',
        '@types/react-dom',
        'typescript',
        'vite'
      ];

      for (const dep of templateDeps) {
        if (pkg.dependencies?.[dep]) delete pkg.dependencies[dep];
        if (pkg.devDependencies?.[dep]) delete pkg.devDependencies[dep];
      }
      if (!pkg.scripts) pkg.scripts = {};
      pkg.scripts.build = 'remix vite:build';
      pkg.scripts.dev = 'remix vite:dev';
      pkg.scripts.preview = 'npm run build && wrangler pages dev ./build/client';
      pkg.scripts.deploy = 'npm run build && wrangler pages deploy ./build/client';

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    } catch {}
  }
}


let cachedHostingAccounts = {
  Cloudflare: null,
  Vercel: null,
  Netlify: null,
  Docker: null
};

export function getHostingAuth(rootDir, targetHosting = null) {
  let provider = targetHosting;
  if (!provider) {
    const wranglerJsonc = path.join(rootDir, 'wrangler.jsonc');
    const wranglerToml = path.join(rootDir, 'wrangler.toml');
    const vercelJson = path.join(rootDir, 'vercel.json');
    const netlifyToml = path.join(rootDir, 'netlify.toml');
    const dockerfile = path.join(rootDir, 'Dockerfile');
    const packageJson = path.join(rootDir, 'package.json');

    if (fs.existsSync(vercelJson)) provider = 'Vercel';
    else if (fs.existsSync(netlifyToml)) provider = 'Netlify';
    else if (fs.existsSync(dockerfile)) provider = 'Docker';
    else if (fs.existsSync(wranglerJsonc) || fs.existsSync(wranglerToml)) provider = 'Cloudflare';
    else if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
        if (pkg.dependencies?.['@remix-run/cloudflare'] || pkg.devDependencies?.['@remix-run/cloudflare'] || pkg.dependencies?.['@react-router/cloudflare'] || pkg.devDependencies?.['@react-router/cloudflare']) {
          provider = 'Cloudflare';
        }
      } catch {}
      provider = provider || 'Cloudflare';
    } else {
      provider = 'Cloudflare';
    }
  }

  const home = os.homedir();
  const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const localappdata = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  if (provider === 'Vercel') {
    if (process.env.VERCEL_TOKEN || process.env.VERCEL_AUTH_TOKEN) {
      return {
        authenticated: true,
        account: cachedHostingAccounts.Vercel || 'Vercel (API Token)',
        provider: 'Vercel',
        checked: true
      };
    }

    const vercelPaths = [
      path.join(appdata, 'xdg.data', 'com.vercel.cli', 'auth.json'),
      path.join(appdata, 'com.vercel.cli', 'auth.json'),
      path.join(localappdata, 'com.vercel.cli', 'auth.json'),
      path.join(home, '.vercel', 'auth.json'),
      path.join(home, '.local', 'share', 'com.vercel.cli', 'auth.json'),
      path.join(home, '.config', 'com.vercel.cli', 'auth.json')
    ];
    for (const p of vercelPaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          const data = JSON.parse(content);
          if (data.token || data.auth) {
            return {
              authenticated: true,
              account: cachedHostingAccounts.Vercel || data.user?.username || data.user?.email || 'Vercel',
              provider: 'Vercel',
              checked: true
            };
          }
        } catch {}
      }
    }

    return {
      authenticated: Boolean(cachedHostingAccounts.Vercel),
      account: cachedHostingAccounts.Vercel || null,
      provider: 'Vercel',
      checked: true
    };
  }

  if (provider === 'Netlify') {
    if (process.env.NETLIFY_AUTH_TOKEN) {
      return {
        authenticated: true,
        account: cachedHostingAccounts.Netlify || 'Netlify (API Token)',
        provider: 'Netlify',
        checked: true
      };
    }

    const netlifyPaths = [
      path.join(appdata, 'xdg.config', 'netlify', 'config.json'),
      path.join(appdata, 'xdg.data', 'netlify', 'config.json'),
      path.join(appdata, 'netlify', 'Config', 'config.json'),
      path.join(appdata, 'netlify', 'config.json'),
      path.join(home, '.netlify', 'config.json'),
      path.join(home, '.config', 'netlify', 'config.json')
    ];
    for (const p of netlifyPaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          const data = JSON.parse(content);
          if (data.userId || data.accessToken || (data.users && Object.keys(data.users).length > 0)) {
            const userObj = data.users ? Object.values(data.users)[0] : null;
            return {
              authenticated: true,
              account: cachedHostingAccounts.Netlify || userObj?.email || userObj?.name || 'Netlify',
              provider: 'Netlify',
              checked: true
            };
          }
        } catch {}
      }
    }

    return {
      authenticated: Boolean(cachedHostingAccounts.Netlify),
      account: cachedHostingAccounts.Netlify || null,
      provider: 'Netlify',
      checked: true
    };
  }

  if (provider === 'Docker') {
    return {
      authenticated: true,
      account: cachedHostingAccounts.Docker || 'Docker Engine',
      provider: 'Docker',
      checked: true
    };
  }

  if (provider === 'Static' || provider === 'Static / CDN') {
    return {
      authenticated: true,
      account: 'Static / CDN',
      provider: 'Static',
      checked: true
    };
  }

  // Default: Cloudflare
  if (process.env.CLOUDFLARE_API_TOKEN || (process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_API_KEY)) {
    return {
      authenticated: true,
      account: cachedHostingAccounts.Cloudflare || process.env.CLOUDFLARE_EMAIL || 'Cloudflare (API Token)',
      provider: 'Cloudflare',
      checked: true
    };
  }

  const wranglerConfigPaths = [
    path.join(home, '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Local', '.wrangler', 'config', 'default.toml')
  ];

  if (process.env.XDG_CONFIG_HOME) {
    wranglerConfigPaths.unshift(path.join(process.env.XDG_CONFIG_HOME, '.wrangler', 'config', 'default.toml'));
  }

  for (const configPath of wranglerConfigPaths) {
    if (configPath && fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        if (content.includes('oauth_token') || content.includes('refresh_token') || content.includes('api_token')) {
          return {
            authenticated: true,
            account: cachedHostingAccounts.Cloudflare || 'Cloudflare',
            provider: 'Cloudflare',
            checked: true
          };
        }
      } catch {}
    }
  }

  return {
    authenticated: Boolean(cachedHostingAccounts.Cloudflare),
    account: cachedHostingAccounts.Cloudflare || null,
    provider: 'Cloudflare',
    checked: true
  };
}

export function getDeployConfig(rootDir, requestedHosting = null, requestedTemplate = null) {
  let projectName = '';
  let configFile = '';
  let detectedTemplate = 'unknown';
  const wranglerJsoncPath = path.join(rootDir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(rootDir, 'wrangler.toml');
  const vercelJsonPath = path.join(rootDir, 'vercel.json');
  const netlifyTomlPath = path.join(rootDir, 'netlify.toml');
  const dockerfilePath = path.join(rootDir, 'Dockerfile');
  const packageJsonPath = path.join(rootDir, 'package.json');

  let pkg = null;
  let availableScripts = [];
  if (fs.existsSync(packageJsonPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name) projectName = pkg.name;
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        availableScripts = Object.keys(pkg.scripts);
      }
    } catch {}
  }

  const candidateConfigs = [
    { file: 'wrangler.toml', path: wranglerTomlPath, template: 'remix-cloudflare' },
    { file: 'wrangler.jsonc', path: wranglerJsoncPath, template: 'react-router-cloudflare' },
    { file: 'vercel.json', path: vercelJsonPath, template: 'react-router-vercel' },
    { file: 'netlify.toml', path: netlifyTomlPath, template: 'react-router-netlify' },
    { file: 'Dockerfile', path: dockerfilePath, template: 'react-router-docker' }
  ].filter(c => fs.existsSync(c.path));

  let primaryCandidate = null;
  if (pkg) {
    if ((pkg.dependencies?.['@remix-run/cloudflare'] || pkg.devDependencies?.['@remix-run/cloudflare'] || pkg.dependencies?.['@remix-run/react'] || pkg.devDependencies?.['@remix-run/react']) && fs.existsSync(wranglerTomlPath)) {
      primaryCandidate = candidateConfigs.find(c => c.file === 'wrangler.toml');
    } else if ((pkg.dependencies?.['@react-router/cloudflare'] || pkg.devDependencies?.['@react-router/cloudflare']) && fs.existsSync(wranglerJsoncPath)) {
      primaryCandidate = candidateConfigs.find(c => c.file === 'wrangler.jsonc');
    } else if (fs.existsSync(dockerfilePath)) {
      primaryCandidate = candidateConfigs.find(c => c.file === 'Dockerfile');
    }
  }

  if (!primaryCandidate && candidateConfigs.length > 0) {
    if (candidateConfigs.length === 1) {
      primaryCandidate = candidateConfigs[0];
    } else {
      candidateConfigs.sort((a, b) => {
        const mtimeA = fs.statSync(a.path).mtimeMs || 0;
        const mtimeB = fs.statSync(b.path).mtimeMs || 0;
        return mtimeB - mtimeA;
      });
      primaryCandidate = candidateConfigs[0];
    }
  }

  if (primaryCandidate) {
    configFile = primaryCandidate.file;
    detectedTemplate = primaryCandidate.template;

    if (primaryCandidate.file === 'wrangler.jsonc') {
      try {
        const content = fs.readFileSync(wranglerJsoncPath, 'utf8');
        const match = content.match(/"name"\s*:\s*"([^"]+)"/);
        if (match) projectName = match[1];
      } catch {}
    } else if (primaryCandidate.file === 'wrangler.toml') {
      try {
        const content = fs.readFileSync(wranglerTomlPath, 'utf8');
        const match = content.match(/^name\s*=\s*"([^"]+)"/m);
        if (match) projectName = match[1];
      } catch {}
    }
  } else if (!configFile && fs.existsSync(packageJsonPath)) {
    configFile = 'package.json';
    if (detectedTemplate === 'unknown') {
      if (pkg?.dependencies?.['@react-router/cloudflare'] || pkg?.devDependencies?.['@react-router/cloudflare']) {
        detectedTemplate = 'react-router-cloudflare';
      } else if (pkg?.dependencies?.['@remix-run/cloudflare'] || pkg?.devDependencies?.['@remix-run/cloudflare']) {
        detectedTemplate = 'remix-cloudflare';
      } else if (fs.existsSync(dockerfilePath)) {
        detectedTemplate = 'react-router-docker';
      } else if (pkg?.dependencies?.['vike'] || pkg?.dependencies?.['vite-plugin-ssr']) {
        detectedTemplate = 'ssg';
      }
    }
  }

  let targetHosting = requestedHosting;
  if (!targetHosting && requestedTemplate) {
    if (requestedTemplate.includes('vercel')) targetHosting = 'Vercel';
    else if (requestedTemplate.includes('netlify')) targetHosting = 'Netlify';
    else if (requestedTemplate.includes('docker')) targetHosting = 'Docker';
    else if (requestedTemplate.includes('ssg')) targetHosting = 'Static';
    else if (requestedTemplate.includes('cloudflare')) targetHosting = 'Cloudflare';
  }
  if (!targetHosting) {
    if (detectedTemplate.includes('vercel')) targetHosting = 'Vercel';
    else if (detectedTemplate.includes('netlify')) targetHosting = 'Netlify';
    else if (detectedTemplate.includes('docker')) targetHosting = 'Docker';
    else if (detectedTemplate.includes('ssg')) targetHosting = 'Static';
    else targetHosting = 'Cloudflare';
  }

  return {
    projectName: projectName || 'webstudio-app',
    configFile: configFile || 'none',
    detectedTemplate,
    targetHosting,
    hasWrangler: Boolean(fs.existsSync(wranglerJsoncPath) || fs.existsSync(wranglerTomlPath)),
    hasBuildDir: Boolean(fs.existsSync(path.join(rootDir, 'build')) || fs.existsSync(path.join(rootDir, 'dist'))),
    availableScripts,
    hostingAuth: getHostingAuth(rootDir, targetHosting)
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

export async function getProjectStatus(targetHosting = null, targetTemplate = null) {
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
    deploy: getDeployConfig(rootDir, targetHosting, targetTemplate),
    hostingAuth: getHostingAuth(rootDir, targetHosting),
    previewServer: {
      running: Boolean(activePreviewProcess),
      url: activePreviewUrl
    }
  };
}

export const getSystemStatus = getProjectStatus;

export let activePreviewProcess = null;
export let activePreviewUrl = null;

export function stopPreviewServer() {
  if (activePreviewProcess) {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${activePreviewProcess.pid} /T /F`);
      } else {
        activePreviewProcess.kill('SIGTERM');
      }
    } catch {}
    activePreviewProcess = null;
  }
  activePreviewUrl = null;
}

export function executeShellCommand(action, command, options = {}) {
  broadcastLog(`$ ${command}`, 'stdout');
  console.log(`\n\x1b[36m[Webstudio CLI]\x1b[0m \x1b[1m$ ${command}\x1b[0m`);

  const child = spawn(command, {
    cwd: rootDir,
    shell: true,
    env: process.env
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const text = chunk.toString();
    broadcastLog(text, 'stdout');

    if (action === 'check-auth' || action === 'login-auth') {
      const prov = options.provider || 'Cloudflare';
      if (prov === 'Cloudflare') {
        const emailMatch = text.match(/email\s+'([^']+)'/i) || text.match(/associated with the email\s+'([^']+)'/i) || text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) cachedHostingAccounts.Cloudflare = emailMatch[1];
        const accMatch = text.match(/Account Name:\s*([^\r\n]+)/i);
        if (accMatch) cachedHostingAccounts.Cloudflare = accMatch[1].trim();
      } else if (prov === 'Vercel') {
        const cleaned = text.replace(/Vercel CLI[^\r\n]*/ig, '').replace(/>[^\r\n]*/g, '').trim();
        const userMatch = text.match(/>\s*Logged in to vercel as\s+([^\s(]+)/i) || text.match(/User:\s*([^\s]+)/i) || text.match(/email:\s*([^\s]+)/i) || (cleaned && !cleaned.includes(' ') && !cleaned.includes('\n') && !cleaned.includes('Error') ? [null, cleaned] : null);
        if (userMatch) cachedHostingAccounts.Vercel = userMatch[1].trim();
      } else if (prov === 'Netlify') {
        const netMatch = text.match(/Email:\s*([^\r\n]+)/i) || text.match(/Name:\s*([^\r\n]+)/i);
        if (netMatch) cachedHostingAccounts.Netlify = netMatch[1].trim();
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    broadcastLog(chunk.toString(), 'stderr');
  });

  child.on('error', (err) => {
    console.error(`\x1b[31m[Webstudio CLI] Process error: ${err.message}\x1b[0m`);
    broadcastLog(`Process error: ${err.message}`, 'stderr');
    broadcastComplete(action, false, 1);
  });

  child.on('close', (code) => {
    const success = code === 0;
    if (success) {
      console.log(`\x1b[32m[Webstudio CLI] Action "${action}" completed successfully.\x1b[0m\n`);
      broadcastLog(`Action "${action}" completed successfully.`, 'stdout');
    } else {
      console.log(`\x1b[31m[Webstudio CLI] Action "${action}" exited with code ${code}.\x1b[0m\n`);
      broadcastLog(`Action "${action}" exited with code ${code}.`, 'stderr');
    }
    broadcastComplete(action, success, code ?? 0);
  });

  return child;
}

export function executePreviewCommand() {
  stopPreviewServer();

  broadcastLog('$ npm run preview', 'stdout');
  console.log(`\n\x1b[36m[Webstudio CLI]\x1b[0m \x1b[1m$ npm run preview\x1b[0m`);

  const child = spawn('npm run preview', {
    cwd: rootDir,
    shell: true,
    env: process.env
  });

  activePreviewProcess = child;
  let readyDetected = false;

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const text = chunk.toString();
    broadcastLog(text, 'stdout');

    if (!readyDetected) {
      const urlMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[0-9]+/i);
      if (urlMatch) {
        readyDetected = true;
        activePreviewUrl = urlMatch[0];
        console.log(`\x1b[32m[Webstudio CLI] 🚀 Preview server ready at ${activePreviewUrl}\x1b[0m`);
        broadcastLog(`🚀 Preview server ready at ${activePreviewUrl}`, 'stdout');
        openBrowser(activePreviewUrl);
        broadcastComplete('preview-project', true, 0);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    const text = chunk.toString();
    broadcastLog(text, 'stderr');

    if (!readyDetected) {
      const urlMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[0-9]+/i);
      if (urlMatch) {
        readyDetected = true;
        activePreviewUrl = urlMatch[0];
        console.log(`\x1b[32m[Webstudio CLI] 🚀 Preview server ready at ${activePreviewUrl}\x1b[0m`);
        broadcastLog(`🚀 Preview server ready at ${activePreviewUrl}`, 'stdout');
        openBrowser(activePreviewUrl);
        broadcastComplete('preview-project', true, 0);
      }
    }
  });

  child.on('error', (err) => {
    activePreviewProcess = null;
    activePreviewUrl = null;
    console.error(`\x1b[31m[Webstudio CLI] Preview process error: ${err.message}\x1b[0m`);
    broadcastLog(`Process error: ${err.message}`, 'stderr');
    broadcastComplete('preview-project', false, 1);
  });

  child.on('close', (code) => {
    activePreviewProcess = null;
    activePreviewUrl = null;
    if (code !== null && code !== 0) {
      console.log(`\x1b[33m[Webstudio CLI] Preview server exited with code ${code}\x1b[0m`);
      broadcastLog(`Preview server exited with code ${code}.`, 'stderr');
      broadcastComplete('preview-project', false, code);
    } else {
      console.log(`\x1b[32m[Webstudio CLI] Preview server stopped.\x1b[0m`);
      broadcastLog(`Preview server stopped.`, 'stdout');
      broadcastComplete('stop-preview', true, 0);
    }
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
      cleanFrameworkArtifacts(rootDir, preset);

      const templates = TEMPLATE_PRESETS[preset] || (Array.isArray(preset) ? preset : [preset]);
      let cmd = 'npx webstudio build';
      for (const t of templates) {
        cmd += ` --template ${t}`;
      }
      executeShellCommand('generate-template', cmd);
      break;
    }
    case 'clean-template': {
      stopPreviewServer();
      cleanAllTemplateGenerations(rootDir);
      console.log('\x1b[33m[Webstudio CLI] 🗑️ Cleaned all generated template files, configs, and dependencies.\x1b[0m\n');
      broadcastLog('🗑️ Cleaned all generated template files, configs, and dependencies.', 'stdout');
      broadcastComplete('clean-template', true, 0);
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
      const deployConfig = getDeployConfig(rootDir);
      let provider = params.provider;
      if (!provider && params.template) {
        if (params.template.includes('vercel')) provider = 'Vercel';
        else if (params.template.includes('netlify')) provider = 'Netlify';
        else if (params.template.includes('docker')) provider = 'Docker';
        else if (params.template.includes('cloudflare')) provider = 'Cloudflare';
      }
      if (!provider) {
        provider = deployConfig.hostingAuth?.provider || deployConfig.targetHosting || 'Cloudflare';
      }
      let cmd = 'npx wrangler whoami';
      if (provider === 'Vercel') cmd = 'npx vercel whoami';
      else if (provider === 'Netlify') cmd = 'npx netlify status';
      else if (provider === 'Docker') cmd = 'docker info';
      executeShellCommand('check-auth', cmd, { provider });
      break;
    }
    case 'login-auth': {
      const deployConfig = getDeployConfig(rootDir);
      let provider = params.provider;
      if (!provider && params.template) {
        if (params.template.includes('vercel')) provider = 'Vercel';
        else if (params.template.includes('netlify')) provider = 'Netlify';
        else if (params.template.includes('docker')) provider = 'Docker';
        else if (params.template.includes('cloudflare')) provider = 'Cloudflare';
      }
      if (!provider) {
        provider = deployConfig.hostingAuth?.provider || deployConfig.targetHosting || 'Cloudflare';
      }
      let cmd = 'npx wrangler login';
      if (provider === 'Vercel') cmd = 'npx vercel login';
      else if (provider === 'Netlify') cmd = 'npx netlify login';
      else if (provider === 'Docker') cmd = 'docker login';
      executeShellCommand('login-auth', cmd, { provider });
      break;
    }
    case 'build-project': {
      executeShellCommand('build-project', 'npm run build');
      break;
    }
    case 'preview-project': {
      executePreviewCommand();
      break;
    }
    case 'stop-preview': {
      stopPreviewServer();
      console.log(`\x1b[33m[Webstudio CLI] ⏹️ Preview server stopped by user.\x1b[0m\n`);
      broadcastLog('⏹️ Preview server stopped.', 'stdout');
      broadcastComplete('stop-preview', true, 0);
      break;
    }
    case 'deploy-project': {
      const deployConfig = getDeployConfig(rootDir);
      const projectName = deployConfig.projectName || 'webstudio-app';
      const provider = deployConfig.hostingAuth?.provider || 'Cloudflare';

      if (provider === 'Vercel' || fs.existsSync(path.join(rootDir, 'vercel.json'))) {
        executeShellCommand('deploy-project', 'npx vercel --prod --yes');
        break;
      }

      if (provider === 'Netlify' || fs.existsSync(path.join(rootDir, 'netlify.toml'))) {
        executeShellCommand('deploy-project', 'npx netlify deploy --prod');
        break;
      }

      if (deployConfig.hasWrangler && fs.existsSync(path.join(rootDir, 'wrangler.toml'))) {
        exec(`npx wrangler pages project create "${projectName}" --production-branch main`, { cwd: rootDir }, () => {
          executeShellCommand('deploy-project', `npx wrangler pages deploy ./build/client --project-name "${projectName}" --branch main --commit-dirty=true`);
        });
        break;
      }

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
          const provider = parsedUrl.searchParams.get('provider') || parsedUrl.searchParams.get('hosting');
          const template = parsedUrl.searchParams.get('template');
          const status = await getProjectStatus(provider, template);
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
