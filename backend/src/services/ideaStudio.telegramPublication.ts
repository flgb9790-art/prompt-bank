import sanitizeHtml from "sanitize-html";
import { StudioError, studioString } from "./ideaStudio.validation";
import { escapeHtml, renderPublicationTemplateHtml } from "../utils/templateHtml";
import type { PublicationTemplateVars } from "../utils/publicationTemplate";

export type StudioTelegramPublication = { bodyHtml: string; promptLinkLabel: string };
export const STUDIO_TELEGRAM_CAPTION_MAX = 1024;
export function defaultStudioTelegramPublication(): StudioTelegramPublication {
  return {
    bodyHtml: `<p>Новый промпт</p><p></p><p>1. Переходи в бот <a href="https://t.me/syntxaibot?start=aff_465351635">Ссылка</a><br>2. Жми "Дизайн с ИИ" → "Nano Banana Pro"<br>3. По желанию выбирай модель, качество и соотношение сторон в "Настройки модели"<br>4. Загружай свой референс и вставляй промпт ↓</p>`,
    promptLinkLabel: "Открыть промпт",
  };
}
const allowedTags = ["p","br","b","strong","i","em","u","s","code","a"];
const options: sanitizeHtml.IOptions = {
  allowedTags, allowedAttributes: {a:["href"]},
  allowedSchemes:["https","http"], allowProtocolRelative:false,
};
export function renderStudioTelegramPostHtml(template: string, vars: PublicationTemplateVars) {
  const rendered = renderPublicationTemplateHtml(template, vars)
    .replace(/<p\b[^>]*>/gi, "").replace(/<\/p>/gi,"\n").replace(/<br\s*\/?>/gi,"\n");
  return sanitizeHtml(rendered, {
    ...options, allowedTags:allowedTags.filter(tag=>tag!=="p"&&tag!=="br"),
    transformTags:{strong:"b",em:"i"},
  }).replace(/\n{3,}/g,"\n\n").trim();
}
export function buildStudioTelegramPostTemplate(input?: unknown) {
  const value = input === undefined ? defaultStudioTelegramPublication() : input as StudioTelegramPublication;
  if (!value || typeof value !== "object") throw new StudioError("Заполните текст публикации.");
  const body = studioString(value.bodyHtml,"Текст публикации",1,8000);
  const label = studioString(value.promptLinkLabel,"Текст ссылки на промпт",1,60);
  if (/\{\{[^}]*\}\}/u.test(body+label)) throw new StudioError("Введите готовый текст поста. Ссылка на промпт добавляется автоматически.");
  const clean = sanitizeHtml(body, options);
  if (!sanitizeHtml(clean,{allowedTags:[],allowedAttributes:{}}).trim()) throw new StudioError("Текст публикации не должен быть пустым.");
  if (clean.includes("<a>")) throw new StudioError("Используйте полную ссылку, начинающуюся с https:// или http://.");
  const template = `${clean}<p></p><p><a href="{{link}}">${escapeHtml(label)}</a></p>`;
  // Reserve space for a per-prompt deep link, including a long bot username and ID.
  const check = renderStudioTelegramPostHtml(template,{
    headline:"",category:"",hashtags:"",channel:"",link:`https://t.me/${"b".repeat(64)}?startapp=prompt_2147483647`,
  });
  if (check.length > STUDIO_TELEGRAM_CAPTION_MAX) throw new StudioError("Текст слишком длинный для подписи Telegram. Сократите его, сохранив место для ссылки на промпт.");
  return template;
}
