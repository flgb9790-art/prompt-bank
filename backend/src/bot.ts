import { Markup, Telegraf } from "telegraf";
import { config } from "./config";
import { assertTelegramWebAppPage } from "./utils/telegramWebContent";
import { prisma } from "./db";
import { PromptService } from "./services/prompt.service";
import { extractKeywords } from "./keywordExtractor";
import { saveFromRemoteUrl } from "./services/media.service";

type MediaType = "image" | "video";

type AddPromptState = {
  step: "content" | "category" | "cover" | "examples";
  content?: string;
  categoryId?: number;
  categoryName?: string;
  coverMediaUrl?: string;
  coverMediaType?: MediaType;
  examples: Array<{ url: string; type: MediaType; originalName?: string }>;
};

type UserState = {
  mode: "idle" | "adding" | "searching";
  addPrompt?: AddPromptState;
};

const userStates = new Map<number, UserState>();

const categoryChoices = [
  { slug: "image-prompts", name: "Image Prompts", label: "📸 Image" },
  { slug: "video-prompts", name: "Video Prompts", label: "🎬 Video" },
  { slug: "cursor-codex", name: "Cursor / Codex", label: "🧠 Cursor" },
  { slug: "telegram-bot", name: "Telegram Bot", label: "🤖 Telegram Bot" },
  { slug: "beauty-cosmetology", name: "Beauty / Cosmetology", label: "💄 Beauty" },
  { slug: "logo-branding", name: "Logo / Branding", label: "🎨 Logo" },
  { slug: "landing-pages", name: "Landing Pages", label: "🖥 Landing" },
  { slug: "ads-marketing", name: "Ads / Marketing", label: "📢 Ads" },
  { slug: "sketchbook", name: "Sketchbook", label: "📓 Sketchbook" },
  { slug: "other", name: "Other", label: "📦 Other" }
];

const menuLabels = {
  add: "➕ Добавить промпт",
  search: "🔎 Найти промпт",
  recent: "🕘 Последние",
  favorites: "⭐ Избранное",
  categories: "📂 Категории",
  help: "ℹ️ Помощь"
};

function getExamplesActionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Готово", "add_examples_done"), Markup.button.callback("⏭ Пропустить", "add_examples_skip")]
  ]);
}

function isBotAdmin(telegramId: number) {
  return config.adminTelegramIds.includes(String(telegramId));
}

function getMainReplyMenu() {
  return Markup.keyboard([
    [menuLabels.add, menuLabels.search],
    [menuLabels.recent, menuLabels.favorites],
    [menuLabels.categories, menuLabels.help]
  ]).resize();
}

async function showUserWelcome(ctx: any) {
  const cleared = await ctx.reply("…", Markup.removeKeyboard());
  await ctx.deleteMessage(cleared.message_id).catch(() => undefined);
  await ctx.reply(
    "👋 Добро пожаловать в Prompt Bank!\n\nЗдесь собраны готовые промпты: ищите по категориям и тегам, копируйте и сохраняйте в избранное.\n\nОткройте приложение, чтобы начать.",
    Markup.inlineKeyboard([[Markup.button.webApp("🌐 Открыть Prompt Bank", buildMiniAppUrl())]])
  );
}

async function showAdminWelcome(ctx: any) {
  await ctx.reply(
    "👋 Добро пожаловать в Prompt Bank!\nЗдесь можно хранить промпты, примеры изображений/видео, категории и быстро копировать лучшие промпты.\nВыберите действие ниже:",
    getMainReplyMenu()
  );
}

async function showWelcome(ctx: any) {
  const from = ctx.from;
  if (!from) return;
  if (isBotAdmin(from.id)) {
    await showAdminWelcome(ctx);
  } else {
    await showUserWelcome(ctx);
  }
}

async function denyNonAdminAdd(ctx: any) {
  await ctx.reply(
    "Добавлять и редактировать промпты могут только администраторы.\nОткройте приложение, чтобы просматривать и копировать промпты.",
    Markup.inlineKeyboard([[Markup.button.webApp("🌐 Открыть Prompt Bank", buildMiniAppUrl())]])
  );
}

async function ensureUser(telegramUser: { id: number; username?: string; first_name?: string; last_name?: string }) {
  return prisma.user.upsert({
    where: { telegramId: String(telegramUser.id) },
    update: {
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name
    },
    create: {
      telegramId: String(telegramUser.id),
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name
    }
  });
}

function buildMiniAppUrl(promptId?: number) {
  const url = new URL(config.webAppUrl);
  if (promptId) {
    url.searchParams.set("prompt", String(promptId));
  }
  return url.toString();
}

