# 🚀 Webstudio AI Agent & Local MCP Toolkit

> **Повноцінний автономний міст для AI-агентів (Antigravity, Cursor, Claude Code, Windsurf), що відкриває 100% можливостей Webstudio MCP локально без жодних обмежень тарифів, лімітів API чи помилок доступу.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Webstudio: Local MCP](https://img.shields.io/badge/Webstudio-Local%20MCP-green.svg)](https://webstudio.is)
[![Node: >=18](https://img.shields.io/badge/Node->=18.0.0-orange.svg)](https://nodejs.org)

---

## 🌟 Головна проблема та рішення

| Звичайна робота через Cloud API | Наш автономний міст (Local MCP + Cloud Push) |
| :--- | :--- |
| ❌ Блокується на безкоштовних тарифах (`FORBIDDEN`) | ✅ **100% безкоштовно і без лімітів** |
| ❌ Потребує платних API-ключів | ✅ Працює офлайн безпосередньо з `.webstudio/data.json` |
| ❌ Повільно (десятки мережевих HTTP-запитів) | ✅ **Миттєва генерація (<500ms)** завдяки Immer-транзакціям |
| ❌ Обмежений функціонал | ✅ **Повна підтримка JSX, Radix UI, Animation Groups, Tokens, Collections** |

---

## 🏗️ Архітектура (Як це працює)

```text
┌───────────────────────────────────────────────────────────┐
│                    AI CODING ASSISTANT                    │
│        (Google Antigravity, Cursor, Claude Code)          │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│              LOCAL WEBSTUDIO MCP RUNTIME                  │
│       (70+ Official MCP Tools: insert-fragment, etc.)     │
└─────────────────────────────┬─────────────────────────────┘
                              │  (Fast Immer Local Mutation)
                              ▼
┌───────────────────────────────────────────────────────────┐
│               LOCAL PROJECT SOURCE OF TRUTH               │
│         .webstudio/data.json  &  .webstudio/assets/       │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼  webstudio import --to "<shareLink>"
┌───────────────────────────────────────────────────────────┐
│                  WEBSTUDIO CLOUD BUILDER                  │
│         (Миттєве відображення результату в хмарі)         │
└───────────────────────────────────────────────────────────┘
```

---

## ⚡ Встановлення (2 варіанти на вибір)

### Варіант А: Локально в проект (Рекомендовано, ізольовано)
```bash
# 1. Встановіть Webstudio локально в проект
npm i webstudio

# 2. Запустіть патчер
node scripts/setup-local-mcp.mjs --local

# 3. Завантажте проект із хмари
npx webstudio sync --link "<shareLink>"

# 4. Використовуйте MCP-інструменти для дизайну
npx webstudio mcp single-op-call list-pages "{}"

# 5. Відправте оновлений дизайн у хмару
npx webstudio import --to "<shareLink>"
```

### Варіант Б: Глобально на комп'ютер (Один раз для всіх проектів)
```bash
# 1. Встановіть глобально
npm i -g webstudio

# 2. Запустіть патчер
node scripts/setup-local-mcp.mjs

# 3. Завантажте проект із хмари
webstudio sync --link "<shareLink>"

# 4. Використовуйте MCP-інструменти для дизайну
webstudio mcp single-op-call list-pages "{}"

# 5. Відправте оновлений дизайн у хмару
webstudio import --to "<shareLink>"
```

---

## 🛠️ Як користуватися

### 1. Використання з AI-асистентами (Antigravity / Cursor / Claude Code)
Просто відкрийте будь-який проект Webstudio у вашому редакторі.
Файли `AGENTS.md` та `.agents/skills/webstudio-ai-designer/SKILL.md` автоматично пояснюють AI-асистенту всі команди та правила генерації!

### 2. Приклади MCP-команд:

#### 📄 Читання сторінок та елементів:
```bash
webstudio mcp single-op-call list-pages "{}"
webstudio mcp single-op-call list-instances '{"pagePath":"/services"}'
webstudio mcp single-op-call list-design-tokens "{}"
```

#### 🎨 Додавання секцій через JSX (`insert-fragment`):
Створіть `payload.json`:
```json
{
  "parentInstanceId": "<parent-instance-id>",
  "fragment": "<ws.element ws:tag='section' ws:tokens={[token('token-card', css`background: #fff; padding: 32px; border-radius: 16px;`)]} ws:style={css`display: flex; gap: 24px; @media (max-width: 767px) { flex-direction: column; }`}><ws.element ws:tag='h2'>Назва Секції</ws.element></ws.element>"
}
```
Виконайте:
```bash
webstudio mcp single-op-call insert-fragment --input-file payload.json
```

#### 📊 Динамічні колекції з JSON-ресурсу:
1. **Створення змінної даних:**
```bash
webstudio mcp single-op-call create-variable --input-file pricing_data.json
```
2. **Підключення динамічної колекції:**
```bash
webstudio mcp single-op-call insert-collection --input-file collection.json
```

#### 🪟 Нативні Radix UI компоненти (Dialog / Popups):
```jsx
<radix.Dialog>
  <radix.DialogTrigger>
    <ws.element ws:tag='button'>Відкрити Попап</ws.element>
  </radix.DialogTrigger>
  <radix.DialogOverlay ws:style={css`position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;`}>
    <radix.DialogContent ws:style={css`background: #fff; border-radius: 20px; padding: 32px; max-width: 500px;`}>
      <$.Box>
        <radix.DialogTitle>Заголовок Попапу</radix.DialogTitle>
        <radix.DialogDescription>Опис модального вікна</radix.DialogDescription>
      </$.Box>
      <radix.DialogClose>✕</radix.DialogClose>
    </radix.DialogContent>
  </radix.DialogOverlay>
</radix.Dialog>
```

#### 🎬 Нативні Webstudio Animation Groups (`<animation.AnimateChildren>`):
```json
{
  "updates": [
    {
      "instanceId": "<animation-instance-id>",
      "name": "action",
      "type": "animationAction",
      "value": {
        "type": "view",
        "animations": [
          {
            "timing": {
              "duration": { "type": "unit", "value": 800, "unit": "ms" },
              "rangeStart": { "type": "unit", "value": 10, "unit": "%" },
              "easing": "ease-out",
              "fill": "backwards"
            },
            "keyframes": [
              { "offset": 0, "styles": { "opacity": "0", "transform": "translateY(40px)" } },
              { "offset": 1, "styles": { "opacity": "1", "transform": "translateY(0px)" } }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## ☁️ Синхронізація у Webstudio Cloud

Коли ви завершили генерацію або редагування сторінок, синхронізуйте весь проект у хмару однією командою:
```bash
webstudio import --to "https://apps.webstudio.is/builder/<projectId>?authToken=<token>"
```

---

## 📜 Ліцензія

Цей проект поширюється під ліцензією [MIT](LICENSE).

Автор: **R0STEFAN**
