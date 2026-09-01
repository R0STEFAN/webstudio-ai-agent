import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGuiServer, sseClients } from '../scripts/gui-server.mjs';
import { i18n, t } from '../gui/i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 4295;
const BASE_URL = `http://localhost:${TEST_PORT}`;

console.log('🧪 Starting Task 6: End-to-End GUI Integration & Smoke Test Suite...\n');

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
        // Stream closed or error
      }
    }
  }

  waitForEvent(predicate, timeoutMs = 5000) {
    // Check already received events
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

async function runTests() {
  const { server } = createGuiServer(TEST_PORT);

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, () => resolve());
    server.on('error', reject);
  });

  console.log(`🌐 Test GUI Server listening on ${BASE_URL}\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Static Files Delivery & MIME Types
    // -------------------------------------------------------------
    const staticFiles = [
      { path: '/', mime: 'text/html; charset=utf-8', contains: 'Webstudio Control Center' },
      { path: '/index.html', mime: 'text/html; charset=utf-8', contains: 'class="main-container"' },
      { path: '/styles.css', mime: 'text/css; charset=utf-8', contains: '--bg-canvas' },
      { path: '/i18n.js', mime: 'text/javascript; charset=utf-8', contains: 'export const i18n' },
      { path: '/app.js', mime: 'text/javascript; charset=utf-8', contains: 'export async function initApp' }
    ];

    for (const file of staticFiles) {
      const res = await fetch(`${BASE_URL}${file.path}`);
      assert.strictEqual(res.status, 200, `GET ${file.path} must return 200 OK`);
      const contentType = res.headers.get('content-type');
      assert.strictEqual(contentType, file.mime, `GET ${file.path} Content-Type mismatch`);
      const body = await res.text();
      assert.ok(body.includes(file.contains), `GET ${file.path} content must include "${file.contains}"`);
    }
    console.log('   ✅ All static assets (HTML, CSS, JS modules) served with exact MIME types.');

    // -------------------------------------------------------------
    // Test 2: Status API (GET /api/status)
    // -------------------------------------------------------------
    console.log('\n2. Verifying System Status API (GET /api/status)...');

    const statusRes = await fetch(`${BASE_URL}/api/status`);
    assert.strictEqual(statusRes.status, 200, 'GET /api/status must return 200 OK');
    const statusContentType = statusRes.headers.get('content-type');
    assert.strictEqual(statusContentType, 'application/json; charset=utf-8');

    const statusData = await statusRes.json();

    // Validate JSON schema
    assert.strictEqual(typeof statusData.installed, 'boolean', 'status.installed must be boolean');
    assert.ok(statusData.webstudioVersion === null || typeof statusData.webstudioVersion === 'string', 'status.webstudioVersion must be string or null');
    assert.ok(statusData.latestVersion === null || typeof statusData.latestVersion === 'string', 'status.latestVersion must be string or null');
    assert.strictEqual(typeof statusData.updateAvailable, 'boolean', 'status.updateAvailable must be boolean');
    assert.ok(statusData.projectId === null || typeof statusData.projectId === 'string', 'status.projectId must be string or null');
    assert.strictEqual(typeof statusData.origin, 'string', 'status.origin must be string');
    assert.strictEqual(typeof statusData.hasAuthToken, 'boolean', 'status.hasAuthToken must be boolean');
    assert.strictEqual(typeof statusData.hasSession, 'boolean', 'status.hasSession must be boolean');
    assert.strictEqual(typeof statusData.projectStats, 'object', 'status.projectStats must be an object');
    assert.strictEqual(typeof statusData.projectStats.pages, 'number', 'projectStats.pages must be a number');
    assert.strictEqual(typeof statusData.projectStats.instances, 'number', 'projectStats.instances must be a number');
    assert.strictEqual(typeof statusData.projectStats.assets, 'number', 'projectStats.assets must be a number');

    console.log('   ✅ Status API returns valid schema:', {
      installed: statusData.installed,
      webstudioVersion: statusData.webstudioVersion,
      projectId: statusData.projectId,
      hasSession: statusData.hasSession,
      projectStats: statusData.projectStats
    });

    // -------------------------------------------------------------
    // Test 3: SSE Log Stream (GET /api/logs)
    // -------------------------------------------------------------
    console.log('\n3. Verifying SSE Log Stream (GET /api/logs)...');

    const sseClient = new SseTestClient(`${BASE_URL}/api/logs`);
    await sseClient.connect();

    const connectEvent = await sseClient.waitForEvent(e => e.event === 'connected', 4000);
    assert.ok(connectEvent, 'Must receive "connected" SSE event');
    assert.ok(connectEvent.data.message.includes('Connected to Webstudio Control Center logs stream'), 'Must contain welcome message');
    assert.ok(connectEvent.data.timestamp, 'Connected event must include timestamp');
    console.log('   ✅ SSE log stream established and "connected" event received successfully.');

    // -------------------------------------------------------------
    // Test 4: Action Dispatcher & SSE Streaming (POST /api/action: check-updates)
    // -------------------------------------------------------------
    console.log('\n4. Verifying Action Dispatcher with check-updates & Real-Time SSE Log Streaming...');

    const actionRes = await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-updates' })
    });

    assert.strictEqual(actionRes.status, 200, 'POST /api/action must return 200 OK');
    const actionResult = await actionRes.json();
    assert.deepStrictEqual(actionResult, { ok: true, action: 'check-updates' });

    // Await log event and complete event via SSE
    const logEvent = await sseClient.waitForEvent(
      e => e.event === 'log' && (typeof e.data.text === 'string' && e.data.text.includes('Checking for Webstudio updates')),
      5000
    );
    assert.ok(logEvent, 'Must receive check-updates log stream event');

    const completeEvent = await sseClient.waitForEvent(
      e => e.event === 'complete' && e.data.action === 'check-updates',
      6000
    );
    assert.ok(completeEvent, 'Must receive complete SSE event for check-updates');
    assert.strictEqual(completeEvent.data.action, 'check-updates');
    assert.strictEqual(typeof completeEvent.data.success, 'boolean');
    assert.strictEqual(typeof completeEvent.data.code, 'number');
    console.log('   ✅ Action check-updates dispatched and streamed log & complete events to SSE client.');

    // -------------------------------------------------------------
    // Test 5: Session Storage Action (POST /api/action: save-session)
    // -------------------------------------------------------------
    console.log('\n5. Verifying Session Storage Action & Disk Persistence...');

    const sessionFilePath = path.join(rootDir, '.webstudio', 'session.json');
    let originalSessionBackup = null;
    if (fs.existsSync(sessionFilePath)) {
      originalSessionBackup = fs.readFileSync(sessionFilePath, 'utf8');
    }

    const testCookie = 'test-auth-session-cookie-xyz-12345';
    const testCsrf = 'test-csrf-token-abc-67890';

    try {
      const saveRes = await fetch(`${BASE_URL}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-session',
          params: { cookie: testCookie, csrfToken: testCsrf }
        })
      });

      assert.strictEqual(saveRes.status, 200, 'POST save-session must return 200 OK');
      const saveResult = await saveRes.json();
      assert.deepStrictEqual(saveResult, { ok: true, action: 'save-session' });

      const sessionComplete = await sseClient.waitForEvent(
        e => e.event === 'complete' && e.data.action === 'save-session',
        3000
      );
      assert.strictEqual(sessionComplete.data.success, true);
      assert.strictEqual(sessionComplete.data.code, 0);

      // Verify file written to disk
      assert.ok(fs.existsSync(sessionFilePath), '.webstudio/session.json must exist on disk');
      const savedContent = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
      assert.strictEqual(savedContent.cookie, testCookie, 'Saved cookie must match test input');
      assert.strictEqual(savedContent.csrfToken, testCsrf, 'Saved csrfToken must match test input');

      // Verify status endpoint reflects hasSession === true
      const postSaveStatus = await (await fetch(`${BASE_URL}/api/status`)).json();
      assert.strictEqual(postSaveStatus.hasSession, true, 'hasSession must be true after saving session');

      console.log('   ✅ Session credentials saved, persisted to .webstudio/session.json, and verified via status API.');
    } finally {
      // Restore original session file
      if (originalSessionBackup !== null) {
        fs.writeFileSync(sessionFilePath, originalSessionBackup, 'utf8');
      } else if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
      }
    }

    // -------------------------------------------------------------
    // Test 6: Draft Sync Action & Share Link Extraction Logic
    // -------------------------------------------------------------
    console.log('\n6. Verifying Draft Sync Action & Share Link Parameter Parsing...');

    // Test URL format A: Subdomain format with query params
    const shareLinkA = 'https://p-my-draft-proj-123.apps.webstudio.is/builder?authToken=auth-tok-789&buildId=build-custom-456';
    const draftResA = await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync-draft',
        params: { shareLink: shareLinkA }
      })
    });
    assert.strictEqual(draftResA.status, 200);

    const syncDraftLogA = await sseClient.waitForEvent(
      e => e.event === 'log' && typeof e.data.text === 'string' && e.data.text.includes('npx webstudio sync') && e.data.text.includes('--buildId "build-custom-456"'),
      4000
    );
    assert.ok(syncDraftLogA, 'Must stream sync command with parsed buildId');
    assert.ok(syncDraftLogA.data.text.includes('--origin "https://p-my-draft-proj-123.apps.webstudio.is"'), 'Must include parsed origin');
    assert.ok(syncDraftLogA.data.text.includes('--authToken "auth-tok-789"'), 'Must include parsed authToken');

    // Test URL format B: Path format
    const shareLinkB = 'https://apps.webstudio.is/project/project-uuid-999?authToken=tok-path-555&buildId=build-path-777';
    await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync-draft',
        params: { shareLink: shareLinkB }
      })
    });

    const syncDraftLogB = await sseClient.waitForEvent(
      e => e.event === 'log' && typeof e.data.text === 'string' && e.data.text.includes('--origin "https://p-project-uuid-999.apps.webstudio.is"'),
      4000
    );
    assert.ok(syncDraftLogB, 'Must stream sync command with transformed project path origin');

    console.log('   ✅ Draft sync accurately extracts origin, authToken, and buildId across multiple link formats.');

    // -------------------------------------------------------------
    // Test 7: Error Handling & Boundary Security Tests
    // -------------------------------------------------------------
    console.log('\n7. Verifying Error Handling, Unknown Actions, and Security Boundaries...');

    // 7.1 Missing action parameter
    const missingActionRes = await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(missingActionRes.status, 400, 'Missing action must return 400 Bad Request');
    const missingActionJson = await missingActionRes.json();
    assert.deepStrictEqual(missingActionJson, { error: 'Action is required' });

    // 7.2 Invalid JSON syntax
    const badJsonRes = await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json syntax }'
    });
    assert.strictEqual(badJsonRes.status, 400, 'Malformed JSON must return 400 Bad Request');
    const badJsonBody = await badJsonRes.json();
    assert.deepStrictEqual(badJsonBody, { error: 'Invalid JSON payload' });

    // 7.3 Unknown action requested
    const unknownActionRes = await fetch(`${BASE_URL}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'non-existent-action-xyz' })
    });
    assert.strictEqual(unknownActionRes.status, 200, 'Unknown action returns 200 with dispatched status');
    const unknownComplete = await sseClient.waitForEvent(
      e => e.event === 'complete' && e.data.action === 'non-existent-action-xyz',
      3000
    );
    assert.strictEqual(unknownComplete.data.success, false, 'Unknown action must report failure');
    assert.strictEqual(unknownComplete.data.code, 1, 'Unknown action must report exit code 1');

    // 7.4 Nonexistent API route
    const notFoundApiRes = await fetch(`${BASE_URL}/api/non-existent-endpoint`);
    assert.strictEqual(notFoundApiRes.status, 404, 'Unknown API route must return 404');
    const notFoundApiJson = await notFoundApiRes.json();
    assert.deepStrictEqual(notFoundApiJson, { error: 'API endpoint not found' });

    // 7.5 Nonexistent static file
    const notFoundFileRes = await fetch(`${BASE_URL}/nonexistent-page-404.html`);
    assert.strictEqual(notFoundFileRes.status, 404, 'Unknown static file must return 404');
    const notFoundFileText = await notFoundFileRes.text();
    assert.strictEqual(notFoundFileText, 'File Not Found');

    // 7.6 Directory traversal prevention
    const traversalRes = await fetch(`${BASE_URL}/../package.json`);
    assert.ok(
      traversalRes.status === 403 || traversalRes.status === 404,
      `Directory traversal attempt must return 403 or 404, got ${traversalRes.status}`
    );

    console.log('   ✅ Error handling, input validation, and directory traversal protections verified.');

    // -------------------------------------------------------------
    // Test 8: Bilingual Dictionary Verification (UA / EN)
    // -------------------------------------------------------------
    console.log('\n8. Verifying Bilingual Dictionary Consistency & Translation Engine...');
    assert.ok(i18n.ua && i18n.en, 'Both UA and EN dictionaries must exist');
    assert.strictEqual(t('appTitle', {}, 'ua'), 'Webstudio Control Center');
    assert.strictEqual(t('appTitle', {}, 'en'), 'Webstudio Control Center');
    assert.strictEqual(t('workspace.terminal.clear', {}, 'ua'), 'Очистити');
    assert.strictEqual(t('workspace.terminal.clear', {}, 'en'), 'Clear');
    assert.strictEqual(t('workspace.projectSection.syncBtn', {}, 'ua'), '🔄 Синхронізувати проєкт');
    assert.strictEqual(t('workspace.projectSection.syncBtn', {}, 'en'), '🔄 Sync Project');
    console.log('   ✅ Bilingual localization engine operating consistently.');

    // Clean up SSE client
    sseClient.close();

    console.log('\n🎉 ALL TASK 6 END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    // Teardown server cleanly
    if (server.listening) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ TASK 6 TEST SUITE FAILED:', err);
  process.exit(1);
});
