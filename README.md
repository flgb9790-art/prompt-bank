# Prompt Bank Telegram Mini App (MVP)

Prompt Bank MVP: Telegram-бот + Telegram Mini App для хранения промптов, категорий, тегов, изображений/видео-примеров и быстрого поиска.

## 1) Описание проекта

- Backend: `Node.js + TypeScript + Express + Prisma + SQLite + Telegraf + Multer`
- Mini App: `React + Vite + TypeScript + Tailwind CSS + Lucide`
- Ключевые функции:
  - CRUD промптов
  - категории и теги
  - автогенерация ключевых слов из текста
  - избранное и usage-count
  - загрузка cover/examples (image/video)
  - Telegram-бот с пошаговым сценарием добавления

## 2) Как установить зависимости

```bash
npm run install:all
```

## 3) Как создать `.env`

1. Скопируйте `.env.example` в `.env` в корне проекта.
2. Заполните переменные:
   - `BOT_TOKEN`
   - `WEBAPP_URL`
   - `BACKEND_URL`
   - `PORT`
   - `ADMIN_TELEGRAM_IDS` (через запятую, кто может редактировать/удалять промпты)
3. Для miniapp создайте `miniapp/.env` на основе `miniapp/.env.example`:
   - `VITE_BACKEND_URL=http://localhost:3001` (локально)
   - для Telegram через ngrok укажите публичный `https://...` URL backend.

## 4) Как запустить Prisma migrate

```bash
npm run prisma:migrate
```

## 5) Как запустить dev

```bash
npm run dev
```

Запускается сразу:
- backend: `http://localhost:3001`
- miniapp: `http://localhost:5173`

## 6) Как подключить Telegram BotFather

1. Создайте бота через [@BotFather](https://t.me/BotFather) (`/newbot`).
2. Скопируйте токен и вставьте в `BOT_TOKEN`.
3. Установите кнопку меню/описание при необходимости (`/setdescription`, `/setuserpic`).

## 7) Как указать URL mini app

В BotFather используйте `/setmenubutton` и укажите `WEBAPP_URL`.

## 8) Как использовать через ngrok для Telegram Mini App

1. Запустите backend и miniapp локально (`npm run dev`).
2. Поднимите публичный URL для miniapp:
   ```bash
   ngrok http 5173
   ```
3. Поставьте `WEBAPP_URL=https://<your-ngrok>.ngrok-free.app`.
4. Перезапустите backend.
5. В BotFather обновите menu button URL на ngrok-ссылку.

## 9) Основные команды бота

- `/start` - открыть меню Prompt Bank
- Inline-действия:
  - `🌐 Открыть Prompt Bank`
  - `➕ Добавить промпт`
  - `🔎 Найти промпт`
  - `🕘 Последние`
  - `⭐ Избранное`
  - `📂 Категории`
  - `ℹ️ Помощь`

## 10) Структура проекта

```text
prompt-bank-telegram-miniapp/
  README.md
  .env.example
  package.json
  tsconfig.json
  backend/
    package.json
    tsconfig.json
    prisma/
      schema.prisma
    src/
      index.ts
      bot.ts
      config.ts
      db.ts
      keywordExtractor.ts
      routes/
        prompts.routes.ts
        categories.routes.ts
        upload.routes.ts
      services/
        prompt.service.ts
        media.service.ts
      uploads/
        images/
        videos/
  miniapp/
    package.json
    index.html
    vite.config.ts
    tsconfig.json
    tailwind.config.js
    postcss.config.js
    src/
      main.tsx
      App.tsx
      api.ts
      types.ts
      styles.css
      components/
        Layout.tsx
        BottomNav.tsx
        PromptCard.tsx
        PromptForm.tsx
        CategoryTabs.tsx
        SearchBar.tsx
        MediaUploader.tsx
        PromptDetailsModal.tsx
      pages/
        HomePage.tsx
        PromptsPage.tsx
        AddPromptPage.tsx
        FavoritesPage.tsx
        ProfilePage.tsx
```
