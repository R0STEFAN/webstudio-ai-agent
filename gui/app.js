/**
 * Webstudio Control Center — Reactive Client State Controller
 * Zero-dependency ES module handling UI state, SSE log streaming, i18n binding, and REST actions.
 */

import { i18n, t } from './i18n.js';

function getInitialLang() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ws_gui_lang') || localStorage.getItem('ws_lang') || 'ua';
    }
  } catch {}
  return 'ua';
}

function getInitialTab() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ws_active_tab') || 'workspace';
    }
  } catch {}
  return 'workspace';
}

// Global application state
export const state = {
  lang: getInitialLang(),
  currentTab: getInitialTab(),
  status: null,
  deploy: null,
  logs: [],
  isRunning: false,
  currentAction: null,
  autoScroll: true,
  sseConnected: false
};

// DOM Cache & Helpers
export const dom = {
  // Header
  headerMcpStatus: null,
  headerMcpPill: null,

  // Tab Navigation & Views
  btnTabProjects: null,
  btnTabWorkspace: null,
  btnTabDeploy: null,
  btnTabBackups: null,
  tabViewProjects: null,
  tabViewWorkspace: null,
  tabViewDeploy: null,
  tabViewBackups: null,
  firstRunView: null,
  workspaceView: null,

  // Multi-Project Header & Tab Elements
  valHeaderActiveProject: null,
  projectHeaderBadge: null,
  inputQuickProjectName: null,
  inputQuickProjectDesc: null,
  btnCreateProjectSubmit: null,
  projectsListContainer: null,
  badgeProjectsTotal: null,
  btnRefreshProjects: null,
  modalNewProject: null,
  inputNewProjectName: null,
  inputNewProjectDesc: null,
  btnConfirmCreateProject: null,
  btnCancelNewProject: null,
  btnCloseNewProjectModal: null,
  // Backups View & Modals
  inputBackupDescription: null,
  btnCreateBackup: null,
  checkAutoBackupTimer: null,
  selectBackupInterval: null,
  checkAutoBackupImport: null,
  badgeBackupsTotal: null,
  btnRefreshBackups: null,
  backupsListContainer: null,
  modalEditBackupDesc: null,
  editBackupId: null,
  inputEditBackupDesc: null,
  btnConfirmSaveDesc: null,
  btnCancelEditDesc: null,
  btnCloseEditDescModal: null,
  modalConfirmRestore: null,
  restoreTargetBackupId: null,
  valRestoreTargetName: null,
  btnConfirmExecuteRestore: null,
  btnCancelRestore: null,
  btnCloseRestoreModal: null,

  // Deploy History
  deployHistoryList: null,
  btnRefreshDeployHistory: null,
  // Terminal
  terminalOutput: null,
  setupTerminalOutput: null,
  terminalContainer: null,
  setupTerminalContainer: null,
  terminalStatus: null,
  btnClearTerminal: null,
  btnCopyTerminal: null,
  btnToggleAutoScroll: null,
  
  // Inputs
  inputShareLink: null,
  inputBuildId: null,
  inputCookie: null,
  inputCsrfToken: null,
  
  // Action Buttons
  btnInstall: null,
  btnLink: null,
  btnSync: null,
  btnSyncDraft: null,
  btnSaveSession: null,
  btnUploadAssets: null,
  btnImport: null,
  btnCheckUpdates: null,
  btnUpdateNow: null,
  btnHelpToggle: null,
  sessionHelpBox: null,
  
  // Deploy Form Elements
  selectTemplatePreset: null,
  btnGenerateTemplate: null,
  btnCleanTemplate: null,
  valActiveTemplateBadge: null,
  inputProjectName: null,
  btnUpdateProjectName: null,
  valDetectedConfig: null,
  valHostingStatus: null,
  btnCheckAuth: null,
  btnLoginAuth: null,
  btnDeployInstall: null,
  btnDeployBuild: null,
  btnDeployPreview: null,
  btnDeployPublish: null,
  valDeployTemplate: null,
  valDeployHosting: null,
  valDeployConfigFile: null,
  valDeployScriptsCount: null,

  // Telemetry
  telemetryProjectId: null,
  telemetryPages: null,
  telemetryInstances: null,
  telemetryAssets: null,
  telemetryStatusBadge: null,
  telemetryLocalMcp: null,
  
  // Footer
  footerVersion: null,
  footerUpdateContainer: null,
  footerUpdateBadge: null,
  footerUpdateBtn: null,
  
  // Language toggles
  langBtns: [],
  
  // Toast container
  toastContainer: null
};

/**
 * Initializes and caches all DOM elements.
 */
export function cacheDOMElements() {
  if (typeof document === 'undefined') return;

  dom.headerMcpStatus = document.getElementById('val-header-mcp-status');
  dom.headerMcpPill = document.getElementById('mcp-status-pill');

  dom.firstRunView = document.getElementById('first-run-view');
  dom.workspaceView = document.getElementById('workspace-view');

  // Tab Controls
  dom.btnTabProjects = document.getElementById('btn-tab-projects');
  dom.btnTabWorkspace = document.getElementById('btn-tab-workspace') || document.getElementById('tab-btn-workspace');
  dom.btnTabDeploy = document.getElementById('btn-tab-deploy') || document.getElementById('tab-btn-deploy');
  dom.btnTabBackups = document.getElementById('btn-tab-backups');
  dom.tabViewProjects = document.getElementById('tab-view-projects');
  dom.tabViewWorkspace = document.getElementById('tab-view-workspace');
  dom.tabViewDeploy = document.getElementById('tab-view-deploy');
  dom.tabViewBackups = document.getElementById('tab-view-backups');

  // Multi-Project Header & Tab Elements
  dom.valHeaderActiveProject = document.getElementById('val-header-active-project');
  dom.projectHeaderBadge = document.getElementById('project-header-badge');
  dom.inputQuickProjectName = document.getElementById('input-quick-project-name');
  dom.inputQuickProjectDesc = document.getElementById('input-quick-project-desc');
  dom.btnCreateProjectSubmit = document.getElementById('btn-create-project-submit');
  dom.projectsListContainer = document.getElementById('projects-list-container');
  dom.badgeProjectsTotal = document.getElementById('badge-projects-total');
  dom.btnRefreshProjects = document.getElementById('btn-refresh-projects');

  dom.modalNewProject = document.getElementById('modal-new-project');
  dom.inputNewProjectName = document.getElementById('input-new-project-name');
  dom.inputNewProjectDesc = document.getElementById('input-new-project-desc');
  dom.btnConfirmCreateProject = document.getElementById('btn-confirm-create-project');
  dom.btnCancelNewProject = document.getElementById('btn-cancel-new-project');
  dom.btnCloseNewProjectModal = document.getElementById('btn-close-new-project-modal');

  // Backups View & Modals
  dom.inputBackupDescription = document.getElementById('input-backup-description');
  dom.btnCreateBackup = document.getElementById('btn-create-backup');
  dom.checkAutoBackupTimer = document.getElementById('check-auto-backup-timer');
  dom.selectBackupInterval = document.getElementById('select-backup-interval');
  dom.checkAutoBackupImport = document.getElementById('check-auto-backup-import');
  dom.badgeBackupsTotal = document.getElementById('badge-backups-total');
  dom.btnRefreshBackups = document.getElementById('btn-refresh-backups');
  dom.backupsListContainer = document.getElementById('backups-list-container');
  dom.modalEditBackupDesc = document.getElementById('modal-edit-backup-desc');
  dom.editBackupId = document.getElementById('edit-backup-id');
  dom.inputEditBackupDesc = document.getElementById('input-edit-backup-desc');
  dom.btnConfirmSaveDesc = document.getElementById('btn-confirm-save-desc');
  dom.btnCancelEditDesc = document.getElementById('btn-cancel-edit-desc');
  dom.btnCloseEditDescModal = document.getElementById('btn-close-edit-desc-modal');
  dom.modalConfirmRestore = document.getElementById('modal-confirm-restore');
  dom.restoreTargetBackupId = document.getElementById('restore-target-backup-id');
  dom.valRestoreTargetName = document.getElementById('val-restore-target-name');
  dom.btnConfirmExecuteRestore = document.getElementById('btn-confirm-execute-restore');
  dom.btnCancelRestore = document.getElementById('btn-cancel-restore');
  dom.btnCloseRestoreModal = document.getElementById('btn-close-restore-modal');

  // Deploy History
  dom.deployHistoryList = document.getElementById('deploy-history-list');
  dom.btnRefreshDeployHistory = document.getElementById('btn-refresh-deploy-history');
  dom.terminalOutput = document.getElementById('terminal-output') || document.getElementById('setup-terminal-output');
  dom.setupTerminalOutput = document.getElementById('setup-terminal-output');
  dom.terminalContainer = document.getElementById('terminal-container') || document.getElementById('setup-terminal-container');
  dom.setupTerminalContainer = document.getElementById('setup-terminal-container');
  dom.terminalStatus = document.getElementById('terminal-status');
  dom.deployTerminalStatus = document.getElementById('deploy-terminal-status');
  dom.btnClearTerminal = document.getElementById('btn-clear-terminal') || document.getElementById('btn-clear-logs');
  dom.btnClearDeployTerminal = document.getElementById('btn-clear-deploy-logs');
  dom.btnCopyTerminal = document.getElementById('btn-copy-terminal') || document.getElementById('btn-copy-logs');
  dom.btnCopyDeployTerminal = document.getElementById('btn-copy-deploy-logs');
  dom.btnToggleAutoScroll = document.getElementById('btn-toggle-autoscroll') || document.getElementById('checkbox-autoscroll') || document.getElementById('chk-autoscroll');
  dom.chkDeployAutoScroll = document.getElementById('chk-deploy-autoscroll');
  dom.inputShareLink = document.getElementById('input-share-link');
  dom.inputBuildId = document.getElementById('input-build-id');
  dom.inputCookie = document.getElementById('input-cookie');
  dom.inputCsrfToken = document.getElementById('input-csrf-token');
  
  dom.btnInstall = document.getElementById('btn-install') || document.getElementById('install-btn');
  dom.btnLink = document.getElementById('btn-link');
  dom.btnSync = document.getElementById('btn-sync');
  dom.btnSyncDraft = document.getElementById('btn-sync-draft');
  dom.btnSaveSession = document.getElementById('btn-save-session');
  dom.btnUploadAssets = document.getElementById('btn-upload-assets');
  dom.btnImport = document.getElementById('btn-import');
  dom.btnCheckUpdates = document.getElementById('btn-check-updates');
  dom.btnUpdateNow = document.getElementById('btn-update-now') || document.getElementById('footer-update-btn');
  dom.btnHelpToggle = document.getElementById('btn-help-toggle');
  dom.sessionHelpBox = document.getElementById('help-guide-box') || document.getElementById('session-help-box') || document.getElementById('session-help-text');

  // Deploy Form Elements
  dom.selectTemplatePreset = document.getElementById('select-template-preset') || document.getElementById('select-preset');
  dom.btnGenerateTemplate = document.getElementById('btn-generate-template');
  dom.btnCleanTemplate = document.getElementById('btn-clean-template');
  dom.valActiveTemplateBadge = document.getElementById('val-active-template-badge');
  dom.inputProjectName = document.getElementById('input-project-name');
  dom.btnUpdateProjectName = document.getElementById('btn-update-project-name');
  dom.valDetectedConfig = document.getElementById('val-detected-config');
  dom.valHostingStatus = document.getElementById('val-hosting-status');
  dom.btnCheckAuth = document.getElementById('btn-check-auth');
  dom.btnLoginAuth = document.getElementById('btn-login-auth');
  dom.btnDeployInstall = document.getElementById('btn-deploy-install');
  dom.btnDeployBuild = document.getElementById('btn-deploy-build');
  dom.btnDeployPreview = document.getElementById('btn-deploy-preview');
  dom.btnDeployPublish = document.getElementById('btn-deploy-publish');
  dom.valDeployTemplate = document.getElementById('val-deploy-template');
  dom.valDeployHosting = document.getElementById('val-deploy-hosting');
  dom.valDeployConfigFile = document.getElementById('val-deploy-config-file');
  dom.valDeployScriptsCount = document.getElementById('val-deploy-scripts-count');

  dom.telemetryProjectId = document.getElementById('telemetry-project-id') || document.getElementById('val-project-id');
  dom.telemetryPages = document.getElementById('telemetry-pages') || document.getElementById('val-pages-count');
  dom.telemetryInstances = document.getElementById('telemetry-instances') || document.getElementById('val-instances-count');
  dom.telemetryAssets = document.getElementById('telemetry-assets') || document.getElementById('val-assets-count');
  dom.telemetryStatusBadge = document.getElementById('telemetry-status-badge') || document.getElementById('val-project-status');
  dom.telemetryLocalMcp = document.getElementById('telemetry-local-mcp') || document.getElementById('val-mcp-status');
  
  dom.footerVersion = document.getElementById('footer-version') || document.getElementById('val-footer-version');
  dom.footerUpdateContainer = document.getElementById('footer-update-container') || document.getElementById('container-update-available');
  dom.footerUpdateBadge = document.getElementById('footer-update-badge') || document.getElementById('val-footer-badge');
  dom.footerUpdateBtn = document.getElementById('footer-update-btn') || document.getElementById('btn-update-now');
  
  dom.langBtns = Array.from(document.querySelectorAll('[data-lang]'));
  dom.toastContainer = document.getElementById('toast-container');
}

