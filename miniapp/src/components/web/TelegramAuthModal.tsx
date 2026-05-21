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
        username: user.username
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
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1020] p-5">
        <h3 className="text-lg font-semibold">Вход через Telegram</h3>
        <p className="mt-2 text-sm text-muted">
          Войдите в свой Telegram-аккаунт, чтобы добавлять, редактировать, удалять и сохранять избранные промпты.
        </p>

        {canRenderWidget ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div ref={widgetContainerRef} className="flex justify-center" />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            Не настроен Telegram Login Widget. Укажите `VITE_TELEGRAM_BOT_USERNAME` или корректный `VITE_TELEGRAM_AUTH_URL`.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