function promptResultKeyboard(id: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 Скопировать", `copy_${id}`), Markup.button.webApp("👁 Открыть", buildMiniAppUrl(id))]
  ]);
}

async function showPromptList(ctx: any, prompts: any[], emptyText: string) {
  if (!prompts.length) {
    await ctx.reply(emptyText);
    return;
  }

  for (const prompt of prompts.slice(0, 5)) {
    const tags = prompt.keywords.map((kw: any) => `#${kw.keyword.name}`).join(" ");
    const preview = prompt.content.length > 120 ? `${prompt.content.slice(0, 119)}…` : prompt.content;
    await ctx.reply(
      `${preview}\n\nКатегория: ${prompt.category.name}\nКлючевые слова: ${tags || "—"}`,
      { parse_mode: "Markdown", ...promptResultKeyboard(prompt.id) }
    );
  }
}

async function handleTelegramMedia(ctx: any) {
  const message = ctx.message;
  if (!message) {
    return null;
  }

  if ("photo" in message && Array.isArray(message.photo) && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    return saveFromRemoteUrl(fileLink.toString(), "image", "telegram-photo.jpg");
  }

  if ("video" in message && message.video) {
    const fileLink = await ctx.telegram.getFileLink(message.video.file_id);
    return saveFromRemoteUrl(fileLink.toString(), "video", message.video.file_name ?? "telegram-video.mp4");
  }

  return null;
}

async function beginAddPromptFlow(ctx: any, fromId: number) {
  if (!isBotAdmin(fromId)) {
    await denyNonAdminAdd(ctx);
    return;
  }
  userStates.set(fromId, { mode: "adding", addPrompt: { step: "content", examples: [] } });
  await ctx.reply("Введите текст промпта:");
}

async function beginSearchFlow(ctx: any, fromId: number) {
  userStates.set(fromId, { mode: "searching" });
  await ctx.reply("Введите слово, тег или часть текста для поиска:");
}

async function showRecentPrompts(ctx: any) {
  const prompts = await prisma.prompt.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { category: true, keywords: { include: { keyword: true } } }
  });
  await showPromptList(ctx, prompts, "Пока нет сохраненных промптов.");
}

async function showFavoritePrompts(ctx: any) {
  const from = ctx.from;
  if (!from) return;

  const user = await ensureUser(from);
  const prompts = await prisma.prompt.findMany({
    where: { favorites: { some: { userId: user.id } } },
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: { category: true, keywords: { include: { keyword: true } } }
  });
  await showPromptList(ctx, prompts, "Пока нет избранных промптов.");
}

async function showCategories(ctx: any) {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const buttons = categories.map((category: any) =>
    [Markup.button.callback(`${category.icon ?? "📂"} ${category.name}`, `category_${category.slug}`)]
  );
  await ctx.reply("Выберите категорию:", Markup.inlineKeyboard(buttons));
}

async function showHelp(ctx: any) {
  const from = ctx.from;
  if (!from) return;

  if (isBotAdmin(from.id)) {
    await ctx.reply(
      "Prompt Bank помогает хранить промпты, примеры, категории и теги.\nЧто можно делать:\n➕ Добавлять промпты\n🖼 Прикреплять картинки и видео\n🔎 Искать по тексту и тегам\n⭐ Добавлять в избранное\n📋 Быстро копировать промпт\n🌐 Управлять всем через Mini App"
    );
    return;
  }

  await ctx.reply(
    "Prompt Bank — библиотека готовых промптов.\n\n🔎 Искать по тексту и тегам\n⭐ Сохранять в личное избранное\n📋 Копировать промпты в один клик\n🌐 Открыть полный каталог в приложении",
    Markup.inlineKeyboard([[Markup.button.webApp("🌐 Открыть Prompt Bank", buildMiniAppUrl())]])
  );
}

