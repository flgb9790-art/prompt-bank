import { randomUUID } from "node:crypto";
import type { Prisma, IdeaStudioJob } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "../db";
import { config } from "../config";
import { resolveUserIdByTelegramId } from "../user";
import { extractKeywords } from "../keywordExtractor";
import { persistMediaBuffer } from "./storage.service";
import { sendPromptToTelegram, buildPromptUrl } from "./telegramPublisher.service";
import { buildStudioTelegramPostTemplate } from "./ideaStudio.telegramPublication";
import { PromptService } from "./prompt.service";
import {
  creativeProfile,
  createCreativeContext,
  readCreativeContext,
  creativeResearchTopics,
  characterImagePrompt,
  studioExclusions,
} from "./ideaStudio.creative";
import { compactStudioHistory } from "./ideaStudio.novelty";
import {
  readStudioReference,
  storeStudioReference,
} from "./ideaStudio.references";
import { prepareStudioReference } from "./ideaStudio.faceReference";
import {
  composeReusableIdea,
  validateReusablePrompt,
} from "./ideaStudio.quality";
import {
  generateStudioTexts,
  generateStudioImage,
  researchStudioIdeas,
  reviewStudioNovelty,
} from "./ideaStudio.openai";
import {
  StudioError,
  fingerprint,
  localStudioClock,
  studioCount,
  studioString,
  validateGeneratedIdeas,
  validateStudioSettings,
  ideaComparisonText,
} from "./ideaStudio.validation";

export const studioDependencies = {
  prepareStudioReference,
  readStudioReference,
  generateStudioTexts,
  generateStudioImage,
  researchStudioIdeas,
  reviewStudioNovelty,
  persistMediaBuffer,
  sendPromptToTelegram,
};
const SETTINGS = "main";
const activeStatuses = ["queued", "running"];
const safeError = (error: unknown) =>
  error instanceof StudioError
    ? error.message
    : "Операция прервана. Обновите страницу и повторите вручную. При публикации сначала проверьте канал.";
