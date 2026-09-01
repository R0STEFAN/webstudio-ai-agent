import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  TEMPLATE_PRESETS,
  getDeployConfig,
  updateProjectNameOnDisk,
  getProjectStatus,
  getSystemStatus,
  createGuiServer,
  sseClients
} from '../scripts/gui-server.mjs';
import { i18n, t } from '../gui/i18n.js';
import { switchTab, state, dom, cacheDOMElements, applyTranslations } from '../gui/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 4294;
const BASE_URL = `http://localhost:${TEST_PORT}`;

console.log('🧪 Starting Task 5: End-to-End Verification & Automated Deploy Tab Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    throw err;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    throw err;
  }
}

// Temporary directory tracker for clean test isolation
const tempDirsToClean = [];
function makeTempDir() {
  const tmpDir = path.join(os.tmpdir(), `ws-test-deploy-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  tempDirsToClean.push(tmpDir);
  return tmpDir;
}

// Helper to manage SSE connections and collect events
class SseTestClient {
  constructor(url) {
    this.url = url;
    this.abortController = new AbortController();
    this.events = [];
    this.listeners = [];
    this.connected = false;
  }

  async connect() {
    this.response = await fetch(this.url, { signal: this.abortController.signal });
    assert.strictEqual(this.response.status, 200, 'SSE endpoint must return 200 OK');
    const contentType = this.response.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/event-stream'), `Content-Type must be text/event-stream, got ${contentType}`);

    this.reader = this.response.body.getReader();
    this.decoder = new TextDecoder();
    this.buffer = '';

    // Start background stream consumer
    this.readLoop();
  }

  async readLoop() {
    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        this.buffer += this.decoder.decode(value, { stream: true });
        const parts = this.buffer.split('\n\n');
        this.buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr += (dataStr ? '\n' : '') + line.slice(6);
            }
          }

          let parsedData = dataStr;
          try {
            parsedData = JSON.parse(dataStr);
          } catch {}

          const evt = { event: eventType, data: parsedData, raw: part };
          this.events.push(evt);

          for (const listener of this.listeners) {
            listener(evt);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Stream closed or aborted intentionally
      }
    }
  }

  waitForEvent(predicate, timeoutMs = 6000) {
    for (const evt of this.events) {
      if (predicate(evt)) return Promise.resolve(evt);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) this.listeners.splice(idx, 1);
        reject(new Error(`Timeout waiting for SSE event (${timeoutMs}ms)`));
      }, timeoutMs);

      const listener = (evt) => {
        if (predicate(evt)) {
          clearTimeout(timer);
          const idx = this.listeners.indexOf(listener);
          if (idx !== -1) this.listeners.splice(idx, 1);
          resolve(evt);
        }
      };

      this.listeners.push(listener);
    });
  }

  close() {
    this.abortController.abort();
  }
}

async function runTestSuite() {
  const expectedPresets = {
    'react-router-cloudflare': ['react-router', 'react-router-cloudflare'],
    'remix-cloudflare': ['defaults', 'cloudflare'],
    'react-router-vercel': ['react-router', 'react-router-vercel'],
    'react-router-netlify': ['react-router', 'react-router-netlify'],
    'react-router-docker': ['react-router', 'react-router-docker'],
    'ssg': ['ssg'],
    'ssg-vercel': ['ssg', 'ssg-vercel'],
    'ssg-netlify': ['ssg', 'ssg-netlify']
  };

  // 1.1 Verify all 8 presets in TEMPLATE_PRESETS dictionary
  it('should define all 8 expected template presets with exact CLI overlay mappings', () => {
    assert.ok(Object.keys(TEMPLATE_PRESETS).length >= 8, 'Must contain all 8 presets plus aliases');
    for (const [key, expectedFlags] of Object.entries(expectedPresets)) {
      assert.ok(key in TEMPLATE_PRESETS, `Preset ${key} must exist in TEMPLATE_PRESETS`);
      assert.deepStrictEqual(TEMPLATE_PRESETS[key], expectedFlags, `Preset ${key} flags mismatch`);
    }
  });

  // 1.2 Verify CLI command flag generation for each preset
  it('should synthesize correct npx webstudio build CLI flags for all 8 presets', () => {
    for (const [preset, templates] of Object.entries(TEMPLATE_PRESETS)) {
      let cmd = 'npx webstudio build';
      for (const t of templates) {
        cmd += ` --template ${t}`;
      }
      assert.ok(cmd.startsWith('npx webstudio build --template '), `Command must start with build template flag`);
      if (preset === 'react-router-cloudflare') {
        assert.strictEqual(cmd, 'npx webstudio build --template react-router --template react-router-cloudflare');
      } else if (preset === 'remix-cloudflare' || preset === 'cloudflare') {
        assert.strictEqual(cmd, 'npx webstudio build --template defaults --template cloudflare');
      } else if (preset === 'ssg') {
        assert.strictEqual(cmd, 'npx webstudio build --template ssg');
      } else if (preset === 'ssg-vercel') {
        assert.strictEqual(cmd, 'npx webstudio build --template ssg --template ssg-vercel');
      }
    }
  });

  // 1.3 Verify bilingual i18n preset translations exist for all 8 presets
  it('should have localized preset labels in both UA and EN dictionaries for all 8 presets', () => {
    const presetKeys = Object.keys(TEMPLATE_PRESETS);
    assert.ok(i18n.ua?.deploy?.templateSection?.presets, 'UA deploy presets dictionary must exist');
    assert.ok(i18n.en?.deploy?.templateSection?.presets, 'EN deploy presets dictionary must exist');

    for (const key of presetKeys) {
      const uaLabel = i18n.ua.deploy.templateSection.presets[key];
      const enLabel = i18n.en.deploy.templateSection.presets[key];

      assert.ok(typeof uaLabel === 'string' && uaLabel.length > 0, `UA label missing for preset "${key}"`);
      assert.ok(typeof enLabel === 'string' && enLabel.length > 0, `EN label missing for preset "${key}"`);
    }
  });

  // 1.4 Verify index.html template select options match the 8 presets
  it('should contain all 8 preset options inside #select-template-preset in gui/index.html', () => {
    const htmlPath = path.join(rootDir, 'gui', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    const selectMatch = html.match(/<select[^>]*id=["']select-template-preset["'][^>]*>([\s\S]*?)<\/select>/i);
    assert.ok(selectMatch, '#select-template-preset must exist in gui/index.html');

    const selectBody = selectMatch[1];
    const optionValues = [...selectBody.matchAll(/<option[^>]*value=["']([^"']+)["']/g)].map(m => m[1]);

    assert.strictEqual(optionValues.length, 8, 'Select dropdown must have exactly 8 options in HTML');
    for (const key of Object.keys(expectedPresets)) {
      assert.ok(optionValues.includes(key), `Dropdown option for preset "${key}" must exist in HTML`);
    }
  });

  console.log('\n✏️ 2. Test Case 2: Multi-Config Project Name Updating on Disk...');

  // 2.1 wrangler.jsonc update
  it('should update project name in wrangler.jsonc while preserving structure and comments', () => {
    const tmpDir = makeTempDir();
    const jsoncPath = path.join(tmpDir, 'wrangler.jsonc');
    const initialJsonc = `{\n  // Cloudflare Workers config\n  "name": "initial-worker-name",\n  "compatibility_date": "2024-09-01",\n  "main": "./build/server/index.js"\n}\n`;
    fs.writeFileSync(jsoncPath, initialJsonc, 'utf8');

    const res = updateProjectNameOnDisk(tmpDir, 'My Awesome Worker!');
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.safeName, 'my-awesome-worker-');

    const updatedContent = fs.readFileSync(jsoncPath, 'utf8');
    assert.ok(updatedContent.includes('"name": "my-awesome-worker-"'), 'wrangler.jsonc must have updated name');
    assert.ok(updatedContent.includes('// Cloudflare Workers config'), 'wrangler.jsonc comments must be preserved');
    assert.ok(updatedContent.includes('"compatibility_date": "2024-09-01"'), 'wrangler.jsonc other fields preserved');

    const config = getDeployConfig(tmpDir);
    assert.strictEqual(config.projectName, 'my-awesome-worker-');
    assert.strictEqual(config.configFile, 'wrangler.jsonc');
    assert.strictEqual(config.detectedTemplate, 'react-router-cloudflare');
  });

  // 2.2 wrangler.toml update
  it('should update project name in wrangler.toml format (TOML regex)', () => {
    const tmpDir = makeTempDir();
    const tomlPath = path.join(tmpDir, 'wrangler.toml');
    const initialToml = `# Cloudflare Pages Remix\nname = "initial-remix-app"\ncompatibility_date = "2024-09-01"\n`;
    fs.writeFileSync(tomlPath, initialToml, 'utf8');

    const res = updateProjectNameOnDisk(tmpDir, 'Remix_App_2026');
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.safeName, 'remix_app_2026');

    const updatedContent = fs.readFileSync(tomlPath, 'utf8');
    assert.ok(updatedContent.includes('name = "remix_app_2026"'), 'wrangler.toml must have updated name');
    assert.ok(updatedContent.includes('# Cloudflare Pages Remix'), 'wrangler.toml comments preserved');

    const config = getDeployConfig(tmpDir);
    assert.strictEqual(config.projectName, 'remix_app_2026');
    assert.strictEqual(config.configFile, 'wrangler.toml');
    assert.strictEqual(config.detectedTemplate, 'remix-cloudflare');
  });

  // 2.3 package.json update
  it('should update package.json name while preserving scripts and dependencies', () => {
    const tmpDir = makeTempDir();
    const pkgPath = path.join(tmpDir, 'package.json');
    const initialPkg = {
      name: 'initial-pkg-app',
      version: '1.0.0',
      scripts: {
        build: 'vite build',
        preview: 'vite preview',
        deploy: 'wrangler deploy'
      },
      dependencies: {
        'react': '^18.3.0'
      }
    };
    fs.writeFileSync(pkgPath, JSON.stringify(initialPkg, null, 2), 'utf8');

    const res = updateProjectNameOnDisk(tmpDir, 'New-Standard-Pkg');
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.safeName, 'new-standard-pkg');

    const updatedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(updatedPkg.name, 'new-standard-pkg');
    assert.strictEqual(updatedPkg.version, '1.0.0');
    assert.deepStrictEqual(updatedPkg.scripts, initialPkg.scripts);

    const config = getDeployConfig(tmpDir);
    assert.strictEqual(config.projectName, 'new-standard-pkg');
    assert.strictEqual(config.configFile, 'package.json');
    assert.deepStrictEqual(config.availableScripts, ['build', 'preview', 'deploy']);
  });

  // 2.4 Simultaneous update across wrangler.jsonc, wrangler.toml, and package.json
  it('should update all 3 configuration files simultaneously when present', () => {
    const tmpDir = makeTempDir();
    const jsoncPath = path.join(tmpDir, 'wrangler.jsonc');
    const tomlPath = path.join(tmpDir, 'wrangler.toml');
    const pkgPath = path.join(tmpDir, 'package.json');

    fs.writeFileSync(jsoncPath, '{\n  "name": "old-cf-worker"\n}\n', 'utf8');
    fs.writeFileSync(tomlPath, 'name = "old-cf-pages"\n', 'utf8');
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'old-node-pkg', version: '2.0.0' }, null, 2), 'utf8');

    const res = updateProjectNameOnDisk(tmpDir, 'Unified_Super_App');
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.safeName, 'unified_super_app');

    const updatedJsonc = fs.readFileSync(jsoncPath, 'utf8');
    const updatedToml = fs.readFileSync(tomlPath, 'utf8');
    const updatedPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.ok(updatedJsonc.includes('"name": "unified_super_app"'));
    assert.ok(updatedToml.includes('name = "unified_super_app"'));
    assert.strictEqual(updatedPkg.name, 'unified_super_app');
  });

  // 2.5 Input sanitization & edge cases
  it('should sanitize invalid characters and reject empty or invalid inputs gracefully', () => {
    const tmpDir = makeTempDir();
    assert.deepStrictEqual(updateProjectNameOnDisk(tmpDir, ''), { updated: false, safeName: '' });
    assert.deepStrictEqual(updateProjectNameOnDisk(tmpDir, '   '), { updated: false, safeName: '' });
    assert.deepStrictEqual(updateProjectNameOnDisk(tmpDir, null), { updated: false, safeName: '' });
    assert.deepStrictEqual(updateProjectNameOnDisk(tmpDir, undefined), { updated: false, safeName: '' });

    // Sanitization of complex characters
    const complexRes = updateProjectNameOnDisk(tmpDir, '  My @Project / Name #2026!  ');
    assert.strictEqual(complexRes.safeName, 'my--project---name--2026-');
  });

  console.log('\n🌐 3. Starting GUI Test Server on isolated port ' + TEST_PORT + '...');

  const { server } = createGuiServer(TEST_PORT);
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, () => resolve());
    server.on('error', reject);
  });
  console.log(`  🚀 Server listening on ${BASE_URL}\n`);

  const sseClient = new SseTestClient(`${BASE_URL}/api/logs`);
  await sseClient.connect();

  const connectedEvt = await sseClient.waitForEvent(e => e.event === 'connected', 4000);
  assert.ok(connectedEvt, 'SSE client must receive initial "connected" event');
  console.log('  📡 SSE Test Client connected successfully.\n');

  // -------------------------------------------------------------
  // Test Case 3: Status API Deploy Metadata Schema
  // -------------------------------------------------------------
  console.log('📊 3. Test Case 3: Status API Deploy Metadata Schema Verification...');

  await itAsync('GET /api/status should return 200 with complete deploy metadata schema', async () => {
    const res = await fetch(`${BASE_URL}/api/status`);
    assert.strictEqual(res.status, 200, 'GET /api/status must return 200 OK');
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Content-Type must be application/json');

    const status = await res.json();

    // Verify root schema
    assert.strictEqual(typeof status.installed, 'boolean');
    assert.ok('webstudioVersion' in status);
    assert.ok('latestVersion' in status);
    assert.strictEqual(typeof status.updateAvailable, 'boolean');
    assert.ok('projectId' in status);
    assert.strictEqual(typeof status.origin, 'string');
    assert.strictEqual(typeof status.hasAuthToken, 'boolean');
    assert.strictEqual(typeof status.hasSession, 'boolean');

    assert.ok(status.projectStats && typeof status.projectStats === 'object');
    assert.strictEqual(typeof status.projectStats.pages, 'number');
    assert.strictEqual(typeof status.projectStats.instances, 'number');
    assert.strictEqual(typeof status.projectStats.assets, 'number');

    // Verify deploy schema
    assert.ok(status.deploy && typeof status.deploy === 'object', 'status.deploy must be an object');
    assert.strictEqual(typeof status.deploy.projectName, 'string', 'deploy.projectName must be string');
    assert.strictEqual(typeof status.deploy.configFile, 'string', 'deploy.configFile must be string');
    assert.strictEqual(typeof status.deploy.detectedTemplate, 'string', 'deploy.detectedTemplate must be string');
    assert.strictEqual(typeof status.deploy.hasWrangler, 'boolean', 'deploy.hasWrangler must be boolean');
    assert.strictEqual(typeof status.deploy.hasBuildDir, 'boolean', 'deploy.hasBuildDir must be boolean');
    assert.ok(Array.isArray(status.deploy.availableScripts), 'deploy.availableScripts must be an array');
  });

  await itAsync('getSystemStatus() alias should match getProjectStatus() return value', async () => {
    const projStatus = await getProjectStatus();
    const sysStatus = await getSystemStatus();
    assert.deepStrictEqual(sysStatus, projStatus, 'getSystemStatus must produce identical output');
  });

  // -------------------------------------------------------------
  // Test Case 4: Real-time SSE Log Streaming for Deploy Actions
  // -------------------------------------------------------------
  console.log('\n⚡ 4. Test Case 4: Real-Time SSE Log Streaming for Deploy Actions...');

  // Backup package.json so action updates do not pollute workspace permanently
  const rootPkgPath = path.join(rootDir, 'package.json');
  let originalPkgBackup = null;
  if (fs.existsSync(rootPkgPath)) {
    originalPkgBackup = fs.readFileSync(rootPkgPath, 'utf8');
  }

  try {
    // 4.1 generate-template action
    await itAsync('POST /api/action with generate-template should stream npx webstudio build command log', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-template',
          params: { templatePreset: 'react-router-cloudflare' }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'generate-template' });

      // Expect command log in SSE stream
      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('npx webstudio build') && e.data.text.includes('--template react-router-cloudflare'),
        5000
      );
      assert.ok(logEvt, 'Must receive generate-template command log event');
    });

    // 4.2 update-project-name action
    await itAsync('POST /api/action with update-project-name should update name & stream success log and complete event', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-project-name',
          params: { projectName: 'webstudio-e2e-app' }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'update-project-name' });

      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('Project name updated to: webstudio-e2e-app'),
        4000
      );
      assert.ok(logEvt, 'Must receive update-project-name success log');

      const completeEvt = await sseClient.waitForEvent(
        e => e.event === 'complete' && e.data?.action === 'update-project-name',
        4000
      );
      assert.strictEqual(completeEvt.data.success, true);
      assert.strictEqual(completeEvt.data.code, 0);
    });

    // 4.3 check-auth action
    await itAsync('POST /api/action with check-auth should stream npx wrangler whoami command log', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-auth' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'check-auth' });

      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('npx wrangler whoami'),
        4000
      );
      assert.ok(logEvt, 'Must receive check-auth wrangler command log');
    });

    // 4.4 build-project action
    await itAsync('POST /api/action with build-project should stream npm run build command log', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build-project' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'build-project' });

      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('npm run build'),
        4000
      );
      assert.ok(logEvt, 'Must receive npm run build command log');
    });

    // 4.5 preview-project action
    await itAsync('POST /api/action with preview-project should stream npm run preview command log', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview-project' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'preview-project' });

      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('npm run preview'),
        4000
      );
      assert.ok(logEvt, 'Must receive npm run preview command log');
    });

    // 4.6 deploy-project action
    await itAsync('POST /api/action with deploy-project should stream npm run deploy command log', async () => {
      const res = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy-project' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data, { ok: true, action: 'deploy-project' });

      const logEvt = await sseClient.waitForEvent(
        e => e.event === 'log' && typeof e.data?.text === 'string' && e.data.text.includes('npm run deploy'),
        4000
      );
      assert.ok(logEvt, 'Must receive npm run deploy command log');
    });
  } finally {
    // Restore original package.json if it was modified
    if (originalPkgBackup !== null) {
      fs.writeFileSync(rootPkgPath, originalPkgBackup, 'utf8');
    }
  }

  // -------------------------------------------------------------
  // Test Case 5: DOM ID and i18n Binding Consistency
  // -------------------------------------------------------------
  console.log('\n🎨 5. Test Case 5: DOM ID and i18n Binding Consistency for Tab 1 & Tab 2...');

  const htmlPath = path.join(rootDir, 'gui', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract all element IDs from HTML
  const allIdMatches = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  const htmlIds = new Set(allIdMatches);

  it('should have strictly unique DOM element IDs with zero duplicates', () => {
    const seen = new Set();
    const duplicates = [];
    for (const id of allIdMatches) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }
    assert.strictEqual(duplicates.length, 0, `Found duplicate DOM IDs: ${duplicates.join(', ')}`);
  });

  // Verify Tab 1 (Workspace) DOM elements
  it('should contain all required Tab 1 (Workspace) DOM element IDs', () => {
    const tab1Ids = [
      'first-run-view',
      'workspace-view',
      'btn-tab-workspace',
      'tab-view-workspace',
      'input-share-link',
      'input-build-id',
      'input-cookie',
      'input-csrf-token',
      'btn-install',
      'btn-link',
      'btn-sync',
      'btn-sync-draft',
      'btn-save-session',
      'btn-upload-assets',
      'btn-import',
      'btn-check-updates',
      'btn-update-now',
      'btn-help-toggle',
      'help-guide-box',
      'session-help-text',
      'terminal-output',
      'terminal-status',
      'btn-clear-logs',
      'btn-copy-logs',
      'chk-autoscroll',
      'val-project-id',
      'val-pages-count',
      'val-instances-count',
      'val-assets-count',
      'val-project-status',
      'val-mcp-status',
      'val-footer-version',
      'container-update-available',
      'val-footer-badge',
      'toast-container'
    ];

    for (const id of tab1Ids) {
      assert.ok(htmlIds.has(id), `Tab 1 DOM ID #${id} must exist in index.html`);
    }
  });

  // Verify Tab 2 (Deploy) DOM elements
  it('should contain all required Tab 2 (Deploy) DOM element IDs', () => {
    const tab2Ids = [
      'btn-tab-deploy',
      'tab-view-deploy',
      'select-template-preset',
      'btn-generate-template',
      'input-project-name',
      'btn-update-project-name',
      'val-detected-config',
      'val-hosting-status',
      'btn-check-auth',
      'btn-login-auth',
      'btn-deploy-install',
      'btn-deploy-build',
      'btn-deploy-preview',
      'btn-deploy-publish',
      'val-deploy-template',
      'val-deploy-hosting',
      'val-deploy-config-file',
      'val-deploy-scripts-count'
    ];

    for (const id of tab2Ids) {
      assert.ok(htmlIds.has(id), `Tab 2 DOM ID #${id} must exist in index.html`);
    }
  });

  // Verify all data-i18n attributes resolve in both UA and EN
  it('should resolve 100% of data-i18n, placeholder, and title keys in both UA and EN dictionaries', () => {
    const i18nRegex = /data-i18n(?:-placeholder|-title)?=["']([^"']+)["']/g;
    const referencedKeys = new Set();
    let m;
    while ((m = i18nRegex.exec(html)) !== null) {
      referencedKeys.add(m[1]);
    }

    assert.ok(referencedKeys.size >= 65, `Expected at least 65 i18n keys, found ${referencedKeys.size}`);

    for (const key of referencedKeys) {
      const uaVal = t(key, {}, 'ua');
      const enVal = t(key, {}, 'en');

      assert.notStrictEqual(uaVal, key, `Translation key "${key}" missing in UA dictionary`);
      assert.notStrictEqual(enVal, key, `Translation key "${key}" missing in EN dictionary`);
      assert.ok(typeof uaVal === 'string' && uaVal.length > 0);
      assert.ok(typeof enVal === 'string' && enVal.length > 0);
    }
  });

  // Verify Tab switching in simulated DOM environment
  it('should correctly switch views and toggle active classes between Tab 1 and Tab 2', () => {
    const elementMap = new Map();
    function createMockEl(id, tag = 'div') {
      const el = {
        id,
        tagName: tag.toUpperCase(),
        children: [],
        options: [],
        selectedIndex: 0,
        value: '',
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); },
          toggle(c, force) {
            if (force !== undefined) {
              force ? this.add(c) : this.remove(c);
            } else {
              this.contains(c) ? this.remove(c) : this.add(c);
            }
          }
        },
        _innerHTML: '',
        get innerHTML() { return this._innerHTML; },
        set innerHTML(val) {
          this._innerHTML = val;
          if (val === '') {
            this.children = [];
            this.options = [];
          }
        },
        appendChild(child) {
          this.children.push(child);
          if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
            this.options.push(child);
          }
          return child;
        },
        querySelector(sel) { return null; },
        getAttribute(attr) { return null; },
        setAttribute(attr, val) {},
        removeAttribute(attr) {}
      };
      if (id) elementMap.set(id, el);
      return el;
    }

    const mockDoc = {
      getElementById(id) { return elementMap.get(id) || null; },
      querySelectorAll(sel) { return []; },
      createElement(tag) { return createMockEl(null, tag); },
      documentElement: { lang: 'ua' }
    };

    globalThis.document = mockDoc;

    dom.btnTabWorkspace = createMockEl('btn-tab-workspace', 'button');
    dom.btnTabDeploy = createMockEl('btn-tab-deploy', 'button');
    dom.tabViewWorkspace = createMockEl('tab-view-workspace', 'section');
    dom.tabViewDeploy = createMockEl('tab-view-deploy', 'section');
    // Switch to Deploy tab
    switchTab('deploy');
    assert.strictEqual(state.currentTab, 'deploy');
    assert.ok(dom.btnTabDeploy.classList.contains('active'), 'Deploy tab button must have active class');
    assert.ok(!dom.btnTabWorkspace.classList.contains('active'), 'Workspace tab button must not have active class');
    assert.ok(!dom.tabViewDeploy.classList.contains('hidden'), 'Deploy tab view must not be hidden');
    assert.ok(dom.tabViewWorkspace.classList.contains('hidden'), 'Workspace tab view must be hidden');

    // Switch to Workspace tab
    switchTab('workspace');
    assert.strictEqual(state.currentTab, 'workspace');
    assert.ok(dom.btnTabWorkspace.classList.contains('active'), 'Workspace tab button must have active class');
    assert.ok(!dom.btnTabDeploy.classList.contains('active'), 'Deploy tab button must not have active class');
    assert.ok(!dom.tabViewWorkspace.classList.contains('hidden'), 'Workspace tab view must not be hidden');
    assert.ok(dom.tabViewDeploy.classList.contains('hidden'), 'Deploy tab view must be hidden');
  });

  // -------------------------------------------------------------
  // Test Case 6: Clean Server Shutdown
  // -------------------------------------------------------------
  console.log('\n🛑 6. Test Case 6: Clean Server Shutdown & Resource Teardown...');

  await itAsync('should cleanly disconnect SSE clients and close HTTP server on port ' + TEST_PORT, async () => {
    // Disconnect SSE client
    sseClient.close();

    // Close HTTP Server
    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    // Verify port is no longer open
    let connectionRefused = false;
    try {
      await fetch(`${BASE_URL}/api/status`, { signal: AbortSignal.timeout(1000) });
    } catch (err) {
      connectionRefused = true;
    }
    assert.ok(connectionRefused, 'Server must no longer accept connections after close');

    // Clean up temporary test directories
    for (const dir of tempDirsToClean) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch {}
    }
  });

  console.log(`\n🎉 Task 5 Integration Suite Completed: ${passedTests}/${totalTests} tests passed.`);
  console.log('✨ All Deploy Tab tests passed successfully with exit code 0.\n');
}

runTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
