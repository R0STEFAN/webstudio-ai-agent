#!/usr/bin/env node
import { loadProject, getShareLink, pushToCloud, runMcpTool } from './engine.mjs';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Webstudio AI Designer Toolkit CLI
---------------------------------
Commands:
  info [dir]                      Inspect local pages, instances, and cloud share link
  mcp <tool> '<json>' [dir]       Run an official Webstudio MCP tool offline
  push [dir] [shareLink]          Push local changes to Webstudio Cloud via webstudio import
  help                            Show this help message
`);
}

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

const targetDir = args[1] && !args[1].startsWith('{') && !args[1].startsWith('http') ? args[1] : process.cwd();

try {
  if (command === 'info') {
    const data = loadProject(targetDir);
    const pages = data.build?.pages || [];
    const instances = data.build?.instances || [];
    const link = getShareLink(targetDir);
    console.log(`📁 Project Directory: ${targetDir}`);
    console.log(`📄 Pages (${pages.length}):`);
    for (const p of pages) {
      const page = Array.isArray(p) ? p[1] : p;
      console.log(`   - ${page.path || page.name} (id: ${page.id})`);
    }
    console.log(`🌳 Total Instances: ${instances.length}`);
    if (link) console.log(`☁️ Cloud Share Link: ${link}`);
  } else if (command === 'mcp') {
    const tool = args[1];
    const inputJson = args[2] ? JSON.parse(args[2]) : {};
    const dir = args[3] || process.cwd();
    const res = runMcpTool(dir, tool, inputJson);
    console.log(typeof res === 'object' ? JSON.stringify(res, null, 2) : res);
  } else if (command === 'push') {
    const shareLink = args[1] && args[1].startsWith('http') ? args[1] : args[2];
    pushToCloud(targetDir, shareLink);
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
