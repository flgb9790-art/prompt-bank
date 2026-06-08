import { useRef, useState } from "react";
import {
  PUBLICATION_TEMPLATE_HINT,
  buildPublicationTemplateVars,
  defaultPinterestDescriptionTemplate,
  defaultPinterestTitleTemplate,
  defaultTelegramPostTemplate,
  resolvePinterestTitleTemplate
} from "../utils/publicationTemplate";
import { isHtmlTemplate, plainTemplateToHtml, renderPublicationTemplateHtml } from "../utils/templateHtml";
import {
  effectivePublicationTemplates,
  saveStoredPublicationTemplates,
  type PublicationTemplatesValue
} from "../utils/publicationTemplatesStorage";
import { RichTextEditor } from "./RichTextEditor";
import { TemplateVariableChips } from "./TemplateVariableChips";

export type { PublicationTemplatesValue };

type Props = {
  content: string;
  categoryName: string;
  tagNames: string[];
  value: PublicationTemplatesValue;
  onChange: (value: PublicationTemplatesValue) => void;
  showPinterestSection?: boolean;
};

export function emptyPublicationTemplates(): PublicationTemplatesValue {
  return {
    telegramPostTemplate: "",
    pinterestTitleTemplate: "",
    pinterestDescriptionTemplate: ""
  };
}

export function publicationTemplatesFromPrompt(
  prompt: {
    telegramPostTemplate?: string | null;
    pinterestTitleTemplate?: string | null;
    pinterestDescriptionTemplate?: string | null;
  },
  fallback?: PublicationTemplatesValue | null
): PublicationTemplatesValue {
  const fromPrompt: PublicationTemplatesValue = {
    telegramPostTemplate: prompt.telegramPostTemplate ?? "",
    pinterestTitleTemplate: prompt.pinterestTitleTemplate ?? "",
    pinterestDescriptionTemplate: prompt.pinterestDescriptionTemplate ?? ""
  };
  const hasStoredOnPrompt =
    fromPrompt.telegramPostTemplate.trim() ||
    fromPrompt.pinterestTitleTemplate.trim() ||
    fromPrompt.pinterestDescriptionTemplate.trim();
  if (hasStoredOnPrompt) return fromPrompt;
  return fallback ?? fromPrompt;
}

export function templatesDirty(
  stored: PublicationTemplatesValue,
  defaults?: PublicationTemplatesValue
): boolean {
  const base = defaults ?? {
    telegramPostTemplate: "",
    pinterestTitleTemplate: "",
    pinterestDescriptionTemplate: ""
  };
  return (
    stored.telegramPostTemplate.trim() !== base.telegramPostTemplate.trim() ||
    stored.pinterestTitleTemplate.trim() !== base.pinterestTitleTemplate.trim() ||
    stored.pinterestDescriptionTemplate.trim() !== base.pinterestDescriptionTemplate.trim()
  );
}

export function templatesPayloadForApi(value: PublicationTemplatesValue) {
  const effective = effectivePublicationTemplates(value);
  saveStoredPublicationTemplates(effective);
  return {
    telegramPostTemplate: effective.telegramPostTemplate,
    pinterestTitleTemplate: effective.pinterestTitleTemplate,
    pinterestDescriptionTemplate: effective.pinterestDescriptionTemplate
  };
}

function resolveTemplateHtml(stored: string | null | undefined, fallback: string, vars: ReturnType<typeof buildPublicationTemplateVars>) {
  const template = stored?.trim() || fallback;
  const html = isHtmlTemplate(template) ? template : plainTemplateToHtml(template);
  return renderPublicationTemplateHtml(html, vars);
}

