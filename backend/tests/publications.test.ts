import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { prisma } from "../src/db";
import { config } from "../src/config";
import { parseTelegramPostLink, buildTelegramPostLink } from "../src/utils/telegramPostLink";
import { sendPromptToTelegram, splitTelegramText } from "../src/services/telegramPublisher.service";
import { buildPinterestPin, sendPromptToPinterest, preparePinterestPublication } from "../src/services/pinterestPublisher.service";
import { PromptService } from "../src/services/prompt.service";
import express from "express";
import adminRouter from "../src/routes/admin.routes";
import promptsRouter from "../src/routes/prompts.routes";
import { once } from "node:events";

// No real network or database calls: all publishers use the fake Prisma methods below.
const realFetch = global.fetch;
let prompt: any;
let telegramPublications: any[];
let pinterestPublications: any[];
let requests: Array<{ url: string; body: any }>;
let sequence: string[];
let failTelegram = false;
let failPinterest = false;
let nextMessage = 100;

function fakeCollection(getRows: () => any[]) {
  return {
    findFirst: async () => getRows().at(-1) ?? null,
    create: async ({ data }: any) => {
      const row = { id: getRows().length + 1, ...data };
      getRows().push(row); return row;
    },
    update: async ({ where, data }: any) => Object.assign(getRows().find((p) => p.id === where.id), data),
    updateMany: async () => ({ count: 0 })
  };
}

beforeEach(() => {
  prompt = {
    id: 1, title: "Sample", content: "Полный текст промпта", category: { name: "Image" },
    keywords: [], examples: [], coverMediaUrl: null, coverMediaType: null,
    telegramPostUrl: null, telegramPublished: false
  };
  telegramPublications = []; pinterestPublications = []; requests = []; sequence = [];
  failTelegram = false; failPinterest = false; nextMessage = 100;
  Object.assign(config, {
    telegramBotToken: "test-token", telegramChannelId: "-1001234567890",
    telegramChannelUrl: "https://t.me/sample_channel", telegramBotUsername: "sample_bot",
    pinterestAccessToken: "test-pin-token", pinterestBoardId: "board", adminTelegramIds: ["42"]
  });
  Object.assign(prisma.prompt, {
    findUnique: async () => prompt,
    findUniqueOrThrow: async () => prompt,
    update: async ({ data }: any) => {
      if (data.telegramPostUrl) sequence.push("save-telegram-link");
      return Object.assign(prompt, data);
    }
  });
  Object.assign(prisma.telegramPublication, fakeCollection(() => telegramPublications));
  Object.assign(prisma.user, { upsert: async () => ({ id: 1 }) });
  Object.assign(prisma.pinterestPublication, fakeCollection(() => pinterestPublications));
  (prisma as any).$transaction = async (ops: any[]) => Promise.all(ops);
  PromptService.invalidateDetailCache();
  global.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith("https://cdn.example.com/")) {
      return new Response(new Uint8Array(300), { headers: { "Content-Type": "image/jpeg" } });
    }
    const body = init.body instanceof FormData ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body);
    requests.push({ url: String(url), body });
    if (String(url).includes("api.telegram.org/")) {
      sequence.push("telegram");
      if (failTelegram) return new Response(JSON.stringify({ ok: false, description: "Forbidden" }), { status: 403 });
      const result = {
        message_id: nextMessage++, chat: { id: "-1001234567890", username: "sample_channel" }
      };
      return new Response(JSON.stringify({ ok: true, result: String(url).endsWith("sendMediaGroup")
        ? [result, { ...result, message_id: nextMessage++ }] : result }));
    }
    assert.ok(String(url).endsWith("/pins"), "Unexpected external request");
    sequence.push("pinterest");
    if (failPinterest) return new Response(JSON.stringify({ message: "Pinterest unavailable" }), { status: 503 });
    return new Response(JSON.stringify({ id: "1234567890123456789", link: body.link }));
  }) as typeof fetch;
});

after(() => { global.fetch = realFetch; });

test("validates post URLs, rejects channel/invite/non-Telegram URLs and normalizes tracking", () => {
  assert.equal(parseTelegramPostLink(" https://t.me/sample_channel/123?single ").url, "https://t.me/sample_channel/123");
  assert.deepEqual(parseTelegramPostLink("https://t.me/c/1234567890/45"), {
    url: "https://t.me/c/1234567890/45", messageId: "45", chatId: "-1001234567890"
  });
  for (const url of [null, "https://t.me/sample_channel", "https://example.com/123", "https://t.me/+invite", "javascript:alert(1)", "https://t.me/sample_channel/0", "https://t.me/share/123"]) {
    assert.throws(() => parseTelegramPostLink(url));
  }
  assert.equal(buildTelegramPostLink({ id: "-1001234567890" }, 45), "https://t.me/c/1234567890/45");
});

