import {
  PUBLICATION_TEMPLATE_HINT,
  buildPublicationTemplateVars,
  defaultPinterestDescriptionTemplate,
  defaultPinterestTitleTemplate,
  defaultTelegramPostTemplate,
  resolvePinterestDescriptionTemplate,
  resolvePinterestTitleTemplate,
  resolveTelegramPostTemplate
} from "../utils/publicationTemplate";

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

export function PublicationTemplatesEditor({
  content,
  categoryName,
  tagNames,
  value,
  onChange,
  open,
  onToggleOpen
}: Props) {
  const vars = buildPublicationTemplateVars({ content, categoryName, tagNames });
  const telegramResolved = resolveTelegramPostTemplate(value.telegramPostTemplate, vars);
  const pinterestTitleResolved = resolvePinterestTitleTemplate(value.pinterestTitleTemplate, vars);
  const pinterestDescriptionResolved = resolvePinterestDescriptionTemplate(value.pinterestDescriptionTemplate, vars);

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

  return (
    <>
      <button type="button" className="publication-templates-toggle" onClick={onToggleOpen} aria-expanded={open}>
        <span>Шаблоны публикации</span>
        <span className="text-xs text-[var(--muted)]">{open ? "Свернуть" : "Раскрыть"}</span>
      </button>

      {open ? (
        <div className="publication-templates-panel space-y-4">
          <p className="text-xs text-[var(--muted)]">{PUBLICATION_TEMPLATE_HINT}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Telegram</p>
              <button type="button" className="text-xs text-[var(--primary)]" onClick={resetTelegram}>
                Сбросить
              </button>
            </div>
            <textarea
              rows={7}
              className="form-textarea text-sm"
              value={value.telegramPostTemplate || defaultTelegramPostTemplate()}
              onChange={(event) => onChange({ ...value, telegramPostTemplate: event.target.value })}
            />
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
              {telegramResolved}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pinterest</p>
              <button type="button" className="text-xs text-[var(--primary)]" onClick={resetPinterest}>
                Сбросить
              </button>
            </div>
            <label className="block text-xs text-[var(--muted)]">Заголовок пина</label>
            <input
              className="form-input"
              value={value.pinterestTitleTemplate || defaultPinterestTitleTemplate()}
              onChange={(event) => onChange({ ...value, pinterestTitleTemplate: event.target.value })}
            />
            <label className="mt-2 block text-xs text-[var(--muted)]">Описание пина</label>
            <textarea
              rows={5}
              className="form-textarea text-sm"
              value={value.pinterestDescriptionTemplate || defaultPinterestDescriptionTemplate()}
              onChange={(event) => onChange({ ...value, pinterestDescriptionTemplate: event.target.value })}
            />
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-3 text-xs leading-relaxed text-[var(--text-soft)]">
              {`Title:\n${pinterestTitleResolved}\n\nDescription:\n${pinterestDescriptionResolved}`}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
