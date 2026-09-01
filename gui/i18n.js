/**
 * Webstudio Control Center — Bilingual Dictionary & Translation Engine (UA / EN)
 * Zero-dependency ES module with dot-notation lookup and {placeholder} interpolation.
 */

export const i18n = {
  ua: {
    appTitle: 'Webstudio Control Center',
    appSubtitle: 'Панель керування та AI-агент Webstudio',
    langSwitch: 'Мова',
    tabs: {
      workspace: '⚡ Керування проєктом',
      deploy: '🚀 Деплой та Шаблони'
    },
    firstRun: {
      title: 'Первинне налаштування Webstudio',
      description: 'Webstudio CLI та робочі залежності ще не встановлені. Натисніть кнопку нижче для автоматичного встановлення всіх необхідних пакетів, конфігурації та застосування системних патчів.',
      installBtn: '⚡ Встановити Webstudio та залежності',
      installing: 'Встановлення залежностей...',
      note: 'Процес може тривати 1-2 хвилини залежно від швидкості інтернет-з\'єднання. Журнал встановлення транслюється в реальному часі нижче.'
    },
    workspace: {
      projectSection: {
        title: 'Прив\'язка та синхронізація проєкту',
        shareLink: 'Share Link (Посилання доступу)',
        shareLinkPlaceholder: 'https://p-bda39d1b-....apps.webstudio.is/?authToken=...',
        buildId: 'Build ID (ID ревізії чернетки)',
        buildIdPlaceholder: 'a173613c-2453-4ebe-b2ea-a10d304741cf (необов\'язково)',
        buildIdHint: 'Build ID використовується для синхронізації неопублікованих чернеток безпосередньо з конструктора Webstudio Builder.',
        linkBtn: '🔗 Прив\'язати проєкт',
        syncBtn: '🔄 Синхронізувати проєкт',
        syncDraftBtn: '⚡ Синхронізувати чернетку',
        linking: 'Прив\'язка проєкту...',
        syncing: 'Синхронізація...'
      },
      sessionSection: {
        title: 'Сесія та авторизація (Asset Bridge)',
        cookie: 'Cookie (Авторизаційний заголовок)',
        cookiePlaceholder: 'connect.sid=s%3A...; _ws_session=...',
        csrfToken: 'CSRF Token',
        csrfTokenPlaceholder: 'Вставте значення csrfToken з DevTools...',
        saveBtn: '💾 Зберегти session.json',
        saving: 'Збереження...',
        saved: '✅ Сесію збережено',
        helpToggle: '📖 Як отримати Cookie та CSRF токен за 10 секунд?',
        helpText: '1. Відкрийте ваш проєкт у Webstudio Builder у браузері.\n2. Відкрийте DevTools (F12) -> вкладка Network (Мережа).\n3. Виконайте будь-яку дію (наприклад, клік або збереження).\n4. Знайдіть будь-який запит до api/rest, перегляньте Headers:\n   • Скопіюйте значення заголовка "Cookie".\n   • Скопіюйте значення "x-csrf-token" або "csrfToken".\n5. Вставте їх у поля вище та натисніть "Зберегти session.json".'
      },
      cloudSection: {
        title: 'Хмарні операції',
        uploadAssetsBtn: '📤 Завантажити локальні асети',
        uploading: 'Завантаження асетів...',
        importBtn: '☁️ Імпортувати в хмару (Cloud Import)',
        importing: 'Імпорт у хмару...'
      },
      telemetry: {
        title: 'Телеметрія проєкту',
        status: 'Статус',
        connected: 'Підключено',
        notConnected: 'Не підключено',
        projectId: 'ID проєкту',
        pages: 'Сторінок',
        instances: 'Елементів (Instances)',
        assets: 'Асетів',
        localMcp: 'Локальний MCP',
        active: 'Активний',
        inactive: 'Неактивний'
      },
      terminal: {
        title: 'Консоль виконання (Live Output)',
        clear: 'Очистити',
        copy: 'Копіювати',
        copied: 'Скопійовано!',
        autoScroll: 'Автопрокрутка',
        ready: 'Система готова. Очікування команд...'
      },
      footer: {
        installedVersion: 'Webstudio CLI: v{version}',
        notInstalled: 'Webstudio: не встановлено',
        checkUpdatesBtn: '🔍 Перевірити оновлення',
        checking: 'Перевірка...',
        upToDate: '✨ Остання версія',
        updateAvailable: '💡 Доступне оновлення: v{version}',
        updateNowBtn: '⚡ Оновити до v{version}',
        updating: 'Оновлення...'
      }
    },
    deploy: {
      templateSection: {
        title: '1. Вибір шаблону фреймворку',
        presetLabel: 'Шаблон хостингу',
        presets: {
          'react-router-cloudflare': '⚡ React Router v7 + Cloudflare Workers',
          'cloudflare-new': '⚡ React Router v7 + Cloudflare Workers',
          'remix-cloudflare': '⚡ Remix + Cloudflare Pages',
          'cloudflare': '⚡ Remix + Cloudflare Pages',
          'react-router-vercel': '▲ React Router v7 + Vercel',
          'vercel': '▲ React Router v7 + Vercel',
          'react-router-netlify': '🌐 React Router v7 + Netlify',
          'netlify': '🌐 React Router v7 + Netlify',
          'react-router-docker': '🐳 React Router v7 + Docker',
          'docker': '🐳 React Router v7 + Docker',
          'ssg': '📄 Static Site (SSG / Vike)',
          'ssg-vercel': '▲ SSG + Vercel Static',
          'ssg-netlify': '🌐 SSG + Netlify Static'
        },
        generateBtn: '🏗️ Згенерувати код за шаблоном',
        generating: 'Генерація коду...',
        hint: 'Webstudio згенерує повну структуру файлів проєкту для обраного хостингу'
      },
      nameSection: {
        title: '2. Назва проєкту для хостингу',
        projectNameLabel: 'Ім\'я проєкту (Project Name)',
        placeholder: 'my-webstudio-app',
        applyBtn: '💾 Застосувати назву',
        applied: 'Назву оновлено!',
        detectedConfig: 'Конфігураційний файл: {file}',
        hint: 'Автоматично оновлює назву у wrangler.jsonc, wrangler.toml та package.json'
      },
      authSection: {
        title: '3. Авторизація хостингу',
        statusLabel: 'Статус облікового запису:',
        checkStatusBtn: '🔍 Перевірити статус',
        loginBtn: '🔑 Увійти в акаунт (Login)',
        checking: 'Перевірка авторизації...',
        authorized: 'Авторизовано ({account})',
        notAuthorized: 'Не авторизовано',
        hint: 'Потрібно для публікації на Cloudflare / Vercel'
      },
      lifecycleSection: {
        title: '4. Послідовні кроки деплою',
        installBtn: '📦 Встановити залежності',
        buildBtn: '🔨 Зібрати проєкт (Build)',
        previewBtn: '👁️ Попередній перегляд',
        deployBtn: '🚀 Опублікувати (Deploy)',
        installing: 'Встановлення...',
        building: 'Збірка проєкту...',
        previewing: 'Запуск прев\'ю...',
        deploying: 'Публікація...',
        hint: 'Універсальні команди: npm install ➔ npm run build ➔ npm run preview ➔ npm run deploy'
      },
      telemetry: {
        title: '📊 Стан збірки та деплою',
        currentTemplate: 'Поточний шаблон',
        targetHosting: 'Цільовий хостинг',
        configFiles: 'Файли конфігурації',
        scriptsCount: 'Доступно npm-скриптів',
        lastBuild: 'Остання збірка'
      }
    },
    messages: {
      validationError: 'Помилка валідації',
      shareLinkRequired: 'Будь ласка, вкажіть коректне посилання Share Link (повинно починатися з https://)',
      buildIdRequired: 'Для синхронізації чернетки необхідно вказати Build ID або Share Link',
      sessionSaved: 'Сесію успішно збережено у .webstudio/session.json',
      projectNameUpdated: 'Назву проєкту успішно оновлено на: {name}',
      templateGenerated: 'Код за шаблоном {preset} успішно згенеровано!',
      actionError: 'Виникла помилка під час виконання дії',
      networkError: 'Помилка зв\'язку із сервером GUI. Перевірте з\'єднання.',
      actionStarted: 'Запуск дії: {action}...',
      actionSuccess: 'Дію {action} успішно завершено.',
      actionFailed: 'Дія {action} завершилася з помилкою (код {code}).'
    }
  },
  en: {
    appTitle: 'Webstudio Control Center',
    appSubtitle: 'Control Panel & Webstudio AI Agent',
    langSwitch: 'Language',
    tabs: {
      workspace: '⚡ Project Workspace',
      deploy: '🚀 Build & Deploy'
    },
    firstRun: {
      title: 'Webstudio Initial Setup',
      description: 'Webstudio CLI and workspace dependencies are not yet installed. Click the button below to automatically install all required packages, configure the workspace, and apply system patches.',
      installBtn: '⚡ Install Webstudio & Dependencies',
      installing: 'Installing dependencies...',
      note: 'The process may take 1-2 minutes depending on your internet connection. Installation logs are streamed in real time below.'
    },
    workspace: {
      projectSection: {
        title: 'Project Link & Synchronization',
        shareLink: 'Share Link',
        shareLinkPlaceholder: 'https://p-bda39d1b-....apps.webstudio.is/?authToken=...',
        buildId: 'Build ID (Draft Revision ID)',
        buildIdPlaceholder: 'a173613c-2453-4ebe-b2ea-a10d304741cf (optional)',
        buildIdHint: 'Build ID is used to sync unpublished draft revisions directly from Webstudio Builder.',
        linkBtn: '🔗 Link Project',
        syncBtn: '🔄 Sync Project',
        syncDraftBtn: '⚡ Sync Draft',
        linking: 'Linking project...',
        syncing: 'Syncing...'
      },
      sessionSection: {
        title: 'Session & Auth (Asset Bridge)',
        cookie: 'Cookie (Auth Header)',
        cookiePlaceholder: 'connect.sid=s%3A...; _ws_session=...',
        csrfToken: 'CSRF Token',
        csrfTokenPlaceholder: 'Paste csrfToken value from DevTools...',
        saveBtn: '💾 Save session.json',
        saving: 'Saving...',
        saved: '✅ Session saved',
        helpToggle: '📖 How to obtain Cookie and CSRF token in 10 seconds?',
        helpText: '1. Open your project in Webstudio Builder in the browser.\n2. Open DevTools (F12) -> Network tab.\n3. Trigger any action (e.g. click or save).\n4. Select any request to api/rest and check Headers:\n   • Copy the value of the "Cookie" header.\n   • Copy the value of "x-csrf-token" or "csrfToken".\n5. Paste them into the fields above and click "Save session.json".'
      },
      cloudSection: {
        title: 'Cloud Operations',
        uploadAssetsBtn: '📤 Upload Local Assets',
        uploading: 'Uploading assets...',
        importBtn: '☁️ Import to Cloud (Cloud Import)',
        importing: 'Importing to cloud...'
      },
      telemetry: {
        title: 'Project Telemetry',
        status: 'Status',
        connected: 'Connected',
        notConnected: 'Not Connected',
        projectId: 'Project ID',
        pages: 'Pages',
        instances: 'Instances',
        assets: 'Assets',
        localMcp: 'Local MCP',
        active: 'Active',
        inactive: 'Inactive'
      },
      terminal: {
        title: 'Execution Console (Live Output)',
        clear: 'Clear',
        copy: 'Copy',
        copied: 'Copied!',
        autoScroll: 'Auto-scroll',
        ready: 'System ready. Awaiting commands...'
      },
      footer: {
        installedVersion: 'Webstudio CLI: v{version}',
        notInstalled: 'Webstudio: not installed',
        checkUpdatesBtn: '🔍 Check for Updates',
        checking: 'Checking...',
        upToDate: '✨ Up to date',
        updateAvailable: '💡 Update available: v{version}',
        updateNowBtn: '⚡ Update to v{version}',
        updating: 'Updating...'
      }
    },
    deploy: {
      templateSection: {
        title: '1. Framework & Target Template',
        presetLabel: 'Deployment Preset',
        presets: {
          'react-router-cloudflare': '⚡ React Router v7 + Cloudflare Workers',
          'cloudflare-new': '⚡ React Router v7 + Cloudflare Workers',
          'remix-cloudflare': '⚡ Remix + Cloudflare Pages',
          'cloudflare': '⚡ Remix + Cloudflare Pages',
          'react-router-vercel': '▲ React Router v7 + Vercel',
          'vercel': '▲ React Router v7 + Vercel',
          'react-router-netlify': '🌐 React Router v7 + Netlify',
          'netlify': '🌐 React Router v7 + Netlify',
          'react-router-docker': '🐳 React Router v7 + Docker',
          'docker': '🐳 React Router v7 + Docker',
          'ssg': '📄 Static Site (SSG / Vike)',
          'ssg-vercel': '▲ SSG + Vercel Static',
          'ssg-netlify': '🌐 SSG + Netlify Static'
        },
        generateBtn: '🏗️ Generate Code from Template',
        generating: 'Generating code...',
        hint: 'Webstudio scaffolds complete framework project files for the selected target'
      },
      nameSection: {
        title: '2. Project Name for Hosting',
        projectNameLabel: 'Project Name',
        placeholder: 'my-webstudio-app',
        applyBtn: '💾 Apply Project Name',
        applied: 'Project name updated!',
        detectedConfig: 'Configuration file: {file}',
        hint: 'Automatically updates project name across wrangler.jsonc, wrangler.toml, and package.json'
      },
      authSection: {
        title: '3. Hosting Authentication',
        statusLabel: 'Account Status:',
        checkStatusBtn: '🔍 Check Auth Status',
        loginBtn: '🔑 Login to Account',
        checking: 'Checking auth...',
        authorized: 'Authorized ({account})',
        notAuthorized: 'Not authorized',
        hint: 'Required for publishing to Cloudflare / Vercel'
      },
      lifecycleSection: {
        title: '4. Deploy Lifecycle Actions',
        installBtn: '📦 Install Dependencies',
        buildBtn: '🔨 Build Project',
        previewBtn: '👁️ Preview Locally',
        deployBtn: '🚀 Deploy to Hosting',
        installing: 'Installing...',
        building: 'Building...',
        previewing: 'Starting preview...',
        deploying: 'Deploying...',
        hint: 'Universal commands: npm install ➔ npm run build ➔ npm run preview ➔ npm run deploy'
      },
      telemetry: {
        title: '📊 Build & Deploy Status',
        currentTemplate: 'Current Template',
        targetHosting: 'Target Hosting',
        configFiles: 'Config Files',
        scriptsCount: 'Available NPM Scripts',
        lastBuild: 'Last Build'
      }
    },
    messages: {
      validationError: 'Validation Error',
      shareLinkRequired: 'Please provide a valid Share Link (must start with https://)',
      buildIdRequired: 'To sync a draft, please specify a Build ID or Share Link',
      sessionSaved: 'Session successfully saved to .webstudio/session.json',
      projectNameUpdated: 'Project name successfully updated to: {name}',
      templateGenerated: 'Template {preset} code successfully generated!',
      actionError: 'An error occurred while executing the action',
      networkError: 'Server communication error. Check your connection.',
      actionStarted: 'Starting action: {action}...',
      actionSuccess: 'Action {action} completed successfully.',
      actionFailed: 'Action {action} failed with code {code}.'
    }
  }
};

