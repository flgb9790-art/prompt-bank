type SortValue = "new" | "old" | "usage";

type Props = {
  value: SortValue;
  onChange: (value: SortValue) => void;
};

export function SortSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as SortValue)}
      className="h-[42px] w-[216px] rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-200"
    >
      <option value="new">Сортировка: Новые</option>
      <option value="old">Сортировка: Старые</option>
      <option value="usage">Сортировка: По использованию</option>
    </select>
  );
}
