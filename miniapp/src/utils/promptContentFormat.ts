/** Сохраняет переносы строк и абзацы при вставке и сохранении промпта. */
export function normalizePromptContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlClipboardToPlainText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");
    const text = doc.body.innerText ?? "";
    if (text.trim()) {
      return normalizePromptContent(text);
    }
  }

  return normalizePromptContent(
    trimmed
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<\/div>\s*<div[^>]*>/gi, "\n\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
  );
}

export function plainTextFromClipboard(clipboard: DataTransfer): string {
  const html = clipboard.getData("text/html");
  const plain = clipboard.getData("text/plain");
  if (html.trim()) {
    return htmlClipboardToPlainText(html);
  }
  return normalizePromptContent(plain);
}
