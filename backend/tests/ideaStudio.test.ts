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
  saveStudioSettings,
} from "../src/services/ideaStudio.service";
import {
  localStudioClock,
  similarIdea,
  validateGeneratedIdeas,
  validateStudioSettings,
  ideaComparisonText,
} from "../src/services/ideaStudio.validation";
import { identityInstruction } from "../src/services/ideaStudio.creative";
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
              : name === "prompt" ? {telegramPublished:false,telegramPostUrl:null} : {};
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
  studioDependencies.prepareStudioReference = async key => studioDependencies.readStudioReference(key);
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
  let transactionQueue = Promise.resolve();
  (prisma as any).$transaction = (fn: any) => {
    if (Array.isArray(fn)) return Promise.all(fn);
    // Model database transaction isolation, including concurrent quota reservations.
    const result = transactionQueue.then(async () => {
      const snapshot = structuredClone(tables);
      try { return await fn(prisma); }
      catch (e) { tables = snapshot; throw e; }
    });
    transactionQueue = result.then(()=>undefined,()=>undefined);
    return result;
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
  studioDependencies.reviewStudioNovelty = async input => input.candidates;
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
  studioDependencies.prepareStudioReference = async (key) => Buffer.from(`aligned:${key}`);
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
  assert.equal(used[0], "aligned:photo-A");
  await enqueueStudioDraftAction(draft.id, "image", "42");
  await processNextStudioJob();
  assert.deepEqual(used, ["aligned:photo-A", "aligned:photo-A"]);
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
test("manual text generation and search continue beyond twelve requests while preserving usage",async()=>{
  for(let i=0;i<12;i++)await reserveStudioUsage("text",new Date(),"manual");
  const batch=await enqueueStudioBatch({count:1,useWebSearch:true},"42");
  await processNextStudioJob();
  assert.equal(tables.ideaStudioBatch.find(row=>row.id===batch.id).status,"ready");
  const overview=await getStudioOverview(batch.id);
  assert.equal(overview.usage.text,14);
  assert.equal(overview.usage.scheduledText,0);
  assert.equal(overview.limits.manualTextUnlimited,true);
  assert.equal(imageCalls,1);assert.equal(textCalls,1);assert.equal(telegramCalls,0);
});
test("scheduled text quota is separate and a manual rewrite of a scheduled draft bypasses it",async()=>{
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42","daily:unit-test");
  await processNextStudioJob();
  const draft=tables.ideaStudioDraft.find(row=>row.batchId===batch.id);
  for(let i=1;i<12;i++)await reserveStudioUsage("text");
  await assert.rejects(()=>reserveStudioUsage("text"),/автоматических текстовых/);
  await enqueueStudioDraftAction(draft.id,"rewrite","42","Change the lighting to warm afternoon sunlight");
  await processNextStudioJob();
  const overview=await getStudioOverview(batch.id);
  assert.equal(overview.usage.scheduledText,12);
  assert.equal(overview.usage.text,13);
  assert.equal(tables.ideaStudioJob[1].status,"succeeded");
  assert.equal(textCalls,2);assert.equal(imageCalls,1);
});
test("manual calls do not consume the scheduled allowance and scheduled jobs stop at their cap",async()=>{
  for(let i=0;i<20;i++)await reserveStudioUsage("text",new Date(),"manual");
  await reserveStudioUsage("text");
  let overview=await getStudioOverview();
  assert.equal(overview.usage.text,21);assert.equal(overview.usage.scheduledText,1);
  for(let i=1;i<12;i++)await reserveStudioUsage("text");
  const batch=await enqueueStudioBatch({count:1,useWebSearch:true},"42","daily:another-test");
  await processNextStudioJob();
  assert.equal(tables.ideaStudioBatch.find(row=>row.id===batch.id).status,"failed");
  overview=await getStudioOverview();
  assert.equal(overview.usage.scheduledText,12);assert.equal(overview.usage.text,32);
  assert.equal(textCalls,0);assert.equal(imageCalls,0);
});
test("scheduled allowance resets at UTC midnight without losing total manual accounting",async()=>{
  config.studioDailyTextLimit=1;
  const first=new Date("2026-11-13T23:59:59Z"), next=new Date("2026-11-14T00:00:00Z");
  await reserveStudioUsage("text",first,"manual");
  await reserveStudioUsage("text",first);
  await assert.rejects(()=>reserveStudioUsage("text",first),/автоматических/);
  await reserveStudioUsage("text",next);
  assert.equal(tables.ideaStudioUsage.find(row=>row.id==="2026-11-13:text").requests,2);
  assert.equal(tables.ideaStudioUsage.find(row=>row.id==="2026-11-14:text").requests,1);
});
test("manual images continue beyond the former daily cap and remain accounted",async()=>{
  for(let i=0;i<10;i++)await reserveStudioUsage("image",new Date(),"manual");
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42");
  await processNextStudioJob();
  const overview=await getStudioOverview(batch.id);
  assert.equal(overview.current?.status,"ready");
  assert.equal(overview.usage.image,11);
  assert.equal(overview.usage.scheduledImage,0);
  assert.equal(overview.limits.manualImageUnlimited,true);
  assert.equal(imageCalls,1);assert.equal(textCalls,1);assert.equal(telegramCalls,0);
});
test("manual retry of an automatic image bypasses the schedule quota",async()=>{
  config.studioDailyImageLimit=1;
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42","daily:image-test");
  await processNextStudioJob();
  const draft=tables.ideaStudioDraft.find(row=>row.batchId===batch.id);
  await assert.rejects(()=>reserveStudioUsage("image"),/автоматических изображений/);
  await enqueueStudioDraftAction(draft.id,"image","42");
  await processNextStudioJob();
  const overview=await getStudioOverview(batch.id);
  assert.equal(overview.usage.image,2);assert.equal(overview.usage.scheduledImage,1);
  assert.equal(tables.ideaStudioJob[1].status,"succeeded");assert.equal(imageCalls,2);
});
test("no paid text generation when there is insufficient automatic image quota", async () => {
  config.studioDailyImageLimit = 1;
  await reserveStudioUsage("image");
  await enqueueStudioBatch({ count: 1, useWebSearch: false }, "42", "daily:exhausted-images");
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
test("publication captures the reviewed caption and resolves a distinct prompt on materialization",async()=>{
  const draft=await makeDraft();
  await prisma.category.create({data:{slug:"image-prompts"}} as any);
  await editStudioDraft(draft.id,{selected:true});
  const form={bodyHtml:"<p>Текст из формы</p>",promptLinkLabel:"Читать промпт"};
  const job=await enqueueStudioPublication([draft.id],"42",true,form);
  form.bodyHtml="<p>Поздняя правка</p>";
  assert.match((job.payload as any).telegramPostTemplate,/Текст из формы/);
  await processNextStudioJob();
  assert.match(tables.prompt[0].telegramPostTemplate,/Текст из формы/);
  assert.match(tables.prompt[0].telegramPostTemplate,/href="\{\{link\}\}"/);
  assert.ok(!tables.prompt[0].telegramPostTemplate.includes("Поздняя правка"));
  const original=tables.prompt[0].telegramPostTemplate;
  await enqueueStudioPublication([draft.id],"42",true,{...form,bodyHtml:"<p>Другой текст</p>"});
  await processNextStudioJob();
  assert.equal(tables.prompt[0].telegramPostTemplate,original);
  assert.equal(telegramCalls,1);
});
test("a reviewed retry updates only the unsent prompt caption and never creates a second prompt",async()=>{
  const draft=await makeDraft();
  await prisma.category.create({data:{slug:"image-prompts"}} as any);
  await editStudioDraft(draft.id,{selected:true});
  failTelegram=true;
  await enqueueStudioPublication([draft.id],"42",true,{bodyHtml:"<p>Первый текст</p>",promptLinkLabel:"Открыть"});
  await processNextStudioJob();
  await allowStudioPublicationRetry(draft.id,true);
  failTelegram=false;
  await enqueueStudioPublication([draft.id],"42",true,{bodyHtml:"<p>Исправленный текст</p>",promptLinkLabel:"Открыть"});
  await processNextStudioJob();
  assert.equal(tables.prompt.length,1);
  assert.match(tables.prompt[0].telegramPostTemplate,/Исправленный текст/);
  assert.equal(telegramCalls,2);
});
test("invalid publication text never locks drafts or creates a Telegram job",async()=>{
  const draft=await makeDraft();
  await editStudioDraft(draft.id,{selected:true});
  const jobs=tables.ideaStudioJob.length;
  await assert.rejects(()=>enqueueStudioPublication([draft.id],"42",true,{bodyHtml:"<p></p>",promptLinkLabel:"Open"}),/пустым/);
  assert.equal(tables.ideaStudioJob.length,jobs);assert.equal(draft.busyJobId,null);assert.equal(telegramCalls,0);
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
function characterIdea(title:string, concept:string, scene:string, pose:string) {
  const content = `${identityInstruction("en")}\n\nOutfit and accessories: A tailored camel coat over an ivory satin blouse, straight trousers, leather ankle boots, a structured shoulder bag and small gold earrings.\n\nStyling: Natural polished makeup and softly groomed hair.\n\nPose and expression: ${pose}\n\nScene: ${scene}\n\nLighting: Soft warm daylight with gentle shadows and natural reflections.\n\nCamera and composition: Eye-level editorial photograph, gentle background separation.\n\nTextures and finish: Natural skin, visible fabric weave, restrained warm color grading.`;
  return {...idea,title,concept,content,imagePrompt:content,theme:"everyday",visualStyle:"quiet luxury editorial"};
}
const distinctScenes = () => [
  characterIdea("Morning Café", "A quiet breakfast while writing postcards at a sidewalk café.", "A sidewalk café table with coffee, croissants, handwritten postcards and passing street trams.", "Seated sideways, writing a postcard with one hand while holding a coffee cup in the other."),
  characterIdea("Home Workspace", "An illustrator edits a digital drawing with a stylus in her home studio.", "A home studio desk with a drawing tablet, color samples, a large monitor and open bookshelves.", "Leaning toward the tablet, holding a stylus, eyes focused on the drawing, shoulders relaxed."),
  characterIdea("Autumn Stroll", "Walking a small dog through fallen maple leaves on a park trail.", "A woodland trail under golden maple trees with fallen leaves and a dog running alongside the path.", "Walking mid-step and looking back over a shoulder toward the dog, carrying a loose leash."),
];
test("shared identity, clothing and photographic style do not make different scenes duplicates",()=>{
  const rows=distinctScenes();
  assert.equal(validateGeneratedIdeas({ideas:rows},3,"en",[]).length,3);
  assert.equal(similarIdea(rows[0].content,rows[1].content),false);
  const unstructured = "Use my reference photo as the base image and preserve identity. Create a woman writing postcards at a sunny café table with coffee and croissants.";
  assert.equal(similarIdea(unstructured, unstructured), true);
  assert.equal(ideaComparisonText(rows[0].content).includes("sole identity reference"),false);
  assert.match(ideaComparisonText(rows[0].content),/sidewalk café table/);
  assert.equal(validateGeneratedIdeas({ideas:[rows[1]]},1,"en",[{...rows[0],concept:rows[0].content.slice(0,500),content:rows[0].content.slice(0,1200)}]).length,1);
  // A short, repeated title alone does not mean the scenes are the same.
  assert.equal(validateGeneratedIdeas({ideas:[{...rows[1],title:rows[0].title}]},1,"en",[rows[0]]).length,1);
});
test("true scene copies are rejected even after renaming; partial selection keeps new ideas",()=>{
  const [first, second]=distinctScenes();
  const renamed={...first,title:"Breakfast Notes",concept:"A newly worded description of a familiar morning scene."};
  assert.throws(()=>validateGeneratedIdeas({ideas:[renamed]},1,"en",[first]),/похожая/);
  const kept=validateGeneratedIdeas({ideas:[first,renamed,second]},3,"en",[],{skipDuplicates:true});
  assert.deepEqual(kept.map(row=>row.title),[first.title,second.title]);
  assert.throws(()=>validateGeneratedIdeas({ideas:[renamed]},1,"en",[first],{skipDuplicates:true}),/Все предложенные сцены/);
});
test("a partly repetitive batch saves unique drafts and charges images only for them",async()=>{
  const rows=distinctScenes();
  studioDependencies.generateStudioTexts=async(input,reserve)=>{
    await reserve();textCalls++;
    return {ideas:[rows[0],{...rows[0],title:"Breakfast Notes"},rows[1]]};
  };
  const batch=await enqueueStudioBatch({count:3,useWebSearch:false},"42");
  await processNextStudioJob();
  const stored=tables.ideaStudioBatch.find(row=>row.id===batch.id);
  assert.equal(stored.status,"ready");
  assert.equal(stored.count,2);
  assert.match(stored.error,/Сохранено 2 новых идей из 3/);
  assert.equal(tables.ideaStudioDraft.length,2);
  assert.equal(imageCalls,2);assert.equal(textCalls,1);assert.equal(telegramCalls,0);
  const job=tables.ideaStudioJob[0];
  assert.equal(job.status,"succeeded");assert.equal(job.completed,2);assert.equal(job.total,2);
});
test("a fully repetitive batch never calls image generation or retries the paid text request",async()=>{
  await makeDraft();
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42");
  await processNextStudioJob();
  assert.equal(tables.ideaStudioBatch.find(row=>row.id===batch.id).status,"failed");
  assert.match(tables.ideaStudioBatch.find(row=>row.id===batch.id).error,/Все предложенные сцены/);
  assert.equal(imageCalls,1);assert.equal(textCalls,2);assert.equal(telegramCalls,0);
});

test("exclusions persist, snapshot into a batch and reach research and semantic review",async()=>{
  const overview=await getStudioOverview();
  const exclusions="Кафе и кофе\nНоутбуки";
  await saveStudioSettings({...overview.settings,creativeProfile:{...overview.settings.creativeProfile,exclusions}},"42");
  assert.equal((await getStudioOverview()).settings.creativeProfile.exclusions,exclusions);
  let researched=false,reviewed=false;
  studioDependencies.researchStudioIdeas=async(topics,reserve)=>{
    await reserve();const brief=JSON.parse(topics);
    assert.deepEqual(brief.exclusions,["Кафе и кофе","Ноутбуки"]);
    assert.equal(brief.explorationSeed,batch.id);researched=true;
    return {text:"New directions",sources:[{title:"Source",url:"https://example.test/"}]};
  };
  studioDependencies.reviewStudioNovelty=async(input,reserve)=>{
    await reserve();assert.ok(researched);assert.equal(imageCalls,0);
    assert.deepEqual(input.exclusions,["Кафе и кофе","Ноутбуки"]);reviewed=true;
    return input.candidates;
  };
  const batch=await enqueueStudioBatch({count:1,useWebSearch:true},"42");
  tables.ideaStudioSettings[0].creativeProfile.exclusions="Other rules for later batches";
  await processNextStudioJob();
  assert.ok(reviewed);assert.equal(imageCalls,1);assert.equal(telegramCalls,0);
});

test("semantic filtering precedes images and retains only genuinely new candidates",async()=>{
  const rows=distinctScenes();
  studioDependencies.generateStudioTexts=async(_input,reserve)=>{await reserve();return {ideas:rows};};
  studioDependencies.reviewStudioNovelty=async(input,reserve)=>{
    assert.equal(imageCalls,0);await reserve();return [input.candidates[1]];
  };
  const batch=await enqueueStudioBatch({count:3,useWebSearch:false},"42");
  await processNextStudioJob();
  const stored=tables.ideaStudioBatch.find(row=>row.id===batch.id);
  assert.equal(stored.status,"ready");assert.equal(stored.count,1);
  assert.equal(imageCalls,1);assert.equal(tables.ideaStudioDraft[0].title,rows[1].title);
  assert.match(stored.error,/Повторов и исключений пропущено: 2/);
});

test("all rejected and old library records participate beyond the former history limits",async()=>{
  for(let i=0;i<180;i++) tables.ideaStudioDraft.push({id:`history-${i}`,title:`Old scene ${i}`,concept:`Archive story ${i}`,content:`Archival scene number ${i} with unrelated equipment and surroundings`,rejected:true});
  for(let i=0;i<130;i++) tables.prompt.push({id:10000+i,title:`Library scene ${i}`,content:`Library narrative ${i} among unrelated objects and places`});
  studioDependencies.reviewStudioNovelty=async input=>{
    assert.equal(input.previous.length,310);
    assert.ok(input.previous.some(row=>row.title==="Old scene 179"));
    assert.ok(input.previous.some(row=>row.title==="Library scene 129"));
    return [];
  };
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42");
  await processNextStudioJob();
  assert.equal(tables.ideaStudioBatch.find(row=>row.id===batch.id).status,"failed");
  assert.equal(imageCalls,0);assert.equal(telegramCalls,0);
});

test("a failed novelty check stops before images without an automatic paid retry",async()=>{
  let reviews=0;
  studioDependencies.reviewStudioNovelty=async(_input,reserve)=>{reviews++;await reserve();throw Error("mock provider timeout");};
  const batch=await enqueueStudioBatch({count:1,useWebSearch:false},"42");
  await processNextStudioJob();await processNextStudioJob();
  assert.equal(tables.ideaStudioBatch.find(row=>row.id===batch.id).status,"failed");
  assert.equal(reviews,1);assert.equal(textCalls,1);assert.equal(imageCalls,0);
});

test("manual rewrite excludes its own draft but respects current exclusions",async()=>{
  const draft=await makeDraft();
  tables.ideaStudioSettings[0].creativeProfile.exclusions="Яхты";
  const original=draft.content;
  studioDependencies.reviewStudioNovelty=async input=>{
    assert.equal(input.previous.length,0);assert.deepEqual(input.exclusions,["Яхты"]);return [];
  };
  await enqueueStudioDraftAction(draft.id,"rewrite","42","Change the setting to another place");
  await processNextStudioJob();
  assert.equal(draft.content,original);assert.equal(draft.revision,0);assert.equal(imageCalls,1);
  assert.equal(tables.ideaStudioJob.at(-1)!.status,"failed");
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