test("Telegram persists the message containing prompt text, then Pinterest uses its URL", async () => {
  assert.equal((await sendPromptToTelegram(1)).status, "published");
  assert.equal(prompt.telegramMessageId, "100");
  assert.equal(prompt.telegramPostUrl, "https://t.me/sample_channel/100");
  assert.ok(requests[0].body.text.includes(prompt.content));
  prompt.coverMediaUrl = "https://cdn.example.com/image.jpg"; prompt.coverMediaType = "image";
  await preparePinterestPublication(1, { title: "Custom title", description: "Custom description" });
  assert.equal(requests.length, 1, "Preparing preview must not create a pin");
  const result = await sendPromptToPinterest(1, undefined, prompt.telegramPostUrl);
  assert.equal(result.status, "published");
  assert.equal(requests.at(-1)!.body.link, prompt.telegramPostUrl);
  assert.equal(pinterestPublications.at(-1).pinterestPinId, "1234567890123456789");
  assert.equal(pinterestPublications.at(-1).publishedUrl, "https://www.pinterest.com/pin/1234567890123456789/");
  assert.ok(sequence.indexOf("save-telegram-link") < sequence.indexOf("pinterest"));
});

test("failed Telegram and missing destination never send a Pinterest API request", async () => {
  failTelegram = true;
  assert.equal((await sendPromptToTelegram(1)).status, "failed");
  const result = await sendPromptToPinterest(1, { link: config.telegramChannelUrl }, config.telegramChannelUrl);
  assert.equal(result.status, "failed");
  assert.match(result.error!, /нет ссылки на Telegram-пост/);
  assert.equal(requests.length, 1);
});

test("Pinterest retry never republishes Telegram and ignores old channel override", async () => {
  await sendPromptToTelegram(1);
  prompt.coverMediaUrl = "https://cdn.example.com/image.jpg"; prompt.coverMediaType = "image";
  failPinterest = true;
  assert.equal((await sendPromptToPinterest(1, { link: config.telegramChannelUrl }, prompt.telegramPostUrl)).status, "failed");
  failPinterest = false;
  assert.equal((await sendPromptToPinterest(1, undefined, prompt.telegramPostUrl)).status, "published");
  await sendPromptToTelegram(1);
  assert.equal(sequence.filter((item) => item === "telegram").length, 1);
  assert.equal(requests.at(-1)!.body.link, prompt.telegramPostUrl);
});

test("changed destination must be confirmed again", async () => {
  prompt.telegramPostUrl = "https://t.me/sample_channel/200";
  const result = await sendPromptToPinterest(1, undefined, "https://t.me/sample_channel/100");
  assert.equal(result.status, "failed");
  assert.equal(requests.length, 0);
});

test("templates use the saved post URL, never a channel fallback", () => {
  prompt.telegramPostUrl = "https://t.me/sample_channel/456";
  prompt.pinterestDescriptionTemplate = "Перейти: {{link}}";
  assert.equal(buildPinterestPin(prompt).description, "Перейти: https://t.me/sample_channel/456");
  assert.equal(buildPinterestPin(prompt, { link: "https://t.me/other_channel/123" }).destinationLink, prompt.telegramPostUrl);
  prompt.telegramPostUrl = null;
  assert.throws(() => buildPinterestPin(prompt));
});

test("legacy published material cannot be resent to Telegram to discover its URL", async () => {
  prompt.telegramPublished = true;
  await assert.rejects(sendPromptToTelegram(1), /существующий пост вручную/);
  assert.equal(requests.length, 0);
});

test("long text and emoji chunks preserve content and link the text instead of media", async () => {
  const content = "😀".repeat(3000) + " long prompt ".repeat(200);
  const chunks = splitTelegramText(content);
  assert.equal(chunks.join(""), content);
  assert.ok(chunks.every((chunk) => chunk.length <= 4000 && !/[\uD800-\uDBFF]$/.test(chunk)));
  prompt.content = content;
  await sendPromptToTelegram(1);
  assert.equal(prompt.telegramMessageId, "100");
  assert.ok(requests.map((r) => r.body.text).join("").includes(content));
});

