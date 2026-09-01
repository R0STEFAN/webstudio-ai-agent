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
  createGuiServer
} from '../scripts/gui-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 4296;
const BASE_URL = `http://localhost:${TEST_PORT}`;

console.log('🧪 Starting Task 1: Deployment Server & Template Dispatcher Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. UNIT TESTS: TEMPLATE_PRESETS Dictionary
// -------------------------------------------------------------
console.log('📦 1. Testing TEMPLATE_PRESETS Dictionary...');

it('should export all 8 predefined template presets with correct CLI flags', () => {
  assert.strictEqual(typeof TEMPLATE_PRESETS, 'object', 'TEMPLATE_PRESETS should be an object');
  
  assert.deepStrictEqual(TEMPLATE_PRESETS['react-router-cloudflare'], ['react-router', 'react-router-cloudflare']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['remix-cloudflare'], ['cloudflare']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['react-router-vercel'], ['react-router', 'react-router-vercel']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['react-router-netlify'], ['react-router', 'react-router-netlify']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['react-router-docker'], ['react-router', 'react-router-docker']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['ssg'], ['ssg']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['ssg-vercel'], ['ssg', 'ssg-vercel']);
  assert.deepStrictEqual(TEMPLATE_PRESETS['ssg-netlify'], ['ssg', 'ssg-netlify']);

  assert.strictEqual(Object.keys(TEMPLATE_PRESETS).length, 8);
});

// -------------------------------------------------------------
// 2. UNIT TESTS: getDeployConfig()
// -------------------------------------------------------------
console.log('\n🔍 2. Testing getDeployConfig()...');

const tempDirsToClean = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-deploy-test-'));
  tempDirsToClean.push(dir);
  return dir;
}

it('should detect wrangler.jsonc with React Router + Cloudflare template and project name', () => {
  const tempDir = makeTempDir();
  fs.writeFileSync(
    path.join(tempDir, 'wrangler.jsonc'),
    '{\n  "name": "my-rr-cf-app",\n  "compatibility_date": "2024-09-01"\n}',
    'utf8'
  );

  const config = getDeployConfig(tempDir);
  assert.strictEqual(config.projectName, 'my-rr-cf-app');
  assert.strictEqual(config.configFile, 'wrangler.jsonc');
  assert.strictEqual(config.detectedTemplate, 'react-router-cloudflare');
  assert.strictEqual(config.hasWrangler, true);
  assert.deepStrictEqual(config.availableScripts, []);
});

it('should detect wrangler.toml with Remix + Cloudflare template and project name', () => {
  const tempDir = makeTempDir();
  fs.writeFileSync(
    path.join(tempDir, 'wrangler.toml'),
    'name = "my-remix-app"\ncompatibility_date = "2024-09-01"\n',
    'utf8'
  );

  const config = getDeployConfig(tempDir);
  assert.strictEqual(config.projectName, 'my-remix-app');
  assert.strictEqual(config.configFile, 'wrangler.toml');
  assert.strictEqual(config.detectedTemplate, 'remix-cloudflare');
  assert.strictEqual(config.hasWrangler, true);
});

it('should detect vercel.json, netlify.toml, and Dockerfile', () => {
  const tempVercel = makeTempDir();
  fs.writeFileSync(path.join(tempVercel, 'vercel.json'), '{}', 'utf8');
  assert.strictEqual(getDeployConfig(tempVercel).configFile, 'vercel.json');
  assert.strictEqual(getDeployConfig(tempVercel).detectedTemplate, 'react-router-vercel');

  const tempNetlify = makeTempDir();
  fs.writeFileSync(path.join(tempNetlify, 'netlify.toml'), '', 'utf8');
  assert.strictEqual(getDeployConfig(tempNetlify).configFile, 'netlify.toml');
  assert.strictEqual(getDeployConfig(tempNetlify).detectedTemplate, 'react-router-netlify');

  const tempDocker = makeTempDir();
  fs.writeFileSync(path.join(tempDocker, 'Dockerfile'), 'FROM node:20', 'utf8');
  assert.strictEqual(getDeployConfig(tempDocker).configFile, 'Dockerfile');
  assert.strictEqual(getDeployConfig(tempDocker).detectedTemplate, 'react-router-docker');
});

it('should extract projectName and availableScripts from package.json', () => {
  const tempDir = makeTempDir();
  const pkgData = {
    name: 'custom-webstudio-site',
    scripts: {
      build: 'react-router build',
      preview: 'react-router preview',
      deploy: 'wrangler deploy'
    },
    dependencies: {
      '@react-router/cloudflare': '^7.0.0'
    }
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgData, null, 2), 'utf8');

  const config = getDeployConfig(tempDir);
  assert.strictEqual(config.projectName, 'custom-webstudio-site');
  assert.strictEqual(config.configFile, 'package.json');
  assert.strictEqual(config.detectedTemplate, 'react-router-cloudflare');
  assert.deepStrictEqual(config.availableScripts, ['build', 'preview', 'deploy']);
});