/**
 * Resolves a translation string with dot-notation key lookup and variable interpolation.
 * 
 * @param {string} key - Dot-delimited key (e.g. 'workspace.projectSection.title')
 * @param {Record<string, string | number>} [params] - Values to interpolate into {placeholder}
 * @param {string} [lang] - Language code ('ua' or 'en'), defaults to 'ua'
 * @returns {string} Translated string or key fallback
 */
export function t(key, params = {}, lang = 'ua') {
  if (!key || typeof key !== 'string') return '';
  
  const targetLang = (lang && i18n[lang]) ? lang : 'ua';
  const keys = key.split('.');
  
  let current = i18n[targetLang];
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      current = undefined;
      break;
    }
  }
  
  // Fallback to English if not found in Ukrainian
  if (current === undefined && targetLang !== 'en') {
    let fallback = i18n.en;
    for (const k of keys) {
      if (fallback && typeof fallback === 'object' && k in fallback) {
        fallback = fallback[k];
      } else {
        fallback = undefined;
        break;
      }
    }
    current = fallback;
  }
  
  // Fallback to Ukrainian if not found in English
  if (current === undefined && targetLang !== 'ua') {
    let fallback = i18n.ua;
    for (const k of keys) {
      if (fallback && typeof fallback === 'object' && k in fallback) {
        fallback = fallback[k];
      } else {
        fallback = undefined;
        break;
      }
    }
    current = fallback;
  }
  
  if (current === undefined || typeof current !== 'string') {
    return key;
  }
  
  // Interpolate {variable} placeholders
  if (params && typeof params === 'object') {
    return current.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
      if (varName in params && params[varName] !== undefined && params[varName] !== null) {
        return String(params[varName]);
      }
      return match;
    });
  }
  
  return current;
}

if (typeof window !== 'undefined') {
  window.i18n = i18n;
  window.t = t;
}