export async function startBot() {
  if (!config.botToken) {
    console.warn("BOT_TOKEN is empty. Telegram bot is disabled.");
    return;
  }

  const bot = new Telegraf(config.botToken);
  await bot.telegram.setMyCommands([
    { command: "start", description: "Открыть главное меню Prompt Bank" }
  ]);

  const miniAppUrl = buildMiniAppUrl();
  try {
    await assertTelegramWebAppPage(miniAppUrl);
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Prompt Bank",
        web_app: { url: miniAppUrl }
      }
    });
    console.info("Chat menu WebApp URL:", miniAppUrl);
  } catch (error) {
    console.warn("Failed to set chat menu button:", error);
  }

  bot.start(async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ensureUser(from);
    userStates.set(from.id, { mode: "idle" });
    await showWelcome(ctx);
  });

  bot.action("menu_add_prompt", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    await beginAddPromptFlow(ctx, from.id);
  });

  bot.action("menu_search_prompt", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    await beginSearchFlow(ctx, from.id);
  });

  bot.action("menu_recent", async (ctx) => {
    await ctx.answerCbQuery();
    await showRecentPrompts(ctx);
  });

  bot.action("menu_favorites", async (ctx) => {
    await ctx.answerCbQuery();
    await showFavoritePrompts(ctx);
  });

  bot.action("menu_categories", async (ctx) => {
    await ctx.answerCbQuery();
    await showCategories(ctx);
  });

  bot.action("menu_help", async (ctx) => {
    await ctx.answerCbQuery();
    await showHelp(ctx);
  });

  bot.hears(menuLabels.add, async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    await beginAddPromptFlow(ctx, from.id);
  });

  bot.hears(menuLabels.search, async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    await beginSearchFlow(ctx, from.id);
  });

  bot.hears(menuLabels.recent, async (ctx) => {
    await showRecentPrompts(ctx);
  });

  bot.hears(menuLabels.favorites, async (ctx) => {
    await showFavoritePrompts(ctx);
  });

  bot.hears(menuLabels.categories, async (ctx) => {
    await showCategories(ctx);
  });

  bot.hears(menuLabels.help, async (ctx) => {
    await showHelp(ctx);
  });

  bot.action(/^category_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const slug = ctx.match[1];
    const prompts = await prisma.prompt.findMany({
      where: { category: { slug } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { category: true, keywords: { include: { keyword: true } } }
    });
    await showPromptList(ctx, prompts, "В этой категории пока нет промптов.");
  });

  bot.action(/^copy_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Скопируйте текст из сообщения ниже");
    const id = Number(ctx.match[1]);
    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt) {
      await ctx.reply("Промпт не найден.");
      return;
    }
    await prisma.prompt.update({ where: { id }, data: { usageCount: { increment: 1 } } });
    await ctx.reply(`📋 ${prompt.content}`);
  });


  bot.action("add_skip_cover", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    const state = userStates.get(from.id);
    if (!state?.addPrompt || state.mode !== "adding") {
      return;
    }
    state.addPrompt.step = "examples";
    await ctx.reply(
      "Хотите добавить примеры результата? Можно отправить несколько картинок или видео. Когда закончите, нажмите кнопку ‘Готово’.",
      getExamplesActionKeyboard()
    );
  });

  bot.action("add_examples_skip", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    const state = userStates.get(from.id);
    if (!state?.addPrompt || state.mode !== "adding") {
      return;
    }
    state.addPrompt.examples = [];
    await finalizePrompt(ctx, from.id);
  });

  bot.action("add_examples_done", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    const state = userStates.get(from.id);
    if (!state?.addPrompt || state.mode !== "adding") {
      return;
    }
    await finalizePrompt(ctx, from.id);
  });

  bot.action("after_add_more", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    if (!isBotAdmin(from.id)) {
      await denyNonAdminAdd(ctx);
      return;
    }
    userStates.set(from.id, { mode: "adding", addPrompt: { step: "content", examples: [] } });
    await ctx.reply("Введите текст промпта:");
  });

  bot.action("after_add_menu", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    userStates.set(from.id, { mode: "idle" });
    await showWelcome(ctx);
  });

  bot.action(/^add_cat_(.+)$/, async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }
    await ctx.answerCbQuery();
    if (!isBotAdmin(from.id)) {
      await denyNonAdminAdd(ctx);
      return;
    }
    const state = userStates.get(from.id);
    if (!state || state.mode !== "adding" || !state.addPrompt) {
      return;
    }
    const slug = ctx.match[1];
    const category = await prisma.category.findUnique({ where: { slug } });
    if (!category) {
      await ctx.reply("Категория не найдена, попробуйте еще раз.");
      return;
    }

    state.addPrompt.categoryId = category.id;
    state.addPrompt.categoryName = category.name;
    state.addPrompt.step = "cover";

    await ctx.reply(
      "Отправьте картинку или видео для заставки промпта.\nМожно пропустить этот шаг.",
      Markup.inlineKeyboard([[Markup.button.callback("⏭ Пропустить", "add_skip_cover")]])
    );
  });

  bot.on("message", async (ctx, next) => {
    const from = ctx.from;
    if (!from) {
      return next();
    }
    const state = userStates.get(from.id);
    if (!state) {
      return next();
    }

    try {
      if (state.mode === "searching") {
        if (!("text" in ctx.message)) {
          await ctx.reply("Пожалуйста, отправьте текст для поиска.");
          return;
        }

        const search = ctx.message.text.trim();
        const { items: prompts } = await PromptService.list({ search, limit: 5 });
        await showPromptList(ctx, prompts, "Ничего не найдено. Попробуйте другой запрос.");
        state.mode = "idle";
        return;
      }

      if (state.mode !== "adding" || !state.addPrompt) {
        return next();
      }

      if (!isBotAdmin(from.id)) {
        state.mode = "idle";
        await denyNonAdminAdd(ctx);
        return;
      }

      const add = state.addPrompt;
      if (add.step === "content") {
        if (!("text" in ctx.message)) {
          await ctx.reply("Пожалуйста, отправьте текст промпта.");
          return;
        }
        add.content = ctx.message.text.trim();
        add.step = "category";
        const rows = [];
        for (let i = 0; i < categoryChoices.length; i += 2) {
          const left = categoryChoices[i];
          const right = categoryChoices[i + 1];
          rows.push(
            right
              ? [
                  Markup.button.callback(left.label, `add_cat_${left.slug}`),
                  Markup.button.callback(right.label, `add_cat_${right.slug}`)
                ]
              : [Markup.button.callback(left.label, `add_cat_${left.slug}`)]
          );
        }
        await ctx.reply("Выберите категорию промпта:", Markup.inlineKeyboard(rows));
        return;
      }

      if (add.step === "cover") {
        const media = await handleTelegramMedia(ctx);
        if (!media) {
          await ctx.reply("Пожалуйста, отправьте картинку или видео, либо нажмите «⏭ Пропустить».");
          return;
        }
        add.coverMediaUrl = media.url;
        add.coverMediaType = media.type;
        add.step = "examples";
        await ctx.reply(
          "Хотите добавить примеры результата? Можно отправить несколько картинок или видео. Когда закончите, нажмите кнопку ‘Готово’.",
          getExamplesActionKeyboard()
        );
        return;
      }

      if (add.step === "examples") {
        const media = await handleTelegramMedia(ctx);
        if (!media) {
          await ctx.reply("Ожидаю картинку или видео. Когда закончите, нажмите «✅ Готово».", getExamplesActionKeyboard());
          return;
        }
        add.examples.push({ url: media.url, type: media.type, originalName: media.originalName });
        await ctx.reply("Пример добавлен. Можете отправить еще или нажать «✅ Готово».", getExamplesActionKeyboard());
        return;
      }
    } catch (error) {
      console.error(error);
      await ctx.reply("Не удалось обработать сообщение. Попробуйте еще раз.");
    }

    return next();
  });

  bot.catch((error, ctx) => {
    console.error("Bot error:", error);
    ctx.reply("Произошла ошибка. Попробуйте еще раз чуть позже.");
  });

  await bot.launch();
  console.log("Telegram bot started");
}

