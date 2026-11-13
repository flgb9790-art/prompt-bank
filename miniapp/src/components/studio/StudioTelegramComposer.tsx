import { lazy, Suspense, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { IdeaStudioDraft } from "../../ideaStudioTypes";
import { resolveMediaUrl } from "../../api";
import { defaultStudioTelegramPublication, studioTelegramPreview, studioTelegramCaptionSize, type StudioTelegramPublication } from "../../utils/studioTelegramPublication";
const RichTextEditor = lazy(()=>import("../RichTextEditor").then(module=>({default:module.RichTextEditor})));

export function StudioTelegramComposer({value,onChange,drafts,promptLinkBase,busy}:{
  value:StudioTelegramPublication;onChange:(value:StudioTelegramPublication)=>void;
  drafts:IdeaStudioDraft[];promptLinkBase?:string;busy:boolean;
}) {
  const [previewId,setPreviewId]=useState<string>();
  const preview=drafts.find(d=>d.id===previewId)||drafts[0];
  const size=studioTelegramCaptionSize(value);
  const promptUrl=preview?.promptId&&promptLinkBase?`${promptLinkBase}${preview.promptId}`:undefined;
  return <div className="idea-publication-composer">
    <section className="idea-publication-fields" aria-labelledby="idea-publication-text-label">
      <div className="idea-publication-field-heading">
        <label id="idea-publication-text-label">Текст поста</label>
        <button type="button" className="idea-muted-button" disabled={busy} onClick={()=>onChange(defaultStudioTelegramPublication())}><RotateCcw size={13}/>По умолчанию</button>
      </div>
      <Suspense fallback={<p role="status">Загружаем редактор…</p>}><RichTextEditor
        value={value.bodyHtml} onChange={bodyHtml=>onChange({...value,bodyHtml})}
        ariaLabel="Текст поста в Telegram" disabled={busy} minHeight={290}
      /></Suspense>
      <label className="idea-field">Текст ссылки на промпт
        <input value={value.promptLinkLabel} maxLength={60} disabled={busy} onChange={e=>onChange({...value,promptLinkLabel:e.target.value})}/>
      </label>
      <div className="idea-publication-counter">
        <span className="idea-help">Ссылка в мини-приложение добавляется для каждого промпта автоматически.</span>
        <span className={size>1024?"is-error":""} aria-live="polite">{size}/1024</span>
      </div>
      {size>1024&&<p role="alert" className="idea-help">Сократи текст: подпись должна поместиться вместе со ссылкой на промпт.</p>}
      <p className="idea-help">Этот текст будет у всех выбранных материалов. В канал отправится изображение с подписью; полный промпт откроется по ссылке.</p>
    </section>
    <section className="idea-publication-preview-section" aria-label="Предпросмотр публикации">
      <div className="idea-publication-field-heading">
        <span>Предпросмотр</span>
        {drafts.length>1&&<select aria-label="Материал для предпросмотра" value={preview?.id||""} onChange={e=>setPreviewId(e.target.value)}>
          {drafts.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}
        </select>}
      </div>
      <article className="idea-telegram-post">
        {preview?.imageUrl&&<img className="idea-publication-photo" src={resolveMediaUrl(preview.imageUrl)} alt={preview.title}/>}
        <div className="idea-telegram-caption" onClick={e=>e.preventDefault()}>
          <div dangerouslySetInnerHTML={{__html:studioTelegramPreview(value.bodyHtml)}}/>
          <p className="idea-telegram-footer">{promptUrl?<a href={promptUrl}>{value.promptLinkLabel}</a>:<span className="idea-telegram-link">{value.promptLinkLabel||"Открыть промпт"}</span>}</p>
        </div>
        {preview?.imageUrl&&<a className="idea-telegram-original" href={resolveMediaUrl(preview.imageUrl)} onClick={e=>e.preventDefault()}>Оригинал изображения ↗</a>}
      </article>
      <p className="idea-help">Кнопка «Оригинал изображения» открывает сохранённый файл без сжатия Telegram. Фото в ленте канала обрабатывается Telegram отдельно.</p>
      {preview&&<p className="idea-help">{preview.title}{!promptUrl&&" · индивидуальная ссылка подставится после создания материала."}</p>}
    </section>
  </div>;
}
