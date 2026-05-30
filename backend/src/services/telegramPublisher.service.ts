import { prisma } from "../db";
import { config } from "../config";
import { PromptService } from "./prompt.service";
import { derivePromptTitle } from "../utils/promptTitle";
import {
  type PublicationTemplateVars,
  resolveTelegramPostTemplate
} from "../utils/publicationTemplate";
import {
  htmlToPlainText,
  htmlToTelegramHtml,
  isHtmlTemplate,
  plainTemplateToHtml,
  renderPublicationTemplateHtml
} from "../utils/templateHtml";
import { assertTelegramMediaUrl, humanizeTelegramApiError, isSamePublicHost } from "../utils/telegramWebContent";

const TELEGRAM_CAPTION_MAX = 1024;
const TELEGRAM_MEDIA_GROUP_MAX = 10;
const HASHTAG_MAX = 8;

type PromptForPost = {
  id: number;
  title: string;
  content: string;
  telegramPostTemplate?: string | null;
  coverMediaUrl: string | null;
  coverMediaType: string | null;
  category: { name: string };
  keywords: Array<{ keyword: { name: string } }>;
  examples: Array<{ url: string; type: string }>;
};

type PostMediaItem = { url: string; type: "image" | "video" };

type TelegramMessage = {
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

function buildPromptStartParam(promptId: number): string {
  return `prompt_${promptId}`;
}

export function buildPromptUrl(promptId: number): string {
  const username = config.telegramBotUsername.trim();
  if (!username) {
    const base = (config.publicSiteUrl || config.webAppUrl).replace(/\/$/, "");
    return `${base}/?prompt=${promptId}`;
  }

  const startParam = buildPromptStartParam(promptId);
  return `https://t.me/${username}?startapp=${encodeURIComponent(startParam)}`;
}

function truncateCaption(text: string): string {
  if (text.length <= TELEGRAM_CAPTION_MAX) return text;
  return `${text.slice(0, TELEGRAM_CAPTION_MAX - 1)}…`;
}

function buildTelegramTemplateVars(prompt: PromptForPost): PublicationTemplateVars {
  return {
    headline: derivePromptTitle(prompt.content),
    category: prompt.category.name,
    hashtags: buildHashtags(prompt.keywords),
    link: buildPromptUrl(prompt.id),
    channel: config.telegramChannelUrl.trim()
  };
}

export function buildTelegramPost(prompt: PromptForPost): string {
  const vars = buildTelegramTemplateVars(prompt);
  const stored = prompt.telegramPostTemplate?.trim();
  const template = stored || resolveTelegramPostTemplate(null, vars);
  if (isHtmlTemplate(template)) {
    const rendered = renderPublicationTemplateHtml(template, vars);
    return truncateCaption(htmlToPlainText(rendered));
  }
  return truncateCaption(resolveTelegramPostTemplate(prompt.telegramPostTemplate, vars));
}

export function buildTelegramPostHtml(prompt: PromptForPost): string {
  const vars = buildTelegramTemplateVars(prompt);
  const stored = prompt.telegramPostTemplate?.trim();
  const template = stored || resolveTelegramPostTemplate(null, vars);
  const htmlSource = isHtmlTemplate(template) ? template : plainTemplateToHtml(template);
  const rendered = renderPublicationTemplateHtml(htmlSource, vars);
  return truncateCaption(htmlToTelegramHtml(rendered));
}

export function resolvePublicMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url)) {
    if (isSamePublicHost(url, config.webAppUrl)) {
      throw new Error(
        "Абсолютный URL медиа ведёт на mini app. Сохраните относительный путь /uploads/... или задайте PUBLIC_BACKEND_URL на API."
      );
    }
    return url;
  }
  const base = config.publicBackendUrl.replace(/\/$/, "");
  if (!base) {
    throw new Error("PUBLIC_BACKEND_URL не задан — нельзя собрать публичный URL медиа");
  }
  const mediaPath = url.startsWith("/") ? url : `/${url}`;
  return `${base}${mediaPath}`;
}

export function collectPostMedia(prompt: PromptForPost): PostMediaItem[] {
  const items: PostMediaItem[] = [];
  const seen = new Set<string>();

  function add(url: string | null | undefined, type: string | null | undefined) {
    if (type !== "image" && type !== "video") return;
    const resolved = resolvePublicMediaUrl(url);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    items.push({ url: resolved, type });
  }

  add(prompt.coverMediaUrl, prompt.coverMediaType);
  for (const example of prompt.examples) {
    add(example.url, example.type);
  }

  return items.slice(0, TELEGRAM_MEDIA_GROUP_MAX);
}

function resolvePublicationMediaType(items: PostMediaItem[]): string {
  if (items.length === 0) return "text";
  if (items.length > 1) return "media_group";
  return items[0].type === "video" ? "video" : "photo";
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = config.telegramBotToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не указан");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data: { ok: boolean; description?: string; result?: T };
  try {
    data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  } catch {
    throw new Error(`Telegram API error (${method}): invalid response`);
  }

  if (!response.ok || !data.ok || data.result === undefined) {
    const description = (data as { description?: string }).description || `Telegram API error (${method})`;
    throw new Error(humanizeTelegramApiError(description));
  }

  return data.result;
}

async function sendTelegramPost(chatId: string, postHtml: string, mediaItems: PostMediaItem[]): Promise<TelegramMessage> {
  const linkPreviewOff = { link_preview_options: { is_disabled: true } };

  for (const item of mediaItems) {
    await assertTelegramMediaUrl(item.url, item.type);
  }

  if (mediaItems.length === 0) {
    return callTelegramApi<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text: postHtml,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...linkPreviewOff
    });
  }

  if (mediaItems.length === 1) {
    const [item] = mediaItems;
    const method = item.type === "video" ? "sendVideo" : "sendPhoto";
    const mediaKey = item.type === "video" ? "video" : "photo";
    return callTelegramApi<TelegramMessage>(method, {
      chat_id: chatId,
      [mediaKey]: item.url,
      caption: postHtml,
      parse_mode: "HTML",
      ...linkPreviewOff
    });
  }

  const messages = await callTelegramApi<TelegramMessage[]>("sendMediaGroup", {
    chat_id: chatId,
    media: mediaItems.map((item, index) => ({
      type: item.type === "video" ? "video" : "photo",
      media: item.url,
      ...(index === 0
        ? {
            caption: postHtml,
            parse_mode: "HTML"
          }
        : {})
    }))
  });

  if (!messages.length) {
    throw new Error("Telegram API error (sendMediaGroup): empty result");
  }

  return messages[0];
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
  const postHtml = buildTelegramPostHtml(prompt);
  const mediaItems = collectPostMedia(prompt);
  const mediaType = resolvePublicationMediaType(mediaItems);

  const publication = await prisma.telegramPublication.create({
    data: {
      promptId,
      status: "pending",
      postText,
      mediaType
    }
  });

  try {
    const result = await sendTelegramPost(config.telegramChannelId, postHtml, mediaItems);

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
    const raw = error instanceof Error ? error.message : String(error);
    const message = humanizeTelegramApiError(raw);
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
