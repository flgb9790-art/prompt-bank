import {
  buildPublicationTemplateVars,
  resolveTelegramPostTemplate
} from "./publicationTemplate";

const HASHTAG_MAX = 8;

export function normalizeHashtag(name: string): string | null {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
  return normalized ? `#${normalized}` : null;
}

export function buildHashtagsFromNames(names: string[]): string {
  const tags = names
    .slice(0, HASHTAG_MAX)
    .map((name) => normalizeHashtag(name))
    .filter((tag): tag is string => Boolean(tag));
  return tags.length ? tags.join(" ") : "#prompt";
}

export function buildPromptPublicUrl(promptId: number | string, siteOrigin = window.location.origin): string {
  const base = siteOrigin.replace(/\/$/, "");
  return `${base}/?prompt=${promptId}`;
}

export function buildTelegramPostPreview(input: {
  content: string;
  categoryName: string;
  tagNames: string[];
  promptId?: number | string;
  siteOrigin?: string;
  telegramPostTemplate?: string | null;
}): string {
  const vars = buildPublicationTemplateVars({
    content: input.content,
    categoryName: input.categoryName,
    tagNames: input.tagNames,
    promptId: input.promptId,
    siteOrigin: input.siteOrigin
  });
  return resolveTelegramPostTemplate(input.telegramPostTemplate, vars);
}

export function telegramPublicationStatusLabel(status?: string | null): string {
  if (status === "published") return "Telegram: опубликовано ✅";
  if (status === "pending") return "Telegram: публикация...";
  if (status === "failed") return "Telegram: ошибка ⚠️";
  return "Telegram: не опубликовано";
}