async function finalizePrompt(ctx: any, telegramUserId: number) {
  const state = userStates.get(telegramUserId);
  if (!state?.addPrompt) {
    return;
  }

  const add = state.addPrompt;
  if (!add.content || !add.categoryId) {
    await ctx.reply("Не хватает данных для сохранения. Запустите добавление заново.");
    userStates.set(telegramUserId, { mode: "idle" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: String(telegramUserId) }
  });
  if (!user) {
    await ctx.reply("Пользователь не найден. Используйте /start и попробуйте снова.");
    return;
  }

  try {
    const prompt = await PromptService.create({
      userId: user.id,
      content: add.content,
      categoryId: add.categoryId,
      coverMediaUrl: add.coverMediaUrl,
      coverMediaType: add.coverMediaType,
      examples: add.examples
    });

    const keywords = extractKeywords(add.content).slice(0, 6).map((k) => `#${k}`).join(" ");
    await ctx.reply(
      `✅ Промпт сохранен!\nКатегория: ${add.categoryName ?? prompt.category.name}\nКлючевые слова: ${keywords || "—"}\nМедиа: ${add.coverMediaUrl ? "1 заставка" : "0 заставок"}, ${add.examples.length} примера`,
      Markup.inlineKeyboard([
        [Markup.button.webApp("🌐 Открыть в Mini App", buildMiniAppUrl(prompt.id))],
        [Markup.button.callback("➕ Добавить еще", "after_add_more")],
        [Markup.button.callback("🏠 Главное меню", "after_add_menu")]
      ])
    );

    userStates.set(telegramUserId, { mode: "idle" });
  } catch (error) {
    console.error("finalizePrompt error:", error);
    await ctx.reply("Не удалось сохранить промпт. Попробуйте еще раз.");
    userStates.set(telegramUserId, { mode: "idle" });
  }
}
