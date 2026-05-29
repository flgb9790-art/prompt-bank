import { buildHashtagsFromNames } from "./telegramPost";
import { derivePromptTitle } from "./promptTitle";
import { resolveTelegramChannelUrl } from "./pinterestPost";

export type PublicationTemplateVars = {
  headline: string;
  category: string;
  hashtags: string;
  link: string;
  channel: string;
};

export const PUBLICATION_TEMPLATE_HINT =
  "Плейсхолдеры: {{headline}}, {{category}}, {{hashtags}}, {{link}}, {{channel}}";

export function defaultTelegramPostTemplate(): string {
  return `<p>✨ Новый промпт: {{headline}}</p>
<p>📂 {{category}}</p>
<p>🏷 {{hashtags}}</p>
<p><a href="{{link}}">Открыть промпт</a></p>`;
}

export function defaultPinterestTitleTemplate(): string {
  return "{{headline}}";
}

export function defaultPinterestDescriptionTemplate(): string {
  return `<p>Готовый промпт для {{category}}.</p>
<p>Больше промптов и подборок в нашем <a href="{{channel}}">Telegram-канале</a>.</p>`;
}

export function renderPublicationTemplate(template: string, vars: PublicationTemplateVars): string {
  return template
    .replace(/\{\{headline\}\}/g, vars.headline)
    .replace(/\{\{category\}\}/g, vars.category)
    .replace(/\{\{hashtags\}\}/g, vars.hashtags)
    .replace(/\{\{link\}\}/g, vars.link)
    .replace(/\{\{channel\}\}/g, vars.channel);
}

export function buildPublicationTemplateVars(input: {
  content: string;
  categoryName: string;
  tagNames: string[];
  promptId?: number | string;
  siteOrigin?: string;
}): PublicationTemplateVars {
  const base = (input.siteOrigin ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  const link = input.promptId ? `${base}/?prompt=${input.promptId}` : `${base}/?prompt=…`;
  return {
    headline: derivePromptTitle(input.content || "Текст промпта"),
    category: input.categoryName || "Категория",
    hashtags: buildHashtagsFromNames(input.tagNames),
    link,
    channel: resolveTelegramChannelUrl()
  };
}

export function resolveTelegramPostTemplate(stored: string | null | undefined, vars: PublicationTemplateVars): string {
  const template = stored?.trim() || defaultTelegramPostTemplate();
  return renderPublicationTemplate(template, vars);
}

export function resolvePinterestTitleTemplate(stored: string | null | undefined, vars: PublicationTemplateVars): string {
  const template = stored?.trim() || defaultPinterestTitleTemplate();
  return renderPublicationTemplate(template, vars);
}

export function resolvePinterestDescriptionTemplate(
  stored: string | null | undefined,
  vars: PublicationTemplateVars
): string {
  const template = stored?.trim() || defaultPinterestDescriptionTemplate();
  return renderPublicationTemplate(template, vars);
}
