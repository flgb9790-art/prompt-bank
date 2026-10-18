import {
  buildPublicationTemplateVars,
  resolvePinterestDescriptionTemplate,
  resolvePinterestTitleTemplate
} from "./publicationTemplate";

const DEFAULT_TELEGRAM_CHANNEL_URL = "https://t.me/your_channel";

export function buildPinterestPinUrl(pinId?: string | null): string | undefined {
  const id = pinId?.trim();
  return id && /^\d+$/.test(id) ? `https://www.pinterest.com/pin/${id}/` : undefined;
}

export function resolveTelegramChannelUrl(): string {
  const fromEnv = (import.meta.env.VITE_TELEGRAM_CHANNEL_URL as string | undefined)?.trim();
  return fromEnv || DEFAULT_TELEGRAM_CHANNEL_URL;
}

export function buildPinterestPinPreview(input: {
  content: string;
  categoryName: string;
  telegramChannelUrl?: string;
  telegramPostUrl?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
}): string {
  const channelUrl = input.telegramChannelUrl?.trim() || resolveTelegramChannelUrl();
  const vars = buildPublicationTemplateVars({
    content: input.content,
    categoryName: input.categoryName,
    tagNames: [],
    siteOrigin: channelUrl
  });
  vars.channel = channelUrl;
  vars.link = input.telegramPostUrl?.trim() || "";

  const title = resolvePinterestTitleTemplate(input.pinterestTitleTemplate, vars);
  const description = resolvePinterestDescriptionTemplate(input.pinterestDescriptionTemplate, vars);

  return `Title:
${title}

Description:
${description}

Destination:
${input.telegramPostUrl?.trim() || "Ссылка на пост будет получена после публикации в Telegram"}`;
}

export function pinterestPublicationStatusLabel(status?: string | null): string {
  if (status === "awaiting_confirmation") return "Pinterest: подтвердите ссылку назначения";
  if (status === "published") return "Pinterest: опубликовано ✅";
  if (status === "pending") return "Pinterest: публикация...";
  if (status === "failed") return "Pinterest: ошибка ⚠️";
  return "Pinterest: не опубликовано";
}

export function buildCreatePromptToastMessage(input: {
  telegramPublicationStatus?: "published" | "failed";
  telegramPublicationError?: string;
  pinterestPublicationStatus?: "published" | "failed" | "awaiting_confirmation";
  pinterestPublicationError?: string;
}): string {
  const errors: string[] = [];

  if (input.telegramPublicationStatus === "failed") {
    errors.push(
      input.telegramPublicationError ??
        "Промпт сохранен, но публикация в Telegram не удалась. Проверьте настройки канала и права бота."
    );
  }

  if (input.pinterestPublicationStatus === "failed") {
    errors.push(
      input.pinterestPublicationError ??
        "Промпт сохранен, но публикация в Pinterest не удалась. Проверьте access token, board id и доступность изображения."
    );
  }

  if (errors.length) {
    return errors.join(" ");
  }
  if (input.pinterestPublicationStatus === "awaiting_confirmation") {
    return "Промпт сохранён. Подтвердите ссылку Telegram-поста для Pinterest в карточке промпта.";
  }

  const telegramPublished = input.telegramPublicationStatus === "published";
  const pinterestPublished = input.pinterestPublicationStatus === "published";

  if (telegramPublished && pinterestPublished) {
    return "Промпт сохранен и опубликован в Telegram и Pinterest";
  }
  if (telegramPublished) {
    return "Промпт сохранен и опубликован в Telegram";
  }
  if (pinterestPublished) {
    return "Промпт сохранен и опубликован в Pinterest";
  }

  return "Промпт сохранен";
}