export function studioConfigured() {
  return Boolean(config.openaiApiKey);
}
export async function studioSettings() {
  return prisma.ideaStudioSettings.upsert({
    where: { id: SETTINGS },
    create: { id: SETTINGS },
    update: {},
  });
}
export async function setStudioReference(buffer: Buffer | null) {
  const key = buffer ? await storeStudioReference(buffer) : null;
  if (key) await studioDependencies.prepareStudioReference(key);
  await studioSettings();
  await prisma.ideaStudioSettings.update({
    where: { id: SETTINGS },
    data: { referenceImageKey: key },
  });
}
export async function getStudioReference(batchId?: string, identity = false) {
  const source = batchId
    ? await prisma.ideaStudioBatch.findUnique({ where: { id: batchId } })
    : await studioSettings();
  if (!source?.referenceImageKey)
    throw new StudioError("Референс не найден.", 404);
  return identity
    ? studioDependencies.prepareStudioReference(source.referenceImageKey)
    : studioDependencies.readStudioReference(source.referenceImageKey);
}
export async function reserveStudioUsage(
  kind: "text" | "image",
  date = new Date(),
  origin: "manual" | "scheduled" = "scheduled",
) {
  const id = `${date.toISOString().slice(0, 10)}:${kind}`;
  const limit = kind === "image" ? config.studioDailyImageLimit : config.studioDailyTextLimit;
  await prisma.$transaction(async tx => {
      if (origin === "scheduled") {
        const scheduledId = `${id}:scheduled`;
        await tx.ideaStudioUsage.upsert({where:{id:scheduledId},create:{id:scheduledId},update:{}});
        const reserved = await tx.ideaStudioUsage.updateMany({
          where:{id:scheduledId,requests:{lt:limit}},
          data:{requests:{increment:1}},
        });
        if (!reserved.count) throw new StudioError(
          `Достигнут дневной лимит автоматических ${kind === "image" ? "изображений" : "текстовых запросов"} (${limit}). Он обновится в 00:00 UTC. Ручные запросы доступны без этого лимита.`, 429,
        );
      }
      await tx.ideaStudioUsage.upsert({
        where:{id},create:{id,requests:1},update:{requests:{increment:1}},
      });
  });
}
export async function getStudioOverview(batchId?: string) {
  const settings = await studioSettings();
  const day = new Date().toISOString().slice(0, 10);
  const [batches, jobs, usage] = await Promise.all([
    prisma.ideaStudioBatch.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { drafts: true } } },
    }),
    prisma.ideaStudioJob.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        completed: true,
        total: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.ideaStudioUsage.findMany({
      where: { id: { in: [`${day}:text`, `${day}:image`, `${day}:text:scheduled`, `${day}:image:scheduled`] } },
    }),
  ]);
  const currentId = batchId || batches[0]?.id;
  const current = currentId
    ? await prisma.ideaStudioBatch.findUnique({
        where: { id: currentId },
        include: {
          drafts: {
            orderBy: { createdAt: "asc" },
            include: {
              prompt: {
                select: {
                  id: true,
                  telegramPostUrl: true,
                  pinterestPublished: true,
                },
              },
            },
          },
        },
      })
    : null;
  return {
    configured: studioConfigured(),
    publication: {promptLinkBase:buildPromptUrl(0).slice(0,-1)},
    reference: {
      available: Boolean(settings.referenceImageKey),
      version: settings.referenceImageKey
        ? fingerprint(settings.referenceImageKey).slice(0, 16)
        : null,
    },
    models: {
      text: config.studioTextModel,
      image: config.studioImageModel,
      imageQuality: config.studioImageQuality,
    },
    settings: {
      dailyEnabled: settings.dailyEnabled,
      dailyCount: settings.dailyCount,
      runAt: settings.runAt,
      timeZone: settings.timeZone,
      language: settings.language,
      topics: settings.topics,
      useWebSearch: settings.useWebSearch,
      creativeProfile: creativeProfile(settings.creativeProfile),
    },
    limits: {
      image: config.studioDailyImageLimit,
      text: config.studioDailyTextLimit,
      manualTextUnlimited: true,
      manualImageUnlimited: true,
      resetTimeZone: "UTC",
    },
    usage: {
      image: usage.find((x) => x.id.endsWith(":image"))?.requests || 0,
      text: usage.find((x) => x.id.endsWith(":text"))?.requests || 0,
      scheduledText: usage.find((x) => x.id.endsWith(":text:scheduled"))?.requests || 0,
      scheduledImage: usage.find((x) => x.id.endsWith(":image:scheduled"))?.requests || 0,
    },
    batches: batches.map(({ referenceImageKey, ...batch }) => ({
      ...batch,
      creativeContext: readCreativeContext(batch.creativeContext),
      hasReference: Boolean(referenceImageKey),
    })),
    jobs,
    current: current
      ? (({ referenceImageKey, ...batch }) => ({
          ...batch,
          creativeContext: readCreativeContext(batch.creativeContext),
          hasReference: Boolean(referenceImageKey),
        }))(current)
      : null,
  };
}
export async function saveStudioSettings(input: unknown, owner: string) {
  const existing = await studioSettings();
  const data = {
    ...validateStudioSettings(input),
    creativeProfile: creativeProfile(
      (input as any)?.creativeProfile ?? existing.creativeProfile,
    ),
  };
  if (data.dailyEnabled && !studioConfigured())
    throw new StudioError("Сначала настройте OPENAI_API_KEY на backend.", 503);
  if (data.dailyEnabled && data.dailyCount > config.studioDailyImageLimit)
    throw new StudioError(
      "Идей в подборке больше, чем дневной лимит изображений.",
    );
  await studioSettings();
  return prisma.ideaStudioSettings.update({
    where: { id: SETTINGS },
    data: { ...data, ownerTelegramId: owner },
  });
}
export async function enqueueStudioBatch(
  input: any,
  owner: string,
  dailyKey?: string,
) {
  if (!studioConfigured())
    throw new StudioError(
      "Сначала добавьте OPENAI_API_KEY в backend Railway.",
      503,
    );
  const count = studioCount(input.count);
  const settings = await studioSettings();
  const profile = creativeProfile(
    input.creativeProfile ?? settings.creativeProfile,
  );
  const referenceImageKey = profile.useCharacter
    ? settings.referenceImageKey
    : null;
  if (referenceImageKey)
    await studioDependencies.prepareStudioReference(referenceImageKey);
  const creativeContext = createCreativeContext(
    profile,
    Boolean(referenceImageKey),
    settings.timeZone,
  );
  const topics = studioString(
    input.topics ?? settings.topics,
    "Тематики",
    3,
    2000,
  );
  const language = input.language ?? settings.language;
  if (!["en", "ru"].includes(language))
    throw new StudioError("Неизвестный язык.");
  const sourcePrompt = input.sourcePrompt
    ? studioString(input.sourcePrompt, "Исходный промпт", 20, 12000)
    : null;
  if (
    (await prisma.ideaStudioJob.count({
      where: { status: { in: activeStatuses } },
    })) >= 10
  )
    throw new StudioError(
      "Очередь заполнена. Дождитесь завершения задач.",
      409,
    );
  return prisma.$transaction(async (tx) => {
    if (dailyKey) {
      const existing = await tx.ideaStudioBatch.findUnique({
        where: { dailyKey },
      });
      if (existing) return existing;
    }
    const batch = await tx.ideaStudioBatch.create({
      data: {
        dailyKey,
        count,
        topics,
        language,
        sourcePrompt,
        creativeContext,
        referenceImageKey,
        creatorTelegramId: owner,
        useWebSearch: input.useWebSearch ?? settings.useWebSearch,
      },
    });
    await tx.ideaStudioJob.create({
      data: {
        kind: "generate",
        creatorTelegramId: owner,
        payload: { batchId: batch.id },
        total: count,
      },
    });
    return batch;
  });
}
export async function editStudioDraft(id: string, input: any) {
  if (typeof input.content === "string") validateReusablePrompt(input.content);
  const draft = await prisma.ideaStudioDraft.findUnique({ where: { id } });
  if (!draft) throw new StudioError("Черновик не найден.", 404);
  const data: Prisma.IdeaStudioDraftUpdateManyMutationInput = {
    revision: { increment: 1 },
  };
  for (const key of ["title", "concept", "content", "imagePrompt"] as const) {
    if (input[key] !== undefined)
      data[key] = studioString(
        input[key],
        key,
        key === "title" ? 2 : 15,
        key === "title" ? 100 : 14000,
      );
  }
  if (input.selected !== undefined) {
    if (typeof input.selected !== "boolean")
      throw new StudioError("Неверное значение выбора.");
    data.selected = input.selected;
    if (input.selected) data.rejected = false;
  }
  if (input.rejected !== undefined) {
    if (typeof input.rejected !== "boolean")
      throw new StudioError("Неверное значение отклонения.");
    data.rejected = input.rejected;
    if (input.rejected) data.selected = false;
  }
  if (
    (input.content !== undefined && input.content !== draft.content) ||
    (input.imagePrompt !== undefined && input.imagePrompt !== draft.imagePrompt)
  )
    data.imageStale = true;
  if (
    input.content !== undefined &&
    input.content !== draft.content &&
    (input.imagePrompt === undefined || input.imagePrompt === draft.imagePrompt)
  )
    data.imagePrompt = data.content;
  const result = await prisma.ideaStudioDraft.updateMany({
    where: { id, revision: draft.revision, busyJobId: null, promptId: null },
    data,
  });
  if (!result.count)
    throw new StudioError(
      "Черновик уже изменён, обрабатывается или опубликован. Обновите список.",
      409,
    );
  return prisma.ideaStudioDraft.findUniqueOrThrow({ where: { id } });
}
export async function enqueueStudioDraftAction(
  id: string,
  kind: "image" | "rewrite",
  owner: string,
  instructions?: string,
) {
  if (!studioConfigured())
    throw new StudioError("Сначала настройте OPENAI_API_KEY.", 503);
  const extra =
    kind === "rewrite"
      ? studioString(instructions, "Что изменить", 3, 2000)
      : "";
  return prisma.$transaction(async (tx) => {
    const job = await tx.ideaStudioJob.create({
      data: {
        kind,
        creatorTelegramId: owner,
        payload: { draftId: id, instructions: extra },
      },
    });
    const locked = await tx.ideaStudioDraft.updateMany({
      where: { id, busyJobId: null, promptId: null, rejected: false },
      data: { busyJobId: job.id },
    });
    if (!locked.count)
      throw new StudioError(
        "Черновик занят, отклонён или уже опубликован.",
        409,
      );
    return job;
  });
}
export async function enqueueStudioPublication(
  ids: unknown,
  owner: string,
  confirmed: unknown,
  publication?: unknown,
) {
  if (confirmed !== true)
    throw new StudioError(
      "Проверьте предпросмотр и подтвердите отправку в Telegram.",
    );
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 10 ||
    ids.some((id) => typeof id !== "string")
  )
    throw new StudioError("Выберите от 1 до 10 черновиков.");
  const unique = [...new Set(ids as string[])];
  const telegramPostTemplate = buildStudioTelegramPostTemplate(publication);
  return prisma.$transaction(async (tx) => {
    const drafts = await tx.ideaStudioDraft.findMany({
      where: { id: { in: unique } },
      include: { prompt: { select: { telegramPostUrl: true } } },
    });
    if (drafts.length !== unique.length)
      throw new StudioError("Один из черновиков не найден.", 404);
    for (const draft of drafts) {
      validateReusablePrompt(draft.content);
      if (
        draft.busyJobId ||
        draft.rejected ||
        !draft.selected ||
        draft.imageStatus !== "ready" ||
        !draft.imageUrl ||
        draft.imageStale
      )
        throw new StudioError(
          "Все материалы должны быть выбраны, иметь актуальное изображение и не обрабатываться.",
          409,
        );
      if (draft.publishUncertain && !draft.prompt?.telegramPostUrl)
        throw new StudioError(
          "Прошлая отправка прервалась. Сначала проверьте канал и сохраните ссылку на пост или подтвердите его отсутствие.",
          409,
        );
    }
    const job = await tx.ideaStudioJob.create({
      data: {
        kind: "publish",
        creatorTelegramId: owner,
        payload: { draftIds: unique, telegramPostTemplate },
        total: unique.length,
      },
    });
    const locked = await tx.ideaStudioDraft.updateMany({
      where: { id: { in: unique }, busyJobId: null },
      data: { busyJobId: job.id, publishError: null },
    });
    if (locked.count !== unique.length)
      throw new StudioError(
        "Материалы уже обрабатываются. Обновите список.",
        409,
      );
    return job;
  });
}
export async function allowStudioPublicationRetry(
  id: string,
  confirmed: unknown,
) {
  if (confirmed !== true)
    throw new StudioError(
      "Подтвердите, что проверили канал и пост отсутствует.",
    );
  const result = await prisma.ideaStudioDraft.updateMany({
    where: { id, busyJobId: null, publishUncertain: true },
    data: { publishUncertain: false, publishError: null },
  });
  if (!result.count)
    throw new StudioError("Материал не найден или ещё обрабатывается.", 409);
}

