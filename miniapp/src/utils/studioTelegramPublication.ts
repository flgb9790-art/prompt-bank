import DOMPurify from "dompurify";

export type StudioTelegramPublication = {bodyHtml:string;promptLinkLabel:string};
export function defaultStudioTelegramPublication(): StudioTelegramPublication {
  return {
    bodyHtml: `<p>Новый промпт</p><p></p><p>1. Переходи в бот <a href="https://t.me/syntxaibot?start=aff_465351635">Ссылка</a><br>2. Жми "Дизайн с ИИ" → "Nano Banana Pro"<br>3. По желанию выбирай модель, качество и соотношение сторон в "Настройки модели"<br>4. Загружай свой референс и вставляй промпт ↓</p>`,
    promptLinkLabel: "Открыть промпт",
  };
}
export function studioTelegramPreview(body: string) {
  return DOMPurify.sanitize(body,{
    ALLOWED_TAGS:["p","br","b","strong","i","em","u","s","code","a"],
    ALLOWED_ATTR:["href"], ALLOWED_URI_REGEXP:/^https?:\/\//i,
  });
}
export function studioTelegramCaptionSize(value:StudioTelegramPublication) {
  const body=studioTelegramPreview(value.bodyHtml)
    .replace(/<p\b[^>]*>/gi,"").replace(/<\/p>/gi,"\n").replace(/<br\s*\/?>/gi,"\n")
    .replace(/<strong>/g,"<b>").replace(/<\/strong>/g,"</b>").replace(/<em>/g,"<i>").replace(/<\/em>/g,"</i>")
    .replace(/\n{3,}/g,"\n\n").trim();
  const label=value.promptLinkLabel.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").trim();
  return body.length+`\n\n<a href="https://t.me/${"b".repeat(64)}?startapp=prompt_2147483647">${label}</a>`.length;
}
export function validStudioTelegramPublication(value:StudioTelegramPublication) {
  const text=studioTelegramPreview(value.bodyHtml).replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").trim();
  return Boolean(text&&value.promptLinkLabel.trim()&&value.promptLinkLabel.trim().length<=60&&studioTelegramCaptionSize(value)<=1024&&!/\{\{[^}]*\}\}/.test(value.bodyHtml+value.promptLinkLabel));
}
