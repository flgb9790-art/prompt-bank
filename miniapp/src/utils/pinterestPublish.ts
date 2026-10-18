export function defaultPinterestDescriptionText(categoryName: string): string {
  return `Готовый промпт для ${categoryName}.\nБольше промптов и подборок в нашем Telegram-канале.`;
}

export function isValidPinterestLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && parsed.hostname === "t.me" && !parsed.port &&
      !parsed.username && !parsed.password &&
      /^\/(?:[a-zA-Z][a-zA-Z0-9_]{3,31}|c\/[1-9]\d*)\/[1-9]\d*\/?$/.test(parsed.pathname) &&
      !/^\/(?:share|joinchat|proxy|socks|login)\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}