type Lease = { signal: AbortSignal; check: () => void };
async function createDraftImage(id: string, owner: string, lease: Lease, origin: "manual" | "scheduled" = "manual") {
  const draft = await prisma.ideaStudioDraft.findUniqueOrThrow({
    where: { id },
    include: { batch: true },
  });
  lease.check();
  await prisma.ideaStudioDraft.update({
    where: { id },
    data: { imageStatus: "generating", imageError: null },
  });
  try {
    const reference = draft.batch.referenceImageKey
      ? await studioDependencies.prepareStudioReference(
          draft.batch.referenceImageKey,
        )
      : undefined;
    const creative = readCreativeContext(draft.batch.creativeContext);
    const imagePrompt = reference
      ? characterImagePrompt(draft.imagePrompt, draft.batch.language)
      : creative?.profile.useCharacter
        ? `No reference photo is attached. Create a realistic professional photograph with an adult woman. Private character guidance: ${creative.profile.characterDescription}.\n\n${draft.imagePrompt.replace(/^(?:Use the person in the uploaded photograph|Используй человека из приложенной фотографии)[\s\S]*?\n\n/u, "")}`
        : draft.imagePrompt;
    const bytes = await studioDependencies.generateStudioImage(
      imagePrompt,
      owner,
      () => reserveStudioUsage("image", new Date(), origin),
      lease.signal,
      reference,
    );
    lease.check();
    const meta = await sharp(bytes).metadata();
    if (
      !meta.width ||
      !meta.height ||
      !["jpeg", "png", "webp"].includes(meta.format || "")
    )
      throw new StudioError("ИИ вернул повреждённое изображение.", 502);
    const jpeg = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
    const media = await studioDependencies.persistMediaBuffer(
      "image",
      jpeg,
      "studio.jpg",
      "image/jpeg",
    );
    lease.check();
    await prisma.ideaStudioDraft.update({
      where: { id },
      data: {
        imageUrl: media.url,
        imageStatus: "ready",
        imageStale: false,
        imageError: null,
      },
    });
  } catch (error) {
    lease.check();
    await prisma.ideaStudioDraft.update({
      where: { id },
      data: { imageStatus: "failed", imageError: safeError(error) },
    });
    throw error;
  }
}
async function loadStudioHistory(exclude?: {id:string; promptId:number|null}) {
  const [drafts, prompts] = await Promise.all([
    prisma.ideaStudioDraft.findMany({
      ...(exclude ? {where:{id:{not:exclude.id}}} : {}),
      orderBy:{createdAt:"desc"}, select:{title:true,concept:true,content:true},
    }),
    prisma.prompt.findMany({
      ...(exclude?.promptId ? {where:{id:{not:exclude.promptId}}} : {}),
      orderBy:{createdAt:"desc"}, select:{title:true,content:true},
    }),
  ]);
  return [...drafts,...prompts.map(prompt => ({...prompt,concept:ideaComparisonText(prompt.content)}))];
}
async function processGeneration(job: IdeaStudioJob, lease: Lease) {
  const { batchId } = job.payload as { batchId: string };
  const batch = await prisma.ideaStudioBatch.findUniqueOrThrow({
    where: { id: batchId },
  });
  const used = batch.dailyKey ? await prisma.ideaStudioUsage.findUnique({
    where: { id: `${new Date().toISOString().slice(0, 10)}:image:scheduled` },
  }) : null;
  if (batch.dailyKey && (used?.requests || 0) + batch.count > config.studioDailyImageLimit)
    throw new StudioError(
      "Для автоматической подборки не хватает дневного лимита изображений. Текстовые запросы не выполнялись; ручной запуск доступен без этого лимита.",
      429,
    );
  await prisma.ideaStudioBatch.update({
    where: { id: batchId },
    data: { status: "generating", error: null },
  });
  const previous = await loadStudioHistory();
  const compactHistory = compactStudioHistory(previous);
  let research = "";
  let researchNotice: string | null = null;
  // Origin comes from the server-created schedule key, never from request body flags.
  const textOrigin = batch.dailyKey ? "scheduled" : "manual";
  const creativeContext = readCreativeContext(batch.creativeContext);
  if (batch.useWebSearch) {
    const result = await studioDependencies.researchStudioIdeas(
      creativeResearchTopics(batch.topics, creativeContext, {recentScenes:compactHistory.slice(0,30),explorationSeed:batch.id}),
      () => reserveStudioUsage("text", new Date(), textOrigin),
      lease.signal,
    );
    lease.check();
    research = result.text;
    researchNotice = result.notice || null;
    await prisma.ideaStudioBatch.update({
      where: { id: batchId },
      data: { sources: result.sources, error: researchNotice },
    });
  }
  const raw = await studioDependencies.generateStudioTexts(
    {
      count: batch.count,
      topics: batch.topics,
      language: batch.language,
      sourcePrompt: batch.sourcePrompt,
      previous: compactHistory.slice(0,100),
      research,
      creativeContext,
      shotSeed: batch.id,
    },
    () => reserveStudioUsage("text", new Date(), textOrigin),
    lease.signal,
  );
  lease.check();
  const prepared = {
    ...raw,
    ideas: Array.isArray(raw?.ideas)
      ? raw.ideas.map((idea: any) =>
          composeReusableIdea(idea, creativeContext, batch.language),
        )
      : raw?.ideas,
  };
  const candidates = validateGeneratedIdeas(
    prepared,
    batch.count,
    batch.language,
    previous,
    { skipDuplicates: true },
  );
  const ideas = await studioDependencies.reviewStudioNovelty({
    candidates, previous, exclusions:studioExclusions(creativeContext?.profile.exclusions),
  }, () => reserveStudioUsage("text", new Date(), textOrigin), lease.signal);
  lease.check();
  if (!ideas.length) throw new StudioError("Подборка повторяет прежние сюжеты, попадает под исключения или не соответствует реалистичной фотосъёмке. Изображения не создавались. Уточните темы; платного повтора автоматически не будет.", 502);
  const duplicateCount = batch.count - ideas.length;
  const generationNotice = [researchNotice, duplicateCount
    ? `Сохранено ${ideas.length} новых идей из ${batch.count}. Повторов, исключений и нереалистичных сюжетов пропущено: ${duplicateCount}; платная перегенерация не выполнялась.`
    : null].filter(Boolean).join(" ") || null;
  await prisma.$transaction(
    ideas.map((idea) =>
      prisma.ideaStudioDraft.create({
        data: {
          ...idea,
          batchId,
          fingerprint: fingerprint(idea.content),
          busyJobId: job.id,
        },
      }),
    ),
  );
  await prisma.ideaStudioBatch.update({
    where: { id: batchId },
    data: { status: "images", count: ideas.length, error: generationNotice },
  });
  if (duplicateCount) await prisma.ideaStudioJob.update({
    where: { id: job.id }, data: { total: ideas.length },
  });
  const drafts = await prisma.ideaStudioDraft.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
  });
  let errors = 0;
  for (const draft of drafts) {
    lease.check();
    try {
      await createDraftImage(draft.id, job.creatorTelegramId, lease, batch.dailyKey ? "scheduled" : "manual");
    } catch {
      lease.check();
      errors++;
    }
    await prisma.ideaStudioDraft.update({
      where: { id: draft.id },
      data: { busyJobId: null },
    });
    await prisma.ideaStudioJob.update({
      where: { id: job.id },
      data: { completed: { increment: 1 } },
    });
  }
  await prisma.ideaStudioBatch.update({
    where: { id: batchId },
    data: {
      status: errors ? "partial" : "ready",
      error: [generationNotice, errors
        ? `Не удалось подготовить ${errors} изображений. Тексты сохранены, изображения можно повторить отдельно.`
        : null].filter(Boolean).join(" ") || null,
    },
  });
  return drafts.length;
}
async function processRewrite(job: IdeaStudioJob, lease: Lease) {
  const { draftId, instructions } = job.payload as {
    draftId: string;
    instructions: string;
  };
  const draft = await prisma.ideaStudioDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { batch: true },
  });
  const previous = await loadStudioHistory(draft);
  // Current exclusions apply to a manual rewrite; character/reference snapshots stay fixed.
  const settings = await studioSettings();
  const context = readCreativeContext(draft.batch.creativeContext);
  const exclusions = creativeProfile(settings.creativeProfile).exclusions;
  const creativeContext = context ? {...context,profile:{...context.profile,exclusions}} : undefined;
  const raw = await studioDependencies.generateStudioTexts(
    {
      count: 1,
      topics: instructions,
      language: draft.batch.language,
      sourcePrompt: draft.content,
      previous: compactStudioHistory(previous).slice(0,100),
      creativeContext,
    },
    () => reserveStudioUsage("text", new Date(), "manual"),
    lease.signal,
  );
  lease.check();
  const prepared = {
    ...raw,
    ideas: Array.isArray(raw?.ideas)
      ? raw.ideas.map((idea: any) =>
          composeReusableIdea(
            idea,
            creativeContext,
            draft.batch.language,
          ),
        )
      : raw?.ideas,
  };
  const candidates = validateGeneratedIdeas(prepared, 1, draft.batch.language, previous);
  const [idea] = await studioDependencies.reviewStudioNovelty({candidates,previous,exclusions:studioExclusions(exclusions)}, () => reserveStudioUsage("text",new Date(),"manual"),lease.signal);
  lease.check();
  if (!idea) throw new StudioError("Переработанная идея повторяет другой сюжет, попадает под исключения или не соответствует реалистичной фотосъёмке. Исходный черновик сохранён.",502);
  await prisma.ideaStudioDraft.update({
    where: { id: draftId },
    data: {
      ...idea,
      fingerprint: fingerprint(idea.content),
      imageStale: true,
      revision: { increment: 1 },
    },
  });
}
async function materializeStudioPrompt(id: string, owner: string, telegramPostTemplate: string) {
  const userId = await resolveUserIdByTelegramId(owner);
  const category = await prisma.category.findFirst({
    where: { slug: "image-prompts" },
  });
  if (!category)
    throw new StudioError(
      "Создайте категорию Image Prompts перед публикацией.",
      409,
    );
  return prisma.$transaction(async (tx) => {
    const draft = await tx.ideaStudioDraft.findUniqueOrThrow({ where: { id } });
    if (draft.promptId) {
      await tx.prompt.updateMany({
        where:{id:draft.promptId,telegramPostUrl:null,telegramPublished:false},
        data:{telegramPostTemplate},
      });
      return draft.promptId;
    }
    const prompt = await tx.prompt.create({
      data: {
        userId,
        categoryId: category.id,
        title: draft.title,
        content: draft.content,
        coverMediaUrl: draft.imageUrl,
        coverMediaType: "image",
        telegramPostTemplate,
      },
    });
    for (const name of extractKeywords(draft.content, draft.title)) {
      const keyword = await tx.keyword.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await tx.promptKeyword.create({
        data: { promptId: prompt.id, keywordId: keyword.id },
      });
    }
    await tx.ideaStudioDraft.update({
      where: { id },
      data: { promptId: prompt.id },
    });
    return prompt.id;
  });
}
async function processPublications(job: IdeaStudioJob, lease: Lease) {
  const { draftIds, telegramPostTemplate = buildStudioTelegramPostTemplate() } = job.payload as { draftIds: string[]; telegramPostTemplate?:string };
  let failed = 0;
  for (const id of draftIds) {
    lease.check();
    try {
      const draft = await prisma.ideaStudioDraft.findUniqueOrThrow({
        where: { id },
        include: { prompt: true },
      });
      if (draft.prompt?.telegramPostUrl) {
        await prisma.ideaStudioDraft.update({
          where: { id },
          data: { publishUncertain: false, publishError: null },
        });
        continue;
      }
      if (!draft.prompt?.telegramPostUrl && draft.publishUncertain)
        throw new StudioError(
          "Проверьте результат прежней отправки в канале.",
          409,
        );
      const promptId = await materializeStudioPrompt(id, job.creatorTelegramId, telegramPostTemplate);
      lease.check();
      // Retain this flag across crashes/timeouts: never blindly resend an ambiguous post.
      await prisma.ideaStudioDraft.update({
        where: { id },
        data: { publishUncertain: true, publishError: null },
      });
      const result = await studioDependencies.sendPromptToTelegram(promptId);
      lease.check();
      if (result.status !== "published")
        throw new StudioError(
          result.error || "Telegram не подтвердил публикацию.",
          502,
        );
      await prisma.ideaStudioDraft.update({
        where: { id },
        data: { publishUncertain: false, publishError: null },
      });
      PromptService.invalidateDetailCache(promptId);
    } catch (error) {
      lease.check();
      failed++;
      await prisma.ideaStudioDraft.update({
        where: { id },
        data: { publishError: safeError(error) },
      });
    } finally {
      lease.check();
      await prisma.ideaStudioDraft.update({
        where: { id },
        data: { busyJobId: null },
      });
      await prisma.ideaStudioJob.update({
        where: { id: job.id },
        data: { completed: { increment: 1 } },
      });
    }
  }
  if (failed)
    throw new StudioError(
      `Не удалось подтвердить ${failed} публикаций. Успешные сохранены; проверьте ошибки на карточках.`,
      502,
    );
}

