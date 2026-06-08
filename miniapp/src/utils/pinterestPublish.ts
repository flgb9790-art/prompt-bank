export function defaultPinterestDescriptionText(categoryName: string): string {
  return `Готовый промпт для ${categoryName}.\nБольше промптов и подборок в нашем Telegram-канале.`;
}

export function isValidPinterestLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return /^https?:$/i.test(parsed.protocol);
  } catch {
    return false;
  }
}