/**
 * Changes active application language and re-translates DOM.
 * 
 * @param {'ua' | 'en'} lang - Language code
 */
export function setLanguage(lang) {
  if (lang !== 'ua' && lang !== 'en') lang = 'ua';
  state.lang = lang;
  
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ws_gui_lang', lang);
      localStorage.setItem('ws_lang', lang);
    }
  } catch {}
  
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    
    // Update active state on language switcher buttons
    if (dom.langBtns && dom.langBtns.length > 0) {
      dom.langBtns.forEach((btn) => {
        const btnLang = btn.getAttribute('data-lang');
        if (btnLang === lang) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }
  
  applyTranslations();
  renderView();
}

/**
 * Switches active dashboard tab between 'workspace' and 'deploy'.
 * 
 * @param {'projects' | 'workspace' | 'deploy' | 'backups'} tabId - Tab identifier
 */
export function switchTab(tabId) {
  if (tabId !== 'projects' && tabId !== 'workspace' && tabId !== 'deploy' && tabId !== 'backups') tabId = 'workspace';
  state.currentTab = tabId;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ws_active_tab', tabId);
    }
  } catch {}

  if (typeof document !== 'undefined') {
    if (dom.btnTabProjects) dom.btnTabProjects.classList.toggle('active', tabId === 'projects');
    if (dom.btnTabWorkspace) dom.btnTabWorkspace.classList.toggle('active', tabId === 'workspace');
    if (dom.btnTabDeploy) dom.btnTabDeploy.classList.toggle('active', tabId === 'deploy');
    if (dom.btnTabBackups) dom.btnTabBackups.classList.toggle('active', tabId === 'backups');

    if (dom.tabViewProjects) dom.tabViewProjects.classList.toggle('hidden', tabId !== 'projects');
    if (dom.tabViewWorkspace) dom.tabViewWorkspace.classList.toggle('hidden', tabId !== 'workspace');
    if (dom.tabViewDeploy) dom.tabViewDeploy.classList.toggle('hidden', tabId !== 'deploy');
    if (dom.tabViewBackups) dom.tabViewBackups.classList.toggle('hidden', tabId !== 'backups');

    if (tabId === 'projects') {
      fetchProjects();
    } else if (tabId === 'backups') {
      fetchBackups();
    } else if (tabId === 'deploy') {
      fetchDeployHistory();
    }
  }
}

/**
 * Traverses DOM and updates all elements with translation directives:
 * - data-i18n: updates textContent (or innerHTML if data-i18n-html="true")
 * - data-i18n-placeholder: updates placeholder attribute
 * - data-i18n-title: updates title attribute
 */
export function applyTranslations() {
  if (typeof document === 'undefined') return;

  // Translate text content
  const translatableElements = document.querySelectorAll('[data-i18n]');
  translatableElements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    
    const translated = t(key, {}, state.lang);
    if (el.getAttribute('data-i18n-html') === 'true') {
      el.innerHTML = translated;
    } else {
      el.textContent = translated;
    }
  });
  
  // Translate input placeholders
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key, {}, state.lang));
    }
  });
  
  // Translate element titles/tooltips
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  titleElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key, {}, state.lang));
    }
  });

  // Populate deploy template presets dropdown while preserving selected value
  if (dom.selectTemplatePreset) {
    const currentValue = dom.selectTemplatePreset.value;
    const presets = i18n[state.lang]?.deploy?.templateSection?.presets || {};
    const PRIMARY_PRESETS = [
      'react-router-cloudflare',
      'remix-cloudflare',
      'react-router-vercel',
      'react-router-netlify',
      'react-router-docker',
      'ssg',
      'ssg-vercel',
      'ssg-netlify'
    ];

    // Clear and rebuild options
    dom.selectTemplatePreset.innerHTML = '';
    for (const presetKey of PRIMARY_PRESETS) {
      const presetLabel = presets[presetKey];
      if (!presetLabel) continue;
      const option = document.createElement('option');
      option.value = presetKey;
      option.textContent = presetLabel;
      dom.selectTemplatePreset.appendChild(option);
    }

    // Preserve previously selected value or default to first option
    if (currentValue && presets[currentValue]) {
      dom.selectTemplatePreset.value = currentValue;
    } else if (dom.selectTemplatePreset.options && dom.selectTemplatePreset.options.length > 0) {
      dom.selectTemplatePreset.selectedIndex = 0;
    }
  }
}

/**
 * Converts ANSI terminal escape sequences into HTML spans for styled console output.
 * 
 * @param {string} text - Raw terminal text with ANSI escape codes
 * @returns {string} Safe HTML string with ANSI color classes
 */
