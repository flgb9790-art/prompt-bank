import { useEffect, useMemo, useRef } from "react";
import type { TelegramUser } from "../../types";

type Props = {
  open: boolean;
  botUsername?: string;
  onClose: () => void;
  onAuthSuccess: (user: TelegramUser) => void;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    }) => void;
  }
}

export function TelegramAuthModal({ open, botUsername, onClose, onAuthSuccess }: Props) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const canRenderWidget = useMemo(() => Boolean(botUsername?.trim()), [botUsername]);

  useEffect(() => {
    if (!open || !canRenderWidget || !widgetContainerRef.current) return;
    const container = widgetContainerRef.current;
    container.innerHTML = "";

    window.onTelegramAuth = (user) => {
      onAuthSuccess({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url?.trim() || undefined
      });
      onClose();
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername!);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      container.innerHTML = "";
    };
  }, [open, canRenderWidget, botUsername, onAuthSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-[90] grid place-items-center p-4">
      <div className="modal-panel w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-[var(--text)]">Вход через Telegram</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Войдите в свой Telegram-аккаунт, чтобы добавлять, редактировать, удалять и сохранять избранные промпты.
        </p>

        {canRenderWidget ? (
          <div className="upload-zone mt-4">
            <div ref={widgetContainerRef} className="flex justify-center" />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--yellow)]/30 bg-[var(--yellow-soft)] p-3 text-sm text-[#92400e]">
            Не настроен Telegram Login Widget. Укажите `VITE_TELEGRAM_BOT_USERNAME` или корректный `VITE_TELEGRAM_AUTH_URL`.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
