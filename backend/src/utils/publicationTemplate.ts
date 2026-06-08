export type PublicationTemplateVars = {
  headline: string;
  category: string;
  hashtags: string;
  link: string;
  channel: string;
};

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
  return `Готовый промпт для {{category}}.\nБольше промптов и подборок в нашем Telegram-канале.`;
}

export function renderPublicationTemplate(template: string, vars: PublicationTemplateVars): string {
  return template
    .replace(/\{\{headline\}\}/g, vars.headline)
    .replace(/\{\{category\}\}/g, vars.category)
    .replace(/\{\{hashtags\}\}/g, vars.hashtags)
    .replace(/\{\{link\}\}/g, vars.link)
    .replace(/\{\{channel\}\}/g, vars.channel);
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
