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

## 📋 Покрокова інструкція по запуску та налаштуванню

### Крок 1. Встановлення Webstudio CLI у проєкт

Встановіть офіційний пакет `webstudio` у ваш репозиторій:
```bash
npm i webstudio
```

---

### Крок 2. Активація локального мосту (Патчер)

Запустіть скрипт конфігурації локального MCP:
```bash
node scripts/setup-local-mcp.mjs --local
```
> **Що робить патчер:** Перемикає виконання всіх 70+ MCP-інструментів на локальний файл `.webstudio/data.json`, розблоковує всі дозволи та активує місток авторизації браузерної сесії для завантаження ассетів.

---

### Крок 3. Прив'язка та завантаження проєкту з Webstudio Cloud

1. У веб-інтерфейсі Webstudio натисніть **Share** (вгорі праворуч) та скопіюйте посилання на проєкт.
2. Прив'яжіть проєкт до локальної папки:
```bash
npx webstudio link --link "<shareLink>"
```
3. Завантажте повну структуру проєкту та ассети:
```bash
npx webstudio sync
```
Після виконання у вас з'являться файли:
- `.webstudio/data.json` — повна структура проєкту, сторінки, слоти та стилі.
- `.webstudio/assets/` — локальна папка для зображень та шрифтів.

---

### Крок 4. Авторизація сесії браузера для ассетів (Один раз)

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

### Крок 5. Створення дизайну за допомогою AI або MCP

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

### Крок 6. Синхронізація у Webstudio Cloud

Коли ви завершили генерацію або редагування сторінок, надішліть усі оновлення та фотографії у хмару однією нативною командою:

```bash
npx webstudio import --to "<shareLink>"
```

✨ **Що відбудеться автоматично:**
1. Команда виявить нові згенеровані картинки у `.webstudio/assets/`.
2. Наш місток передасть їх у хмару через вашу активну сесію.
3. Усі сторінки, слоти, компоненти та прив'язані картинки миттєво оновляться у браузері!

---

## 🛠️ Додаткові корисні команди

* **Повне завантаження та переприв'язка ассетів окремим скриптом:**
  ```bash
  npm run upload-assets
  ```
* **Швидка перевірка стану проєкту через CLI:**
  ```bash
  npm run cli info
  ```

---

## 📜 Ліцензія

Цей проект поширюється під ліцензією [MIT](LICENSE).

Автор: **R0STEFAN**
