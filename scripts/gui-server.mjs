import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, exec, execSync } from 'node:child_process';
import { ProjectManager } from './project-manager.mjs';
import { BackupManager } from './backup-manager.mjs';
import { fetchDeployHistory } from './deploy-cloudflare.mjs';

// Prevent sharp from failing on systems with globally installed libvips
process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = process.env.SHARP_IGNORE_GLOBAL_LIBVIPS || '1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const guiDir = path.join(rootDir, 'gui');

export const projectManager = new ProjectManager(rootDir);
export function getActiveBackupManager() {
  return new BackupManager(projectManager.getActiveProjectDir());
}

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
export function cleanFrameworkArtifacts(dir = null, preset) {
  const targetDir = dir || (typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null);
  if (!targetDir) return;
  const pkgPath = path.join(targetDir, 'package.json');
  let pkg = null;
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {}
  }

  const presetStr = String(preset || '').toLowerCase();
  const isRemix = presetStr.includes('remix') || presetStr === 'cloudflare';
  const isReactRouter = presetStr.includes('react-router') || presetStr === 'cloudflare-new' || presetStr === 'docker';
  const isCloudflare = presetStr.includes('cloudflare');
  const isVercel = presetStr.includes('vercel');
  const isNetlify = presetStr.includes('netlify');
  const isDocker = presetStr.includes('docker');

  const removePaths = [];
  const depsToRemove = [];

  // Always clean conflicting hosting configs when switching platforms
  if (!isCloudflare) {
    removePaths.push(
      path.join(targetDir, 'wrangler.toml'),
      path.join(targetDir, 'wrangler.jsonc'),
      path.join(targetDir, 'functions'),
      path.join(targetDir, 'workers'),
      path.join(targetDir, 'worker-configuration.d.ts'),
      path.join(targetDir, 'load-context.ts'),
      path.join(targetDir, '.wrangler')
    );
  } else {
    if (isReactRouter) {
      removePaths.push(
        path.join(targetDir, 'wrangler.toml'),
        path.join(targetDir, 'functions')
      );
    } else {
      removePaths.push(
        path.join(targetDir, 'wrangler.jsonc'),
        path.join(targetDir, 'workers'),
        path.join(targetDir, 'worker-configuration.d.ts')
      );
    }
  }

  if (!isVercel) {
    removePaths.push(path.join(targetDir, 'vercel.json'));
  }
  if (!isNetlify) {
    removePaths.push(path.join(targetDir, 'netlify.toml'));
  }
  let isDockerTarget = isDocker;
  try {
    const deployConf = getDeployConfig(targetDir);
    if (deployConf?.targetHosting === 'Docker') isDockerTarget = true;
  } catch {}
  if (!isDockerTarget) {
    removePaths.push(path.join(targetDir, 'Dockerfile'));
  }

  // Framework transitions (Remix vs React Router)
  if (isRemix) {
    removePaths.push(
      path.join(targetDir, 'app', 'routes.ts'),
      path.join(targetDir, 'react-router.config.ts')
    );
  } else if (isReactRouter) {
    removePaths.push(
      path.join(targetDir, 'app', 'entry.server.tsx')
    );
  }

  for (const p of removePaths) {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {}
    }
  }
}
export function cleanAllTemplateGenerations(dir = null) {
  const targetDir = dir || (typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null);
  if (!targetDir) return;
  const pathsToRemove = [
    path.join(targetDir, 'app'),
    path.join(targetDir, 'functions'),
    path.join(targetDir, 'workers'),
    path.join(targetDir, 'public'),
    path.join(targetDir, 'build'),
    path.join(targetDir, 'dist'),
    path.join(targetDir, '.wrangler'),
    path.join(targetDir, 'wrangler.jsonc'),
    path.join(targetDir, 'wrangler.toml'),
    path.join(targetDir, 'vercel.json'),
    path.join(targetDir, 'netlify.toml'),
    path.join(targetDir, 'Dockerfile'),
    path.join(targetDir, 'vite.config.ts'),
    path.join(targetDir, 'react-router.config.ts'),
    path.join(targetDir, 'worker-configuration.d.ts'),
    path.join(targetDir, 'load-context.ts'),
    path.join(targetDir, 'tsconfig.json'),
    path.join(targetDir, 'WS_CF_README.md')
  ];

  if (targetDir !== rootDir) {
    pathsToRemove.push(path.join(targetDir, '.npmrc'));
    pathsToRemove.push(path.join(targetDir, 'node_modules'));
    pathsToRemove.push(path.join(targetDir, 'package-lock.json'));
  }

  for (const p of pathsToRemove) {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {}
    }
  }

}


