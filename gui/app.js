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

// Global application state
export const state = {
  lang: getInitialLang(),
  status: null,
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

  // Views
  firstRunView: null,
  workspaceView: null,
  
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
  
  dom.terminalOutput = document.getElementById('terminal-output') || document.getElementById('setup-terminal-output');
  dom.setupTerminalOutput = document.getElementById('setup-terminal-output');
  dom.terminalContainer = document.getElementById('terminal-container') || document.getElementById('setup-terminal-container');
  dom.setupTerminalContainer = document.getElementById('setup-terminal-container');
  dom.terminalStatus = document.getElementById('terminal-status');
  dom.btnClearTerminal = document.getElementById('btn-clear-terminal') || document.getElementById('btn-clear-logs');
  dom.btnCopyTerminal = document.getElementById('btn-copy-terminal') || document.getElementById('btn-copy-logs');
  dom.btnToggleAutoScroll = document.getElementById('btn-toggle-autoscroll') || document.getElementById('checkbox-autoscroll') || document.getElementById('chk-autoscroll');
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

  const outputs = document.querySelectorAll('#terminal-output, #setup-terminal-output');
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
    const scrollTargets = document.querySelectorAll('#terminal-container, #setup-terminal-container, #terminal-output, #setup-terminal-output');
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
    const outputs = document.querySelectorAll('#terminal-output, #setup-terminal-output');
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
    
    if (dom.btnCopyTerminal) {
      dom.btnCopyTerminal.textContent = t('workspace.terminal.copied', {}, state.lang);
      dom.btnCopyTerminal.classList.add('copied');
      setTimeout(() => {
        if (dom.btnCopyTerminal) {
          dom.btnCopyTerminal.textContent = t('workspace.terminal.copy', {}, state.lang);
          dom.btnCopyTerminal.classList.remove('copied');
        }
      }, 2000);
    }
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
    if (dom.terminalStatus) {
      dom.terminalStatus.textContent = 'ONLINE';
      dom.terminalStatus.className = 'terminal-status online';
    }
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
    if (dom.terminalStatus) {
      dom.terminalStatus.textContent = 'RECONNECTING';
      dom.terminalStatus.className = 'terminal-status reconnecting';
    }
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
    dom.btnUpdateNow
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
  } else {
    // Reset labels on completion
    applyTranslations();
  }
}

/**
 * Fetches current system status from /api/status.
 */
export async function fetchStatus() {
  if (typeof fetch === 'undefined') return null;

  try {
    const response = await fetch('/api/status');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    state.status = data;
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
  
  const { installed, webstudioVersion, latestVersion, updateAvailable, projectId, origin, projectStats } = state.status;
  
  // Two-Phase UI View Switching
  if (!installed) {
    if (dom.firstRunView) dom.firstRunView.classList.remove('hidden');
    if (dom.workspaceView) dom.workspaceView.classList.add('hidden');
  } else {
    if (dom.firstRunView) dom.firstRunView.classList.add('hidden');
    if (dom.workspaceView) dom.workspaceView.classList.remove('hidden');
  }
  
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
  
  // Clear Terminal Button
  if (dom.btnClearTerminal) {
    dom.btnClearTerminal.addEventListener('click', () => {
      clearTerminal();
    });
  }
  
  // Copy Terminal Button
  if (dom.btnCopyTerminal) {
    dom.btnCopyTerminal.addEventListener('click', () => {
      copyTerminalLogs();
    });
  }
  
  // Toggle Auto-Scroll Button / Checkbox
  if (dom.btnToggleAutoScroll) {
    dom.btnToggleAutoScroll.addEventListener('click', () => {
      state.autoScroll = !state.autoScroll;
      if (dom.btnToggleAutoScroll.type === 'checkbox') {
        dom.btnToggleAutoScroll.checked = state.autoScroll;
      } else {
        dom.btnToggleAutoScroll.classList.toggle('active', state.autoScroll);
      }
    });
  }
}

/**
 * Main Application Lifecycle Bootstrapper
 */
export async function initApp() {
  cacheDOMElements();
  setLanguage(state.lang);
  setupEventListeners();
  initSSE();
  clearTerminal();
  await fetchStatus();
}

// Auto-boot if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
