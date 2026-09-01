import assert from 'node:assert';
import { i18n, t } from '../gui/i18n.js';
import { ansiToHtml, state, dom, appendLog, setLanguage, switchTab, applyTranslations, renderView, updateButtonStates } from '../gui/app.js';

console.log('🧪 Running Task 2 & GUI i18n verification tests...\n');

// 1. Verify i18n Root Dictionaries
console.log('1. Verifying i18n Root Objects...');
assert.ok(i18n.ua, 'i18n.ua must be defined');
assert.ok(i18n.en, 'i18n.en must be defined');
assert.strictEqual(typeof i18n.ua, 'object');
assert.strictEqual(typeof i18n.en, 'object');
console.log('   ✅ Root dictionaries present.');

// Helper to recursively collect all dot-notation keys
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getAllKeys(v, currentPath));
    } else {
      keys.push(currentPath);
    }
  }
  return keys;
}

const uaKeys = getAllKeys(i18n.ua).sort();
const enKeys = getAllKeys(i18n.en).sort();

// 2. Verify 100% Key Parity between UA and EN
console.log('\n2. Verifying 100% Key Parity between UA and EN...');
const missingInEn = uaKeys.filter(k => !enKeys.includes(k));
const missingInUa = enKeys.filter(k => !uaKeys.includes(k));

assert.strictEqual(missingInEn.length, 0, `Keys present in UA but missing in EN: ${missingInEn.join(', ')}`);
assert.strictEqual(missingInUa.length, 0, `Keys present in EN but missing in UA: ${missingInUa.join(', ')}`);
assert.strictEqual(uaKeys.length, enKeys.length, 'Key counts must match exactly');
console.log(`   ✅ Exact parity confirmed across all ${uaKeys.length} translation keys.`);

// 3. Verify Required Acceptance Dictionary Keys
console.log('\n3. Verifying Required Acceptance Keys (Workspace & Deploy)...');
const requiredKeys = [
  'appTitle',
  'appSubtitle',
  'langSwitch',
  'tabs.workspace',
  'tabs.deploy',
  'firstRun.title',
  'firstRun.description',
  'firstRun.installBtn',
  'firstRun.installing',
  'firstRun.note',
  'workspace.projectSection.title',
  'workspace.projectSection.shareLink',
  'workspace.projectSection.shareLinkPlaceholder',
  'workspace.projectSection.buildId',
  'workspace.projectSection.buildIdPlaceholder',
  'workspace.projectSection.buildIdHint',
  'workspace.projectSection.linkBtn',
  'workspace.projectSection.syncBtn',
  'workspace.projectSection.syncDraftBtn',
  'workspace.projectSection.linking',
  'workspace.projectSection.syncing',
  'workspace.sessionSection.title',
  'workspace.sessionSection.cookie',
  'workspace.sessionSection.cookiePlaceholder',
  'workspace.sessionSection.csrfToken',
  'workspace.sessionSection.csrfTokenPlaceholder',
  'workspace.sessionSection.saveBtn',
  'workspace.sessionSection.saving',
  'workspace.sessionSection.saved',
  'workspace.sessionSection.helpToggle',
  'workspace.sessionSection.helpText',
  'workspace.cloudSection.title',
  'workspace.cloudSection.uploadAssetsBtn',
  'workspace.cloudSection.uploading',
  'workspace.cloudSection.importBtn',
  'workspace.cloudSection.importing',
  'workspace.telemetry.title',
  'workspace.telemetry.status',
  'workspace.telemetry.connected',
  'workspace.telemetry.notConnected',
  'workspace.telemetry.projectId',
  'workspace.telemetry.pages',
  'workspace.telemetry.instances',
  'workspace.telemetry.assets',
  'workspace.telemetry.localMcp',
  'workspace.telemetry.active',
  'workspace.telemetry.inactive',
  'workspace.terminal.title',
  'workspace.terminal.clear',
  'workspace.terminal.copy',
  'workspace.terminal.copied',
  'workspace.terminal.autoScroll',
  'workspace.terminal.ready',
  'workspace.footer.installedVersion',
  'workspace.footer.notInstalled',
  'workspace.footer.checkUpdatesBtn',
  'workspace.footer.checking',
  'workspace.footer.upToDate',
  'workspace.footer.updateAvailable',
  'workspace.footer.updateNowBtn',
  'workspace.footer.updating',
  'deploy.templateSection.title',
  'deploy.templateSection.presetLabel',
  'deploy.templateSection.presets.react-router-cloudflare',
  'deploy.templateSection.presets.remix-cloudflare',
  'deploy.templateSection.presets.react-router-vercel',
  'deploy.templateSection.presets.react-router-netlify',
  'deploy.templateSection.presets.react-router-docker',
  'deploy.templateSection.presets.ssg',
  'deploy.templateSection.presets.ssg-vercel',
  'deploy.templateSection.presets.ssg-netlify',
  'deploy.templateSection.generateBtn',
  'deploy.templateSection.generating',
  'deploy.templateSection.hint',
  'deploy.nameSection.title',
  'deploy.nameSection.projectNameLabel',
  'deploy.nameSection.placeholder',
  'deploy.nameSection.applyBtn',
  'deploy.nameSection.applied',
  'deploy.nameSection.detectedConfig',
  'deploy.nameSection.hint',
  'deploy.authSection.title',
  'deploy.authSection.statusLabel',
  'deploy.authSection.checkStatusBtn',
  'deploy.authSection.loginBtn',
  'deploy.authSection.checking',
  'deploy.authSection.authorized',
  'deploy.authSection.notAuthorized',
  'deploy.authSection.hint',
  'deploy.lifecycleSection.title',
  'deploy.lifecycleSection.installBtn',
  'deploy.lifecycleSection.buildBtn',
  'deploy.lifecycleSection.previewBtn',
  'deploy.lifecycleSection.deployBtn',
  'deploy.lifecycleSection.installing',
  'deploy.lifecycleSection.building',
  'deploy.lifecycleSection.previewing',
  'deploy.lifecycleSection.deploying',
  'deploy.lifecycleSection.hint',
  'deploy.telemetry.title',
  'deploy.telemetry.currentTemplate',
  'deploy.telemetry.targetHosting',
  'deploy.telemetry.configFiles',
  'deploy.telemetry.scriptsCount',
  'deploy.telemetry.lastBuild',
  'messages.validationError',
  'messages.shareLinkRequired',
  'messages.buildIdRequired',
  'messages.sessionSaved',
  'messages.projectNameUpdated',
  'messages.templateGenerated',
  'messages.actionError',
  'messages.networkError',
  'messages.actionStarted',
  'messages.actionSuccess',
  'messages.actionFailed'
];