test("album uses the first caption containing the prompt; long album links the text message", async () => {
  prompt.examples = [{ url: "https://cdn.example.com/a.jpg", type: "image" }, { url: "https://cdn.example.com/b.jpg", type: "image" }];
  await sendPromptToTelegram(1);
  assert.equal(prompt.telegramMessageId, "100");
  assert.ok(JSON.parse(requests[0].body.media)[0].caption.includes(prompt.content));
  prompt.telegramPostUrl = null; prompt.telegramPublished = false; prompt.content = "Полный промпт ".repeat(200); nextMessage = 200;
  requests = [];
  await sendPromptToTelegram(1);
  assert.equal(prompt.telegramMessageId, "200");
  assert.ok(requests[0].body.text.includes(prompt.content));
});

async function withLocalApp(run: (base: string) => Promise<void>) {
  const app = express(); app.use(express.json());
  app.use("/admin", adminRouter); app.use("/prompts", promptsRouter);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address() as { port: number };
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("admin can save an existing post without publishing; other users and channel URLs rejected", async () => {
  await withLocalApp(async (base) => {
    const body = JSON.stringify({ telegramPostUrl: "https://t.me/sample_channel/999" });
    const send = (telegramId?: string, payload = body) => realFetch(`${base}/admin/prompts/1/telegram-post-link`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...(telegramId ? { "x-telegram-id": telegramId } : {}) }, body: payload
    });
    assert.equal((await send()).status, 401);
    assert.equal((await send("43")).status, 403);
    assert.equal((await send("42", JSON.stringify({ telegramPostUrl: config.telegramChannelUrl }))).status, 400);
    assert.equal((await send("42")).status, 200);
    assert.equal(prompt.telegramPostUrl, "https://t.me/sample_channel/999");
    assert.equal(prompt.telegramMessageId, "999");
    assert.equal(requests.length, 0);
  });
});

test("combined create saves Telegram first and waits for destination confirmation", async () => {
  const originalCreate = PromptService.create;
  PromptService.create = (async () => prompt) as any;
  try {
    await withLocalApp(async (base) => {
      const response = await realFetch(`${base}/prompts`, { method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-id": "42" },
        body: JSON.stringify({ userId: 1, content: prompt.content, categoryId: 1, publishToTelegram: true, publishToPinterest: true }) });
      assert.equal(response.status, 201);
      const created = await response.json();
      assert.equal(created.pinterestPublicationStatus, "awaiting_confirmation");
      assert.equal(created.telegramPostUrl, "https://t.me/sample_channel/100");
      assert.deepEqual(sequence, ["telegram", "save-telegram-link"]);
    });
  } finally { PromptService.create = originalCreate; }
});

test("combined create returns a clear error and no Pinterest draft when Telegram fails", async () => {
  const originalCreate = PromptService.create;
  PromptService.create = (async () => prompt) as any;
  failTelegram = true;
  try {
    await withLocalApp(async (base) => {
      const response = await realFetch(`${base}/prompts`, { method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-id": "42" },
        body: JSON.stringify({ userId: 1, content: prompt.content, categoryId: 1, publishToTelegram: true, publishToPinterest: true }) });
      assert.equal(response.status, 201, "The prompt is saved even when publication fails");
      const created = await response.json();
      assert.equal(created.telegramPublicationStatus, "failed");
      assert.equal(created.pinterestPublicationStatus, "failed");
      assert.match(created.pinterestPublicationError, /Telegram не удалась/);
      assert.equal(pinterestPublications.length, 0);
      assert.deepEqual(sequence, ["telegram"]);
    });
  } finally { PromptService.create = originalCreate; }
});

test("PostgreSQL patch is repeatable and preserves existing materials", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Prompt" ("id" INTEGER PRIMARY KEY, "content" TEXT); INSERT INTO "Prompt" VALUES (1, \'existing prompt\');');
    const patch = readFileSync("prisma/patches/20261018_telegram_post_destination.sql", "utf8");
    await db.exec(patch); await db.exec(patch);
    const { rows } = await db.query('SELECT * FROM "Prompt"');
    assert.deepEqual(rows, [{ id: 1, content: "existing prompt", telegramMessageId: null, telegramChatId: null, telegramPostUrl: null }]);
    await db.exec('UPDATE "Prompt" SET "telegramMessageId" = \'123\', "telegramPostUrl" = \'https://t.me/sample_channel/123\' WHERE id=1');
  } finally { await db.close(); }
});
