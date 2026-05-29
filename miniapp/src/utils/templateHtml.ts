import type { PublicationTemplateVars } from "./publicationTemplate";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

export function isHtmlTemplate(template: string): boolean {
  return /<[a-z][\s\S]*>/i.test(template);
}

export function plainTemplateToHtml(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return "<p></p>";
  if (isHtmlTemplate(trimmed)) return trimmed;
  return trimmed
    .split(/\n\n+/)
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p>${inner}</p>`;
    })
    .join("");
}

export function renderPublicationTemplateHtml(template: string, vars: PublicationTemplateVars): string {
  const escaped = {
    headline: escapeHtml(vars.headline),
    category: escapeHtml(vars.category),
    hashtags: escapeHtml(vars.hashtags),
    link: escapeHtmlAttr(vars.link),
    channel: escapeHtml(vars.channel)
  };
  return template
    .replace(/\{\{headline\}\}/g, escaped.headline)
    .replace(/\{\{category\}\}/g, escaped.category)
    .replace(/\{\{hashtags\}\}/g, escaped.hashtags)
    .replace(/\{\{link\}\}/g, escaped.link)
    .replace(/\{\{channel\}\}/g, escaped.channel);
}

export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "");
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const label = htmlToPlainText(inner).trim();
    if (!label || label === href) return href;
    return `${label} (${href})`;
  });
  text = text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Telegram HTML: b, i, u, s, code, pre, a */
export function htmlToTelegramHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?strong>/gi, (m) => (m.includes("/") ? "</b>" : "<b>"))
    .replace(/<\/?em>/gi, (m) => (m.includes("/") ? "</i>" : "<i>"))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/?(?:div|span)[^>]*>/gi, "");

  out = out.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    const hrefMatch = /href=["']([^"']*)["']/i.exec(attrs);
    if (!hrefMatch) return "";
    return `<a href="${escapeHtmlAttr(hrefMatch[1])}">`;
  });

  const allowed = /<\/?(?:b|i|u|s|code|pre|a)\b[^>]*>/gi;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const tagRe = new RegExp(allowed.source, "gi");
  while ((m = tagRe.exec(out)) !== null) {
    parts.push(escapeHtml(out.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(out.slice(last)));
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}