for (const key of requiredKeys) {
  assert.ok(uaKeys.includes(key), `Required key '${key}' missing from UA`);
  assert.ok(enKeys.includes(key), `Required key '${key}' missing from EN`);
}
console.log(`   ✅ All ${requiredKeys.length} required acceptance keys present in both languages.`);

// 4. Verify t() Function Lookup & Interpolation
console.log('\n4. Verifying t() Translation & Interpolation Engine...');

// Direct key
assert.strictEqual(t('appTitle', {}, 'ua'), 'Webstudio Control Center');
assert.strictEqual(t('appTitle', {}, 'en'), 'Webstudio Control Center');

// Tabs keys
assert.strictEqual(t('tabs.workspace', {}, 'ua'), '⚡ Керування проєктом');
assert.strictEqual(t('tabs.workspace', {}, 'en'), '⚡ Project Workspace');
assert.strictEqual(t('tabs.deploy', {}, 'ua'), '🚀 Деплой та Шаблони');
assert.strictEqual(t('tabs.deploy', {}, 'en'), '🚀 Build & Deploy');

// Deploy keys
assert.strictEqual(t('deploy.templateSection.title', {}, 'ua'), '1. Вибір шаблону фреймворку');
assert.strictEqual(t('deploy.templateSection.title', {}, 'en'), '1. Framework & Target Template');
assert.strictEqual(t('deploy.templateSection.presets.react-router-cloudflare', {}, 'ua'), '⚡ React Router v7 + Cloudflare Workers');
assert.strictEqual(t('deploy.templateSection.presets.ssg', {}, 'en'), '📄 Static Site (SSG / Vike)');

// Nested key
assert.strictEqual(t('workspace.terminal.clear', {}, 'ua'), 'Очистити');
assert.strictEqual(t('workspace.terminal.clear', {}, 'en'), 'Clear');

// Variable interpolation single var
const uaVersion = t('workspace.footer.installedVersion', { version: '0.296.0' }, 'ua');
const enVersion = t('workspace.footer.installedVersion', { version: '0.296.0' }, 'en');
assert.strictEqual(uaVersion, 'Webstudio CLI: v0.296.0');
assert.strictEqual(enVersion, 'Webstudio CLI: v0.296.0');

