type Props = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  onLogin?: () => void;
};

export function AuthRequiredState({
  title = "Нужно войти",
  description = "История просмотров и копирований доступна только после входа через Telegram.",
  buttonLabel = "Войти через Telegram",
  onLogin
}: Props) {
  return (
    <div className="history-empty-card">
      <div className="history-empty-icon" aria-hidden>
        <span>🔐</span>
      </div>
      <h3 className="history-empty-title">{title}</h3>
      <p className="history-empty-description">{description}</p>
      {onLogin ? (
        <button type="button" className="btn-primary history-empty-button" onClick={onLogin}>
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}
