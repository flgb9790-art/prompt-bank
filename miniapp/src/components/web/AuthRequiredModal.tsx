type Props = {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
};

export function AuthRequiredModal({ open, onClose, onLogin }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1020] p-5">
        <h3 className="text-lg font-semibold">Нужно войти</h3>
        <p className="mt-2 text-sm text-muted">
          Смотреть и копировать промпты можно без входа. Чтобы добавлять свои промпты и сохранять избранное, войдите через Telegram.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onLogin} className="rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-3 py-2 text-sm">
            Войти через Telegram
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
