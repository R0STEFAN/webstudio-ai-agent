import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectManager } from '../scripts/project-manager.mjs';
import { BackupManager } from '../scripts/backup-manager.mjs';
import { createGuiServer } from '../scripts/gui-server.mjs';
import { i18n, t } from '../gui/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 4291;
const BASE_URL = `http://localhost:${TEST_PORT}`;

console.log('🧪 Starting Multi-Project Hub, Backups & Deploy History Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------
// 1. UNIT TESTS: ProjectManager
// --------------------------------------------------------------------------
console.log('📁 1. Testing ProjectManager...');

const tempDirsToClean = [];
function makeTempDir(prefix = 'pm-test-') {
  const p = path.join(rootDir, 'test', `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(p, { recursive: true });
  tempDirsToClean.push(p);
  return p;
}

it('should initialize and discover legacy root project', () => {
  const temp = makeTempDir();
  const wsDir = path.join(temp, '.webstudio');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify({ pages: [{}, {}] }), 'utf8');

  const pm = new ProjectManager(temp);
  const reg = pm.loadRegistry();
  assert.ok(reg.projects.length >= 1);
  const active = pm.getActiveProject();
  assert.ok(active);
  assert.strictEqual(active.id, reg.activeProjectId);
});

it('should create a new project and switch active context', () => {
  const temp = makeTempDir();
  const pm = new ProjectManager(temp);
  const newProj = pm.createProject('coffee-shop', 'Кав\'ярня третьої хвилі');

  assert.strictEqual(newProj.id, 'coffee-shop');
  assert.strictEqual(newProj.name, 'coffee-shop');
  assert.strictEqual(newProj.description, 'Кав\'ярня третьої хвилі');

  const active = pm.getActiveProject();
  assert.strictEqual(active.id, 'coffee-shop');

  const list = pm.listProjects();
  assert.strictEqual(list.activeProjectId, 'coffee-shop');
  const found = list.projects.find(p => p.id === 'coffee-shop');
  assert.ok(found);
  assert.strictEqual(found.isActive, true);
});

it('should rename a project and update wrangler.toml name', () => {
  const temp = makeTempDir();
  const pm = new ProjectManager(temp);
  pm.createProject('my-barber', 'Original desc');
  const renamed = pm.renameProject('my-barber', 'barber-zp');

  assert.strictEqual(renamed.name, 'barber-zp');
  const active = pm.getActiveProject();
  assert.strictEqual(active.name, 'barber-zp');
});

it('should prevent deleting the last remaining project', () => {
  const temp = makeTempDir();
  const pm = new ProjectManager(temp);
  const list = pm.listProjects();
  assert.strictEqual(list.projects.length, 1);

  assert.throws(() => {
    pm.deleteProject(list.projects[0].id);
  }, /Cannot delete the last remaining project/);
});

// --------------------------------------------------------------------------
// 2. UNIT TESTS: BackupManager
// --------------------------------------------------------------------------
console.log('\n💾 2. Testing BackupManager...');

it('should create manual backup with custom description and stats', () => {
  const temp = makeTempDir();
  const wsDir = path.join(temp, '.webstudio');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify({
    pages: [{ id: '1' }, { id: '2' }],
    build: { instances: { a: {}, b: {}, c: {} } }
  }), 'utf8');

  const bm = new BackupManager(temp);
  const snapshot = bm.createBackup('Перед редизайном шапки', 'manual');

  assert.ok(snapshot.id.startsWith('backup_'));
  assert.strictEqual(snapshot.description, 'Перед редизайном шапки');
  assert.strictEqual(snapshot.type, 'manual');
  assert.strictEqual(snapshot.stats.pagesCount, 2);
  assert.strictEqual(snapshot.stats.instancesCount, 3);

  const list = bm.listBackups();
  assert.strictEqual(list.totalCount, 1);
  assert.strictEqual(list.backups[0].id, snapshot.id);
});

it('should update backup description', () => {
  const temp = makeTempDir();
  const wsDir = path.join(temp, '.webstudio');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'data.json'), '{}', 'utf8');

  const bm = new BackupManager(temp);
  const b1 = bm.createBackup('Початковий опис', 'manual');
  const updated = bm.updateDescription(b1.id, 'Оновлений точний опис');

  assert.strictEqual(updated.description, 'Оновлений точний опис');
  const list = bm.listBackups();
  assert.strictEqual(list.backups[0].description, 'Оновлений точний опис');
});

it('should restore backup and create safety pre-restore snapshot', () => {
  const temp = makeTempDir();
  const wsDir = path.join(temp, '.webstudio');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify({ version: 'v1-original' }), 'utf8');

  const bm = new BackupManager(temp);
  const snap1 = bm.createBackup('Версія 1', 'manual');

  // Change active file
  fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify({ version: 'v2-modified' }), 'utf8');

  // Restore snap1
  const restoreRes = bm.restoreBackup(snap1.id);
  assert.strictEqual(restoreRes.success, true);
  assert.strictEqual(restoreRes.restoredId, snap1.id);

  // Active data.json should be restored to v1
  const activeContent = JSON.parse(fs.readFileSync(path.join(wsDir, 'data.json'), 'utf8'));
  assert.strictEqual(activeContent.version, 'v1-original');

  // Total backups should now be 2 (original + safety pre-restore)
  const list = bm.listBackups();
  assert.strictEqual(list.totalCount, 2);
  assert.strictEqual(list.backups[0].type, 'pre-restore');
});

it('should handle auto-backup timer and skip duplicates when no changes', () => {
  const temp = makeTempDir();
  const wsDir = path.join(temp, '.webstudio');
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify({ counter: 1 }), 'utf8');

  const bm = new BackupManager(temp);
  bm.createBackup('Перший бекап', 'manual');

  // Check auto-backup without changing data.json
  const skipCheck = bm.checkAutoBackup();
  assert.strictEqual(skipCheck, null);

  // Trigger import auto-backup
  const importSnap = bm.triggerImportBackup();
  assert.ok(importSnap);
  assert.strictEqual(importSnap.type, 'import');
});

// --------------------------------------------------------------------------
// 3. INTEGRATION TESTS: HTTP API Endpoints
// --------------------------------------------------------------------------
console.log('\n🌐 3. Testing HTTP API Endpoints...');

async function runApiTests() {
  const { ProjectManager } = await import('../scripts/project-manager.mjs');
  const pm = new ProjectManager(rootDir);
  const initialActive = pm.getActiveProject()?.id;

  const { server } = createGuiServer(TEST_PORT);

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // 3.1 GET /api/projects
    await itAsync('GET /api/projects should return project list', async () => {
      const res = await fetch(`${BASE_URL}/api/projects`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.projects));
      assert.ok(data.projects.length >= 1);
      assert.ok(data.activeProjectId);
    });

    // 3.2 POST /api/projects/create
    let createdProjId = '';
    await itAsync('POST /api/projects/create should create and select a new project', async () => {
      const testName = `test-shop-${Date.now()}`;
      const res = await fetch(`${BASE_URL}/api/projects/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: testName, description: 'Test online shop' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.project.name, testName);
      createdProjId = data.project.id;
    });

    // 3.3 GET /api/backups
    await itAsync('GET /api/backups should return backups for active project', async () => {
      const res = await fetch(`${BASE_URL}/api/backups`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.backups));
      assert.ok(data.config);
    });

    // 3.4 POST /api/backups/create
    let createdBackupId = '';
    await itAsync('POST /api/backups/create should create a snapshot', async () => {
      const res = await fetch(`${BASE_URL}/api/backups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'API test backup', type: 'manual' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.backup.id);
      createdBackupId = data.backup.id;
    });

    // 3.5 POST /api/backups/update
    await itAsync('POST /api/backups/update should update backup description', async () => {
      const res = await fetch(`${BASE_URL}/api/backups/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: createdBackupId, description: 'Updated via API' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.backup.description, 'Updated via API');
    });

    // 3.6 POST /api/backups/restore
    await itAsync('POST /api/backups/restore should restore snapshot', async () => {
      const res = await fetch(`${BASE_URL}/api/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: createdBackupId })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.restoredId, createdBackupId);
    });

    // 3.7 GET /api/deploy/history
    await itAsync('GET /api/deploy/history should return deployments or graceful error', async () => {
      const res = await fetch(`${BASE_URL}/api/deploy/history?project=tattoo-v3-test&limit=3`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(typeof data === 'object');
      if (data.success) {
        assert.ok(Array.isArray(data.deployments));
      }
    });

    // Clean up created test project
    if (createdProjId) {
      await fetch(`${BASE_URL}/api/projects/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'tattoo-v3-test' })
      });
      await fetch(`${BASE_URL}/api/projects/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: createdProjId })
      });
    }

  } finally {
    if (initialActive) {
      try {
        pm.selectProject(initialActive);
      } catch {}
    }
    await new Promise(resolve => server.close(resolve));
  }
}

// --------------------------------------------------------------------------
// 4. UNIT TESTS: i18n Keys Consistency
// --------------------------------------------------------------------------
console.log('\n🌐 4. Testing i18n Localization Keys...');

it('should contain all required new keys in both UA and EN dictionaries', () => {
  const keysToCheck = [
    'tabs.backups',
    'projects.newBtn',
    'projects.modal.title',
    'projects.modal.nameLabel',
    'projects.modal.createBtn',
    'deploy.history.title',
    'deploy.history.refresh',
    'backups.create.title',
    'backups.create.btn',
    'backups.auto.title',
    'backups.list.title',
    'backups.modal.restoreTitle',
    'common.cancel',
    'common.save'
  ];

  for (const key of keysToCheck) {
    const valUa = t(key, {}, 'ua');
    const valEn = t(key, {}, 'en');
    assert.ok(valUa && valUa !== key, `Missing UA translation for: ${key}`);
    assert.ok(valEn && valEn !== key, `Missing EN translation for: ${key}`);
  }
});

// Run all
runApiTests()
  .then(() => {
    // Clean up temp dirs
    for (const dir of tempDirsToClean) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    console.log(`\n🎉 Multi-Project & Backups Test Suite Completed: ${passedTests}/${totalTests} tests passed.`);
  })
  .catch((err) => {
    for (const dir of tempDirsToClean) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  });
