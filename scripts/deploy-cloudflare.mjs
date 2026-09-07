import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function getProjectName(dir = rootDir) {
  const tomlPath = path.join(dir, 'wrangler.toml');
  if (fs.existsSync(tomlPath)) {
    try {
      const content = fs.readFileSync(tomlPath, 'utf8');
      const m = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (m) return m[1].trim();
    } catch {}
  }

  const jsoncPath = path.join(dir, 'wrangler.jsonc');
  if (fs.existsSync(jsoncPath)) {
    try {
      const content = fs.readFileSync(jsoncPath, 'utf8');
      const m = content.match(/"name"\s*:\s*"([^"]+)"/);
      if (m) return m[1].trim();
    } catch {}
  }

  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name.trim();
    } catch {}
  }

  return 'webstudio-app';
}

export function getWranglerToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  const home = os.homedir();
  const configPaths = [
    path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml')
  ];

  if (process.env.XDG_CONFIG_HOME) {
    configPaths.unshift(path.join(process.env.XDG_CONFIG_HOME, '.wrangler', 'config', 'default.toml'));
  }

  for (const p of configPaths) {
    if (p && fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const m = content.match(/oauth_token\s*=\s*"([^"]+)"/);
        if (m) return m[1];
      } catch {}
    }
  }
  return null;
}

export async function fetchDeployHistory(projectName, limit = 10, retried = false) {
  let token = getWranglerToken();
  if (!token) return { success: false, deployments: [], error: 'Not authenticated with Wrangler' };

  try {
    let accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4500)
    });

    if (accRes.status === 401 || accRes.status === 403) {
      if (!retried) {
        const { execSync } = await import('node:child_process');
        try {
          execSync('npx wrangler whoami', { stdio: 'ignore' });
          return fetchDeployHistory(projectName, limit, true);
        } catch {}
      }
      return { success: false, deployments: [], error: 'Cloudflare access token expired or invalid' };
    }

    const accData = await accRes.json();
    const accountId = accData.result?.[0]?.id;
    if (!accountId) return { success: false, deployments: [], error: 'No Cloudflare account found' };

    const depRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });

    if (!depRes.ok) {
      return { success: false, deployments: [], error: `Failed to fetch deployments (${depRes.status})` };
    }

    const depData = await depRes.json();
    const deployments = (depData.result || []).map(d => ({
      id: d.id,
      shortId: d.short_id,
      environment: d.environment || 'preview',
      branch: d.deployment_trigger?.metadata?.branch || '',
      commitMessage: d.deployment_trigger?.metadata?.commit_message || '',
      commitHash: d.deployment_trigger?.metadata?.commit_hash ? d.deployment_trigger.metadata.commit_hash.slice(0, 7) : '',
      url: d.url || '',
      createdOn: d.created_on,
      status: d.latest_stage?.status || 'success',
      isProduction: d.environment === 'production'
    }));

    return {
      success: true,
      projectName,
      total: deployments.length,
      deployments
    };
  } catch (err) {
    return { success: false, deployments: [], error: err.message };
  }
}

export async function detectProductionBranch(projectName) {
  const token = getWranglerToken();
  if (!token) {
    return { branch: 'main', source: 'default (unauthenticated)' };
  }

  try {
    const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000)
    });
    if (!accRes.ok) {
      return { branch: 'main', source: 'default (accounts fetch failed)' };
    }
    const accData = await accRes.json();
    const accountId = accData.result?.[0]?.id;
    if (!accountId) {
      return { branch: 'main', source: 'default (no account id)' };
    }

    const projRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000)
    });
    if (projRes.ok) {
      const projData = await projRes.json();
      const prodBranch = projData.result?.production_branch;
      if (prodBranch) {
        return { branch: prodBranch, source: `Cloudflare Pages project config (${projectName})` };
      }
    }
  } catch {}

  return { branch: 'main', source: 'default (new project)' };
}

export async function deploy() {
  const targetDir = process.env.PROJECT_DIR ? path.resolve(process.env.PROJECT_DIR) : process.cwd();
  const projectName = getProjectName(targetDir);
  console.log(`\x1b[36m[Cloudflare Deploy]\x1b[0m Detecting production branch for project: \x1b[1m"${projectName}"\x1b[0m...`);

  const { branch: targetBranch, source } = await detectProductionBranch(projectName);
  console.log(`\x1b[36m[Cloudflare Deploy]\x1b[0m Target production branch: \x1b[32m"${targetBranch}"\x1b[0m (${source})`);

  const deployDir = fs.existsSync(path.join(targetDir, 'build', 'client')) ? './build/client' : './build';
  const cmd = `npx wrangler pages deploy ${deployDir} --project-name "${projectName}" --branch "${targetBranch}" --commit-dirty=true`;

  console.log(`\x1b[36m[Cloudflare Deploy]\x1b[0m $ ${cmd}\n`);

  const child = spawn(cmd, {
    cwd: targetDir,
    shell: true,
    stdio: 'inherit',
    env: process.env
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(`\x1b[31m[Cloudflare Deploy] Failed to start wrangler: ${err.message}\x1b[0m`);
    process.exit(1);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  deploy();
}
