# 🚀 Webstudio AI Agent & Local MCP Toolkit

> **Повноцінний автономний міст для AI-агентів (Google Antigravity, Cursor, Claude Code, Windsurf), що відкриває 100% можливостей Webstudio MCP локально без жодних обмежень тарифів, лімітів API чи помилок доступу.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Webstudio: Local MCP](https://img.shields.io/badge/Webstudio-Local%20MCP-green.svg)](https://webstudio.is)
[![Node: >=18](https://img.shields.io/badge/Node->=18.0.0-orange.svg)](https://nodejs.org)

---

## 🌟 Головна проблема та рішення

| Звичайна робота через Cloud API | Наш автономний міст (Local MCP + Cloud Push) |
| :--- | :--- |
| ❌ Блокується на безкоштовних тарифах (`FORBIDDEN: Authorization token cannot use Builder API`) | ✅ **100% безкоштовно і без лімітів** |
| ❌ Потребує платних тарифів / додаткових API-дозволів | ✅ Працює офлайн безпосередньо з `.webstudio/data.json` |
| ❌ Повільно (десятки мережевих HTTP-запитів на кожну зміну) | ✅ **Миттєва генерація (<500ms)** завдяки Immer-транзакціям |
| ❌ Обмежений функціонал | ✅ **Повна підтримка JSX, Radix UI, Animation Groups, Tokens, Collections, Slots** |
| ❌ Помилки при завантаженні нових медіафайлів | ✅ **Автоматичний місток сесії для завантаження будь-яких ассетів** |

---

## 🏗️ Архітектура (Як це працює)

```text
┌───────────────────────────────────────────────────────────┐
│                    AI CODING ASSISTANT                    │
│        (Google Antigravity, Cursor, Claude Code)          │
└─────────────────────────────┬─────────────────────────────┘
                              │ (MCP-команди: extract-slot, insert-fragment...)
                              ▼
┌───────────────────────────────────────────────────────────┐
│              LOCAL WEBSTUDIO MCP RUNTIME                  │
│       (70+ Official MCP Tools: швидкі Immer-транзакції)   │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│               LOCAL PROJECT SOURCE OF TRUTH               │
│         .webstudio/data.json  &  .webstudio/assets/       │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼  npx webstudio import --to "<shareLink>"
┌───────────────────────────────────────────────────────────┐
│                  WEBSTUDIO CLOUD BUILDER                  │
│       (Авто-завантаження ассетів через сесію + імпорт)    │
└───────────────────────────────────────────────────────────┘
```

---
## 🖥️ Webstudio Control Center (Графічна панель керування)

Найпростіший спосіб налаштування та роботи з агентом — використання інтерактивної веб-панелі **Control Center**:

### 🚀 Швидкий запуск GUI:
* **Windows:** двічі клікніть на **`start-gui.bat`** у корені проєкту (або `npm run gui`)
* **macOS / Linux:** виконайте в терміналі:
  ```bash
  npm run gui
  ```

Панель автоматично відкриється у браузері за адресою **`http://localhost:4200`** (із автоматичним перемиканням на вільний порт за потреби).

### ✨ Можливості Control Center:
* ⚡ **First-run Auto Installer:** Автоматична перевірка середовища, встановлення залежностей та налаштування локального MCP мосту в один клік.
* 🔗 **Share Link & Cloud Sync:** Прив'язка проєкту за посиланням (`Share Link`), синхронізація локальних даних та публікація у хмару Webstudio.
* 🍪 **Керування сесією (Cookie & CSRF):** Зручне внесення та перевірка параметрів сесії для необмеженого завантаження ассетів.
* 💻 **Live Terminal Streaming:** Потоковий вивід логів виконання операцій у реальному часі через Server-Sent Events (SSE).
* 🔄 **One-click Updates:** Перевірка та оновлення Webstudio SDK до версії `@latest` однією кнопкою.
* 🌐 **UA / EN Localization:** Повна двомовна підтримка інтерфейсу з миттєвим перемиканням.

---


## 📋 Покрокова інструкція по запуску

### Крок 1. Клонування та встановлення (Авто-конфігурація)

Склонуйте репозиторій та встановіть залежності:
```bash
git clone https://github.com/R0STEFAN/webstudio-ai-agent.git
cd webstudio-ai-agent
npm install
```
> ⚡ **Що відбувається автоматично:** Завдяки вбудованому `postinstall`-хуку під час `npm install` автоматично запускається скрипт `setup-local-mcp.mjs`, який знаходить локальний Webstudio CLI і застосовує всі необхідні локальні патчі.
>
> 💡 **Хочете завжди найсвіжішу версію Webstudio з npm?** Виконайте:
> ```bash
> npm run update-webstudio
> ```

---

### Крок 2. Прив'язка та завантаження проєкту з Webstudio Cloud

1. У веб-інтерфейсі Webstudio натисніть **Share** (вгорі праворуч) та скопіюйте посилання на проєкт (вигляду `https://p-<id>.apps.webstudio.is/?authToken=<token>`).
2. Прив'яжіть проєкт до локальної папки та завантажте дані:
```bash
npx webstudio link --link "<shareLink>"
npx webstudio sync
```
Після виконання у вас з'явиться локальна папка `.webstudio/` із повною структурою сайту (`data.json`) та папкою зображень/шрифтів (`assets/`).

---

### Крок 3. Авторизація сесії браузера для ассетів (Один раз)

Щоб нативна команда `webstudio import` могла завантажувати нові згенеровані картинки без обмежень безкоштовного тарифу, створіть файл **`.webstudio/session.json`** у корені проєкту:

#### 📄 Формат `.webstudio/session.json`:
```json
{
  "cookie": "ВСТАВИТИ_РЯДОК_COOKIE_З_БРАУЗЕРА",
  "csrfToken": "ВСТАВИТИ_X_CSRF_TOKEN_З_БРАУЗЕРА"
}
```

#### 🔍 Як отримати ці дані за 10 секунд (DevTools F12):
1. Відкрийте ваш проєкт у браузері у [Webstudio Builder](https://apps.webstudio.is).
2. Натисніть **`F12`** (DevTools) -> перейдіть на вкладку **Network** (Мережа).
3. Зробіть будь-яку дію (клікніть елемент або оновіть сторінку F5).
4. Клікніть на будь-який запит (наприклад, `polly.poll` або `loadProjectBundle...`) -> у вкладці **Headers** знайдіть **Request Headers**:
   - **`cookie:`** — скопіюйте весь рядок та вставте в поле `"cookie"`.
   - **`x-csrf-token:`** — скопіюйте рядок токена та вставте в поле `"csrfToken"`.

> 🔒 **Безпека:** Файл `.webstudio/session.json` автоматично додано в `.gitignore` і він ніколи не потрапить на GitHub.

---

### Крок 4. Створення дизайну за допомогою AI або MCP

Тепер ви (або AI-агент) можете створювати будь-які сторінки, секції, слоти та компоненти:

#### 📄 Перегляд сторінок та елементів:
```bash
npx webstudio mcp single-op-call list-pages "{}"
npx webstudio mcp single-op-call list-instances '{"pagePath":"/hospital"}'
npx webstudio mcp single-op-call list-design-tokens "{}"
```

#### 🧩 Виділення блоку в перевикористовуваний слот (`extract-slot`):
```bash
npx webstudio mcp single-op-call extract-slot '{"instanceId":"<header-instance-id>"}'
```

#### 🎨 Додавання секцій через нативний JSX (`insert-fragment`):
```bash
npx webstudio mcp single-op-call insert-fragment --input-file payload.json
```

---

### Крок 5. Синхронізація у Webstudio Cloud

Коли ви завершили генерацію або редагування сторінок, надішліть усі оновлення та фотографії у хмару однією нативною командою:

```bash
npx webstudio import --to "<shareLink>"
```

✨ **Що відбудеться автоматично:**
1. Команда виявить нові згенеровані картинки у `.webstudio/assets/`.
2. Наш місток передасть їх у хмару через вашу активну сесію.
3. Усі сторінки, слоти, компоненти та прив'язані картинки миттєво оновляться у браузері!

---

## 🔄 Оновлення Webstudio до найновішої версії

Якщо вийшла нова версія Webstudio або її SDK і ви хочете оновитися до `@latest`:
```bash
npm run update-webstudio
```
Ця команда автоматично завантажить найсвіжіші пакети з npm, оновить чистий бекап і повторно застосує всі патчі локального мосту.

---

## 🛠️ Додаткові корисні команди

* **Запуск графічної панелі керування (Control Center GUI):**
  ```bash
  npm run gui
  ```
* **Повне завантаження та переприв'язка ассетів окремим скриптом:**
  ```bash
  npm run upload-assets
  ```
* **Швидка перевірка стану проєкту через CLI:**
  ```bash
  npm run cli -- info
  ```

## 📜 Ліцензія

Цей проект поширюється під ліцензією [MIT](LICENSE).

Автор: **R0STEFAN**