let working = false;
export async function processNextStudioJob() {
  if (working) return;
  working = true;
  const token = randomUUID(),
    controller = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let owned = false,
    lost = false;
  const lease: Lease = {
    signal: controller.signal,
    check: () => {
      if (lost) throw new Error("Studio lease lost");
    },
  };
  try {
    await studioSettings();
    const lock = await prisma.ideaStudioSettings.updateMany({
      where: {
        id: SETTINGS,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { workerToken: token, leaseUntil: new Date(Date.now() + 90000) },
    });
    if (!lock.count) return;
    owned = true;
    heartbeat = setInterval(() => {
      void prisma.ideaStudioSettings
        .updateMany({
          where: { id: SETTINGS, workerToken: token },
          data: { leaseUntil: new Date(Date.now() + 90000) },
        })
        .then((result) => {
          if (!result.count) {
            lost = true;
            controller.abort();
          }
        })
        .catch(() => {
          lost = true;
          controller.abort();
        });
    }, 15000);
    heartbeat.unref();
    // A crashed paid call is never automatically retried. Completed media/Telegram URLs survive.
    const interrupted = await prisma.ideaStudioJob.findMany({
      where: { status: "running" },
      select: { id: true, payload: true, kind: true },
    });
    for (const old of interrupted) {
      const error =
        "Задача прервалась при перезапуске. Готовые результаты сохранены. Повторите недостающий этап вручную.";
      await prisma.ideaStudioJob.update({
        where: { id: old.id },
        data: { status: "failed", error },
      });
      await prisma.ideaStudioDraft.updateMany({
        where: { busyJobId: old.id, imageStatus: "generating" },
        data: { imageStatus: "failed", imageError: error },
      });
      await prisma.ideaStudioDraft.updateMany({
        where: { busyJobId: old.id },
        data: { busyJobId: null },
      });
      if (old.kind === "generate")
        await prisma.ideaStudioBatch.updateMany({
          where: { id: (old.payload as any).batchId },
          data: { status: "partial", error },
        });
    }
    const job = await prisma.ideaStudioJob.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    if (!job) return;
    lease.check();
    await prisma.ideaStudioJob.update({
      where: { id: job.id },
      data: { status: "running" },
    });
    try {
      if (!config.adminTelegramIds.includes(job.creatorTelegramId))
        throw new StudioError(
          "У автора задачи больше нет доступа администратора.",
          403,
        );
      let total = job.total;
      if (job.kind === "generate") total = await processGeneration(job, lease);
      else if (job.kind === "image")
        await createDraftImage(
          (job.payload as any).draftId,
          job.creatorTelegramId,
          lease,
        );
      else if (job.kind === "rewrite") await processRewrite(job, lease);
      else if (job.kind === "publish") await processPublications(job, lease);
      else throw new StudioError("Неизвестная задача.");
      lease.check();
      await prisma.ideaStudioJob.update({
        where: { id: job.id },
        data: { status: "succeeded", completed: total, total },
      });
    } catch (error) {
      lease.check();
      const message = safeError(error);
      await prisma.ideaStudioJob.update({
        where: { id: job.id },
        data: { status: "failed", error: message },
      });
      if (job.kind === "generate")
        await prisma.ideaStudioBatch.update({
          where: { id: (job.payload as any).batchId },
          data: { status: "failed", error: message },
        });
    } finally {
      if (!lost)
        await prisma.ideaStudioDraft.updateMany({
          where: { busyJobId: job.id },
          data: { busyJobId: null },
        });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    try {
      if (owned && !lost)
        await prisma.ideaStudioSettings.updateMany({
          where: { id: SETTINGS, workerToken: token },
          data: { workerToken: null, leaseUntil: null },
        });
    } finally {
      working = false;
    }
  }
}
export async function scheduleStudioBatch(now = new Date()) {
  if (!studioConfigured()) return;
  const settings = await studioSettings();
  if (
    !settings.dailyEnabled ||
    !settings.ownerTelegramId ||
    !config.adminTelegramIds.includes(settings.ownerTelegramId)
  )
    return;
  const clock = localStudioClock(now, settings.timeZone);
  if (clock.time < settings.runAt) return;
  const key = `daily:${clock.date}`;
  if (await prisma.ideaStudioBatch.findUnique({ where: { dailyKey: key } }))
    return;
  try {
    await enqueueStudioBatch(
      { count: settings.dailyCount, ...settings },
      settings.ownerTelegramId,
      key,
    );
  } catch (error) {
    if ((error as any)?.code !== "P2002") throw error;
  }
}
export function kickStudioWorker() {
  void processNextStudioJob().catch(() =>
    console.warn(
      "[idea-studio] Worker interrupted; queued work remains in the database.",
    ),
  );
}
export function startIdeaStudioWorker() {
  const tick = async () => {
    await scheduleStudioBatch();
    await processNextStudioJob();
  };
  const timer = setInterval(() => {
    void tick().catch(() =>
      console.warn(
        "[idea-studio] Scheduled tick failed; results remain in the database.",
      ),
    );
  }, 15000);
  timer.unref();
  void tick().catch(() =>
    console.warn("[idea-studio] Waiting for configuration/database."),
  );
}
