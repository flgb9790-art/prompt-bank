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
  title: string;
  categoryName: string;
  tagNames: string[];
  promptId?: number | string;
  siteOrigin?: string;
}): string {
  const hashtags = buildHashtagsFromNames(input.tagNames);

  return `✨ Новый промпт: ${input.title || "Название промпта"}

📂 ${input.categoryName || "Категория"}
🏷 ${hashtags}

🔗 Открыть промпт`;
}

export function telegramPublicationStatusLabel(status?: string | null): string {
  if (status === "published") return "Telegram: опубликовано ✅";
  if (status === "pending") return "Telegram: публикация...";
  if (status === "failed") return "Telegram: ошибка ⚠️";
  return "Telegram: не опубликовано";
}
