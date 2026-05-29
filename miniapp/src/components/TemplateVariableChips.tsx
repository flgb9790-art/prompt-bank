const CHIPS = [
  { key: "{{headline}}", label: "Заголовок" },
  { key: "{{category}}", label: "Категория" },
  { key: "{{hashtags}}", label: "Хэштеги" },
  { key: "{{link}}", label: "Ссылка" },
  { key: "{{channel}}", label: "Канал" }
] as const;

type Props = {
  onInsert: (token: string) => void;
};

export function TemplateVariableChips({ onInsert }: Props) {
  return (
    <div className="template-var-chips" role="group" aria-label="Плейсхолдеры">
      {CHIPS.map((chip) => (
        <button key={chip.key} type="button" className="template-var-chip" onClick={() => onInsert(chip.key)}>
          {chip.label}
        </button>
      ))}
    </div>
  );
}
