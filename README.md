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

## 7) Домен и URL (prompt-bank.one)

Полная инструкция: **[docs/DOMAIN.md](docs/DOMAIN.md)** — DNS, переменные Railway (backend + miniapp), BotFather.

Кратко:

- `https://prompt-bank.one` — Mini App и кнопка меню в Telegram  
- `https://api.prompt-bank.one` — API и медиа `/uploads`  
- Не подставляйте URL API в `WEBAPP_URL` — Telegram вернёт `wrong type of the web page content`

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

## 10) Telegram Channel Publishing

Админ может автоматически публиковать новый промпт в Telegram-канал при сохранении.

### Настройка

1. Создайте бота через [@BotFather](https://t.me/BotFather).
2. Добавьте бота в канал **администратором** с правом публиковать сообщения.
3. Заполните в `.env`:
   - `TELEGRAM_BOT_TOKEN` (или используйте `BOT_TOKEN`, если это тот же бот)
   - `TELEGRAM_CHANNEL_ID` — `@your_channel` или `-1001234567890`
   - `PUBLIC_SITE_URL` — публичный URL сайта/Mini App для ссылок в посте
   - `PUBLIC_BACKEND_URL` — публичный URL backend для медиа (`/uploads/...`), если отличается
   - `ADMIN_TELEGRAM_IDS` — Telegram ID админов через запятую
4. Примените миграцию схемы:
   ```bash
   npm --prefix backend run prisma:push
   ```
5. Перезапустите backend.

### Использование

- На сайте и в Mini App у админа в форме добавления промпта есть checkbox **«Опубликовать в Telegram-канале»**.
- После сохранения backend отправляет пост в канал по шаблону с cover/example медиа.
- Если публикация не удалась, промпт всё равно сохраняется; ошибка видна админу в деталях промпта.
- В деталях промпта админ может вручную опубликовать или повторить публикацию:
  `POST /api/admin/prompts/:id/publish-telegram`

## 11) Pinterest Publishing

Админ может автоматически публиковать новый промпт в Pinterest при сохранении. Пин ведёт в Telegram-канал (не на сайт).

### Настройка

1. Создайте приложение в [Pinterest Developers](https://developers.pinterest.com/).
2. Получите access token с правами на создание pins.
3. Получите `board_id` нужной доски Pinterest.
4. Заполните в `.env`:
   - `PINTEREST_ACCESS_TOKEN`
   - `PINTEREST_BOARD_ID`
   - `PINTEREST_API_BASE_URL` (по умолчанию `https://api.pinterest.com/v5`)
   - `TELEGRAM_CHANNEL_URL` — публичная ссылка на канал, например `https://t.me/promptbank_channel`
   - `PUBLIC_BACKEND_URL` — публичный URL для изображений (`/uploads/...`), если отличается от `BACKEND_URL`
5. Убедитесь, что изображения доступны по публичному HTTPS URL.
6. Примените миграцию схемы:
   ```bash
   npm --prefix backend run prisma:push
   ```
7. Перезапустите backend.

Для preview Pinterest-публикации в miniapp можно указать `VITE_TELEGRAM_CHANNEL_URL` в `miniapp/.env`.

### Использование

- У админа в форме добавления промпта есть checkbox **«Опубликовать в Pinterest»**.
- После сохранения backend создаёт image pin с title, description и destination link на Telegram-канал.
- Для Pinterest используется cover image или первый example image. Video pins в MVP не поддерживаются.
- Если публикация не удалась, промпт всё равно сохраняется; ошибка видна админу в деталях промпта.
- Telegram и Pinterest публикуются независимо друг от друга.
- Ручная публикация или повтор после ошибки:
  `POST /api/admin/prompts/:id/publish-pinterest`

## 12) Структура проекта

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
