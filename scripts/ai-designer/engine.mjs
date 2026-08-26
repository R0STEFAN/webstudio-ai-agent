import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export const DEFAULT_BP = 'pLmXDeIXfu7F4jzDPjGFS'; // Base breakpoint

export function nanoid(len = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function loadProject(projectDir) {
  const dataPath = path.join(projectDir, '.webstudio', 'data.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Webstudio data file not found at: ${dataPath}`);
  }
  const content = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(content);
}

export function saveProject(projectDir, data) {
  const dataPath = path.join(projectDir, '.webstudio', 'data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getShareLink(projectDir) {
  const configPath = path.join(projectDir, '.webstudio', 'config.json');
  let projectId = '';

  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      projectId = cfg.projectId || '';
    } catch {}
  }

  const authPath = path.join(projectDir, '.webstudio', 'auth.json');
  let authToken = '';
  if (fs.existsSync(authPath)) {
    try {
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      for (const route of Object.values(auth.routes || {})) {
        if (route && route.authToken) {
          authToken = route.authToken;
          break;
        }
      }
    } catch {}
  }

  if (projectId && authToken) {
    return `https://p-${projectId}.apps.webstudio.is/?authToken=${authToken}`;
  }
  return null;
}

export function pushToCloud(projectDir, shareLink) {
  const link = shareLink || getShareLink(projectDir);
  if (!link) {
    throw new Error('No share link found. Provide one via arguments or ensure .webstudio/config.json and auth.json exist.');
  }
  console.log(`🚀 Pushing project to Webstudio Cloud: ${link}`);
  const out = execSync(`webstudio import --to "${link}"`, {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: 'inherit'
  });
  return out;
}

export function runMcpTool(projectDir, toolName, inputObj) {
  const tempDir = path.join(projectDir, '.temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const tempFile = path.join(tempDir, `mcp_${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(inputObj, null, 2), 'utf-8');
  
  try {
    const cmd = `webstudio mcp single-op-call ${toolName} --input-file "${tempFile}"`;
    const res = execSync(cmd, { cwd: projectDir, encoding: 'utf-8' });
    try {
      return JSON.parse(res);
    } catch {
      return res;
    }
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}