it('should return safe fallback defaults for empty directory', () => {
  const tempDir = makeTempDir();
  const config = getDeployConfig(tempDir);
  assert.strictEqual(config.projectName, 'webstudio-app');
  assert.strictEqual(config.configFile, 'none');
  assert.strictEqual(config.detectedTemplate, 'unknown');
  assert.deepStrictEqual(config.availableScripts, []);
});

// -------------------------------------------------------------
// 3. UNIT TESTS: updateProjectNameOnDisk()
// -------------------------------------------------------------
console.log('\n✏️ 3. Testing updateProjectNameOnDisk()...');

it('should sanitize and update project name across wrangler.jsonc, wrangler.toml, and package.json', () => {
  const tempDir = makeTempDir();
  
  fs.writeFileSync(path.join(tempDir, 'wrangler.jsonc'), '{\n  "name": "old-name"\n}', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'wrangler.toml'), 'name = "old-name"\n', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'old-name' }, null, 2), 'utf8');

  const res = updateProjectNameOnDisk(tempDir, 'My Awesome_Project 2026!');
  assert.strictEqual(res.updated, true);
  assert.strictEqual(res.safeName, 'my-awesome_project-2026-');

  // Verify file contents
  const jsonc = fs.readFileSync(path.join(tempDir, 'wrangler.jsonc'), 'utf8');
  assert.match(jsonc, /"name":\s*"my-awesome_project-2026-"/);

  const toml = fs.readFileSync(path.join(tempDir, 'wrangler.toml'), 'utf8');
  assert.match(toml, /name\s*=\s*"my-awesome_project-2026-"/);

  const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'my-awesome_project-2026-');
});

it('should handle invalid or empty names gracefully', () => {
  const tempDir = makeTempDir();
  const res1 = updateProjectNameOnDisk(tempDir, '');
  assert.strictEqual(res1.updated, false);
  assert.strictEqual(res1.safeName, '');

  const res2 = updateProjectNameOnDisk(tempDir, null);
  assert.strictEqual(res2.updated, false);
  assert.strictEqual(res2.safeName, '');
});

// -------------------------------------------------------------
// 4. INTEGRATION TESTS: HTTP API Endpoints (/api/status & /api/action)
// -------------------------------------------------------------
console.log('\n🌐 4. Testing GUI Server API Endpoints...');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, headers: res.headers, data };
}

async function runServerTests() {
  const { server } = createGuiServer(TEST_PORT);

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    await itAsync('GET /api/status should include deploy metadata in response', async () => {
      const { status, data } = await fetchJson(`${BASE_URL}/api/status`);
      assert.strictEqual(status, 200);
      assert.ok(data.deploy, 'status response must have deploy property');
      assert.strictEqual(typeof data.deploy.projectName, 'string');
      assert.strictEqual(typeof data.deploy.configFile, 'string');
      assert.strictEqual(typeof data.deploy.detectedTemplate, 'string');
      assert.ok(Array.isArray(data.deploy.availableScripts));
      assert.strictEqual(typeof data.deploy.hasWrangler, 'boolean');
      assert.strictEqual(typeof data.deploy.hasBuildDir, 'boolean');
    });

    await itAsync('POST /api/action with update-project-name should execute and return ok', async () => {
      const { status, data } = await fetchJson(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-project-name',
          params: { projectName: 'test-demo-app' }
        })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.action, 'update-project-name');
    });

    await itAsync('POST /api/action should accept generate-template action', async () => {
      const { status, data } = await fetchJson(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-template',
          params: { templatePreset: 'react-router-cloudflare' }
        })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.action, 'generate-template');
    });

    await itAsync('POST /api/action should accept check-auth action', async () => {
      const { status, data } = await fetchJson(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-auth'
        })
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.action, 'check-auth');
    });

    await itAsync('POST /api/action should accept build-project, preview-project, deploy-project actions', async () => {
      for (const act of ['build-project', 'preview-project', 'deploy-project']) {
        const { status, data } = await fetchJson(`${BASE_URL}/api/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: act })
        });
        assert.strictEqual(status, 200);
        assert.strictEqual(data.ok, true);
        assert.strictEqual(data.action, act);
      }
    });

  } finally {
    // Teardown server
    await new Promise((resolve) => server.close(resolve));

    // Cleanup temp dirs
    for (const dir of tempDirsToClean) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }
}

runServerTests()
  .then(() => {
    console.log(`\n🎉 Task 1 Tests Completed: ${passedTests}/${totalTests} passed.`);
    if (process.exitCode === 1) {
      console.error('💥 Some tests failed!');
      process.exit(1);
    } else {
      console.log('✨ All tests passed successfully with exit code 0.');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('💥 Fatal error in test runner:', err);
    process.exit(1);
  });