export function PublicationTemplatesEditor({
  content,
  categoryName,
  tagNames,
  value,
  onChange,
  showPinterestSection = true
}: Props) {
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [pinterestOpen, setPinterestOpen] = useState(false);
  const pinterestTitleRef = useRef<HTMLInputElement>(null);
  const vars = buildPublicationTemplateVars({ content, categoryName, tagNames });

  const telegramHtml = resolveTemplateHtml(
    value.telegramPostTemplate,
    defaultTelegramPostTemplate(),
    vars
  );
  const pinterestTitleResolved = resolvePinterestTitleTemplate(value.pinterestTitleTemplate, vars);
  const pinterestDescriptionHtml = resolveTemplateHtml(
    value.pinterestDescriptionTemplate,
    defaultPinterestDescriptionTemplate(),
    vars
  );

  function persistTemplates(next: PublicationTemplatesValue) {
    saveStoredPublicationTemplates(effectivePublicationTemplates(next));
    onChange(next);
  }

  function resetTelegram() {
    persistTemplates({ ...value, telegramPostTemplate: defaultTelegramPostTemplate() });
  }

  function resetPinterest() {
    persistTemplates({
      ...value,
      pinterestTitleTemplate: defaultPinterestTitleTemplate(),
      pinterestDescriptionTemplate: defaultPinterestDescriptionTemplate()
    });
  }

  function insertIntoPinterestTitle(token: string) {
    const input = pinterestTitleRef.current;
    const current = value.pinterestTitleTemplate || defaultPinterestTitleTemplate();
    if (!input) {
      persistTemplates({ ...value, pinterestTitleTemplate: current + token });
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? start;
    const next = current.slice(0, start) + token + current.slice(end);
    persistTemplates({ ...value, pinterestTitleTemplate: next });
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  }

  function insertIntoTelegram(token: string) {
    const current = value.telegramPostTemplate || defaultTelegramPostTemplate();
    persistTemplates({ ...value, telegramPostTemplate: current + token });
  }

  function insertIntoPinterestDescription(token: string) {
    const current = value.pinterestDescriptionTemplate || defaultPinterestDescriptionTemplate();
    persistTemplates({ ...value, pinterestDescriptionTemplate: current + token });
  }

  return (
    <div className="publication-templates-root">
      <p className="publication-templates-hint">
        {PUBLICATION_TEMPLATE_HINT}. Форматирование и ссылки — в раскрытом редакторе.
      </p>

      <button
        type="button"
        className="publication-template-section-toggle publication-template-section-toggle--telegram"
        onClick={() => setTelegramOpen((open) => !open)}
        aria-expanded={telegramOpen}
      >
        <span>Шаблон Telegram</span>
        <span className="text-xs text-[var(--muted)]">{telegramOpen ? "Свернуть" : "Раскрыть"}</span>
      </button>

      {telegramOpen ? (
        <div className="publication-template-section publication-template-section--telegram">
          <div className="publication-template-section-head">
            <p className="publication-template-section-title">Пост в канал</p>
            <button type="button" className="text-xs text-[var(--primary)]" onClick={resetTelegram}>
              Сбросить
            </button>
          </div>
          <TemplateVariableChips onInsert={insertIntoTelegram} />
            <RichTextEditor
              value={value.telegramPostTemplate || defaultTelegramPostTemplate()}
              onChange={(html) => persistTemplates({ ...value, telegramPostTemplate: html })}
              placeholder="Текст поста в Telegram…"
            />
            <div className="template-preview template-preview--telegram">
              <p className="template-preview-label">Предпросмотр поста</p>
              <div
                className="template-preview-body"
                dangerouslySetInnerHTML={{ __html: telegramHtml }}
              />
            </div>
        </div>
      ) : null}

      {showPinterestSection ? (
        <>
          <button
            type="button"
            className="publication-template-section-toggle publication-template-section-toggle--pinterest"
            onClick={() => setPinterestOpen((open) => !open)}
            aria-expanded={pinterestOpen}
          >
            <span>Шаблон Pinterest</span>
            <span className="text-xs text-[var(--muted)]">{pinterestOpen ? "Свернуть" : "Раскрыть"}</span>
          </button>

          {pinterestOpen ? (
            <div className="publication-template-section publication-template-section--pinterest">
              <div className="publication-template-section-head">
                <p className="publication-template-section-title">Пин</p>
                <button type="button" className="text-xs text-[var(--primary)]" onClick={resetPinterest}>
                  Сбросить
                </button>
              </div>
              <label className="block text-xs text-[var(--muted)]">Заголовок</label>
              <TemplateVariableChips onInsert={insertIntoPinterestTitle} />
              <input
                ref={pinterestTitleRef}
                className="form-input"
                value={value.pinterestTitleTemplate || defaultPinterestTitleTemplate()}
                onChange={(event) => persistTemplates({ ...value, pinterestTitleTemplate: event.target.value })}
              />
              <label className="block text-xs text-[var(--muted)]">Описание</label>
              <TemplateVariableChips onInsert={insertIntoPinterestDescription} />
              <RichTextEditor
                value={value.pinterestDescriptionTemplate || defaultPinterestDescriptionTemplate()}
                onChange={(html) => persistTemplates({ ...value, pinterestDescriptionTemplate: html })}
                placeholder="Описание пина…"
                minHeight={120}
              />
              <div className="template-preview template-preview--pinterest">
                <p className="template-preview-label">Предпросмотр пина</p>
                <p className="template-preview-pin-title">{pinterestTitleResolved}</p>
                <div
                  className="template-preview-body"
                  dangerouslySetInnerHTML={{ __html: pinterestDescriptionHtml }}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
