import { Columns3, LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "../../utils/viewMode";

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
  hidePinterest?: boolean;
};

export function ViewModeSwitcher({ value, onChange, className = "", hidePinterest = false }: Props) {
  return (
    <div className={`view-mode-switcher ${className}`.trim()} role="group" aria-label="Режим отображения">
      <button
        type="button"
        title="Карточки"
        aria-label="Карточки"
        aria-pressed={value === "grid"}
        className={`view-mode-switcher-btn ${value === "grid" ? "active" : ""}`}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid size={20} strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Список"
        aria-label="Список"
        aria-pressed={value === "list"}
        className={`view-mode-switcher-btn ${value === "list" ? "active" : ""}`}
        onClick={() => onChange("list")}
      >
        <List size={20} strokeWidth={2} />
      </button>
      {!hidePinterest ? (
        <button
          type="button"
          title="Pinterest"
          aria-label="Pinterest"
          aria-pressed={value === "pinterest"}
          className={`view-mode-switcher-btn ${value === "pinterest" ? "active" : ""}`}
          onClick={() => onChange("pinterest")}
        >
          <Columns3 size={20} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
