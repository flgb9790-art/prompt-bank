import { prisma } from "../db";
import { config } from "../config";
import { PromptService } from "./prompt.service";

const TELEGRAM_CAPTION_MAX = 1024;
const HASHTAG_MAX = 8;

type PromptForPost = {
  id: number;
  title: string;
  coverMediaUrl: string | null;
  coverMediaType: string | null;
  category: { name: string };
  keywords: Array<{ keyword: { name: string } }>;
  examples: Array<{ url: string; type: string }>;
};

type TelegramApiResult = {
  message_id: number;
  chat: { id: number | string };
};

export function normalizeHashtag(name: string): string | null {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
  return normalized ? `#${normalized}` : null;
}

export function buildHashtags(keywords: Array<{ keyword: { name: string } }>): string {
  const tags = keywords
    .map((item) => item.keyword.name)
    .slice(0, HASHTAG_MAX)
    .map((name) => normalizeHashtag(name))
    .filter((tag): tag is string => Boolean(tag));
  return tags.length ? tags.join(" ") : "#prompt";
}

export function buildPromptUrl(promptId: number): string {
  const base = (config.publicSiteUrl || config.webAppUrl).replace(/\/$/, "");
  return `${base}/?prompt=${promptId}`;
}

function truncateCaption(text: string): string {
  if (text.length <= TELEGRAM_CAPTION_MAX) return text;
  return `${text.slice(0, TELEGRAM_CAPTION_MAX - 1)}…`;
}

export function buildTelegramPost(prompt: PromptForPost): string {
  const hashtags = buildHashtags(prompt.keywords);
  return truncateCaption(`✨ Новый промпт: ${prompt.title}

📂 ${prompt.category.name}
🏷 ${hashtags}

🔗 Открыть и скопировать:
${buildPromptUrl(prompt.id)}`);
}

export function resolvePublicMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (config.publicBackendUrl || config.mediaPublicUrl || config.backendUrl).replace(/\/$/, "");
  if (!base) return url.startsWith("/") ? url : `/${url}`;
  const mediaPath = url.startsWith("/") ? url : `/${url}`;
  return `${base}${mediaPath}`;
}

function pickMedia(prompt: PromptForPost): { url: string; type: "image" | "video" } | null {
  if (prompt.coverMediaUrl && prompt.coverMediaType === "image") {
    const url = resolvePublicMediaUrl(prompt.coverMediaUrl);
    if (url) return { url, type: "image" };
  }
  if (prompt.coverMediaUrl && prompt.coverMediaType === "video") {
    const url = resolvePublicMediaUrl(prompt.coverMediaUrl);
    if (url) return { url, type: "video" };
  }

  for (const example of prompt.examples) {
    if (example.type !== "image" && example.type !== "video") continue;
    const url = resolvePublicMediaUrl(example.url);
    if (url) return { url, type: example.type as "image" | "video" };
  }

  return null;
}

async function callTelegramApi(method: string, payload: Record<string, unknown>): Promise<TelegramApiResult> {
  const token = config.telegramBotToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не указан");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data: { ok: boolean; description?: string; result?: TelegramApiResult };
  try {
    data = (await response.json()) as { ok: boolean; description?: string; result?: TelegramApiResult };
  } catch {
    throw new Error(`Telegram API error (${method}): invalid response`);
  }

  if (!response.ok || !data.ok || !data.result) {
    throw new Error(data.description || `Telegram API error (${method})`);
  }

  return data.result;
}

export async function getLatestTelegramPublication(promptId: number) {
  return prisma.telegramPublication.findFirst({
    where: { promptId },
    orderBy: { createdAt: "desc" }
  });
}

export async function sendPromptToTelegram(promptId: number) {
  if (!config.telegramChannelId) {
    throw new Error("TELEGRAM_CHANNEL_ID не указан");
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      category: true,
      keywords: { include: { keyword: true } },
      examples: { orderBy: { id: "asc" } }
    }
  });

  if (!prompt) {
    throw new Error("Prompt not found");
  }

  const postText = buildTelegramPost(prompt);
  const media = pickMedia(prompt);
  const mediaType = media ? (media.type === "image" ? "photo" : "video") : "text";

  const publication = await prisma.telegramPublication.create({
    data: {
      promptId,
      status: "pending",
      postText,
      mediaType
    }
  });

  try {
    const chatId = config.telegramChannelId;
    let result: TelegramApiResult;

    if (media?.type === "image") {
      result = await callTelegramApi("sendPhoto", {
        chat_id: chatId,
        photo: media.url,
        caption: postText
      });
    } else if (media?.type === "video") {
      result = await callTelegramApi("sendVideo", {
        chat_id: chatId,
        video: media.url,
        caption: postText
      });
    } else {
      result = await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: postText
      });
    }

    await prisma.$transaction([
      prisma.telegramPublication.update({
        where: { id: publication.id },
        data: {
          status: "published",
          telegramMessageId: String(result.message_id),
          telegramChatId: String(result.chat.id),
          publishedAt: new Date()
        }
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { telegramPublished: true }
      })
    ]);

    const updated = await getLatestTelegramPublication(promptId);
    PromptService.invalidateDetailCache(promptId);
    return { status: "published" as const, publication: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Telegram publish failed for prompt ${promptId}:`, message);

    await prisma.$transaction([
      prisma.telegramPublication.update({
        where: { id: publication.id },
        data: {
          status: "failed",
          error: message
        }
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { telegramPublished: false }
      })
    ]);

    const updated = await getLatestTelegramPublication(promptId);
    PromptService.invalidateDetailCache(promptId);
    return { status: "failed" as const, error: message, publication: updated };
  }
}
