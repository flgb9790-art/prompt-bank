const DEFAULT_TELEGRAM_CHANNEL_URL = "https://t.me/your_channel";

export function resolveTelegramChannelUrl(): string {
  const fromEnv = (import.meta.env.VITE_TELEGRAM_CHANNEL_URL as string | undefined)?.trim();
  return fromEnv || DEFAULT_TELEGRAM_CHANNEL_URL;
}

import { derivePromptTitle } from "./promptTitle";

export function buildPinterestPinPreview(input: {
  content: string;
  categoryName: string;
  telegramChannelUrl?: string;
}): string {
  const channelUrl = input.telegramChannelUrl?.trim() || resolveTelegramChannelUrl();
  const headline = derivePromptTitle(input.content);

  return `Title:
${headline}

Description:
Готовый промпт для ${input.categoryName || "Категория"}. 
Больше промптов и подборок в нашем Telegram-канале.

${channelUrl}

Destination:
${channelUrl}`;
}

export function pinterestPublicationStatusLabel(status?: string | null): string {
  if (status === "published") return "Pinterest: опубликовано ✅";
  if (status === "pending") return "Pinterest: публикация...";
  if (status === "failed") return "Pinterest: ошибка ⚠️";
  return "Pinterest: не опубликовано";
}

export function buildCreatePromptToastMessage(input: {
  telegramPublicationStatus?: "published" | "failed";
  telegramPublicationError?: string;
  pinterestPublicationStatus?: "published" | "failed";
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