// Deploy variable interpolations
const uaConfig = t('deploy.nameSection.detectedConfig', { file: 'wrangler.jsonc' }, 'ua');
const enConfig = t('deploy.nameSection.detectedConfig', { file: 'wrangler.jsonc' }, 'en');
assert.strictEqual(uaConfig, 'Конфігураційний файл: wrangler.jsonc');
assert.strictEqual(enConfig, 'Configuration file: wrangler.jsonc');

const uaAuth = t('deploy.authSection.authorized', { account: 'user@example.com' }, 'ua');
const enAuth = t('deploy.authSection.authorized', { account: 'user@example.com' }, 'en');
assert.strictEqual(uaAuth, 'Авторизовано (user@example.com)');
assert.strictEqual(enAuth, 'Authorized (user@example.com)');

const uaProjectName = t('messages.projectNameUpdated', { name: 'my-webstudio-app' }, 'ua');
const enProjectName = t('messages.projectNameUpdated', { name: 'my-webstudio-app' }, 'en');
assert.strictEqual(uaProjectName, 'Назву проєкту успішно оновлено на: my-webstudio-app');
assert.strictEqual(enProjectName, 'Project name successfully updated to: my-webstudio-app');

const uaTmplGen = t('messages.templateGenerated', { preset: 'react-router-cloudflare' }, 'ua');
const enTmplGen = t('messages.templateGenerated', { preset: 'react-router-cloudflare' }, 'en');
assert.strictEqual(uaTmplGen, 'Код за шаблоном react-router-cloudflare успішно згенеровано!');
assert.strictEqual(enTmplGen, 'Template react-router-cloudflare code successfully generated!');

// Multiple variable interpolation
const uaFailed = t('messages.actionFailed', { action: 'sync', code: 127 }, 'ua');
const enFailed = t('messages.actionFailed', { action: 'sync', code: 127 }, 'en');
assert.strictEqual(uaFailed, 'Дія sync завершилася з помилкою (код 127).');
assert.strictEqual(enFailed, 'Action sync failed with code 127.');

// Non-existent key fallback
assert.strictEqual(t('unknown.nested.key', {}, 'ua'), 'unknown.nested.key');
assert.strictEqual(t('', {}, 'ua'), '');
assert.strictEqual(t(null, {}, 'ua'), '');

console.log('   ✅ Translation lookup and variable interpolation work accurately.');

// 5. Verify ansiToHtml Helper
console.log('\n5. Verifying ANSI to HTML Formatter...');
const rawAnsi = '\x1b[1m\x1b[32m[SUCCESS]\x1b[0m \x1b[31mError:\x1b[0m <script>alert("xss")</script> \x1b[94mInfo\x1b[0m';
const html = ansiToHtml(rawAnsi);
assert.ok(html.includes('<span class="ansi-bold">'), 'Must convert bold ANSI code');
assert.ok(html.includes('<span class="ansi-green">'), 'Must convert green ANSI code');
assert.ok(html.includes('<span class="ansi-red">'), 'Must convert red ANSI code');
assert.ok(html.includes('<span class="ansi-bright-blue">'), 'Must convert bright blue ANSI code');
assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'), 'Must escape HTML tags');
assert.ok(!html.includes('\x1b['), 'Must strip raw escape codes');
console.log('   ✅ ANSI styling and HTML sanitization verified.');

// 6. Verify State Object & Language Switcher
console.log('\n6. Verifying Application State and Language Controller...');
setLanguage('en');
assert.strictEqual(state.lang, 'en', 'State lang must update to en');
setLanguage('ua');
assert.strictEqual(state.lang, 'ua', 'State lang must update to ua');
setLanguage('invalid');
assert.strictEqual(state.lang, 'ua', 'Invalid lang must fallback to ua');

assert.strictEqual(state.isRunning, false, 'isRunning default must be false');
assert.strictEqual(state.autoScroll, true, 'autoScroll default must be true');

// Verify appendLog capping
state.logs = [];
for (let i = 0; i < 2600; i++) {
  appendLog(`Log entry ${i}`, 'stdout');
}
assert.ok(state.logs.length <= 2500, `Logs length must be capped, got ${state.logs.length}`);
console.log('   ✅ Reactive state defaults and memory cap verified.');

// 7. Verify Task 3: Tab Switching Controller & Deploy Telemetry
console.log('\n7. Verifying Task 3: Tab Switching Controller & Deploy Telemetry...');

