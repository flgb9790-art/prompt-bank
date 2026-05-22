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
      className="sort-select form-select h-[42px] min-w-[210px] rounded-xl pr-10 text-[14px]"
    >
      <option value="new">Сортировка: Новые</option>
      <option value="old">Сортировка: Старые</option>
      <option value="usage">Сортировка: По использованию</option>
    </select>
  );
}
