import { LayoutGrid, List } from "lucide-react";

type Props = {
  value: "grid" | "list";
  onChange: (value: "grid" | "list") => void;
};

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`btn-ghost-icon ${value === "grid" ? "active" : ""}`}
        aria-label="Сетка"
      >
        <LayoutGrid size={18} />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`btn-ghost-icon ${value === "list" ? "active" : ""}`}
        aria-label="Список"
      >
        <List size={18} />
      </button>
    </div>
  );
}