// Test switchTab updates state
switchTab('deploy');
assert.strictEqual(state.currentTab, 'deploy', 'switchTab("deploy") must update state.currentTab to "deploy"');
switchTab('workspace');
assert.strictEqual(state.currentTab, 'workspace', 'switchTab("workspace") must update state.currentTab to "workspace"');
switchTab('non-existent');
assert.strictEqual(state.currentTab, 'workspace', 'switchTab with invalid tab must fallback to "workspace"');

// Test DOM updates in simulated DOM environment
{
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
        toggle(c, force) { if (force !== undefined) { force ? this.add(c) : this.remove(c); } else { this.contains(c) ? this.remove(c) : this.add(c); } }
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

  dom.selectTemplatePreset = createMockEl('select-template-preset', 'select');
  dom.inputProjectName = createMockEl('input-project-name', 'input');
  dom.valDetectedConfig = createMockEl('val-detected-config', 'span');
  dom.valDeployTemplate = createMockEl('val-deploy-template', 'span');
  dom.valDeployHosting = createMockEl('val-deploy-hosting', 'span');
  dom.valDeployConfigFile = createMockEl('val-deploy-config-file', 'span');
  dom.valDeployScriptsCount = createMockEl('val-deploy-scripts-count', 'span');

  // Test switchTab toggles CSS classes
  switchTab('deploy');
  assert.ok(dom.btnTabDeploy.classList.contains('active'), 'Deploy tab button must have active class');
  assert.ok(!dom.btnTabWorkspace.classList.contains('active'), 'Workspace tab button must not have active class');
  assert.ok(!dom.tabViewDeploy.classList.contains('hidden'), 'Deploy tab view must not have hidden class');
  assert.ok(dom.tabViewWorkspace.classList.contains('hidden'), 'Workspace tab view must have hidden class');

  switchTab('workspace');
  assert.ok(dom.btnTabWorkspace.classList.contains('active'), 'Workspace tab button must have active class');
  assert.ok(!dom.btnTabDeploy.classList.contains('active'), 'Deploy tab button must not have active class');
  assert.ok(!dom.tabViewWorkspace.classList.contains('hidden'), 'Workspace tab view must not have hidden class');
  assert.ok(dom.tabViewDeploy.classList.contains('hidden'), 'Deploy tab view must have hidden class');

  // Test applyTranslations populates selectTemplatePreset options
  state.lang = 'en';
  applyTranslations();
  assert.strictEqual(dom.selectTemplatePreset.options.length, 8, 'Must populate all 8 preset options in EN');
  assert.strictEqual(dom.selectTemplatePreset.options[0].value, 'react-router-cloudflare');
  assert.strictEqual(dom.selectTemplatePreset.options[0].textContent, '⚡ React Router v7 + Cloudflare Workers');

  state.lang = 'ua';
  dom.selectTemplatePreset.value = 'remix-cloudflare';
  applyTranslations();
  assert.strictEqual(dom.selectTemplatePreset.options.length, 8, 'Must populate all 8 preset options in UA');
  assert.strictEqual(dom.selectTemplatePreset.value, 'remix-cloudflare', 'Must preserve selected value when switching languages');

  // Test renderView updates deploy telemetry
  state.status = {
    installed: true,
    webstudioVersion: '0.296.0',
    projectId: 'test-project-123',
    deploy: {
      projectName: 'my-custom-cf-app',
      configFile: 'wrangler.jsonc',
      detectedTemplate: 'react-router-cloudflare',
      availableScripts: ['build', 'preview', 'deploy']
    }
  };

  renderView();
  assert.strictEqual(state.deploy.projectName, 'my-custom-cf-app');
  assert.strictEqual(dom.inputProjectName.value, 'my-custom-cf-app');
  assert.strictEqual(dom.valDeployConfigFile.textContent, 'wrangler.jsonc');
  assert.strictEqual(dom.valDeployScriptsCount.textContent, '3');
  assert.strictEqual(dom.valDeployHosting.textContent, 'Cloudflare');
  assert.strictEqual(dom.valDeployTemplate.textContent, '⚡ React Router v7 + Cloudflare Workers');
  assert.strictEqual(dom.valDetectedConfig.textContent, 'Конфігураційний файл: wrangler.jsonc');

  delete globalThis.document;
}

console.log('   ✅ Tab switching, preset dropdown population, and deploy telemetry binding verified.');

console.log('\n🎉 ALL TASK 2 & TASK 3 UNIT TESTS PASSED SUCCESSFULLY!\n');
