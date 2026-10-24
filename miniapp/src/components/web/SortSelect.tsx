type SortValue = "new" | "old" | "usage";

type Props = {
  value: SortValue;
  onChange: (value: SortValue) => void;
};

export function SortSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      aria-label="Сортировка промптов"
      onChange={(event) => onChange(event.target.value as SortValue)}
      className="sort-select form-select h-[42px] rounded-xl pr-10 text-[14px]"
    >
      <option value="new">Сначала новые</option>
      <option value="old">Сначала старые</option>
      <option value="usage">Популярные</option>
    </select>
  );
}
