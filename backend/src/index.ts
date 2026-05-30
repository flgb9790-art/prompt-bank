import compression from "compression";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { config, logResolvedPublicUrls, uploadsDir } from "./config";
import { prisma } from "./db";
import promptsRouter from "./routes/prompts.routes";
import categoriesRouter from "./routes/categories.routes";
import uploadRouter from "./routes/upload.routes";
import tagsRouter from "./routes/tags.routes";
import bootstrapRouter from "./routes/bootstrap.routes";
import meRouter from "./routes/me.routes";
import adminRouter from "./routes/admin.routes";
import { extractKeywords } from "./keywordExtractor";
import { startBot } from "./bot";
import { authRequired, isAdminRequest, readTelegramId } from "./auth";
import { PromptService } from "./services/prompt.service";
import { migrateSupabaseMedia } from "./services/migrate-supabase-media.service";

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "3mb" }));

fs.mkdirSync(path.join(uploadsDir, "images"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "images", "thumbs"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "videos"), { recursive: true });

app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    etag: true,
    lastModified: true
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/me", meRouter);
app.use("/api/admin", adminRouter);

app.use("/api/prompts", promptsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/upload", authRequired, uploadRouter);

app.delete("/api/examples/:id", authRequired, async (req, res, next) => {
  try {
    await prisma.mediaExample.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Unexpected error" });
});

const categoriesSeed = [
  { name: "Image Prompts", slug: "image-prompts", icon: "📸", color: "#8b5cf6", sortOrder: 1 },
  { name: "Video Prompts", slug: "video-prompts", icon: "🎬", color: "#3b82f6", sortOrder: 2 },
  { name: "Cursor / Codex", slug: "cursor-codex", icon: "🧠", color: "#6366f1", sortOrder: 3 },
  { name: "Telegram Bot", slug: "telegram-bot", icon: "🤖", color: "#60a5fa", sortOrder: 4 },
  { name: "Beauty / Cosmetology", slug: "beauty-cosmetology", icon: "💄", color: "#ec4899", sortOrder: 5 },
  { name: "Logo / Branding", slug: "logo-branding", icon: "🎨", color: "#f59e0b", sortOrder: 6 },
  { name: "Landing Pages", slug: "landing-pages", icon: "🖥", color: "#10b981", sortOrder: 7 },
  { name: "Ads / Marketing", slug: "ads-marketing", icon: "📢", color: "#f97316", sortOrder: 8 },
  { name: "Sketchbook", slug: "sketchbook", icon: "📓", color: "#14b8a6", sortOrder: 9 },
  { name: "Other", slug: "other", icon: "📦", color: "#64748b", sortOrder: 10 }
];

async function seedInitialData() {
  for (const category of categoriesSeed) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category
    });
  }

  if (!config.seedDemoData) {
    return;
  }

  const promptsCount = await prisma.prompt.count();
  if (promptsCount > 0) {
    return;
  }

  await prisma.user.upsert({
    where: { telegramId: "1" },
    update: {},
    create: { telegramId: "1", username: "mock_user", firstName: "Mock", lastName: "User" }
  });

  const baseUser = await prisma.user.findUniqueOrThrow({ where: { telegramId: "1" } });
  const categories = await prisma.category.findMany();
  const getCategoryId = (slug: string) => categories.find((item: any) => item.slug === slug)?.id ?? categories[0].id;

  const demoPrompts = [
    {
      title: "Beauty Portrait - Identity Preservation",
      content:
        "Create a realistic beauty portrait with identity preservation, studio light, lips and skin texture details.",
      categoryId: getCategoryId("beauty-cosmetology")
    },
    {
      title: "Cursor - React Component",
      content:
        "Build a clean reusable React component with TypeScript props, responsive behavior, and accessibility support.",
      categoryId: getCategoryId("cursor-codex")
    },
    {
      title: "Telegram Bot - Booking System",
      content:
        "Generate a Telegram bot booking flow with calendar selection, validation, and confirmation summary.",
      categoryId: getCategoryId("telegram-bot")
    },
    {
      title: "Tropical Beach Video Prompt",
      content: "Cinematic tropical beach video, dolly movement, golden hour, realistic waves, 4k quality.",
      categoryId: getCategoryId("video-prompts")
    },
    {
      title: "Logo Design Gradient Prompt",
      content: "Create a modern logo branding concept with blue-purple gradient, minimal shape and premium style.",
      categoryId: getCategoryId("logo-branding")
    }
  ];

  for (const prompt of demoPrompts) {
    const created = await prisma.prompt.create({
      data: {
        userId: baseUser.id,
        title: prompt.title,
        content: prompt.content,
        categoryId: prompt.categoryId
      }
    });

    const keywords = extractKeywords(prompt.content);
    for (const key of keywords) {
      const keyword = await prisma.keyword.upsert({
        where: { name: key },
        update: {},
        create: { name: key }
      });
      await prisma.promptKeyword.create({
        data: { promptId: created.id, keywordId: keyword.id }
      });
    }
  }
}

async function ensureSearchExtensions() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Prompt_title_trgm_idx" ON "Prompt" USING gin (title gin_trgm_ops)`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Prompt_content_trgm_idx" ON "Prompt" USING gin (content gin_trgm_ops)`
    );
  } catch (error) {
    console.warn("Search extensions setup skipped:", error);
  }
}

async function bootstrap() {
  logResolvedPublicUrls();
  // Schema: `npx prisma db push` against Railway Postgres (DATABASE_PUBLIC_URL from local).
  await seedInitialData();
  await ensureSearchExtensions();
  if (process.env.MIGRATE_SUPABASE_MEDIA === "true") {
    await migrateSupabaseMedia();
  }
  app.listen(config.port, () => {
    console.log(`Backend running on http://localhost:${config.port}`);
  });
  startBot().catch((error) => {
    console.error("Bot startup error:", error);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
