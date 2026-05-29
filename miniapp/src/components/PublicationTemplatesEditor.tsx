import { useRef } from "react";
import {
  PUBLICATION_TEMPLATE_HINT,
  buildPublicationTemplateVars,
  defaultPinterestDescriptionTemplate,
  defaultPinterestTitleTemplate,
  defaultTelegramPostTemplate,
  resolvePinterestTitleTemplate
} from "../utils/publicationTemplate";
import {
  htmlToPlainText,
  htmlToTelegramHtml,
  isHtmlTemplate,
  plainTemplateToHtml,
  renderPublicationTemplateHtml
} from "../utils/templateHtml";
import { RichTextEditor } from "./RichTextEditor";
import { TemplateVariableChips } from "./TemplateVariableChips";

export type PublicationTemplatesValue = {
  telegramPostTemplate: string;
  pinterestTitleTemplate: string;
  pinterestDescriptionTemplate: string;
};

type Props = {
  content: string;
  categoryName: string;
  tagNames: string[];
  value: PublicationTemplatesValue;
  onChange: (value: PublicationTemplatesValue) => void;
  open: boolean;
  onToggleOpen: () => void;
};

export function emptyPublicationTemplates(): PublicationTemplatesValue {
  return {
    telegramPostTemplate: "",
    pinterestTitleTemplate: "",
    pinterestDescriptionTemplate: ""
  };
}

export function publicationTemplatesFromPrompt(prompt: {
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
}): PublicationTemplatesValue {
  return {
    telegramPostTemplate: prompt.telegramPostTemplate ?? "",
    pinterestTitleTemplate: prompt.pinterestTitleTemplate ?? "",
    pinterestDescriptionTemplate: prompt.pinterestDescriptionTemplate ?? ""
  };
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
  return {
    telegramPostTemplate: value.telegramPostTemplate.trim() || null,
    pinterestTitleTemplate: value.pinterestTitleTemplate.trim() || null,
    pinterestDescriptionTemplate: value.pinterestDescriptionTemplate.trim() || null
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
  open,
  onToggleOpen
}: Props) {
  const pinterestTitleRef = useRef<HTMLInputElement>(null);
  const vars = buildPublicationTemplateVars({ content, categoryName, tagNames });

  const telegramHtml = resolveTemplateHtml(
    value.telegramPostTemplate,
    defaultTelegramPostTemplate(),
    vars
  );
  const telegramPreviewHtml = htmlToTelegramHtml(telegramHtml);

  const pinterestTitleResolved = resolvePinterestTitleTemplate(value.pinterestTitleTemplate, vars);
  const pinterestDescriptionHtml = resolveTemplateHtml(
    value.pinterestDescriptionTemplate,
    defaultPinterestDescriptionTemplate(),
    vars
  );
  const pinterestDescriptionPlain = htmlToPlainText(pinterestDescriptionHtml);

  function resetTelegram() {
    onChange({ ...value, telegramPostTemplate: defaultTelegramPostTemplate() });
  }

  function resetPinterest() {
    onChange({
      ...value,
      pinterestTitleTemplate: defaultPinterestTitleTemplate(),
      pinterestDescriptionTemplate: defaultPinterestDescriptionTemplate()
    });
  }

  function insertIntoPinterestTitle(token: string) {
    const input = pinterestTitleRef.current;
    const current = value.pinterestTitleTemplate || defaultPinterestTitleTemplate();
    if (!input) {
      onChange({ ...value, pinterestTitleTemplate: current + token });
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? start;
    const next = current.slice(0, start) + token + current.slice(end);
    onChange({ ...value, pinterestTitleTemplate: next });
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  }

  function insertIntoTelegram(token: string) {
    const current = value.telegramPostTemplate || defaultTelegramPostTemplate();
    onChange({ ...value, telegramPostTemplate: current + token });
  }

  function insertIntoPinterestDescription(token: string) {
    const current = value.pinterestDescriptionTemplate || defaultPinterestDescriptionTemplate();
    onChange({ ...value, pinterestDescriptionTemplate: current + token });
  }

  return (
    <>
      <button type="button" className="publication-templates-toggle" onClick={onToggleOpen} aria-expanded={open}>
        <span>Шаблоны публикации</span>
        <span className="text-xs text-[var(--muted)]">{open ? "Свернуть" : "Раскрыть"}</span>
      </button>

      {open ? (
        <div className="publication-templates-panel space-y-4">
          <p className="text-xs text-[var(--muted)]">{PUBLICATION_TEMPLATE_HINT}. Можно форматировать текст и вставлять ссылки на выделенный фрагмент.</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Telegram</p>
              <button type="button" className="text-xs text-[var(--primary)]" onClick={resetTelegram}>
                Сбросить
              </button>
            </div>
            <TemplateVariableChips onInsert={insertIntoTelegram} />
            <RichTextEditor
              value={value.telegramPostTemplate || defaultTelegramPostTemplate()}
              onChange={(html) => onChange({ ...value, telegramPostTemplate: html })}
              placeholder="Текст поста в Telegram…"
            />
            <div
              className="publication-templates-preview-html"
              dangerouslySetInnerHTML={{ __html: telegramPreviewHtml }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pinterest</p>
              <button type="button" className="text-xs text-[var(--primary)]" onClick={resetPinterest}>
                Сбросить
              </button>
            </div>
            <label className="block text-xs text-[var(--muted)]">Заголовок пина</label>
            <TemplateVariableChips onInsert={insertIntoPinterestTitle} />
            <input
              ref={pinterestTitleRef}
              className="form-input"
              value={value.pinterestTitleTemplate || defaultPinterestTitleTemplate()}
              onChange={(event) => onChange({ ...value, pinterestTitleTemplate: event.target.value })}
            />
            <label className="mt-2 block text-xs text-[var(--muted)]">Описание пина</label>
            <TemplateVariableChips onInsert={insertIntoPinterestDescription} />
            <RichTextEditor
              value={value.pinterestDescriptionTemplate || defaultPinterestDescriptionTemplate()}
              onChange={(html) => onChange({ ...value, pinterestDescriptionTemplate: html })}
              placeholder="Описание пина…"
              minHeight={120}
            />
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
              {`Title:\n${pinterestTitleResolved}\n\nDescription:\n${pinterestDescriptionPlain}`}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
