# Домен prompt-bank.one

Рекомендуемая схема (два поддомена на Railway):

| Назначение | URL | Сервис Railway |
|------------|-----|----------------|
| Mini App + веб | `https://prompt-bank.one` | **miniapp** |
| API + медиа `/uploads` | `https://api.prompt-bank.one` | **backend** |

Старые `*.up.railway.app` можно оставить как запасные, но в переменных окружения и BotFather используйте домен выше.

---

## 1. DNS у регистратора домена

В панели DNS (где куплен `prompt-bank.one`) добавьте записи **как показывает Railway** для каждого сервиса:

1. Railway → сервис **miniapp** → **Settings** → **Networking** → **Custom Domain** → `prompt-bank.one`  
   Скопируйте тип записи (обычно `CNAME` на `….up.railway.app`).

2. Railway → сервис **backend** → **Networking** → **Custom Domain** → `api.prompt-bank.one`  
   Добавьте вторую запись (поддомен `api`).

Дождитесь статуса **Active** / зелёной галочки в Railway (5–30 минут).

Проверка:

```bash
curl -I https://prompt-bank.one
curl https://api.prompt-bank.one/api/health
```

Ожидается: HTML/200 на сайте и `{"ok":true}` на health.

---

## 2. Переменные Railway — сервис **backend**

**Settings → Variables** (или Shared Variables, если один набор на проект):

```env
NODE_ENV=production

WEBAPP_URL=https://prompt-bank.one
PUBLIC_SITE_URL=https://prompt-bank.one

PUBLIC_BACKEND_URL=https://api.prompt-bank.one
BACKEND_URL=https://api.prompt-bank.one
MEDIA_PUBLIC_URL=https://api.prompt-bank.one

BOT_TOKEN=<токен из BotFather>
TELEGRAM_BOT_TOKEN=<тот же или отдельный бот для канала>
TELEGRAM_BOT_USERNAME=prmtb_bot
TELEGRAM_CHANNEL_ID=<@канал или -100…>
TELEGRAM_CHANNEL_URL=https://t.me/<ваш_канал>

ADMIN_TELEGRAM_IDS=<ваш telegram id>
DATABASE_URL=<postgres url>
DIRECT_URL=<postgres direct url>
UPLOADS_DIR=/data/uploads
```

После сохранения: **Redeploy** backend.

В логах при старте должно быть:

```text
[config] WEBAPP_URL (mini app): https://prompt-bank.one
[config] PUBLIC_BACKEND_URL (media API): https://api.prompt-bank.one
```

---

## 3. Переменные Railway — сервис **miniapp**

```env
BACKEND_URL=https://api.prompt-bank.one
```

Опционально на этапе сборки (если не задаёте только при старте):

```env
VITE_BACKEND_URL=https://api.prompt-bank.one
VITE_TELEGRAM_BOT_USERNAME=prmtb_bot
VITE_TELEGRAM_CHANNEL_URL=https://t.me/<ваш_канал>
```

После сохранения: **Redeploy** miniapp.

Проверка в браузере: откройте `https://prompt-bank.one`, в DevTools → Network запросы к API идут на `https://api.prompt-bank.one/api/...`.

---

## 4. BotFather (вручную)

### Кнопка меню Mini App

1. Откройте [@BotFather](https://t.me/BotFather).
2. `/mybots` → ваш бот → **Bot Settings** → **Menu Button** → **Configure menu button**.
3. Тип: **Web App**.
4. URL: `https://prompt-bank.one` (без слэша в конце).
5. Текст кнопки, например: `Prompt Bank`.

Либо команда (подставьте username бота):

```text
/setmenubutton
@prmtb_bot
Prompt Bank
https://prompt-bank.one
```

Бот при перезапуске backend тоже выставляет menu button из `WEBAPP_URL`, если токен и URL корректны.

### Домен для Telegram Login (веб-вход)

Если на сайте есть «Войти через Telegram»:

1. BotFather → `/setdomain`
2. Выберите бота.
3. Укажите домен: `prompt-bank.one` (без `https://`).

---

## 5. Если API пока без поддомена

Временно можно оставить API на Railway:

```env
PUBLIC_BACKEND_URL=https://prompt-bank-production.up.railway.app
BACKEND_URL=https://prompt-bank-production.up.railway.app
```

На miniapp:

```env
BACKEND_URL=https://prompt-bank-production.up.railway.app
```

Но **WEBAPP_URL** и BotFather всё равно должны быть `https://prompt-bank.one`.

Когда подключите `api.prompt-bank.one`, замените все `PUBLIC_BACKEND_URL` / `BACKEND_URL` на новый домен и сделайте Redeploy обоих сервисов.

---

## 6. Чеклист

- [ ] DNS: `prompt-bank.one` → miniapp, `api.prompt-bank.one` → backend  
- [ ] Railway backend: `WEBAPP_URL`, `PUBLIC_BACKEND_URL`, redeploy  
- [ ] Railway miniapp: `BACKEND_URL`, redeploy  
- [ ] BotFather: Menu Button = `https://prompt-bank.one`  
- [ ] BotFather: `/setdomain` → `prompt-bank.one` (если нужен вход на сайте)  
- [ ] Открыть Mini App из Telegram — каталог и картинки грузятся  
