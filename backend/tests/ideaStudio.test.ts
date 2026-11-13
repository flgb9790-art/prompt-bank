import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import express from "express";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { prisma } from "../src/db";
import { config } from "../src/config";
import router from "../src/routes/ideaStudio.routes";
import { signedHeaders } from "./telegramTestIdentity";
import {
  enqueueStudioBatch,
  editStudioDraft,
  enqueueStudioPublication,
  processNextStudioJob,
  reserveStudioUsage,
  scheduleStudioBatch,
  studioDependencies,
  studioSettings,
  allowStudioPublicationRetry,
  enqueueStudioDraftAction,
  getStudioOverview,
} from "../src/services/ideaStudio.service";
import {
  localStudioClock,
  similarIdea,
  validateGeneratedIdeas,
  validateStudioSettings,
} from "../src/services/ideaStudio.validation";
import {
  openaiStudioRequest,
  responseSources,
  responseText,
} from "../src/services/ideaStudio.openai";

let tables: Record<string, any[]>;
let seq = 0,
  imageCalls = 0,
  textCalls = 0,
  telegramCalls = 0,
  failImage = false,
  failTelegram = false;
const delegates = [
  "ideaStudioSettings",
  "ideaStudioBatch",
  "ideaStudioDraft",
  "ideaStudioJob",
  "ideaStudioUsage",
  "prompt",
  "category",
  "keyword",
  "promptKeyword",
  "user",
];
const originals = new Map(delegates.map((k) => [k, { ...(prisma as any)[k] }]));
const realTransaction = prisma.$transaction;
const realFetch = global.fetch;
const dependencyOriginals = { ...studioDependencies };
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((v: any) => matches(row, v));
    if (key === "AND") return value.every((v: any) => matches(row, v));
    if (value === null) return row[key] == null;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(row[key]);
      if ("lt" in value) return row[key] < value.lt;
      if ("not" in value) return row[key] !== value.not;
    }
    return row[key] === value;
  });
}
function result(row: any, args: any = {}) {
  if (!row) return null;
  const r = structuredClone(row);
  if (args.include?.prompt)
    r.prompt = tables.prompt.find((p) => p.id === row.promptId) || null;
  if (args.include?.batch)
    r.batch = tables.ideaStudioBatch.find((b) => b.id === row.batchId);
  if (args.select)
    return Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k]]));
  return r;
}
function update(row: any, data: any) {
  for (const [key, value] of Object.entries(data) as any)
    row[key] =
      value && typeof value === "object" && "increment" in value
        ? (row[key] || 0) + value.increment
        : value;
  row.updatedAt = new Date();
  return row;
}
function delegate(name: string) {
  const rows = () => tables[name];
  const create = async ({ data }: any) => {
    const defaults =
      name === "ideaStudioSettings"
        ? {
            id: "main",
            dailyEnabled: false,
            dailyCount: 10,
            runAt: "09:00",
            timeZone: "Europe/Minsk",
            language: "en",
            topics: "Architecture, portrait, surreal still life",
            useWebSearch: false,
            leaseUntil: null,
            creativeProfile: { useCharacter: false },
            referenceImageKey: null,
          }
        : name === "ideaStudioDraft"
          ? {
              selected: false,
              rejected: false,
              busyJobId: null,
              promptId: null,
              imageStatus: "pending",
              imageUrl: null,
              imageStale: false,
              publishUncertain: false,
              revision: 0,
            }
          : name === "ideaStudioJob"
            ? { status: "queued", completed: 0, total: 1 }
            : name === "ideaStudioBatch"
              ? { status: "queued", sources: [] }
              : name === "ideaStudioUsage"
                ? { requests: 0 }
                : {};
    const row = {
      id: ["prompt", "user", "category", "keyword"].includes(name)
        ? ++seq
        : `id-${++seq}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...defaults,
      ...data,
    };
    rows().push(row);
    return structuredClone(row);
  };
  return {
    create,
    findUnique: async (args: any) =>
      result(
        rows().find((r) => matches(r, args.where)),
        args,
      ),
    findUniqueOrThrow: async (args: any) => {
      const row = rows().find((r) => matches(r, args.where));
      if (!row) throw Error("Missing row");
      return result(row, args);
    },
    findFirst: async (args: any = {}) =>
      result(
        rows().find((r) => matches(r, args.where)),
        args,
      ),
    findMany: async (args: any = {}) =>
      rows()
        .filter((r) => matches(r, args.where))
        .slice(0, args.take ?? Infinity)
        .map((r) => result(r, args)),
    count: async (args: any = {}) =>
      rows().filter((r) => matches(r, args.where)).length,
    update: async (args: any) => {
      const row = rows().find((r) => matches(r, args.where));
      if (!row) throw Error("Missing row");
      return result(update(row, args.data), args);
    },
    updateMany: async (args: any) => {
      const selected = rows().filter((r) => matches(r, args.where));
      selected.forEach((r) => update(r, args.data));
      return { count: selected.length };
    },
    upsert: async (args: any) => {
      const row = rows().find((r) => matches(r, args.where));
      return row
        ? result(update(row, args.update))
        : create({ data: args.create });
    },
  };
}
const content =
  "A sculptural amber glass vase stands in a quiet concrete courtyard surrounded by blue ceramic tiles. Soft morning sunlight creates long diagonal shadows and subtle reflections. Photograph this still life at eye level with precise material texture, balanced negative space and a restrained editorial composition.";
const idea = {
  title: "Amber Courtyard",
  concept:
    "A sculptural amber glass vase in a quiet concrete courtyard with blue ceramic tiles.",
  content,
  imagePrompt: content,
  theme: "Still life",
  visualStyle: "Architectural minimalism",
};
beforeEach(async () => {
  Object.assign(studioDependencies, dependencyOriginals);
  tables = Object.fromEntries(delegates.map((k) => [k, []]));
  seq = 0;
  imageCalls = 0;
  textCalls = 0;
  telegramCalls = 0;
  failImage = false;
  failTelegram = false;
  Object.assign(config, {
    openaiApiKey: "unit-test-key",
    adminTelegramIds: ["42"],
    botToken: "unit-test-bot",
    studioDailyImageLimit: 10,
    studioDailyTextLimit: 12,
  });
  for (const name of delegates)
    Object.assign((prisma as any)[name], delegate(name));
  (prisma as any).$transaction = async (fn: any) => {
    if (Array.isArray(fn)) return Promise.all(fn);
    const snapshot = structuredClone(tables);
    try {
      return await fn(prisma);
    } catch (e) {
      tables = snapshot;
      throw e;
    }
  };
  const image = await sharp({
    create: { width: 32, height: 48, channels: 3, background: "#8b71ab" },
  })
    .jpeg()
    .toBuffer();
  studioDependencies.generateStudioTexts = async (_input, reserve) => {
    await reserve();
    textCalls++;
    return { ideas: [idea] };
  };
  studioDependencies.generateStudioImage = async (_prompt, _owner, reserve) => {
    await reserve();
    imageCalls++;
    if (failImage) throw Error("mock failure");
    return image;
  };
  studioDependencies.persistMediaBuffer = async () => ({
    url: "https://example.test/studio.jpg",
    type: "image",
    originalName: "studio.jpg",
  });
  studioDependencies.researchStudioIdeas = async (_topics, reserve) => {
    await reserve();
    return {
      text: "Design directions",
      sources: [{ title: "Source", url: "https://example.test/design" }],
    };
  };
  studioDependencies.sendPromptToTelegram = async (id) => {
    telegramCalls++;
    if (failTelegram) throw Error("ambiguous network timeout");
    tables.prompt.find((p) => p.id === id).telegramPostUrl =
      "https://t.me/example_channel/33";
    return { status: "published", publication: null } as any;
  };
  global.fetch = async () => {
    throw Error("Unexpected real network access in studio test");
  };
});
after(() => {
  for (const name of delegates)
    Object.assign((prisma as any)[name], originals.get(name));
  (prisma as any).$transaction = realTransaction;
  global.fetch = realFetch;
  Object.assign(studioDependencies, dependencyOriginals);
});
async function makeDraft() {
  const batch = await enqueueStudioBatch(
    { count: 1, useWebSearch: false },
    "42",
  );
  await processNextStudioJob();
  return tables.ideaStudioDraft.find((d) => d.batchId === batch.id);
}
test("overview omits empty legacy creative contexts and preserves complete batch snapshots", async () => {
  const batch = await enqueueStudioBatch({ count: 1, useWebSearch: false }, "42");
  const row = tables.ideaStudioBatch.find((item) => item.id === batch.id)!;
  const snapshot = structuredClone(row.creativeContext);
  // Existing rows receive {} from the additive migration, not null.
  for (const context of [{}, null, { profile: snapshot.profile }]) {
    row.creativeContext = context;
    const overview = JSON.parse(JSON.stringify(await getStudioOverview(batch.id)));
    assert.equal(overview.current.id, batch.id);
    assert.equal(overview.current.creativeContext, undefined);
    assert.equal(overview.batches[0].creativeContext, undefined);
    assert.equal(typeof overview.settings.creativeProfile.useCharacter, "boolean");
  }
  row.creativeContext = snapshot;
  const overview = await getStudioOverview(batch.id);
  assert.deepEqual(overview.current?.creativeContext, snapshot);
  assert.deepEqual(overview.batches[0].creativeContext, snapshot);
  assert.equal(imageCalls, 0);
  assert.equal(textCalls, 0);
  assert.equal(telegramCalls, 0);
});

test("research notice survives successful generation alongside real search sources", async () => {
  studioDependencies.researchStudioIdeas = async (_topics, reserve) => {
    await reserve();
    return {text:"Source titles only; no verified excerpts",sources:[{title:"Source",url:"https://example.test/inspiration"}],notice:"Поиск нашёл источники, но не завершил сводку."};
  };
  const batch = await enqueueStudioBatch({count:1,useWebSearch:true},"42");
  await processNextStudioJob();
  const stored = tables.ideaStudioBatch.find(item=>item.id===batch.id);
  assert.equal(stored.status, "ready");
  assert.match(stored.error, /не завершил сводку/);
  assert.equal(stored.sources[0].url,"https://example.test/inspiration");
  assert.equal(textCalls,1);
  assert.equal(imageCalls,1);
  assert.equal(telegramCalls,0);
});

test("generation saves ready private drafts and never creates a public prompt or sends Telegram", async () => {
  const draft = await makeDraft();
  assert.equal(draft.imageStatus, "ready");
  assert.ok(draft.imageUrl);
  assert.equal(imageCalls, 1);
  assert.equal(textCalls, 1);
  assert.equal(tables.prompt.length, 0);
  assert.equal(telegramCalls, 0);
  assert.equal(tables.ideaStudioBatch[0].status, "ready");
});
test("character batches snapshot the reference and keep public prompts reusable on image retry", async () => {
  const settings = await studioSettings();
  await prisma.ideaStudioSettings.update({
    where: { id: settings.id },
    data: {
      creativeProfile: { useCharacter: true, characterName: "TestName" },
      referenceImageKey: "photo-A",
    },
  });
  studioDependencies.readStudioReference = async (key) => Buffer.from(key);
  studioDependencies.generateStudioTexts = async (_input, reserve) => {
    await reserve();
    return {
      ideas: [
        {
          ...idea,
          recipe: Object.fromEntries(
            [
              "wardrobe",
              "styling",
              "poseExpression",
              "scene",
              "lighting",
              "cameraComposition",
              "finish",
            ].map((key) => [
              key,
              "A tailored camel wool coat, ivory satin blouse, taupe trousers, leather ankle boots, structured shoulder bag and small gold earrings; soft natural light and an elegant hotel courtyard.",
            ]),
          ),
        },
      ],
    };
  };
  const used: string[] = [];
  studioDependencies.generateStudioImage = async (
    imagePrompt,
    _owner,
    reserve,
    _signal,
    reference,
  ) => {
    await reserve();
    assert.match(imagePrompt, /Do not age or de-age/);
    assert.match(imagePrompt, /does not define the pose/);
    assert.match(imagePrompt, /independently staged photograph/);
    used.push(reference!.toString());
    return sharp({
      create: { width: 32, height: 48, channels: 3, background: "#9988aa" },
    })
      .jpeg()
      .toBuffer();
  };
  const batch = await enqueueStudioBatch(
    { count: 1, useWebSearch: false },
    "42",
  );
  await prisma.ideaStudioSettings.update({
    where: { id: settings.id },
    data: { referenceImageKey: "photo-B" },
  });
  await processNextStudioJob();
  const draft = tables.ideaStudioDraft.find((d) => d.batchId === batch.id);
  assert.match(draft.content, /sole identity reference/);
  assert.ok(!draft.content.includes("TestName"));
  assert.equal(used[0], "photo-A");
  await enqueueStudioDraftAction(draft.id, "image", "42");
  await processNextStudioJob();
  assert.deepEqual(used, ["photo-A", "photo-A"]);
});
test("a missing reference never silently generates another face or charges for an image", async () => {
  const settings = await studioSettings();
  await prisma.ideaStudioSettings.update({
    where: { id: settings.id },
    data: {
      referenceImageKey: "missing-photo",
      creativeProfile: { useCharacter: true },
    },
  });
  studioDependencies.readStudioReference = async () => {
    throw Error("missing file");
  };
  await assert.rejects(() => enqueueStudioBatch({ count: 1 }, "42"));
  assert.equal(imageCalls, 0);
  assert.equal(textCalls, 0);
});
test("image failure preserves generated text for an explicit separate retry", async () => {
  failImage = true;
  const draft = await makeDraft();
  assert.equal(draft.imageStatus, "failed");
  assert.equal(draft.content, content);
  assert.equal(tables.ideaStudioBatch[0].status, "partial");
  assert.equal(draft.busyJobId, null);
});
test("quota is reserved atomically before calls, including failed attempts", async () => {
  config.studioDailyImageLimit = 2;
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => reserveStudioUsage("image")),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(tables.ideaStudioUsage[0].requests, 2);
});
test("no paid text generation when there is insufficient image quota", async () => {
  config.studioDailyImageLimit = 1;
  await reserveStudioUsage("image");
  await enqueueStudioBatch({ count: 1, useWebSearch: false }, "42");
  await processNextStudioJob();
  assert.equal(textCalls, 0);
  assert.equal(imageCalls, 0);
  assert.equal(tables.ideaStudioJob[0].status, "failed");
});
test("changing prompt invalidates image and updates image instructions", async () => {
  const draft = await makeDraft();
  const next = content + " Use a silver vase instead.";
  await editStudioDraft(draft.id, { content: next });
  assert.equal(draft.imageStale, true);
  assert.equal(draft.imagePrompt, next);
  await editStudioDraft(draft.id, { selected: true });
  await assert.rejects(
    () => enqueueStudioPublication([draft.id], "42", true),
    /актуальное/,
  );
});
test("publication needs explicit selection and confirmation, locks duplicate clicks and saves the Telegram URL", async () => {
  const draft = await makeDraft();
  await prisma.category.create({ data: { slug: "image-prompts" } } as any);
  await assert.rejects(
    () => enqueueStudioPublication([draft.id], "42", false),
    /подтвердите/,
  );
  await assert.rejects(
    () => enqueueStudioPublication([draft.id], "42", true),
    /выбраны/,
  );
  await editStudioDraft(draft.id, { selected: true });
  await enqueueStudioPublication([draft.id], "42", true);
  await assert.rejects(
    () => enqueueStudioPublication([draft.id], "42", true),
    /обрабатываться/,
  );
  await processNextStudioJob();
  assert.equal(telegramCalls, 1);
  assert.equal(tables.prompt.length, 1);
  assert.ok(tables.prompt[0].telegramPostUrl);
});
test("ambiguous Telegram failure is never resent without review and successful post is reused", async () => {
  const draft = await makeDraft();
  await prisma.category.create({ data: { slug: "image-prompts" } } as any);
  await editStudioDraft(draft.id, { selected: true });
  failTelegram = true;
  await enqueueStudioPublication([draft.id], "42", true);
  await processNextStudioJob();
  assert.equal(draft.publishUncertain, true);
  await assert.rejects(
    () => enqueueStudioPublication([draft.id], "42", true),
    /проверьте канал/,
  );
  assert.equal(telegramCalls, 1);
  await allowStudioPublicationRetry(draft.id, true);
  failTelegram = false;
  await enqueueStudioPublication([draft.id], "42", true);
  await processNextStudioJob();
  assert.equal(telegramCalls, 2);
  assert.equal(tables.prompt.length, 1);
});
test("a repeat of an already successful studio publication never calls Telegram", async () => {
  const draft = await makeDraft();
  await prisma.category.create({ data: { slug: "image-prompts" } } as any);
  await editStudioDraft(draft.id, { selected: true });
  await enqueueStudioPublication([draft.id], "42", true);
  await processNextStudioJob();
  await enqueueStudioPublication([draft.id], "42", true);
  await processNextStudioJob();
  assert.equal(telegramCalls, 1);
  assert.equal(tables.prompt.length, 1);
});
test("worker recovery preserves finished results and does not retry an interrupted paid request", async () => {
  const draft = await makeDraft();
  tables.ideaStudioJob[0].status = "running";
  draft.busyJobId = tables.ideaStudioJob[0].id;
  await processNextStudioJob();
  assert.equal(imageCalls, 1);
  assert.equal(draft.busyJobId, null);
  assert.equal(tables.ideaStudioJob[0].status, "failed");
  assert.ok(draft.imageUrl);
});
test("a different worker lease prevents processing", async () => {
  await enqueueStudioBatch({ count: 1, useWebSearch: false }, "42");
  const settings = await studioSettings();
  await prisma.ideaStudioSettings.update({
    where: { id: settings.id },
    data: { workerToken: "other", leaseUntil: new Date(Date.now() + 60000) },
  });
  await processNextStudioJob();
  assert.equal(textCalls, 0);
  assert.equal(tables.ideaStudioJob[0].status, "queued");
});
test("daily scheduling respects local time and creates only one batch on repeated ticks", async () => {
  const settings = await studioSettings();
  await prisma.ideaStudioSettings.update({
    where: { id: settings.id },
    data: { dailyEnabled: true, ownerTelegramId: "42", dailyCount: 1 },
  });
  await scheduleStudioBatch(new Date("2026-11-13T05:59:00Z"));
  assert.equal(tables.ideaStudioBatch.length, 0);
  await scheduleStudioBatch(new Date("2026-11-13T06:01:00Z"));
  await scheduleStudioBatch(new Date("2026-11-13T07:00:00Z"));
  assert.equal(tables.ideaStudioBatch.length, 1);
  assert.deepEqual(
    localStudioClock(new Date("2026-11-13T22:01:00Z"), "Europe/Minsk"),
    { date: "2026-11-14", time: "01:01" },
  );
});
test("generation rejects repeat concepts and wrong-language titles", () => {
  assert.ok(similarIdea(idea.concept, idea.concept));
  assert.throws(
    () => validateGeneratedIdeas({ ideas: [idea] }, 1, "en", [idea]),
    /похожая/,
  );
  assert.throws(
    () => validateGeneratedIdeas({ ideas: [idea] }, 1, "ru", []),
    /Язык/,
  );
  assert.throws(
    () =>
      validateStudioSettings({
        dailyEnabled: true,
        dailyCount: 10,
        runAt: "25:00",
        timeZone: "Europe/Minsk",
        language: "en",
        topics: "design",
        useWebSearch: true,
      }),
    /Время/,
  );
});
test("provider response errors and citations are handled without inventing sources or exposing the API key", async () => {
  assert.throws(
    () => responseText({ status: "incomplete", output: [] }),
    /не завершил/,
  );
  assert.throws(
    () =>
      responseText({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
    /отклонил/,
  );
  assert.deepEqual(
    responseSources({
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              { url: "javascript:alert(1)" },
              { url: "https://example.test", title: "Source" },
            ],
          },
        },
      ],
    }),
    [{ url: "https://example.test/", title: "Source" }],
  );
  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: config.openaiApiKey } }), {
      status: 401,
    });
  await assert.rejects(
    () => openaiStudioRequest("responses", {}),
    (error) =>
      error instanceof Error &&
      !error.message.includes("unit-test-key") &&
      error.message.includes("API-ключ"),
  );
});
test("all studio routes require a signed administrator identity", async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as any).port;
  try {
    for (const path of [
      "/",
      "/settings",
      "/batches",
      "/drafts/id",
      "/publish",
      "/drafts/id/image",
      "/drafts/id/rewrite",
      "/drafts/id/allow-telegram-retry",
      "/reference",
    ]) {
      const method =
        path === "/"
          ? "GET"
          : path === "/settings"
            ? "PUT"
            : path === "/drafts/id"
              ? "PATCH"
              : "POST";
      assert.equal(
        (await realFetch(`http://127.0.0.1:${port}${path}`, { method })).status,
        401,
      );
      assert.equal(
        (
          await realFetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: signedHeaders("43"),
          })
        ).status,
        403,
      );
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});
test("additive SQL patch is repeatable, preserves existing prompts, and defaults automation to off", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE "Prompt" ("id" INTEGER PRIMARY KEY, "content" TEXT); INSERT INTO "Prompt" VALUES (33,\'existing\');',
    );
    const patch = readFileSync(
      "prisma/patches/20261113_idea_studio.sql",
      "utf8",
    );
    await db.exec(patch);
    await db.exec(patch);
    const characterPatch = readFileSync(
      "prisma/patches/20261113_studio_character.sql",
      "utf8",
    );
    await db.exec(characterPatch);
    await db.exec(characterPatch);
    await db.exec(
      'INSERT INTO "IdeaStudioSettings" ("updatedAt") VALUES (CURRENT_TIMESTAMP)',
    );
    assert.equal(
      (await db.query<any>('SELECT "dailyEnabled" FROM "IdeaStudioSettings"'))
        .rows[0].dailyEnabled,
      false,
    );
    assert.equal(
      (await db.query<any>('SELECT "content" FROM "Prompt" WHERE "id"=33'))
        .rows[0].content,
      "existing",
    );
    const unique = await db.query<any>(
      "SELECT indexname FROM pg_indexes WHERE tablename='IdeaStudioBatch' AND indexdef LIKE '%UNIQUE%'",
    );
    assert.ok(unique.rows.length);
  } finally {
    await db.close();
  }
});
