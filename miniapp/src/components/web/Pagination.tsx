type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: Props) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#a4adbd]">
        Показано {from}–{to} из {totalItems}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Назад
          </button>
          <span className="min-w-[72px] text-center text-sm text-[#a4adbd]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      ) : null}
    </div>
  );
}
