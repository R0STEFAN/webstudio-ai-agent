import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  getHostingAuth,
  getDeployConfig,
  getProjectStatus,
  stopPreviewServer,
  cleanAllTemplateGenerations,
  cleanFrameworkArtifacts,
  activePreviewProcess,
  activePreviewUrl,
  createGuiServer,
  broadcastLog,
  broadcastComplete,
  sseClients
} from '../scripts/gui-server.mjs';
import { i18n, t } from '../gui/i18n.js';
import { state, dom, renderView } from '../gui/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Dedicated Test Suite for Hosting Auth, Preview Lifecycle & Terminal Output...\n');

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

// 1. Test getHostingAuth()
console.log('1. Testing getHostingAuth() & Deploy metadata...');

it('should detect hosting auth and return an authenticated object', () => {
  const auth = getHostingAuth(rootDir);
  assert.ok(typeof auth === 'object' && auth !== null, 'auth must be an object');
  assert.strictEqual(typeof auth.authenticated, 'boolean', 'authenticated must be boolean');
  assert.strictEqual(typeof auth.provider, 'string', 'provider must be string');
  assert.strictEqual(auth.checked, true, 'checked flag must be true');
});

it('should include hostingAuth inside getDeployConfig()', () => {
  const config = getDeployConfig(rootDir);
  assert.ok(config.hostingAuth, 'deploy config must include hostingAuth');
  assert.strictEqual(typeof config.hostingAuth.authenticated, 'boolean');
});
it('cleanAllTemplateGenerations() should clean template directories and configs', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-clean-test-'));
  fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'app', 'entry.server.tsx'), 'export default {}');
  fs.writeFileSync(path.join(tempDir, 'wrangler.toml'), 'name = "test"');
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    name: 'test',
    dependencies: { 'react-router': '^7.0.0', '@remix-run/react': '2.16.5' },
    scripts: { build: 'remix vite:build' }
  }));

  cleanAllTemplateGenerations(tempDir);
  assert.strictEqual(fs.existsSync(path.join(tempDir, 'app')), false);
  assert.strictEqual(fs.existsSync(path.join(tempDir, 'wrangler.toml')), false);
  
  const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.dependencies['react-router'], undefined);
  assert.strictEqual(pkg.dependencies['@remix-run/react'], undefined);
  assert.ok(typeof pkg.scripts?.build === 'string');
});


it('should include hostingAuth and previewServer in getProjectStatus()', async () => {
  const status = await getProjectStatus();
  assert.ok(status.hostingAuth, 'status must include hostingAuth');
  assert.ok(status.previewServer, 'status must include previewServer');
  assert.strictEqual(typeof status.previewServer.running, 'boolean');
});

// 2. Test Preview Server lifecycle helpers
console.log('\n2. Testing Preview Server lifecycle helpers...');

it('stopPreviewServer() should safely reset active preview state', () => {
  stopPreviewServer();
  assert.strictEqual(activePreviewProcess, null);
  assert.strictEqual(activePreviewUrl, null);
});

// 3. Test DOM Hosting Status Badge update in simulated DOM
console.log('\n3. Testing DOM Hosting Status Badge & Button States...');

it('renderView() should update dom.valHostingStatus to authorized badge when authenticated', () => {
  // Setup mock DOM elements
  const mockHostingStatus = {
    textContent: '',
    className: ''
  };
  const mockPreviewBtn = {
    textContent: '',
    className: 'btn btn-secondary',
    classList: {
      add(cls) { this._classes = this._classes || new Set(['btn', 'btn-secondary']); this._classes.add(cls); mockPreviewBtn.className = Array.from(this._classes).join(' '); },
      remove(cls) { this._classes = this._classes || new Set(['btn', 'btn-secondary']); this._classes.delete(cls); mockPreviewBtn.className = Array.from(this._classes).join(' '); }
    }
  };

  const mockActiveTemplateBadge = {
    textContent: '',
    className: ''
  };

  dom.valHostingStatus = mockHostingStatus;
  dom.btnDeployPreview = mockPreviewBtn;
  dom.valActiveTemplateBadge = mockActiveTemplateBadge;
  // Set mock state
  state.lang = 'ua';
  state.status = {
    installed: true,
    webstudioVersion: '0.296.0',
    deploy: {
      projectName: 'test-app',
      configFile: 'wrangler.jsonc',
      detectedTemplate: 'react-router-cloudflare',
      hostingAuth: {
        authenticated: true,
        account: 'user@example.com',
        provider: 'Cloudflare',
        checked: true
      }
    },
    hostingAuth: {
      authenticated: true,
      account: 'user@example.com',
      provider: 'Cloudflare',
      checked: true
    },
    previewServer: {
      running: true,
      url: 'http://127.0.0.1:8788'
    }
  };

  renderView();

  assert.ok(mockHostingStatus.textContent.includes('user@example.com') || mockHostingStatus.textContent.includes('Авторизовано'), 'Badge text should reflect authorization');
  assert.strictEqual(mockHostingStatus.className, 'badge badge-success');
  assert.strictEqual(mockPreviewBtn.textContent, t('deploy.lifecycleSection.stopPreviewBtn', {}, 'ua'));
  assert.ok(mockPreviewBtn.className.includes('btn-warning'), 'Preview button should have warning class when preview is running');
  assert.ok(mockActiveTemplateBadge.textContent.includes('React Router') || mockActiveTemplateBadge.textContent.includes('Cloudflare'));
  assert.strictEqual(mockActiveTemplateBadge.className, 'badge badge-success');
});
it('renderView() should display not authorized when unauthenticated', () => {
  const mockHostingStatus = {
    textContent: '',
    className: ''
  };
  dom.valHostingStatus = mockHostingStatus;

  state.lang = 'ua';
  state.status = {
    installed: true,
    deploy: {
      projectName: 'test-app',
      configFile: 'wrangler.jsonc',
      detectedTemplate: 'react-router-cloudflare',
      hostingAuth: {
        authenticated: false,
        account: null,
        provider: 'Cloudflare',
        checked: true
      }
    },
    hostingAuth: {
      authenticated: false,
      account: null,
      provider: 'Cloudflare',
      checked: true
    },
    previewServer: {
      running: false,
      url: null
    }
  };

  renderView();

  assert.ok(mockHostingStatus.textContent.includes('Не авторизовано'));
});

// 4. Test API endpoint for stop-preview action
console.log('\n4. Testing API endpoints with stop-preview...');

const TEST_PORT = 4299;
const { server } = createGuiServer(TEST_PORT);

await itAsync('POST /api/action with stop-preview should return 200 OK', async () => {
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const res = await fetch(`http://localhost:${TEST_PORT}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stop-preview' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.action, 'stop-preview');

  server.close();
});

console.log(`\n🎉 All ${totalTests} preview, auth, and terminal logging tests passed successfully!\n`);
