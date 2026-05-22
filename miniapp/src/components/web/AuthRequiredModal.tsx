type Props = {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
};

export function AuthRequiredModal({ open, onClose, onLogin }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="modal-panel w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-[var(--text)]">Нужно войти</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Смотреть и копировать промпты можно без входа. Чтобы добавлять свои промпты и сохранять избранное, войдите через Telegram.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onLogin} className="btn-primary justify-center">
            Войти через Telegram
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