export function getGitHubUser() {
  if (cachedHostingAccounts.Docker) {
    const m = cachedHostingAccounts.Docker.match(/^([^\s(]+)/);
    if (m) return m[1];
  }
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
    try {
      const out = execSync('gh api user -q .login', { encoding: 'utf8', timeout: 3000 }).trim();
      if (out) return out;
    } catch {}
  }
  const home = os.homedir();
  const ghPaths = [
    path.join(home, '.config', 'gh', 'hosts.yml'),
    path.join(process.env.XDG_CONFIG_HOME || '', 'gh', 'hosts.yml'),
    path.join(process.env.APPDATA || '', 'GitHub CLI', 'hosts.yml'),
    path.join(process.env.LOCALAPPDATA || '', 'GitHub CLI', 'hosts.yml')
  ].filter(Boolean);

  for (const p of ghPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const userMatch = content.match(/user:\s*([^\r\n]+)/i);
        if (userMatch) return userMatch[1].trim();
      } catch {}
    }
  }

  try {
    const out = execSync('gh api user -q .login', { encoding: 'utf8', timeout: 3000 }).trim();
    if (out) return out;
  } catch {}
  return null;
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
    let accountName = cachedHostingAccounts.Docker;
    if (!accountName) {
      const ghUser = getGitHubUser();
      if (ghUser) {
        accountName = `${ghUser} (GitHub)`;
        cachedHostingAccounts.Docker = accountName;
      }
    }
    const isAuthed = Boolean(accountName);
    return {
      authenticated: isAuthed,
      account: accountName || null,
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

export function getDeployConfig(dir = null, requestedHosting = null, requestedTemplate = null) {
  const activeProj = typeof projectManager !== 'undefined' ? projectManager.getActiveProject() : null;
  const targetDir = dir || (activeProj && typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null);
  
  if (!targetDir) {
    return {
      projectName: '',
      configFile: 'none',
      detectedTemplate: 'none',
      targetHosting: requestedHosting || 'Cloudflare',
      hasWrangler: false,
      hasBuildDir: false,
      availableScripts: [],
      hostingAuth: { ok: false, message: 'No active project' }
    };
  }

  let projectName = '';
  let configFile = '';
  let detectedTemplate = 'unknown';
  const wranglerJsoncPath = path.join(targetDir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(targetDir, 'wrangler.toml');
  const vercelJsonPath = path.join(targetDir, 'vercel.json');
  const netlifyTomlPath = path.join(targetDir, 'netlify.toml');
  const dockerfilePath = path.join(targetDir, 'Dockerfile');
  const packageJsonPath = path.join(targetDir, 'package.json');
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

  // Prioritize active project name from Project Hub registry if available
  if (typeof projectManager !== 'undefined') {
    try {
      const active = projectManager.getActiveProject();
      if (active && (path.resolve(targetDir) === path.resolve(projectManager.getActiveProjectDir() || '') || active.id === path.basename(targetDir))) {
        if (active.name) projectName = active.name;
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
    hasBuildDir: Boolean(fs.existsSync(path.join(targetDir, 'build')) || fs.existsSync(path.join(targetDir, 'dist'))),
    availableScripts,
    hostingAuth: getHostingAuth(targetDir, targetHosting)
  };
}

export function updateProjectNameOnDisk(dir, newName) {
  if (!dir || !newName || typeof newName !== 'string') return { updated: false, safeName: '' };
  const safeName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (!safeName) return { updated: false, safeName: '' };

  const wranglerJsoncPath = path.join(dir, 'wrangler.jsonc');
  const wranglerTomlPath = path.join(dir, 'wrangler.toml');
  const packageJsonPath = path.join(dir, 'package.json');

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

  // Never mutate the root repository package.json!
  if (path.resolve(dir) !== path.resolve(rootDir) && fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      pkg.name = safeName;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      updated = true;
    } catch {}
  }

  return { updated, safeName };
}

/**
 * Fetches recent git deployment/commit history for a project (used for Docker / Coolify / GitHub).
 * 
 * @param {string} projectDir - Absolute path to project directory
 * @param {number} [limit=10] - Number of commits to return
 * @returns {Promise<{ success: boolean, provider: string, projectName?: string, repoUrl?: string, total: number, deployments: Array<object>, error?: string }>}
 */
export async function fetchDeployGitHistory(projectDir, limit = 10) {
  try {
    if (!projectDir || !fs.existsSync(path.join(projectDir, '.git'))) {
      return { success: true, provider: 'Docker', total: 0, deployments: [] };
    }

    let originUrl = '';
    try {
      originUrl = execSync('git remote get-url origin', {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {}

    let webRepoUrl = '';
    if (originUrl) {
      webRepoUrl = originUrl
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/^ssh:\/\/git@([^/]+)\//, 'https://$1/')
        .replace(/\.git$/, '');
    }

    let currentBranch = 'main';
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {}

    let rawLog = '';
    try {
      rawLog = execSync(
        `git log -n ${limit} --pretty=format:"%H%x00%h%x00%s%x00%cI%x00%an%x00%D"`,
        {
          cwd: projectDir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }
      ).trim();
    } catch {}

    if (!rawLog) {
      return { success: true, provider: 'Docker', total: 0, deployments: [] };
    }

    const lines = rawLog.split('\n').filter(Boolean);
    const deployments = lines.map(line => {
      const [fullHash, shortHash, commitMessage, createdOn, author, refNames] = line.split('\0');
      const isProd = currentBranch === 'main' || currentBranch === 'master' || currentBranch === 'production';
      const commitUrl = webRepoUrl ? `${webRepoUrl}/commit/${fullHash}` : '';

      return {
        id: fullHash || shortHash,
        shortId: shortHash,
        environment: isProd ? 'production' : 'preview',
        branch: currentBranch || 'main',
        commitMessage: commitMessage || '',
        commitHash: shortHash || '',
        url: commitUrl || webRepoUrl || '',
        repoUrl: webRepoUrl,
        createdOn: createdOn || new Date().toISOString(),
        status: 'success',
        isProduction: isProd,
        provider: 'Docker',
        author: author || ''
      };
    });

    return {
      success: true,
      provider: 'Docker',
      projectName: path.basename(projectDir),
      repoUrl: webRepoUrl,
      total: deployments.length,
      deployments
    };
  } catch (err) {
    return { success: false, provider: 'Docker', deployments: [], error: err.message };
  }
}

export function getGlobalWebstudioToken(projectId) {
  if (!projectId) return null;
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'webstudio-nodejs', 'Config', 'webstudio-config.json'),
    path.join(process.env.LOCALAPPDATA || '', 'webstudio-nodejs', 'Config', 'webstudio-config.json'),
    path.join(os.homedir(), '.config', 'webstudio-nodejs', 'webstudio-config.json'),
    path.join(os.homedir(), '.config', 'webstudio', 'webstudio-config.json'),
    path.join(os.homedir(), '.webstudio', 'webstudio-config.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const conf = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (conf[projectId]?.token) return conf[projectId].token;
      } catch {}
    }
  }
  return null;
}

export function ensureSafariPatchScript(projectDir) {
  try {
    const patchScriptPath = path.join(projectDir, 'patch-safari.mjs');
    const patchContent = `import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, 'build', 'client', 'assets');

if (!fs.existsSync(buildDir)) {
  process.exit(0);
}

let patchedCount = 0;
const files = fs.readdirSync(buildDir);

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const fullPath = path.join(buildDir, file);
  let code = fs.readFileSync(fullPath, 'utf8');

  const targetPattern = '[new RegExp("(?<=^|\\\\s|\\\\p{P}|\\\\p{S})([-.\\\\w+]+)@([-\\\\w]+(?:\\\\.[-\\\\w]+)+)","gu"),hu]';
  const targetPatternAlt = '[new RegExp("(?<=^|\\\\s|\\\\p{P}|\\\\p{S})([-.\\\\w+]+)@([-\\\\w]+(?:\\\\.[-\\\\w]+)+)", "gu"), hu]';
  const safeReplacement = '[/([-.\\\\w+]+)@([-\\w]+(?:\\\\.[-\\w]+)+)/g,hu]';

  if (code.includes(targetPattern)) {
    code = code.replaceAll(targetPattern, safeReplacement);
    fs.writeFileSync(fullPath, code, 'utf8');
    patchedCount++;
    console.log(\`✅ [patch-safari] Patched iOS Safari RegExp in: \${file}\`);
  } else if (code.includes(targetPatternAlt)) {
    code = code.replaceAll(targetPatternAlt, safeReplacement);
    fs.writeFileSync(fullPath, code, 'utf8');
    patchedCount++;
    console.log(\`✅ [patch-safari] Patched iOS Safari RegExp in: \${file}\`);
  }
}

if (patchedCount > 0) {
  console.log(\`🎉 [patch-safari] Successfully patched \${patchedCount} file(s) for iOS Safari compatibility.\`);
}
`;
    fs.writeFileSync(patchScriptPath, patchContent, 'utf8');
  } catch {}
}

export function patchSafariAssets(projectDir) {
  try {
    const buildDir = path.join(projectDir, 'build', 'client', 'assets');
    if (!fs.existsSync(buildDir)) return;

    let patchedCount = 0;
    const files = fs.readdirSync(buildDir);

    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      const fullPath = path.join(buildDir, file);
      let code = fs.readFileSync(fullPath, 'utf8');

      const targetPattern = '[new RegExp("(?<=^|\\\\s|\\\\p{P}|\\\\p{S})([-.\\\\w+]+)@([-\\\\w]+(?:\\\\.[-\\\\w]+)+)","gu"),hu]';
      const targetPatternAlt = '[new RegExp("(?<=^|\\\\s|\\\\p{P}|\\\\p{S})([-.\\\\w+]+)@([-\\\\w]+(?:\\\\.[-\\\\w]+)+)", "gu"), hu]';
      const safeReplacement = '[/([-.\\\\w+]+)@([-\\w]+(?:\\\\.[-\\w]+)+)/g,hu]';

      if (code.includes(targetPattern)) {
        code = code.replaceAll(targetPattern, safeReplacement);
        fs.writeFileSync(fullPath, code, 'utf8');
        patchedCount++;
      } else if (code.includes(targetPatternAlt)) {
        code = code.replaceAll(targetPatternAlt, safeReplacement);
        fs.writeFileSync(fullPath, code, 'utf8');
        patchedCount++;
      }
    }

    if (patchedCount > 0) {
      console.log(`[Webstudio CLI] 🎉 Patched ${patchedCount} built asset(s) for iOS Safari compatibility.`);
    }
  } catch {}
}

export function ensureLockfileSynced(projectDir) {
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    const lockPath = path.join(projectDir, 'package-lock.json');
    if (!fs.existsSync(pkgPath)) return;

    let inSync = false;
    if (fs.existsSync(lockPath)) {
      try {
        execSync('npm ci --dry-run', { cwd: projectDir, stdio: 'pipe', timeout: 10000 });
        inSync = true;
      } catch {
        inSync = false;
      }
    }

    if (!inSync) {
      console.log(`[Webstudio CLI] 🔄 Synchronizing package-lock.json with package.json for clean CI/Coolify deployment...`);
      try {
        execSync('npm install --package-lock-only', { cwd: projectDir, stdio: 'ignore', timeout: 20000 });
      } catch {
        try {
          execSync('npm install --package-lock-only --legacy-peer-deps', { cwd: projectDir, stdio: 'ignore', timeout: 20000 });
        } catch {}
      }
    }
  } catch {}
}

export function ensureProjectIntegrity(projectDir, options = {}) {
  try {
    if (!projectDir || !fs.existsSync(projectDir)) return;

    const isDocker = Boolean(
      options.isDocker ||
      (options.template && options.template.includes('docker')) ||
      (options.provider === 'Docker') ||
      fs.existsSync(path.join(projectDir, 'Dockerfile'))
    );

    if (isDocker) {
      // If Dockerfile is missing for Docker hosting, copy official Webstudio template
      const dockerfilePath = path.join(projectDir, 'Dockerfile');
      if (!fs.existsSync(dockerfilePath)) {
        const tplDocker = path.join(rootDir, 'node_modules', 'webstudio', 'templates', 'react-router-docker', 'Dockerfile');
        if (fs.existsSync(tplDocker)) {
          fs.copyFileSync(tplDocker, dockerfilePath);
        }
      }

      // Ensure .npmrc has legacy-peer-deps=true for clean Docker / CI builds
      const npmrcPath = path.join(projectDir, '.npmrc');
      const standardNpmrc = "legacy-peer-deps=true\nengine-strict=true\naudit=false\nfund=false\n";
      if (!fs.existsSync(npmrcPath)) {
        fs.writeFileSync(npmrcPath, standardNpmrc, 'utf8');
      } else {
        let npmrcContent = fs.readFileSync(npmrcPath, 'utf8');
        if (!npmrcContent.includes('legacy-peer-deps=true')) {
          npmrcContent = "legacy-peer-deps=true\n" + npmrcContent;
          fs.writeFileSync(npmrcPath, npmrcContent, 'utf8');
        }
      }
    }

    // Ensure standard .gitignore exists
    const gitignorePath = path.join(projectDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const defaultGitignore = "node_modules/\nbuild/\ndist/\n.wrangler/\n.react-router/\n.webstudio-backups/\n.env\n.env.*\n!.env.example\n.DS_Store\n*.log\n";
      fs.writeFileSync(gitignorePath, defaultGitignore, 'utf8');
    }

    // Ensure package-lock.json is valid and strictly in sync if present
    ensureLockfileSynced(projectDir);
  } catch (err) {
    console.error(`[ensureProjectIntegrity] Error: ${err.message}`);
  }
}

export function saveProjectShareLink(projectDir, shareLink) {
  if (!shareLink || typeof shareLink !== 'string' || !shareLink.startsWith('http')) return false;
  const cleanLink = shareLink.trim();

  const wsDir = path.join(projectDir, '.webstudio');
  if (!fs.existsSync(wsDir)) {
    fs.mkdirSync(wsDir, { recursive: true });
  }

  const configPath = path.join(wsDir, 'config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }
  config.shareLink = cleanLink;

  try {
    const url = new URL(cleanLink);
    const pMatch = url.hostname.match(/^p-([a-zA-Z0-9-]+)\./);
    if (pMatch && !config.projectId) {
      config.projectId = pMatch[1];
    }
  } catch {}

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

  try {
    if (typeof projectManager !== 'undefined') {
      const reg = projectManager.loadRegistry();
      const proj = reg.projects.find(p => p.id === path.basename(projectDir) || (config.projectId && p.id === config.projectId));
      if (proj) {
        proj.shareLink = cleanLink;
        projectManager.saveRegistry(reg);
      }
      if (projectDir !== rootDir) {
        projectManager.syncActiveToRoot(projectDir);
      }
    }
  } catch {}

  return true;
}

export async function getProjectStatus(targetHosting = null, targetTemplate = null) {
  const projectDir = typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null;
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
  const configPath = projectDir ? path.join(projectDir, '.webstudio', 'config.json') : '';
  if (configPath && fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }

  let auth = null;
  const authPath = projectDir ? path.join(projectDir, '.webstudio', 'auth.json') : '';
  if (authPath && fs.existsSync(authPath)) {
    try {
      auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    } catch {}
  }

  let session = null;
  const sessionPath = projectDir ? path.join(projectDir, '.webstudio', 'session.json') : '';
  if (sessionPath && fs.existsSync(sessionPath)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {}
  }

  let data = null;
  const dataPath = projectDir ? path.join(projectDir, '.webstudio', 'data.json') : '';
  if (dataPath && fs.existsSync(dataPath)) {
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

  // Extract authToken from config.shareLink if present
  if (!authToken && config?.shareLink) {
    try {
      const u = new URL(config.shareLink);
      const tok = u.searchParams.get('authToken');
      if (tok) authToken = tok;
    } catch {}
  }

  // Check global Webstudio credentials config
  if (!authToken && projectId) {
    const globTok = getGlobalWebstudioToken(projectId);
    if (globTok) authToken = globTok;
  }

  const hasAuthToken = Boolean(authToken || data?.authToken);
  const hasSession = Boolean(session?.cookie && session?.csrfToken);

  // Always preserve full original shareLink exactly as entered
  let savedShareLink = config?.shareLink || '';
  if (!savedShareLink && typeof projectManager !== 'undefined') {
    try {
      const reg = projectManager.loadRegistry();
      const currentProj = reg.projects.find(p => p.id === path.basename(projectDir) || (projectId && p.id === projectId));
      if (currentProj?.shareLink) savedShareLink = currentProj.shareLink;
    } catch {}
  }

  // If no savedShareLink, synthesize one with authToken if available
  if (!savedShareLink) {
    if (projectId && authToken) {
      savedShareLink = `https://p-${projectId}.apps.webstudio.is/?authToken=${authToken}&mode=design`;
    } else if (projectId) {
      savedShareLink = `https://p-${projectId}.apps.webstudio.is`;
    }
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
  } else if (projectDir) {
    const assetsDir = path.join(projectDir, '.webstudio', 'assets');
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
    deploy: getDeployConfig(projectDir, targetHosting, targetTemplate),
    hostingAuth: projectDir ? getHostingAuth(projectDir, targetHosting) : { ok: false, message: 'No active project' },
    previewServer: {
      running: Boolean(activePreviewProcess),
      url: activePreviewUrl
    },
    activeProject: projectManager.getActiveProject(),
    projectsCount: projectManager.listProjects().projects.length,
    backupsCount: getActiveBackupManager().listBackups().totalCount
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
  const targetCwd = options.cwd || (typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null) || rootDir;
  const relPath = path.relative(rootDir, targetCwd).replace(/\\/g, '/') || '.';
  const cwdDisplay = relPath === '.' ? './ (root)' : `./${relPath}`;

  broadcastLog(`📂 [${cwdDisplay}] $ ${command}`, 'stdout');
  console.log(`\n\x1b[36m[Webstudio CLI]\x1b[0m 📂 \x1b[33m${cwdDisplay}\x1b[0m \x1b[1m$ ${command}\x1b[0m`);
  const child = spawn(command, {
    cwd: targetCwd,
    shell: true,
    env: { ...process.env, ...(options.env || {}) }
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
      } else if (prov === 'Docker') {
        const ghMatch = text.match(/Logged in to github\.com account\s+([^\s(]+)/i) || text.match(/account\s+([^\s(]+)/i) || text.match(/user:\s*([^\s]+)/i);
        if (ghMatch) cachedHostingAccounts.Docker = `${ghMatch[1].trim()} (GitHub)`;
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
      if (action === 'import' || action === 'sync' || action === 'sync-draft') {
        try {
          if (typeof projectManager !== 'undefined') {
            projectManager.syncActiveToRoot(targetCwd);
          }
          const autoSnap = getActiveBackupManager().triggerImportBackup();
          if (autoSnap) {
            broadcastLog(`📦 Auto-backup snapshot created: ${autoSnap.displayName}`, 'stdout');
          }
        } catch {}
      }
      if ((action === 'check-auth' || action === 'login-auth') && options.provider === 'Docker') {
        if (!cachedHostingAccounts.Docker) {
          const ghUser = getGitHubUser();
          if (ghUser) cachedHostingAccounts.Docker = `${ghUser} (GitHub)`;
        }
      }
      if (action === 'generate-template') {
        try {
          const activeProj = typeof projectManager !== 'undefined' ? projectManager.getActiveProject() : null;
          const targetName = activeProj?.name || path.basename(targetCwd);
          if (targetName) {
            updateProjectNameOnDisk(targetCwd, targetName);
            broadcastLog(`✓ Synced project name "${targetName}" into template config files.`, 'stdout');
          }
          ensureProjectIntegrity(targetCwd, { template: options.template });
        } catch {}
      }
      if (action === 'build-project') {
        try {
          patchSafariAssets(targetCwd);
        } catch {}
      }
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

  const targetCwd = typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : rootDir;
  const relPath = path.relative(rootDir, targetCwd).replace(/\\/g, '/') || '.';
  const cwdDisplay = relPath === '.' ? './ (root)' : `./${relPath}`;

  const isDocker = fs.existsSync(path.join(targetCwd, 'Dockerfile'));
  let previewCmd = 'npm run preview';
  const pkgPath = path.join(targetCwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (isDocker) {
        const hasBuild = fs.existsSync(path.join(targetCwd, 'build', 'server', 'index.js'));
        const startCmd = pkg.scripts?.start ? 'npm run start' : 'npx react-router-serve ./build/server/index.js';
        previewCmd = hasBuild ? startCmd : `npm run build && ${startCmd}`;
      } else if (!pkg.scripts?.preview && pkg.scripts?.start) {
        previewCmd = 'npm run start';
      } else if (!pkg.scripts?.preview && pkg.scripts?.dev) {
        previewCmd = 'npm run dev';
      }
    } catch {}
  }

  broadcastLog(`📂 [${cwdDisplay}] $ ${previewCmd}`, 'stdout');
  console.log(`\n\x1b[36m[Webstudio CLI]\x1b[0m 📂 \x1b[33m${cwdDisplay}\x1b[0m \x1b[1m$ ${previewCmd}\x1b[0m`);
  const child = spawn(previewCmd, {
    cwd: targetCwd,
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
  const isEn = params.lang === 'en';
  const hasActiveProj = Boolean(typeof projectManager !== 'undefined' && projectManager.getActiveProject());
  const targetProjectDir = hasActiveProj ? projectManager.getActiveProjectDir() : null;

  const projectSpecificActions = [
    'link', 'sync', 'sync-draft', 'import', 'upload-assets',
    'generate-template', 'clean-template', 'build', 'build-project',
    'preview', 'preview-project', 'publish', 'deploy', 'deploy-project',
    'save-session', 'update-project-name'
  ];

  if (projectSpecificActions.includes(action) && !targetProjectDir) {
    const msg = isEn
      ? '⚠️ No active project selected. Please create or select a project in the Projects tab first.'
      : '⚠️ Немає активного проєкту. Будь ласка, створіть або оберіть проєкт у вкладці "Проєкти".';
    console.log(`\x1b[33m[Webstudio CLI] ${msg}\x1b[0m\n`);
    broadcastLog(msg, 'stderr');
    broadcastComplete(action, false, 1);
    return;
  }
  switch (action) {
    case 'install-root':
    case 'install': {
      const cliPath = path.join(rootDir, 'node_modules', 'webstudio', 'lib', 'cli.js');
      const isRootInstalled = fs.existsSync(cliPath);
      const isRootInstall = action === 'install-root' || params.scope === 'root' || !isRootInstalled;

      if (isRootInstall) {
        broadcastLog(
          isEn
            ? '📦 Installing latest Webstudio CLI (@latest) and system dependencies...'
            : '📦 Встановлення актуальної версії Webstudio CLI (@latest) та системних залежностей...',
          'stdout'
        );
        executeShellCommand(action, 'npm run update-webstudio', { cwd: rootDir });
        break;
      }

      const targetPkg = path.join(targetProjectDir, 'package.json');
      if (targetProjectDir !== rootDir && !fs.existsSync(targetPkg)) {
        const relPath = path.relative(rootDir, targetProjectDir).replace(/\\/g, '/') || '.';
        const msg = isEn
          ? `⚠️ [./${relPath}] No package.json found in project folder. Please generate the template code first ("Generate Template" button).`
          : `⚠️ [./${relPath}] У папці проєкту ще немає package.json. Спершу згенеруйте код обраного шаблону (кнопка "Згенерувати шаблон").`;
        console.log(`\x1b[33m[Webstudio CLI] ${msg}\x1b[0m\n`);
        broadcastLog(msg, 'stderr');
        broadcastComplete(action, false, 1);
        break;
      }
      const relPath = path.relative(rootDir, targetProjectDir).replace(/\\/g, '/') || '.';
      const targetLabel = relPath === '.' ? './ (root)' : `./${relPath}`;
      broadcastLog(
        isEn
          ? `📦 Installing template dependencies in ${targetLabel}...`
          : `📦 Встановлення залежностей шаблону в ${targetLabel}...`,
        'stdout'
      );
      executeShellCommand(action, 'npm install', { cwd: targetProjectDir });
      break;
    }
    case 'update': {
      broadcastLog(
        isEn
          ? '⬆️ Updating global Webstudio Engine core...'
          : '⬆️ Оновлення глобального ядра Webstudio Engine...',
        'stdout'
      );
      const hasActiveProj = targetProjectDir !== rootDir && fs.existsSync(path.join(targetProjectDir, 'package.json'));
      let updateCmd = 'npm run update-webstudio';
      if (hasActiveProj) {
        const relProj = path.relative(rootDir, targetProjectDir).replace(/\\/g, '/') || '.';
        broadcastLog(
          isEn
            ? `📦 Also updating Webstudio SDK packages in ./${relProj}...`
            : `📦 Також оновлюються Webstudio SDK пакети у проєкті ./${relProj}...`,
          'stdout'
        );
        updateCmd += ` && (npm --prefix "${targetProjectDir}" update @webstudio-is/image @webstudio-is/react-sdk @webstudio-is/sdk @webstudio-is/sdk-components-animation @webstudio-is/sdk-components-react @webstudio-is/sdk-components-react-radix @webstudio-is/sdk-components-react-router @webstudio-is/wsauth || true)`;
      }
      executeShellCommand('update', updateCmd, { cwd: rootDir });
      break;
    }
    case 'link': {
      const shareLink = (params.shareLink || '').replace(/"/g, '\\"');
      if (params.shareLink && params.shareLink.startsWith('http')) {
        saveProjectShareLink(targetProjectDir, params.shareLink);
      }
      executeShellCommand('link', `npx webstudio link --link "${shareLink}"`, { cwd: targetProjectDir });
      break;
    }
    case 'sync': {
      let cmd = 'npx webstudio sync';
      const confPath = path.join(targetProjectDir, '.webstudio', 'config.json');
      let tok = '';
      if (fs.existsSync(confPath)) {
        try {
          const c = JSON.parse(fs.readFileSync(confPath, 'utf8'));
          if (c.shareLink) {
            const u = new URL(c.shareLink);
            tok = u.searchParams.get('authToken') || '';
          }
        } catch {}
      }
      if (!tok) {
        const pid = path.basename(targetProjectDir);
        tok = getGlobalWebstudioToken(pid) || '';
      }
      if (tok && !cmd.includes('--authToken')) {
        cmd += ` --authToken "${tok}"`;
      }
      executeShellCommand('sync', cmd, { cwd: targetProjectDir });
      break;
    }
    case 'sync-draft': {
      let shareLink = params.shareLink || '';
      if (shareLink && shareLink.startsWith('http')) {
        saveProjectShareLink(targetProjectDir, shareLink);
      }
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
        const authPath = path.join(targetProjectDir, '.webstudio', 'auth.json');
        if (fs.existsSync(authPath)) {
          try {
            const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
            authToken = authData.authToken || authData.token || '';
          } catch {}
        }
      }

      if (!origin) {
        const configPath = path.join(targetProjectDir, '.webstudio', 'config.json');
        const dataPath = path.join(targetProjectDir, '.webstudio', 'data.json');
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

      executeShellCommand('sync-draft', cmd, { cwd: targetProjectDir });
      break;
    }
    case 'save-session': {
      try {
        const projectDir = typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : rootDir;
        const webstudioDir = path.join(projectDir, '.webstudio');
        if (!fs.existsSync(webstudioDir)) {
          fs.mkdirSync(webstudioDir, { recursive: true });
        }
        const sessionPath = path.join(webstudioDir, 'session.json');
        const sessionData = {
          cookie: params.cookie || '',
          csrfToken: params.csrfToken || ''
        };
        fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
        if (typeof projectManager !== 'undefined' && projectDir !== rootDir) {
          projectManager.syncActiveToRoot(projectDir);
        }
        broadcastLog('✅ session.json saved successfully.', 'stdout');
        broadcastComplete('save-session', true, 0);
      } catch (err) {
        broadcastLog(`❌ Failed to save session: ${err.message}`, 'stderr');
        broadcastComplete('save-session', false, 1);
      }
      break;
    }
    case 'upload-assets': {
      executeShellCommand('upload-assets', 'node scripts/upload-assets.mjs', { cwd: targetProjectDir });
      break;
    }
    case 'import': {
      if (params.shareLink && params.shareLink.startsWith('http')) {
        saveProjectShareLink(targetProjectDir, params.shareLink);
      }
      let shareLink = (params.shareLink || '').replace(/"/g, '\\"');
      if (!shareLink) {
        const confPath = path.join(targetProjectDir, '.webstudio', 'config.json');
        if (fs.existsSync(confPath)) {
          try {
            const c = JSON.parse(fs.readFileSync(confPath, 'utf8'));
            if (c.shareLink) shareLink = c.shareLink.replace(/"/g, '\\"');
          } catch {}
        }
      }
      executeShellCommand('import', `npx webstudio import --to "${shareLink}"`, { cwd: targetProjectDir });
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
      cleanFrameworkArtifacts(targetProjectDir, preset);

      const templates = TEMPLATE_PRESETS[preset] || (Array.isArray(preset) ? preset : [preset]);
      let cmd = 'npx webstudio build';
      for (const t of templates) {
        cmd += ` --template ${t}`;
      }
      executeShellCommand('generate-template', cmd, { cwd: targetProjectDir });
      break;
    }
    case 'clean-template': {
      stopPreviewServer();
      cleanAllTemplateGenerations(targetProjectDir);
      console.log(`\x1b[33m[Webstudio CLI] 🗑️ Cleaned all generated template files for ${targetProjectDir}.\x1b[0m\n`);
      broadcastLog('🗑️ Cleaned all generated template files, configs, and dependencies.', 'stdout');
      broadcastComplete('clean-template', true, 0);
      break;
    }
    case 'update-project-name': {
      const newName = params.projectName || params.name || '';
      const result = updateProjectNameOnDisk(targetProjectDir, newName);
      if (result.updated || result.safeName) {
        if (typeof projectManager !== 'undefined') {
          try {
            projectManager.renameProject(projectManager.getActiveProject()?.id, result.safeName);
          } catch {}
        }
        broadcastLog(`✅ Project name updated to: ${result.safeName}`, 'stdout');
        broadcastComplete('update-project-name', true, 0);
      } else {
        broadcastLog('❌ Failed to update project name: invalid name provided', 'stderr');
        broadcastComplete('update-project-name', false, 1);
      }
      break;
    }
    case 'check-auth': {
      const deployConfig = getDeployConfig(targetProjectDir);
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
      else if (provider === 'Docker') {
        cmd = 'gh auth status';
      }
      executeShellCommand('check-auth', cmd, { provider, cwd: targetProjectDir });
      break;
    }
    case 'login-auth': {
      const deployConfig = getDeployConfig(targetProjectDir);
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
      else if (provider === 'Docker') {
        cmd = 'gh auth login --web -h github.com --git-protocol https';
      }
      executeShellCommand('login-auth', cmd, { provider, cwd: targetProjectDir });
      break;
    }
    case 'build-project': {
      const relPath = path.relative(rootDir, targetProjectDir).replace(/\\/g, '/') || '.';
      const targetLabel = relPath === '.' ? './ (root)' : `./${relPath}`;
      broadcastLog(
        isEn
          ? `🔨 Building project in ${targetLabel}...`
          : `🔨 Збірка проєкту в ${targetLabel}...`,
        'stdout'
      );
      ensureProjectIntegrity(targetProjectDir);
      executeShellCommand('build-project', 'npm run build', { cwd: targetProjectDir });
      break;
    }
    case 'preview-project': {
      executePreviewCommand();
      break;
    }
    case 'stop-preview': {
      stopPreviewServer();
      console.log(`\x1b[33m[Webstudio CLI] 🛑 Preview server stopped by user.\x1b[0m\n`);
      broadcastLog(isEn ? '🛑 Preview server stopped.' : '🛑 Preview server stopped.', 'stdout');
      broadcastComplete('stop-preview', true, 0);
      break;
    }
    case 'deploy-project': {
      const relPath = path.relative(rootDir, targetProjectDir).replace(/\\/g, '/') || '.';
      const targetLabel = relPath === '.' ? './ (root)' : `./${relPath}`;
      broadcastLog(
        isEn
          ? `🚀 Deploying project from ${targetLabel}...`
          : `🚀 Публікація (деплой) проєкту з ${targetLabel}...`,
        'stdout'
      );
      const deployConfig = getDeployConfig(targetProjectDir);
      let provider = params.provider;
      if (!provider && params.template) {
        if (params.template.includes('vercel')) provider = 'Vercel';
        else if (params.template.includes('netlify')) provider = 'Netlify';
        else if (params.template.includes('docker')) provider = 'Docker';
        else if (params.template.includes('ssg')) provider = 'Static';
        else if (params.template.includes('cloudflare')) provider = 'Cloudflare';
      }
      if (!provider) {
        provider = deployConfig.targetHosting || deployConfig.hostingAuth?.provider || 'Cloudflare';
      }
      ensureProjectIntegrity(targetProjectDir, { provider, isDocker: provider === 'Docker' });
      if (provider === 'Vercel' || fs.existsSync(path.join(targetProjectDir, 'vercel.json'))) {
        executeShellCommand('deploy-project', 'npm run build && npx vercel --prod --yes', { cwd: targetProjectDir });
        break;
      }

      if (provider === 'Netlify' || fs.existsSync(path.join(targetProjectDir, 'netlify.toml'))) {
        executeShellCommand('deploy-project', 'npm run build && npx netlify deploy --prod', { cwd: targetProjectDir });
        break;
      }

      if (provider === 'Docker' || fs.existsSync(path.join(targetProjectDir, 'Dockerfile'))) {
        const deployConfig = getDeployConfig(targetProjectDir);
        const projName = deployConfig.projectName || path.basename(targetProjectDir);

        // 1. Verify GitHub authentication
        const ghUser = getGitHubUser();
        if (!ghUser) {
          broadcastLog(
            isEn
              ? '❌ Deployment error: You are not authenticated with GitHub CLI (gh)!'
              : '❌ Помилка деплою: Ви не авторизовані у GitHub CLI (gh)!',
            'stderr'
          );
          broadcastLog(
            isEn
              ? '💡 Please click "🔑 Login to Account" in step 3 to connect your GitHub account.'
              : '💡 Будь ласка, натисніть "🔑 Увійти в акаунт (Login)" у кроці 3, щоб підключити акаунт GitHub.',
            'stdout'
          );
          broadcastComplete('deploy-project', false, 1);
          break;
        }

        // 2. Determine target GitHub repository name
        const repoTarget = projName.includes('/') ? projName : `${ghUser}/${projName}`;
        broadcastLog(
          isEn
            ? `🔍 Checking repository "${repoTarget}" on GitHub...`
            : `🔍 Перевірка наявності репозиторію "${repoTarget}" на GitHub...`,
          'stdout'
        );

        // 3. Check if repository exists on GitHub
        let repoInfo = null;
        try {
          const out = execSync(`gh repo view "${repoTarget}" --json name,url,defaultBranchRef`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
          }).trim();
          repoInfo = JSON.parse(out);
        } catch {
          repoInfo = null;
        }

        if (!repoInfo || !repoInfo.name) {
          broadcastLog(
            isEn
              ? `❌ Deployment error: Repository "${repoTarget}" not found on GitHub!`
              : `❌ Помилка деплою: Репозиторій "${repoTarget}" не знайдено на GitHub!`,
            'stderr'
          );
          broadcastLog(
            isEn
              ? `💡 For Docker / Coolify hosting, the project name in step 2 (${projName}) must match your repository name on GitHub.`
              : `💡 Для хостингу Docker / Coolify назва проєкту в пункті 2 (${projName}) має співпадати з назвою вашого репозиторію на GitHub.`,
            'stderr'
          );
          broadcastLog(
            isEn
              ? `👉 Create a new repository "${projName}" on GitHub (https://github.com/new) or specify an existing repository in step 2.`
              : `👉 Створіть новий репозиторій "${projName}" на GitHub (https://github.com/new) або вкажіть назву існуючого репозиторію у пункті 2.`,
            'stdout'
          );
          broadcastComplete('deploy-project', false, 1);
          break;
        }

        // 4. Repository exists -> prepare git and push
        const defaultBranch = repoInfo.defaultBranchRef?.name || 'main';
        const remoteUrl = repoInfo.url ? `${repoInfo.url}.git` : `https://github.com/${repoTarget}.git`;
        broadcastLog(
          isEn
            ? `✅ Repository "${repoTarget}" found on GitHub!`
            : `✅ Репозиторій "${repoTarget}" знайдено на GitHub!`,
          'stdout'
        );
        broadcastLog(
          isEn
            ? `📦 Publishing project files to branch "${defaultBranch}"...`
            : `📦 Публікація файлів проєкту в гілку "${defaultBranch}"...`,
          'stdout'
        );

        // Ensure standard .gitignore exists so node_modules / build are never committed
        const gitignorePath = path.join(targetProjectDir, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
          fs.writeFileSync(
            gitignorePath,
            'node_modules/\nbuild/\ndist/\n.wrangler/\n.react-router/\n.webstudio-backups/\n.env\n.env.*\n!.env.example\n.DS_Store\n*.log\n',
            'utf8'
          );
        }

        const gitDir = path.join(targetProjectDir, '.git');
        try {
          if (!fs.existsSync(gitDir)) {
            try {
              execSync(`git init -b ${defaultBranch}`, { cwd: targetProjectDir, stdio: 'ignore' });
            } catch {
              execSync('git init', { cwd: targetProjectDir, stdio: 'ignore' });
              execSync(`git branch -M ${defaultBranch}`, { cwd: targetProjectDir, stdio: 'ignore' });
            }
          }
        } catch {}

        try {
          execSync('git remote remove origin', { cwd: targetProjectDir, stdio: 'ignore' });
        } catch {}
        try {
          execSync(`git remote add origin "${remoteUrl}"`, { cwd: targetProjectDir, stdio: 'ignore' });
        } catch {}

        try {
          execSync('git config user.name', { cwd: targetProjectDir, stdio: 'ignore' });
        } catch {
          try { execSync(`git config user.name "${ghUser}"`, { cwd: targetProjectDir, stdio: 'ignore' }); } catch {}
        }
        try {
          execSync('git config user.email', { cwd: targetProjectDir, stdio: 'ignore' });
        } catch {
          try { execSync(`git config user.email "${ghUser}@users.noreply.github.com"`, { cwd: targetProjectDir, stdio: 'ignore' }); } catch {}
        }

        ensureProjectIntegrity(targetProjectDir, { isDocker: true, provider: 'Docker' });
        ensureLockfileSynced(targetProjectDir);
        broadcastLog(
          isEn
            ? '🔒 Validated dependencies, Dockerfile, and lockfile synchronization for Coolify.'
            : '🔒 Перевірено цілісність залежностей, Dockerfile та синхронізацію lockfile для Coolify.',
          'stdout'
        );

        try {
          execSync('git add -A', { cwd: targetProjectDir, stdio: 'ignore' });
          const status = execSync('git status --porcelain', { cwd: targetProjectDir, encoding: 'utf8' }).trim();
          if (status) {
            execSync('git commit -m "deploy: update Webstudio build"', { cwd: targetProjectDir, stdio: 'ignore' });
          }
        } catch {}

        const pushCmd = `git push -u origin HEAD:${defaultBranch} --force`;
        executeShellCommand('deploy-project', pushCmd, { provider: 'Docker', cwd: targetProjectDir });
        break;
      }

      const pkgPath = path.join(targetProjectDir, 'package.json');
      let deployCmd = 'npm run deploy';
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (!pkg.scripts?.deploy) {
            const isReactRouter = fs.existsSync(path.join(targetProjectDir, 'wrangler.jsonc'));
            deployCmd = isReactRouter ? 'npm run build && npx wrangler deploy' : 'npm run build && npx wrangler pages deploy ./build/client';
          }
        } catch {}
      }

      executeShellCommand('deploy-project', deployCmd, {
        cwd: targetProjectDir,
        env: { PROJECT_DIR: targetProjectDir }
      });
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
          console.error('[API Error /api/status]', err);
          res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders
          });
          res.end(JSON.stringify({ error: err.message, stack: err.stack }));
        }
        return;
      }
      // Helper to read JSON body
      const readJsonBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(body || '{}')); }
          catch { resolve({}); }
        });
      });

      // GET /api/projects -> List all projects
      if (pathname === '/api/projects' && req.method === 'GET') {
        try {
          const data = projectManager.listProjects();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/projects/create -> Create a new project
      if (pathname === '/api/projects/create' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const newProj = projectManager.createProject(payload.name, payload.description);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, project: newProj }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/projects/select -> Switch active project
      if (pathname === '/api/projects/select' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const proj = projectManager.selectProject(payload.projectId);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, project: proj }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/projects/delete -> Delete a project
      if (pathname === '/api/projects/delete' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const result = projectManager.deleteProject(payload.projectId);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/projects/rename -> Rename a project
      if (pathname === '/api/projects/rename' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const proj = projectManager.renameProject(payload.projectId, payload.newName);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, project: proj }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/project/share-link -> Save full original shareLink for active project
      if (pathname === '/api/project/share-link' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const targetDir = typeof projectManager !== 'undefined' ? projectManager.getActiveProjectDir() : null;
          if (!targetDir) throw new Error('No active project');
          const ok = saveProjectShareLink(targetDir, payload.shareLink);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /api/backups -> List backups for active project
      if (pathname === '/api/backups' && req.method === 'GET') {
        try {
          const bm = getActiveBackupManager();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(bm.listBackups()));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/backups/create -> Create backup for active project
      if (pathname === '/api/backups/create' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const bm = getActiveBackupManager();
          const snapshot = bm.createBackup(payload.description, payload.type || 'manual');
          broadcastLog(`💾 Local backup snapshot created: ${snapshot.displayName}`, 'stdout');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, backup: snapshot }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/backups/restore -> Restore backup into active project
      if (pathname === '/api/backups/restore' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const bm = getActiveBackupManager();
          const result = bm.restoreBackup(payload.backupId);
          projectManager.syncActiveToRoot(projectManager.getActiveProjectDir());
          broadcastLog(`⏪ Restored project snapshot: ${result.displayName}`, 'stdout');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/backups/update -> Update backup description
      if (pathname === '/api/backups/update' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const bm = getActiveBackupManager();
          const updated = bm.updateDescription(payload.backupId, payload.description);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, backup: updated }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/backups/delete -> Delete a backup
      if (pathname === '/api/backups/delete' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const bm = getActiveBackupManager();
          const result = bm.deleteBackup(payload.backupId);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /api/backups/config -> Update auto-backup settings
      if (pathname === '/api/backups/config' && req.method === 'POST') {
        const payload = await readJsonBody();
        try {
          const bm = getActiveBackupManager();
          const updatedCfg = bm.updateConfig(payload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ ok: true, config: updatedCfg }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /api/deploy/history -> Fetch deployment history (Cloudflare Pages or Git/Docker)
      if (pathname === '/api/deploy/history' && req.method === 'GET') {
        try {
          const activeProject = projectManager.getActiveProject();
          const requestedProj = parsedUrl.searchParams.get('project');
          let targetDir = projectManager.getActiveProjectDir();
          if (requestedProj && (!activeProject || requestedProj !== activeProject.name)) {
            const customPath = path.join(projectManager.projectsDir, requestedProj);
            if (fs.existsSync(customPath)) {
              targetDir = customPath;
            }
          }

          const deployConfig = getDeployConfig(targetDir);
          const targetProj = requestedProj || deployConfig.projectName || (activeProject ? activeProject.name : 'webstudio-app');
          const requestedProvider = parsedUrl.searchParams.get('provider');
          const provider = requestedProvider || deployConfig.targetHosting || 'Cloudflare';
          const limit = parseInt(parsedUrl.searchParams.get('limit') || '10', 10);

          let history;
          if (provider === 'Docker' || deployConfig.targetHosting === 'Docker') {
            history = await fetchDeployGitHistory(targetDir, limit);
          } else {
            history = await fetchDeployHistory(targetProj, limit);
            if (history && typeof history === 'object') {
              history.provider = 'Cloudflare';
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          res.end(JSON.stringify(history));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
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

  const autoBackupInterval = setInterval(() => {
    try {
      const bm = getActiveBackupManager();
      const snap = bm.checkAutoBackup();
      if (snap) {
        broadcastLog(`⏰ Auto-backup snapshot created: ${snap.displayName}`, 'stdout');
      }
    } catch {}
  }, 60 * 1000);

  server.on('close', () => {
    clearInterval(autoBackupInterval);
  });

  return { server, port, autoBackupInterval };
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
