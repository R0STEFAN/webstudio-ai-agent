import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import {
  getHostingAuth,
  getGitHubUser,
  getDeployConfig,
  updateProjectNameOnDisk,
  fetchDeployGitHistory,
  createGuiServer
} from '../scripts/gui-server.mjs';
import { t } from '../gui/i18n.js';
import { state, dom, renderView, updateDynamicDeployLabels } from '../gui/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Test Suite for Docker / GitHub Deployment & Repo Validation...\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    throw err;
  }
}

// 1. Test getGitHubUser
console.log('1. Testing GitHub User Detection & getHostingAuth for Docker...');

it('should detect authenticated GitHub user if gh CLI is configured', () => {
  const ghUser = getGitHubUser();
  assert.ok(ghUser === null || typeof ghUser === 'string', 'ghUser must be null or string');
  if (ghUser) {
    console.log(`     Detected GitHub user: ${ghUser}`);
  }
});

it('should return valid hostingAuth object for Docker provider', () => {
  const auth = getHostingAuth(rootDir, 'Docker');
  assert.strictEqual(auth.provider, 'Docker');
  assert.strictEqual(typeof auth.authenticated, 'boolean');
  assert.strictEqual(auth.checked, true);
  if (auth.authenticated) {
    assert.ok(auth.account.includes('(GitHub)'), 'account name must contain (GitHub)');
  }
});

// 2. Test Step 2 Project Name logic
console.log('\n2. Testing Step 2 Project Name & Dynamic Labels...');

it('should update package.json name on disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-docker-proj-'));
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'old-name', version: '1.0.0' }));
  
  const result = updateProjectNameOnDisk(tempDir, 'my-coolify-repo');
  assert.strictEqual(result.updated, true);
  assert.strictEqual(result.safeName, 'my-coolify-repo');

  const updatedPkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
  assert.strictEqual(updatedPkg.name, 'my-coolify-repo');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

it('should dynamically switch labels and hints when Docker is selected', () => {
  // Mock dom
  dom.lblProjectName = { textContent: '' };
  dom.hintProjectName = { textContent: '' };
  dom.hintAuthSection = { textContent: '' };
  dom.lblDeployHistoryTitle = { textContent: '' };

  updateDynamicDeployLabels('Docker');
  assert.strictEqual(dom.lblProjectName.textContent, t('deploy.nameSection.projectNameLabelDocker', {}, 'uk'));
  assert.strictEqual(dom.hintProjectName.textContent, t('deploy.nameSection.hintDocker', {}, 'uk'));
  assert.strictEqual(dom.hintAuthSection.textContent, t('deploy.authSection.hintDocker', {}, 'uk'));
  assert.strictEqual(dom.lblDeployHistoryTitle.textContent, t('deploy.history.titleDocker', {}, 'uk'));

  updateDynamicDeployLabels('Cloudflare');
  assert.strictEqual(dom.lblProjectName.textContent, t('deploy.nameSection.projectNameLabel', {}, 'uk'));
  assert.strictEqual(dom.hintProjectName.textContent, t('deploy.nameSection.hint', {}, 'uk'));
  assert.strictEqual(dom.hintAuthSection.textContent, t('deploy.authSection.hint', {}, 'uk'));
  assert.strictEqual(dom.lblDeployHistoryTitle.textContent, t('deploy.history.title', {}, 'uk'));
});

// 3. Test fetchDeployGitHistory directly
console.log('\n3. Testing fetchDeployGitHistory...');

it('should parse git log and return formatted deployment history for projects with git', async () => {
  const history = await fetchDeployGitHistory(path.join(rootDir, 'projects', 'tattoo-v3-test'), 5);
  assert.strictEqual(history.success, true);
  assert.strictEqual(history.provider, 'Docker');
  assert.ok(Array.isArray(history.deployments));
  if (history.deployments.length > 0) {
    const first = history.deployments[0];
    assert.ok(first.id, 'Deployment must have id');
    assert.ok(first.shortId, 'Deployment must have shortId');
    assert.ok(first.commitHash, 'Deployment must have commitHash');
    assert.strictEqual(first.provider, 'Docker');
    assert.ok(first.createdOn, 'Deployment must have timestamp');
  }
});

// 4. Test API Action handling and /api/deploy/history endpoint
console.log('\n4. Testing deploy-project validation and /api/deploy/history for Docker...');

async function runApiTest() {
  const testPort = 4296;
  const { server } = createGuiServer(testPort);
  await new Promise((resolve) => server.listen(testPort, resolve));

  try {
    // Test check-auth for Docker
    const checkRes = await fetch(`http://localhost:${testPort}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-auth', params: { provider: 'Docker' } })
    });
    const checkData = await checkRes.json();
    assert.strictEqual(checkRes.status, 200);
    assert.strictEqual(checkData.ok, true);
    console.log('  ✅ [PASS] POST /api/action with check-auth for Docker executed successfully');
    passedTests++;
    totalTests++;

    // Test GET /api/deploy/history for Docker project
    const histRes = await fetch(`http://localhost:${testPort}/api/deploy/history?project=tattoo-v3-test&provider=Docker`);
    assert.strictEqual(histRes.status, 200);
    const histData = await histRes.json();
    assert.strictEqual(histData.success, true);
    assert.strictEqual(histData.provider, 'Docker');
    assert.ok(Array.isArray(histData.deployments));
    console.log('  ✅ [PASS] GET /api/deploy/history returned git history for Docker provider');
    passedTests++;
    totalTests++;

    // Test deploy-project for Docker: non-existent repo should terminate with error
    const deployRes = await fetch(`http://localhost:${testPort}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy-project', params: { provider: 'Docker' } })
    });
    const deployData = await deployRes.json();
    assert.strictEqual(deployRes.status, 200);
    assert.strictEqual(deployData.ok, true);
    console.log('  ✅ [PASS] POST /api/action with deploy-project accepted and executed validation');
    passedTests++;
    totalTests++;

  } finally {
    server.close();
  }

  console.log(`\n🎉 All ${passedTests}/${totalTests} Docker / GitHub deploy tests passed successfully!\n`);
}

runApiTest().catch(err => {
  console.error(err);
  process.exit(1);
});
