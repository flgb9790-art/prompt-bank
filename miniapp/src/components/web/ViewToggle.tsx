import { LayoutGrid, Rows3 } from "lucide-react";

type Props = {
  value: "grid" | "list";
  onChange: (value: "grid" | "list") => void;
};

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-white/10">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`grid h-[42px] w-[52px] place-items-center ${value === "grid" ? "bg-[var(--primary)]/20 text-white" : "bg-white/[0.04] text-muted"}`}
      >
        <LayoutGrid size={18} />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`grid h-[42px] w-[52px] place-items-center ${value === "list" ? "bg-[var(--primary)]/20 text-white" : "bg-white/[0.04] text-muted"}`}
      >
        <Rows3 size={18} />
      </button>
    </div>
  );
}
