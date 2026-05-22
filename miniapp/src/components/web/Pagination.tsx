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

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((num) => {
    if (totalPages <= 7) return true;
    return num === 1 || num === totalPages || Math.abs(num - page) <= 1;
  });

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <p className="text-sm text-[var(--muted)]">
        Показано {from}–{to} из {totalItems}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="pagination-btn"
          >
            ‹
          </button>
          {pages.map((num, index) => {
            const prev = pages[index - 1];
            const showEllipsis = prev !== undefined && num - prev > 1;
            return (
              <span key={num} className="flex items-center gap-2">
                {showEllipsis ? <span className="text-[var(--muted-light)]">…</span> : null}
                <button
                  type="button"
                  onClick={() => onPageChange(num)}
                  className={`pagination-btn ${page === num ? "active" : ""}`}
                >
                  {num}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="pagination-btn"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