export function ansiToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  // 1. Strip DEC Private Mode escape sequences (\x1b[?25h, \x1b[?25l) and bare artifacts ([?25h, [?25l)
  let cleaned = text
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[\?[0-9;]+[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;]*[ABCDEFGHJKSTfsulh]/g, '');

  // 2. HTML escape
  let escaped = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
    
  // 3. ANSI colors map
  const ansiCodes = [
    { code: /\x1b\[0m|\x1b\[39m|\x1b\[49m/g, html: '</span>' },
    { code: /\x1b\[1m/g, html: '<span class="ansi-bold">' },
    { code: /\x1b\[2m/g, html: '<span class="ansi-dim">' },
    { code: /\x1b\[30m/g, html: '<span class="ansi-black">' },
    { code: /\x1b\[31m/g, html: '<span class="ansi-red">' },
    { code: /\x1b\[32m/g, html: '<span class="ansi-green">' },
    { code: /\x1b\[33m/g, html: '<span class="ansi-yellow">' },
    { code: /\x1b\[34m/g, html: '<span class="ansi-blue">' },
    { code: /\x1b\[35m/g, html: '<span class="ansi-magenta">' },
    { code: /\x1b\[36m/g, html: '<span class="ansi-cyan">' },
    { code: /\x1b\[37m/g, html: '<span class="ansi-white">' },
    { code: /\x1b\[90m/g, html: '<span class="ansi-gray">' },
    { code: /\x1b\[91m/g, html: '<span class="ansi-bright-red">' },
    { code: /\x1b\[92m/g, html: '<span class="ansi-bright-green">' },
    { code: /\x1b\[93m/g, html: '<span class="ansi-bright-yellow">' },
    { code: /\x1b\[94m/g, html: '<span class="ansi-bright-blue">' },
    { code: /\x1b\[95m/g, html: '<span class="ansi-bright-magenta">' },
    { code: /\x1b\[96m/g, html: '<span class="ansi-bright-cyan">' },
    { code: /\x1b\[97m/g, html: '<span class="ansi-bright-white">' },
    // Catch any remaining unhandled ANSI CSI escape sequences
    { code: /\x1b\[[0-9;?]*[a-zA-Z]/g, html: '' },
    { code: /\x1b/g, html: '' }
  ];
  
  for (const item of ansiCodes) {
    escaped = escaped.replace(item.code, item.html);
  }
  
  return escaped;
}

/**
 * Formats a timestamp into HH:MM:SS string.
 */
function formatTime(isoString) {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toTimeString().split(' ')[0];
  } catch {
    return new Date().toTimeString().split(' ')[0];
  }
}

/**
 * Appends a log line to the live terminal viewer and state.
 * 
 * @param {string} text - Log text
 * @param {'stdout' | 'stderr' | 'system'} [type='stdout'] - Stream source type
 * @param {string} [timestamp] - ISO timestamp string
 */
export function appendLog(text, type = 'stdout', timestamp = null) {
  if (!text) return;
  
  const time = formatTime(timestamp);
  state.logs.push({ text, type, timestamp: timestamp || new Date().toISOString() });
  
  // Cap logs in memory
  if (state.logs.length > 2500) {
    state.logs.splice(0, 500);
  }
  
  if (typeof document === 'undefined') return;

  const outputs = document.querySelectorAll('#terminal-output, #setup-terminal-output, #deploy-terminal-output, .terminal-output');
  if (!outputs.length) return;

  const htmlFormatted = ansiToHtml(text);

  outputs.forEach((output) => {
    const row = document.createElement('div');
    row.className = `terminal-line line-${type}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'terminal-timestamp';
    timeSpan.textContent = `[${time}] `;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'terminal-text';
    textSpan.innerHTML = htmlFormatted;
    
    row.appendChild(timeSpan);
    row.appendChild(textSpan);
    output.appendChild(row);
  });
  
  // Auto-scroll to bottom if enabled
  if (state.autoScroll) {
    const scrollTargets = document.querySelectorAll('#terminal-container, #setup-terminal-container, #deploy-terminal-container, #terminal-output, #setup-terminal-output, #deploy-terminal-output, .terminal-container, .terminal-output');
    scrollTargets.forEach((target) => {
      target.scrollTop = target.scrollHeight;
    });
  }
}

/**
 * Clears the terminal output and resets logs array.
 */
export function clearTerminal() {
  state.logs = [];
  if (typeof document !== 'undefined') {
    const outputs = document.querySelectorAll('#terminal-output, #setup-terminal-output, #deploy-terminal-output, .terminal-output');
    outputs.forEach((output) => {
      output.innerHTML = '';
    });
  }
  appendLog(t('workspace.terminal.ready', {}, state.lang), 'system');
}

/**
 * Copies all active terminal output to clipboard.
 */
export async function copyTerminalLogs() {
  if (!state.logs.length) return;
  
  const textToCopy = state.logs.map((l) => `[${formatTime(l.timestamp)}] ${l.text}`).join('\n');
  
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy);
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    const copyButtons = [dom.btnCopyTerminal, dom.btnCopyDeployTerminal].filter(Boolean);
    copyButtons.forEach((btn) => {
      btn.textContent = t('workspace.terminal.copied', {}, state.lang);
      btn.classList.add('copied');
    });
    setTimeout(() => {
      copyButtons.forEach((btn) => {
        btn.textContent = t('workspace.terminal.copy', {}, state.lang);
        btn.classList.remove('copied');
      });
    }, 2000);
  } catch (err) {
    console.error('Failed to copy logs:', err);
  }
}

/**
 * Shows a toast message in the UI.
 * 
 * @param {string} message - Message text
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - Notification type
 * @param {number} [duration=3500] - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  if (typeof document === 'undefined') return;

  if (!dom.toastContainer) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    dom.toastContainer = container;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  dom.toastContainer.appendChild(toast);
  
  // Trigger animation
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  } else {
    toast.classList.add('show');
  }
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * Initializes Server-Sent Events listener for real-time logs.
 */
export function initSSE() {
  if (typeof EventSource === 'undefined') return;

  const eventSource = new EventSource('/api/logs');
  
  eventSource.addEventListener('open', () => {
    state.sseConnected = true;
    document.querySelectorAll('#terminal-status, #deploy-terminal-status, .terminal-status').forEach((el) => {
      el.textContent = 'ONLINE';
      el.className = 'terminal-status online';
    });
  });
  
  eventSource.addEventListener('connected', (e) => {
    state.sseConnected = true;
    try {
      const data = JSON.parse(e.data);
      appendLog(data.message || 'Connected to Webstudio Control Center stream.', 'system');
    } catch {
      appendLog('Connected to Webstudio Control Center stream.', 'system');
    }
  });
  
  eventSource.addEventListener('log', (e) => {
    try {
      const data = JSON.parse(e.data);
      appendLog(data.text, data.type || 'stdout', data.timestamp);
    } catch (err) {
      console.error('Error parsing SSE log event:', err);
    }
  });
  
  eventSource.addEventListener('complete', (e) => {
    try {
      const data = JSON.parse(e.data);
      state.isRunning = false;
      const finishedAction = state.currentAction || data.action;
      state.currentAction = null;
      
      updateButtonStates();
      
      if (data.success) {
        showToast(t('messages.actionSuccess', { action: finishedAction || 'Action' }, state.lang), 'success');
      } else {
        showToast(t('messages.actionFailed', { action: finishedAction || 'Action', code: data.code || 1 }, state.lang), 'error');
      }
      
      // Refresh status after command completes
      fetchStatus();
    } catch (err) {
      console.error('Error parsing SSE complete event:', err);
      state.isRunning = false;
      state.currentAction = null;
      updateButtonStates();
      fetchStatus();
    }
  });
  
  eventSource.addEventListener('error', () => {
    state.sseConnected = false;
    document.querySelectorAll('#terminal-status, #deploy-terminal-status, .terminal-status').forEach((el) => {
      el.textContent = 'RECONNECTING';
      el.className = 'terminal-status reconnecting';
    });
  });
}

/**
 * Updates UI action button loading and disabled states based on state.isRunning.
 */
export function updateButtonStates() {
  const actionButtons = [
    dom.btnInstall,
    dom.btnLink,
    dom.btnSync,
    dom.btnSyncDraft,
    dom.btnSaveSession,
    dom.btnUploadAssets,
    dom.btnImport,
    dom.btnCheckUpdates,
    dom.btnUpdateNow,
    dom.btnGenerateTemplate,
    dom.btnCleanTemplate,
    dom.btnUpdateProjectName,
    dom.btnCheckAuth,
    dom.btnLoginAuth,
    dom.btnDeployInstall,
    dom.btnDeployBuild,
    dom.btnDeployPreview,
    dom.btnDeployPublish
  ].filter(Boolean);
  
  actionButtons.forEach((btn) => {
    if (state.isRunning) {
      btn.setAttribute('disabled', 'disabled');
      btn.classList.add('loading');
    } else {
      btn.removeAttribute('disabled');
      btn.classList.remove('loading');
    }
  });
  
  // Specific action button labels when running
  if (state.isRunning && state.currentAction) {
    if (state.currentAction === 'install' && dom.btnInstall) {
      dom.btnInstall.textContent = t('firstRun.installing', {}, state.lang);
    }
    if (state.currentAction === 'install' && dom.btnDeployInstall) {
      dom.btnDeployInstall.textContent = t('deploy.lifecycleSection.installing', {}, state.lang);
    }
    if (state.currentAction === 'link' && dom.btnLink) {
      dom.btnLink.textContent = t('workspace.projectSection.linking', {}, state.lang);
    }
    if ((state.currentAction === 'sync' || state.currentAction === 'sync-draft') && dom.btnSync) {
      dom.btnSync.textContent = t('workspace.projectSection.syncing', {}, state.lang);
    }
    if (state.currentAction === 'save-session' && dom.btnSaveSession) {
      dom.btnSaveSession.textContent = t('workspace.sessionSection.saving', {}, state.lang);
    }
    if (state.currentAction === 'upload-assets' && dom.btnUploadAssets) {
      dom.btnUploadAssets.textContent = t('workspace.cloudSection.uploading', {}, state.lang);
    }
    if (state.currentAction === 'import' && dom.btnImport) {
      dom.btnImport.textContent = t('workspace.cloudSection.importing', {}, state.lang);
    }
    if (state.currentAction === 'check-updates' && dom.btnCheckUpdates) {
      dom.btnCheckUpdates.textContent = t('workspace.footer.checking', {}, state.lang);
    }
    if (state.currentAction === 'update' && dom.btnUpdateNow) {
      dom.btnUpdateNow.textContent = t('workspace.footer.updating', {}, state.lang);
    }
    if (state.currentAction === 'generate-template' && dom.btnGenerateTemplate) {
      dom.btnGenerateTemplate.textContent = t('deploy.templateSection.generating', {}, state.lang);
    }
    if (state.currentAction === 'clean-template' && dom.btnCleanTemplate) {
      dom.btnCleanTemplate.textContent = t('deploy.templateSection.cleaning', {}, state.lang);
    }
    if (state.currentAction === 'update-project-name' && dom.btnUpdateProjectName) {
      dom.btnUpdateProjectName.textContent = t('deploy.nameSection.applied', {}, state.lang);
    }
    if (state.currentAction === 'check-auth' && dom.btnCheckAuth) {
      dom.btnCheckAuth.textContent = t('deploy.authSection.checking', {}, state.lang);
    }
    if (state.currentAction === 'build-project' && dom.btnDeployBuild) {
      dom.btnDeployBuild.textContent = t('deploy.lifecycleSection.building', {}, state.lang);
    }
    if (state.currentAction === 'preview-project' && dom.btnDeployPreview) {
      dom.btnDeployPreview.textContent = t('deploy.lifecycleSection.previewing', {}, state.lang);
    }
    if (state.currentAction === 'stop-preview' && dom.btnDeployPreview) {
      dom.btnDeployPreview.textContent = t('deploy.lifecycleSection.stopping', {}, state.lang);
    }
    if (state.currentAction === 'deploy-project' && dom.btnDeployPublish) {
      dom.btnDeployPublish.textContent = t('deploy.lifecycleSection.deploying', {}, state.lang);
    }
  } else {
    // Reset labels on completion
    applyTranslations();
  }
}

/**
 * Fetches current system status from /api/status.
 * 
 * @param {string|null} [provider=null] - Hosting provider to query
 * @param {string|null} [template=null] - Template preset to query
 */
export async function fetchStatus(provider = null, template = null) {
  if (typeof fetch === 'undefined') return null;

  if (!provider && !template && dom.selectTemplatePreset && typeof document !== 'undefined') {
    const sel = dom.selectTemplatePreset.value;
    if (sel) {
      template = sel;
      if (sel.includes('vercel')) provider = 'Vercel';
      else if (sel.includes('netlify')) provider = 'Netlify';
      else if (sel.includes('docker')) provider = 'Docker';
      else if (sel.includes('ssg')) provider = 'Static';
      else if (sel.includes('cloudflare')) provider = 'Cloudflare';
    }
  }

  try {
    let url = '/api/status';
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    if (template) params.set('template', template);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    state.status = data;
    if (data && data.deploy) {
      state.deploy = data.deploy;
    }
    renderView();
    return data;
  } catch (err) {
    console.error('Failed to fetch status:', err);
    appendLog(`[Network Warning] Could not fetch status: ${err.message}`, 'stderr');
    return null;
  }
}

/**
 * Renders views (First-Run vs Workspace) and updates telemetry/footer based on state.status.
 */
export function renderView() {
  if (!state.status) return;
  
  const { installed, webstudioVersion, latestVersion, updateAvailable, projectId, origin, projectStats, deploy } = state.status;
  if (deploy) {
    state.deploy = deploy;
  }
  
  // Two-Phase UI View Switching
  if (!installed) {
    if (dom.firstRunView) dom.firstRunView.classList.remove('hidden');
    if (dom.workspaceView) dom.workspaceView.classList.add('hidden');
  } else {
    if (dom.firstRunView) dom.firstRunView.classList.add('hidden');
    if (dom.workspaceView) dom.workspaceView.classList.remove('hidden');
  }

  // Active Tab Visibility
  switchTab(state.currentTab);
  
  // Header MCP Status Pill
  if (dom.headerMcpStatus) {
    dom.headerMcpStatus.textContent = t('workspace.telemetry.localMcp', {}, state.lang);
  }
  if (dom.headerMcpPill) {
    dom.headerMcpPill.title = installed
      ? `Webstudio MCP: ${t('workspace.telemetry.active', {}, state.lang)}`
      : `Webstudio MCP: ${t('workspace.telemetry.inactive', {}, state.lang)}`;
    const dot = dom.headerMcpPill.querySelector('.status-dot');
    if (dot) {
      dot.style.backgroundColor = installed ? 'var(--color-success)' : 'var(--text-muted)';
      dot.style.boxShadow = installed ? '0 0 8px var(--color-success)' : 'none';
      dot.style.animation = installed ? 'pulse-dot 2.5s infinite' : 'none';
    }
  }

  // Telemetry Card Updates
  if (dom.telemetryProjectId) {
    dom.telemetryProjectId.textContent = projectId || '—';
  }
  if (dom.telemetryPages) {
    dom.telemetryPages.textContent = String(projectStats?.pages ?? 0);
  }
  if (dom.telemetryInstances) {
    dom.telemetryInstances.textContent = String(projectStats?.instances ?? 0);
  }
  if (dom.telemetryAssets) {
    dom.telemetryAssets.textContent = String(projectStats?.assets ?? 0);
  }
  if (dom.telemetryStatusBadge) {
    if (projectId) {
      dom.telemetryStatusBadge.textContent = t('workspace.telemetry.connected', {}, state.lang);
      dom.telemetryStatusBadge.className = 'status-badge status-connected';
    } else {
      dom.telemetryStatusBadge.textContent = t('workspace.telemetry.notConnected', {}, state.lang);
      dom.telemetryStatusBadge.className = 'status-badge status-disconnected';
    }
  }
  if (dom.telemetryLocalMcp) {
    dom.telemetryLocalMcp.textContent = installed ? t('workspace.telemetry.active', {}, state.lang) : t('workspace.telemetry.inactive', {}, state.lang);
    dom.telemetryLocalMcp.className = installed ? 'badge badge-success' : 'badge badge-muted';
  }
  
  // Deploy State and Telemetry Updates
  const deployData = deploy || state.deploy;
  if (deployData) {
    // Template
    if (dom.valDeployTemplate) {
      const presets = i18n[state.lang]?.deploy?.templateSection?.presets || {};
      const templateName = presets[deployData.detectedTemplate] || deployData.detectedTemplate || '—';
      dom.valDeployTemplate.textContent = templateName;
    }
    // Active Template Badge in Card 1
    if (dom.valActiveTemplateBadge) {
      if (deployData.detectedTemplate && deployData.detectedTemplate !== 'unknown' && deployData.detectedTemplate !== 'none') {
        const presets = i18n[state.lang]?.deploy?.templateSection?.presets || {};
        const templateName = presets[deployData.detectedTemplate] || deployData.detectedTemplate;
        dom.valActiveTemplateBadge.textContent = templateName;
        dom.valActiveTemplateBadge.className = 'badge badge-success';
      } else {
        dom.valActiveTemplateBadge.textContent = t('deploy.templateSection.notGenerated', {}, state.lang);
        dom.valActiveTemplateBadge.className = 'badge badge-neutral';
      }
    }
    // Sync Preset Dropdown with detected template if present
    if (dom.selectTemplatePreset && deployData.detectedTemplate && deployData.detectedTemplate !== 'unknown' && deployData.detectedTemplate !== 'none') {
      if (typeof document !== 'undefined' && document.activeElement !== dom.selectTemplatePreset) {
        dom.selectTemplatePreset.value = deployData.detectedTemplate;
      }
    }



    // Config file
    if (dom.valDeployConfigFile) {
      dom.valDeployConfigFile.textContent = deployData.configFile || '—';
    }

    // Project name input (only if user is not actively typing/focused)
    if (dom.inputProjectName && typeof document !== 'undefined' && document.activeElement !== dom.inputProjectName) {
      if (deployData.projectName) {
        dom.inputProjectName.value = deployData.projectName;
      }
    }

    // Detected config label
    if (dom.valDetectedConfig) {
      dom.valDetectedConfig.textContent = t('deploy.nameSection.detectedConfig', { file: deployData.configFile || 'none' }, state.lang);
    }

    // Available scripts count
    if (dom.valDeployScriptsCount) {
      const count = Array.isArray(deployData.availableScripts) ? deployData.availableScripts.length : 0;
      dom.valDeployScriptsCount.textContent = String(count);
    }

    // Target Hosting
    if (dom.valDeployHosting) {
      let hosting = '—';
      if (deployData.detectedTemplate) {
        if (deployData.detectedTemplate.includes('cloudflare')) hosting = 'Cloudflare';
        else if (deployData.detectedTemplate.includes('vercel')) hosting = 'Vercel';
        else if (deployData.detectedTemplate.includes('netlify')) hosting = 'Netlify';
        else if (deployData.detectedTemplate.includes('docker')) hosting = 'Docker';
        else if (deployData.detectedTemplate.includes('ssg')) hosting = 'Static / CDN';
        else hosting = deployData.detectedTemplate;
      }
      dom.valDeployHosting.textContent = hosting;
    }
    // Hosting Auth Status Badge
    if (dom.valHostingStatus) {
      const hostingAuth = deployData.hostingAuth || state.status.hostingAuth;
      const provider = hostingAuth?.provider || 'Cloudflare';
      if (hostingAuth?.authenticated) {
        const account = hostingAuth.account || provider;
        dom.valHostingStatus.textContent = t('deploy.authSection.authorized', { account }, state.lang);
        dom.valHostingStatus.className = 'badge badge-success';
      } else if (hostingAuth?.checked && !hostingAuth?.authenticated) {
        dom.valHostingStatus.textContent = `${t('deploy.authSection.notAuthorized', {}, state.lang)} (${provider})`;
        dom.valHostingStatus.className = 'badge badge-warning';
      } else {
        dom.valHostingStatus.textContent = `${t('deploy.authSection.notChecked', {}, state.lang)} (${provider})`;
        dom.valHostingStatus.className = 'badge badge-neutral';
      }
    }
    // Preview Server State in Deploy Lifecycle
    if (dom.btnDeployPreview && !state.isRunning) {
      const isPreviewRunning = Boolean(state.status?.previewServer?.running);
      if (isPreviewRunning) {
        dom.btnDeployPreview.textContent = t('deploy.lifecycleSection.stopPreviewBtn', {}, state.lang);
        dom.btnDeployPreview.classList.remove('btn-secondary');
        dom.btnDeployPreview.classList.add('btn-warning');
      } else {
        dom.btnDeployPreview.textContent = t('deploy.lifecycleSection.previewBtn', {}, state.lang);
        dom.btnDeployPreview.classList.remove('btn-warning');
        dom.btnDeployPreview.classList.add('btn-secondary');
      }
    }
  }
  // Auto-fill Input Fields strictly from Active Project Server State
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
  if (dom.inputShareLink && activeEl !== dom.inputShareLink) {
    dom.inputShareLink.value = state.status?.savedShareLink || '';
  }

  if (dom.inputBuildId && activeEl !== dom.inputBuildId) {
    dom.inputBuildId.value = state.status?.buildId || '';
  }

  if (dom.inputCookie && activeEl !== dom.inputCookie) {
    dom.inputCookie.value = state.status?.sessionData?.cookie || '';
  }

  if (dom.inputCsrfToken && activeEl !== dom.inputCsrfToken) {
    dom.inputCsrfToken.value = state.status?.sessionData?.csrfToken || '';
  }

  if (dom.inputProjectName && activeEl !== dom.inputProjectName) {
    dom.inputProjectName.value = state.status?.deploy?.projectName || state.activeProjectId || '';
  }

  // Footer Updates
  if (dom.footerVersion) {
    if (installed && webstudioVersion) {
      dom.footerVersion.textContent = t('workspace.footer.installedVersion', { version: webstudioVersion }, state.lang);
    } else {
      dom.footerVersion.textContent = t('workspace.footer.notInstalled', {}, state.lang);
    }
  }
  
  if (dom.footerUpdateContainer || dom.footerUpdateBtn) {
    if (updateAvailable && latestVersion) {
      if (dom.footerUpdateContainer) dom.footerUpdateContainer.classList.remove('hidden');
      if (dom.footerUpdateBtn) {
        dom.footerUpdateBtn.classList.remove('hidden');
        dom.footerUpdateBtn.textContent = t('workspace.footer.updateNowBtn', { version: latestVersion }, state.lang);
      }
      if (dom.footerUpdateBadge) {
        dom.footerUpdateBadge.textContent = t('workspace.footer.updateAvailable', { version: latestVersion }, state.lang);
        dom.footerUpdateBadge.classList.remove('hidden');
      }
    } else {
      if (dom.footerUpdateBtn) dom.footerUpdateBtn.classList.add('hidden');
      if (dom.footerUpdateBadge && installed) {
        dom.footerUpdateBadge.textContent = t('workspace.footer.upToDate', {}, state.lang);
        dom.footerUpdateBadge.classList.remove('hidden');
      }
    }
  }
}

// ============================================================================
// Multi-Project API & Handlers
// ============================================================================
export async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      state.projects = data.projects || [];
      state.activeProjectId = data.activeProjectId;
      renderProjectSelector();
      renderProjectsList();
    }
  } catch {}
}

export function renderProjectSelector() {
  if (dom.valHeaderActiveProject) {
    dom.valHeaderActiveProject.textContent = state.activeProjectId || 'tattoo-v3-test';
  }

  if (!dom.selectActiveProject) return;
  dom.selectActiveProject.innerHTML = '';
  for (const proj of (state.projects || [])) {
    const opt = document.createElement('option');
    opt.value = proj.id;
    opt.textContent = proj.name || proj.id;
    if (proj.id === state.activeProjectId || proj.isActive) {
      opt.selected = true;
    }
    dom.selectActiveProject.appendChild(opt);
  }
}

export function renderProjectsList() {
  if (dom.valHeaderActiveProject) {
    dom.valHeaderActiveProject.textContent = state.activeProjectId || 'tattoo-v3-test';
  }

  if (!dom.projectsListContainer) return;
  const projects = state.projects || [];

  if (dom.badgeProjectsTotal) {
    dom.badgeProjectsTotal.textContent = `${projects.length} проєктів`;
  }

  if (projects.length === 0) {
    dom.projectsListContainer.innerHTML = `
      <div class="backups-empty-state">
        Не знайдено жодного проєкту. Створіть перший проєкт.
      </div>
    `;
    return;
  }

  dom.projectsListContainer.innerHTML = '';
  for (const p of projects) {
    const card = document.createElement('div');
    const isActive = p.id === state.activeProjectId || p.isActive;
    card.className = `project-hub-card ${isActive ? 'active' : ''}`;
    card.dataset.projectId = p.id;

    const modifiedStr = p.lastModified ? new Date(p.lastModified).toLocaleString('uk-UA') : '—';
    const activeBadge = isActive ? `<span class="project-active-badge">🟢 Активний</span>` : '';
    const isOnly = projects.length <= 1;

    card.innerHTML = `
      <div class="project-hub-header">
        <div class="project-hub-title-row">
          <span class="project-hub-icon">📁</span>
          <span class="project-hub-name">${p.name || p.id}</span>
          ${activeBadge}
        </div>
        <span class="project-modified-date" title="Дата останньої модифікації">
          🕒 ${modifiedStr}
        </span>
      </div>
      <div class="project-hub-body">
        ${p.description ? `<p class="project-hub-desc">${p.description}</p>` : ''}
        <div class="project-hub-stats">
          <span>📄 <strong>${p.pagesCount || 0}</strong> сторінок</span>
          <span>🧩 <strong>${p.instancesCount || 0}</strong> блоків</span>
          <span>🖼️ <strong>${p.assetsCount || 0}</strong> ассетів</span>
        </div>
      </div>
      <div class="project-hub-actions">
        ${isActive ? `
          <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.8; cursor: default;">
            <span>✓</span> <span>Активний</span>
          </button>
        ` : `
          <button type="button" class="btn btn-primary btn-sm btn-select-project" data-action="select-project" data-project-id="${p.id}">
            <span>⚡</span> <span>Відкрити в робочій області</span>
          </button>
        `}
        ${!isOnly ? `
          <button type="button" class="btn btn-outline btn-sm" data-action="delete-project" data-project-id="${p.id}" title="Видалити проєкт">
            <span>🗑️</span>
          </button>
        ` : ''}
      </div>
    `;

    dom.projectsListContainer.appendChild(card);
  }
}

export async function handleSelectProject(projectId) {
  if (!projectId) return;
  try {
    if (dom.inputShareLink) dom.inputShareLink.value = '';
    if (dom.inputBuildId) dom.inputBuildId.value = '';
    if (dom.inputCookie) dom.inputCookie.value = '';
    if (dom.inputCsrfToken) dom.inputCsrfToken.value = '';
    if (dom.inputProjectName) dom.inputProjectName.value = '';

    const res = await fetch('/api/projects/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    if (res.ok) {
      state.activeProjectId = projectId;
      showToast(`Проєкт перемкнуто на: ${projectId}`, 'success');
      await fetchProjects();
      await fetchStatus();
      await fetchBackups();
      await fetchDeployHistory();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleCreateProject(name, description) {
  if (!name || !name.trim()) return;
  try {
    if (dom.inputShareLink) dom.inputShareLink.value = '';
    if (dom.inputBuildId) dom.inputBuildId.value = '';
    if (dom.inputCookie) dom.inputCookie.value = '';
    if (dom.inputCsrfToken) dom.inputCsrfToken.value = '';
    if (dom.inputProjectName) dom.inputProjectName.value = '';

    const res = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description ? description.trim() : '' })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`Проєкт "${data.project.name}" успішно створено`, 'success');
      if (dom.modalNewProject) dom.modalNewProject.classList.add('hidden');
      if (dom.inputNewProjectName) dom.inputNewProjectName.value = '';
      if (dom.inputNewProjectDesc) dom.inputNewProjectDesc.value = '';
      if (dom.inputQuickProjectName) dom.inputQuickProjectName.value = '';
      if (dom.inputQuickProjectDesc) dom.inputQuickProjectDesc.value = '';
      await fetchProjects();
      await fetchStatus();
      await fetchBackups();
    } else {
      showToast(data.error || 'Не вдалося створити проєкт', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleDeleteProject(projectId) {
  if (!projectId) return;
  try {
    const res = await fetch('/api/projects/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Проєкт "${projectId}" видалено`, 'info');
      await fetchProjects();
      await fetchStatus();
      await fetchBackups();
    } else {
      showToast(data.error || 'Помилка видалення проєкту', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
// ============================================================================
// Backups API & Handlers
// ============================================================================
export async function fetchBackups() {
  if (!dom.backupsListContainer) return;
  try {
    const res = await fetch('/api/backups');
    if (res.ok) {
      const data = await res.json();
      state.backups = data.backups || [];
      state.backupsConfig = data.config || null;
      renderBackupsList();
    }
  } catch {}
}

export function renderBackupsList() {
  if (!dom.backupsListContainer) return;
  const backups = state.backups || [];

  if (dom.badgeBackupsTotal) {
    dom.badgeBackupsTotal.textContent = `${backups.length} знімків`;
  }

  if (state.backupsConfig) {
    if (dom.checkAutoBackupTimer) dom.checkAutoBackupTimer.checked = Boolean(state.backupsConfig.autoBackupEnabled);
    if (dom.selectBackupInterval) dom.selectBackupInterval.value = String(state.backupsConfig.intervalMinutes || 10);
    if (dom.checkAutoBackupImport) dom.checkAutoBackupImport.checked = Boolean(state.backupsConfig.backupOnImport);
  }

  if (backups.length === 0) {
    dom.backupsListContainer.innerHTML = `
      <div class="backups-empty-state">
        ${t('backups.list.empty', {}, state.lang) || 'Локальних бекапів ще немає. Натисніть «Забекапити поточний стан», щоб створити перший знімок.'}
      </div>
    `;
    return;
  }

  dom.backupsListContainer.innerHTML = '';
  for (const b of backups) {
    const card = document.createElement('div');
    card.className = 'backup-card';
    card.dataset.backupId = b.id;

    const pillLabels = {
      manual: 'Ручний',
      timer: 'Таймер 10хв',
      import: 'Після Import',
      'pre-restore': 'Перед відновленням'
    };
    const pillLabel = pillLabels[b.type] || b.type;

    card.innerHTML = `
      <div class="backup-card-header">
        <div class="backup-card-title-group">
          <span class="backup-name">📦 ${b.displayName}</span>
          <span class="backup-type-pill ${b.type}">${pillLabel}</span>
        </div>
      </div>
      <div class="backup-description-box">
        <span class="backup-desc-text">💬 "${b.description || 'Без опису'}"</span>
        <button type="button" class="btn-edit-desc" data-action="edit-desc" data-backup-id="${b.id}" data-current-desc="${encodeURIComponent(b.description || '')}">
          ✏️ Змінити опис
        </button>
      </div>
      <div class="backup-stats-row">
        <div class="backup-stat-chip">📄 <strong>${b.stats?.pagesCount ?? 0}</strong> Сторінок</div>
        <div class="backup-stat-chip">🧩 <strong>${b.stats?.instancesCount ?? 0}</strong> Блоків</div>
        <div class="backup-stat-chip">🖼️ <strong>${b.stats?.assetsCount ?? 0}</strong> Ассетів</div>
        <div class="backup-stat-chip">💾 <strong>${b.stats?.formattedSize || '0 B'}</strong></div>
      </div>
      <div class="backup-actions-row">
        <button type="button" class="btn btn-secondary btn-sm" data-action="restore" data-backup-id="${b.id}" data-display-name="${encodeURIComponent(b.displayName)}">
          <span>⏪</span> <span>Відновити</span>
        </button>
        <button type="button" class="btn btn-outline btn-sm" data-action="delete" data-backup-id="${b.id}" title="Видалити бекап">
          <span>🗑️</span>
        </button>
      </div>
    `;
    dom.backupsListContainer.appendChild(card);
  }
}

export async function handleCreateBackup(customDesc) {
  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: customDesc || '', type: 'manual' })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`Знімок "${data.backup.displayName}" створено`, 'success');
      if (dom.inputBackupDescription) dom.inputBackupDescription.value = '';
      await fetchBackups();
    } else {
      showToast(data.error || 'Помилка створення бекапу', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleRestoreBackup(backupId) {
  if (!backupId) return;
  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Проєкт успішно відновлено до стану: ${data.displayName}`, 'success');
      if (dom.modalConfirmRestore) dom.modalConfirmRestore.classList.add('hidden');
      await fetchStatus();
      await fetchBackups();
    } else {
      showToast(data.error || 'Помилка відновлення', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleUpdateBackupDesc(backupId, newDesc) {
  if (!backupId) return;
  try {
    const res = await fetch('/api/backups/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId, description: newDesc || '' })
    });
    if (res.ok) {
      showToast('Опис бекапу оновлено', 'success');
      if (dom.modalEditBackupDesc) dom.modalEditBackupDesc.classList.add('hidden');
      await fetchBackups();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleDeleteBackup(backupId) {
  if (!backupId) return;
  try {
    const res = await fetch('/api/backups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    if (res.ok) {
      showToast('Бекап видалено', 'info');
      await fetchBackups();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export async function handleSaveAutoBackupConfig() {
  const cfg = {
    autoBackupEnabled: dom.checkAutoBackupTimer ? dom.checkAutoBackupTimer.checked : true,
    intervalMinutes: dom.selectBackupInterval ? parseInt(dom.selectBackupInterval.value, 10) : 10,
    backupOnImport: dom.checkAutoBackupImport ? dom.checkAutoBackupImport.checked : true
  };
  try {
    await fetch('/api/backups/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
  } catch {}
}

// ============================================================================
// Deploy History API & Handler
// ============================================================================
export async function fetchDeployHistory() {
  if (!dom.deployHistoryList) return;
  try {
    const res = await fetch('/api/deploy/history');
    if (res.ok) {
      const data = await res.json();
      state.deployHistory = data.deployments || [];
      renderDeployHistory();
    }
  } catch {}
}

export function renderDeployHistory() {
  if (!dom.deployHistoryList) return;
  const list = state.deployHistory || [];

  if (list.length === 0) {
    dom.deployHistoryList.innerHTML = `
      <div class="history-empty">
        ${t('deploy.history.empty', {}, state.lang) || 'Деплоїв для цього проєкту ще немає.'}
      </div>
    `;
    return;
  }

  dom.deployHistoryList.innerHTML = '';
  for (const item of list) {
    const el = document.createElement('div');
    el.className = 'deploy-history-item';

    const timeAgo = item.createdOn ? new Date(item.createdOn).toLocaleString('uk-UA') : '';
    const badgeClass = item.isProduction ? 'production' : 'preview';
    const badgeText = item.isProduction ? '🟢 Production' : '🟡 Preview';

    el.innerHTML = `
      <div class="deploy-item-left">
        <span class="deploy-badge ${badgeClass}">${badgeText}</span>
        <div class="deploy-item-meta">
          <span class="deploy-item-branch">${item.branch || 'unknown'}</span>
          <span class="deploy-item-time">${timeAgo} ${item.commitHash ? `(${item.commitHash})` : ''}</span>
        </div>
      </div>
      <div class="deploy-item-actions">
        ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="deploy-link-btn">Переглянути ↗</a>` : ''}
      </div>
    `;
    dom.deployHistoryList.appendChild(el);
  }
}

/**
 * Dispatches an action command to POST /api/action.
 * 
 * @param {string} action - Action identifier ('install', 'sync', 'link', etc.)
 * @param {Record<string, unknown>} [params={}] - Parameters payload
 */
export async function dispatchAction(action, params = {}) {
  if (state.isRunning) {
    showToast(t('messages.validationError', {}, state.lang), 'warning');
    return;
  }
  
  state.isRunning = true;
  state.currentAction = action;
  updateButtonStates();
  
  appendLog(`\n[Action: ${action}] Dispatched...`, 'system');
  
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
  } catch (err) {
    console.error(`Action '${action}' dispatch failed:`, err);
    appendLog(`❌ Action dispatch error: ${err.message}`, 'stderr');
    showToast(t('messages.actionError', {}, state.lang) + `: ${err.message}`, 'error');
    state.isRunning = false;
    state.currentAction = null;
    updateButtonStates();
  }
}

/**
 * Sets up all UI DOM event listeners.
 */
export function setupEventListeners() {
  if (typeof document === 'undefined') return;

  // Language Switcher Buttons
  dom.langBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = btn.getAttribute('data-lang');
      if (lang) setLanguage(lang);
    });
  });

  // Tab Navigation Buttons
  if (dom.btnTabProjects) {
    dom.btnTabProjects.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('projects');
    });
  }
  if (dom.projectHeaderBadge) {
    dom.projectHeaderBadge.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('projects');
    });
  }
  if (dom.btnTabWorkspace) {
    dom.btnTabWorkspace.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('workspace');
    });
  }
  if (dom.btnTabDeploy) {
    dom.btnTabDeploy.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('deploy');
    });
  }
  if (dom.btnTabBackups) {
    dom.btnTabBackups.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('backups');
    });
  }

  // Projects Hub Tab Listeners
  if (dom.btnCreateProjectSubmit) {
    dom.btnCreateProjectSubmit.addEventListener('click', () => {
      const name = dom.inputQuickProjectName ? dom.inputQuickProjectName.value.trim() : '';
      const desc = dom.inputQuickProjectDesc ? dom.inputQuickProjectDesc.value.trim() : '';
      if (!name) {
        showToast('Вкажіть назву проєкту', 'warning');
        if (dom.inputQuickProjectName) dom.inputQuickProjectName.focus();
        return;
      }
      handleCreateProject(name, desc);
    });
  }
  if (dom.btnRefreshProjects) {
    dom.btnRefreshProjects.addEventListener('click', () => {
      fetchProjects();
    });
  }
  if (dom.projectsListContainer) {
    dom.projectsListContainer.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      const projectId = target.getAttribute('data-project-id');
      if (!projectId) return;

      if (action === 'select-project') {
        handleSelectProject(projectId);
      } else if (action === 'delete-project') {
        if (confirm(`Видалити проєкт "${projectId}" безповоротно?`)) {
          handleDeleteProject(projectId);
        }
      }
    });
  }
  // Multi-Project Selector & Modal
  if (dom.selectActiveProject) {
    dom.selectActiveProject.addEventListener('change', (e) => {
      handleSelectProject(e.target.value);
    });
  }
  if (dom.btnHeaderNewProject) {
    dom.btnHeaderNewProject.addEventListener('click', () => {
      if (dom.modalNewProject) dom.modalNewProject.classList.remove('hidden');
      if (dom.inputNewProjectName) dom.inputNewProjectName.focus();
    });
  }
  if (dom.btnCloseNewProjectModal) {
    dom.btnCloseNewProjectModal.addEventListener('click', () => {
      if (dom.modalNewProject) dom.modalNewProject.classList.add('hidden');
    });
  }
  if (dom.btnCancelNewProject) {
    dom.btnCancelNewProject.addEventListener('click', () => {
      if (dom.modalNewProject) dom.modalNewProject.classList.add('hidden');
    });
  }
  if (dom.btnConfirmCreateProject) {
    dom.btnConfirmCreateProject.addEventListener('click', () => {
      const name = dom.inputNewProjectName ? dom.inputNewProjectName.value.trim() : '';
      const desc = dom.inputNewProjectDesc ? dom.inputNewProjectDesc.value.trim() : '';
      if (!name) {
        showToast('Вкажіть назву проєкту', 'warning');
        return;
      }
      handleCreateProject(name, desc);
    });
  }

  // Backups View Listeners
  if (dom.btnCreateBackup) {
    dom.btnCreateBackup.addEventListener('click', () => {
      const desc = dom.inputBackupDescription ? dom.inputBackupDescription.value.trim() : '';
      handleCreateBackup(desc);
    });
  }
  if (dom.btnRefreshBackups) {
    dom.btnRefreshBackups.addEventListener('click', () => {
      fetchBackups();
    });
  }
  if (dom.checkAutoBackupTimer) {
    dom.checkAutoBackupTimer.addEventListener('change', handleSaveAutoBackupConfig);
  }
  if (dom.selectBackupInterval) {
    dom.selectBackupInterval.addEventListener('change', handleSaveAutoBackupConfig);
  }
  if (dom.checkAutoBackupImport) {
    dom.checkAutoBackupImport.addEventListener('change', handleSaveAutoBackupConfig);
  }

  // Backups Card Actions Delegation (Restore, Edit Desc, Delete)
  if (dom.backupsListContainer) {
    dom.backupsListContainer.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      const backupId = target.getAttribute('data-backup-id');
      if (!backupId) return;

      if (action === 'restore') {
        const displayName = decodeURIComponent(target.getAttribute('data-display-name') || backupId);
        if (dom.restoreTargetBackupId) dom.restoreTargetBackupId.value = backupId;
        if (dom.valRestoreTargetName) dom.valRestoreTargetName.textContent = `📦 ${displayName}`;
        if (dom.modalConfirmRestore) dom.modalConfirmRestore.classList.remove('hidden');
      } else if (action === 'edit-desc') {
        const currentDesc = decodeURIComponent(target.getAttribute('data-current-desc') || '');
        if (dom.editBackupId) dom.editBackupId.value = backupId;
        if (dom.inputEditBackupDesc) dom.inputEditBackupDesc.value = currentDesc;
        if (dom.modalEditBackupDesc) dom.modalEditBackupDesc.classList.remove('hidden');
      } else if (action === 'delete') {
        if (confirm('Видалити цей бекап безповоротно?')) {
          handleDeleteBackup(backupId);
        }
      }
    });
  }

  // Edit Backup Desc Modal Listeners
  if (dom.btnCloseEditDescModal) {
    dom.btnCloseEditDescModal.addEventListener('click', () => {
      if (dom.modalEditBackupDesc) dom.modalEditBackupDesc.classList.add('hidden');
    });
  }
  if (dom.btnCancelEditDesc) {
    dom.btnCancelEditDesc.addEventListener('click', () => {
      if (dom.modalEditBackupDesc) dom.modalEditBackupDesc.classList.add('hidden');
    });
  }
  if (dom.btnConfirmSaveDesc) {
    dom.btnConfirmSaveDesc.addEventListener('click', () => {
      const backupId = dom.editBackupId ? dom.editBackupId.value : '';
      const newDesc = dom.inputEditBackupDesc ? dom.inputEditBackupDesc.value.trim() : '';
      handleUpdateBackupDesc(backupId, newDesc);
    });
  }

  // Restore Confirm Modal Listeners
  if (dom.btnCloseRestoreModal) {
    dom.btnCloseRestoreModal.addEventListener('click', () => {
      if (dom.modalConfirmRestore) dom.modalConfirmRestore.classList.add('hidden');
    });
  }
  if (dom.btnCancelRestore) {
    dom.btnCancelRestore.addEventListener('click', () => {
      if (dom.modalConfirmRestore) dom.modalConfirmRestore.classList.add('hidden');
    });
  }
  if (dom.btnConfirmExecuteRestore) {
    dom.btnConfirmExecuteRestore.addEventListener('click', () => {
      const backupId = dom.restoreTargetBackupId ? dom.restoreTargetBackupId.value : '';
      handleRestoreBackup(backupId);
    });
  }

  // Deploy History Refresh
  if (dom.btnRefreshDeployHistory) {
    dom.btnRefreshDeployHistory.addEventListener('click', () => {
      fetchDeployHistory();
    });
  }
  
  // Install Webstudio Button
  if (dom.btnInstall) {
    dom.btnInstall.addEventListener('click', () => {
      dispatchAction('install');
    });
  }
  
  // Link Project Button
  if (dom.btnLink) {
    dom.btnLink.addEventListener('click', () => {
      const shareLink = dom.inputShareLink ? dom.inputShareLink.value.trim() : '';
      if (!shareLink || !shareLink.startsWith('http')) {
        showToast(t('messages.shareLinkRequired', {}, state.lang), 'warning');
        if (dom.inputShareLink) dom.inputShareLink.focus();
        return;
      }
      dispatchAction('link', { shareLink });
    });
  }
  
  // Sync Project Button
  if (dom.btnSync) {
    dom.btnSync.addEventListener('click', () => {
      dispatchAction('sync');
    });
  }
  
  // Sync Draft Button (with optional Build ID)
  if (dom.btnSyncDraft) {
    dom.btnSyncDraft.addEventListener('click', () => {
      const shareLink = dom.inputShareLink ? dom.inputShareLink.value.trim() : '';
      const buildId = dom.inputBuildId ? dom.inputBuildId.value.trim() : '';
      
      if (!buildId && !shareLink && (!state.status || !state.status.projectId)) {
        showToast(t('messages.buildIdRequired', {}, state.lang), 'warning');
        if (dom.inputBuildId) dom.inputBuildId.focus();
        return;
      }
      dispatchAction('sync-draft', { shareLink, buildId });
    });
  }
  
  // Input Persistence Listeners (Scoped per active project)
  if (dom.inputShareLink) {
    dom.inputShareLink.addEventListener('input', () => {
      const pid = state.activeProjectId || 'default';
      try { localStorage.setItem(`ws_share_link_${pid}`, dom.inputShareLink.value.trim()); } catch {}
    });
  }
  if (dom.inputBuildId) {
    dom.inputBuildId.addEventListener('input', () => {
      const pid = state.activeProjectId || 'default';
      try { localStorage.setItem(`ws_build_id_${pid}`, dom.inputBuildId.value.trim()); } catch {}
    });
  }
  // Save Session Button
  if (dom.btnSaveSession) {
    dom.btnSaveSession.addEventListener('click', () => {
      const cookie = dom.inputCookie ? dom.inputCookie.value.trim() : '';
      const csrfToken = dom.inputCsrfToken ? dom.inputCsrfToken.value.trim() : '';
      
      if (!cookie) {
        showToast(t('messages.validationError', {}, state.lang) + ': Cookie is required', 'warning');
        if (dom.inputCookie) dom.inputCookie.focus();
        return;
      }
      
      dispatchAction('save-session', { cookie, csrfToken });
    });
  }
  
  // Upload Assets Button
  if (dom.btnUploadAssets) {
    dom.btnUploadAssets.addEventListener('click', () => {
      dispatchAction('upload-assets');
    });
  }
  
  // Import to Cloud Button
  if (dom.btnImport) {
    dom.btnImport.addEventListener('click', () => {
      const shareLink = dom.inputShareLink ? dom.inputShareLink.value.trim() : '';
      dispatchAction('import', { shareLink });
    });
  }

  // Generate Template Preset Button
  if (dom.btnGenerateTemplate) {
    dom.btnGenerateTemplate.addEventListener('click', () => {
      const templatePreset = dom.selectTemplatePreset ? dom.selectTemplatePreset.value : 'react-router-cloudflare';
      dispatchAction('generate-template', { templatePreset });
    });
  }

  // Clean Template Action Button
  if (dom.btnCleanTemplate) {
    dom.btnCleanTemplate.addEventListener('click', () => {
      dispatchAction('clean-template');
    });
  }

  // Update Project Name Button
  if (dom.btnUpdateProjectName) {
    dom.btnUpdateProjectName.addEventListener('click', () => {
      const projectName = dom.inputProjectName ? dom.inputProjectName.value.trim() : '';
      if (!projectName) {
        showToast(t('messages.validationError', {}, state.lang) + ': Project name is required', 'warning');
        if (dom.inputProjectName) dom.inputProjectName.focus();
        return;
      }
      dispatchAction('update-project-name', { projectName });
    });
  }

  // Check Auth Button
  if (dom.btnCheckAuth) {
    dom.btnCheckAuth.addEventListener('click', () => {
      const selectedPreset = dom.selectTemplatePreset?.value || 'react-router-cloudflare';
      let provider = 'Cloudflare';
      if (selectedPreset.includes('vercel')) provider = 'Vercel';
      else if (selectedPreset.includes('netlify')) provider = 'Netlify';
      else if (selectedPreset.includes('docker')) provider = 'Docker';
      else if (selectedPreset.includes('ssg')) provider = 'Static';
      dispatchAction('check-auth', { provider, template: selectedPreset });
    });
  }

  // Login Auth Button
  if (dom.btnLoginAuth) {
    dom.btnLoginAuth.addEventListener('click', () => {
      const selectedPreset = dom.selectTemplatePreset?.value || 'react-router-cloudflare';
      let provider = 'Cloudflare';
      if (selectedPreset.includes('vercel')) provider = 'Vercel';
      else if (selectedPreset.includes('netlify')) provider = 'Netlify';
      else if (selectedPreset.includes('docker')) provider = 'Docker';
      else if (selectedPreset.includes('ssg')) provider = 'Static';
      dispatchAction('login-auth', { provider, template: selectedPreset });
    });
  }

  // Preset selection change listener
  if (dom.selectTemplatePreset) {
    dom.selectTemplatePreset.addEventListener('change', () => {
      const selectedPreset = dom.selectTemplatePreset.value;
      try { localStorage.setItem('ws_selected_preset', selectedPreset); } catch {}
      let provider = 'Cloudflare';
      if (selectedPreset.includes('vercel')) provider = 'Vercel';
      else if (selectedPreset.includes('netlify')) provider = 'Netlify';
      else if (selectedPreset.includes('docker')) provider = 'Docker';
      else if (selectedPreset.includes('ssg')) provider = 'Static';
      
      if (dom.valDeployHosting) {
        dom.valDeployHosting.textContent = provider;
      }
      fetchStatus(provider, selectedPreset);
    });
  }
  // Deploy Lifecycle: Install Dependencies
  if (dom.btnDeployInstall) {
    dom.btnDeployInstall.addEventListener('click', () => {
      dispatchAction('install');
    });
  }

  // Deploy Lifecycle: Build Project
  if (dom.btnDeployBuild) {
    dom.btnDeployBuild.addEventListener('click', () => {
      dispatchAction('build-project');
    });
  }

  // Deploy Lifecycle: Preview Project (Toggle Start / Stop)
  if (dom.btnDeployPreview) {
    dom.btnDeployPreview.addEventListener('click', () => {
      if (state.status?.previewServer?.running) {
        dispatchAction('stop-preview');
      } else {
        dispatchAction('preview-project');
      }
    });
  }
  // Deploy Lifecycle: Publish / Deploy Project
  if (dom.btnDeployPublish) {
    dom.btnDeployPublish.addEventListener('click', () => {
      dispatchAction('deploy-project');
    });
  }
  
  // Check Updates Button
  if (dom.btnCheckUpdates) {
    dom.btnCheckUpdates.addEventListener('click', () => {
      dispatchAction('check-updates');
    });
  }
  
  // Update Now Button
  if (dom.btnUpdateNow) {
    dom.btnUpdateNow.addEventListener('click', () => {
      dispatchAction('update');
    });
  }
  
  // Help Toggle (10-second cookie guide)
  if (dom.btnHelpToggle) {
    dom.btnHelpToggle.addEventListener('click', (e) => {
      e.preventDefault();
      if (dom.sessionHelpBox) {
        dom.sessionHelpBox.classList.toggle('hidden');
      }
    });
  }
  
  // Clear Terminal Buttons (Workspace & Deploy)
  if (dom.btnClearTerminal) {
    dom.btnClearTerminal.addEventListener('click', () => {
      clearTerminal();
    });
  }
  if (dom.btnClearDeployTerminal) {
    dom.btnClearDeployTerminal.addEventListener('click', () => {
      clearTerminal();
    });
  }
  
  // Copy Terminal Buttons (Workspace & Deploy)
  if (dom.btnCopyTerminal) {
    dom.btnCopyTerminal.addEventListener('click', () => {
      copyTerminalLogs();
    });
  }
  if (dom.btnCopyDeployTerminal) {
    dom.btnCopyDeployTerminal.addEventListener('click', () => {
      copyTerminalLogs();
    });
  }
  
  // Toggle Auto-Scroll Buttons / Checkboxes
  const autoScrollToggles = [dom.btnToggleAutoScroll, dom.chkDeployAutoScroll].filter(Boolean);
  autoScrollToggles.forEach((el) => {
    el.addEventListener('change', (e) => {
      state.autoScroll = e.target.checked;
      autoScrollToggles.forEach((other) => {
        if (other.type === 'checkbox') other.checked = state.autoScroll;
      });
    });
  });
}

/**
 * Main Application Lifecycle Bootstrapper
 */
export async function initApp() {
  cacheDOMElements();
  setLanguage(state.lang);
  switchTab(state.currentTab);
  setupEventListeners();

  // Restore preset dropdown from local storage if saved
  if (dom.selectTemplatePreset) {
    try {
      const savedPreset = localStorage.getItem('ws_selected_preset');
      if (savedPreset) dom.selectTemplatePreset.value = savedPreset;
    } catch {}
  }

  initSSE();
  if (!state.logs || state.logs.length === 0) {
    clearTerminal();
  }
  await fetchStatus();
  await fetchProjects();
  if (state.currentTab === 'backups') {
    await fetchBackups();
  } else if (state.currentTab === 'deploy') {
    await fetchDeployHistory();
  }
}
// Auto-boot if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
