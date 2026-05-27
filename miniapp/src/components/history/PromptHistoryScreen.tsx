import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Eye } from "lucide-react";
import { api, resolveCardMediaUrl } from "../../api";
import type { Prompt, PromptHistoryItem } from "../../types";
import { AuthRequiredState } from "../AuthRequiredState";
import { MobilePromptFeed } from "../MobilePromptFeed";
import { MobilePromptPostCard } from "../MobilePromptPostCard";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { getPromptExcerpt } from "../../utils/promptContent";

type Mode = "copied" | "viewed";

type Props = {
  mode: Mode;
  isAuthenticated: boolean;
  variant?: "web" | "mini";
  onBack?: () => void;
  onLogin: () => void;
  onOpenPrompt: (prompt: Prompt) => void;
  onCopyPrompt: (prompt: Prompt) => void;
  onToggleFavorite: (id: number) => void;
  onNavigatePrompts: () => void;
};

function eventTime(item: PromptHistoryItem, mode: Mode) {
  return mode === "copied" ? item.copiedAt : item.viewedAt;
}

export function PromptHistoryScreen({
  mode,
  isAuthenticated,
  variant = "web",
  onBack,
  onLogin,
  onOpenPrompt,
  onCopyPrompt,
  onToggleFavorite,
  onNavigatePrompts
}: Props) {
  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const isMini = variant === "mini";
  const title = mode === "copied" ? (isMini ? "Скопированные" : "Скопированные промпты") : isMini ? "Просмотренные" : "Просмотренные промпты";
  const subtitle =
    mode === "copied"
      ? isMini
        ? "История скопированных промптов"
        : "История промптов, которые вы копировали."
      : isMini
        ? "История просмотренных промптов"
        : "История промптов, которые вы открывали.";

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const loader = mode === "copied" ? api.getCopiedPrompts() : api.getViewedPrompts();
    void loader
      .then((result: { items: PromptHistoryItem[] }) => setItems(result.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, mode]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const prompt = item.prompt;
      if (!prompt) return false;
      const tags = prompt.keywords?.map((entry: { keyword: { name: string } }) => entry.keyword.name).join(" ") ?? "";
      return `${prompt.title} ${getPromptExcerpt(prompt)} ${prompt.category?.name ?? ""} ${tags}`.toLowerCase().includes(query);
    });
  }, [items, search]);

  async function handleClear() {
    setClearing(true);
    try {
      if (mode === "copied") {
        await api.clearCopiedPrompts();
      } else {
        await api.clearViewedPrompts();
      }
      setItems([]);
      setConfirmOpen(false);
    } finally {
      setClearing(false);
    }
  }

  function renderHistoryFeed(className = "") {
    return (
      <MobilePromptFeed className={className}>
        {filtered.map((item) => {
          const prompt = item.prompt;
          if (!prompt) return null;
          const when = eventTime(item, mode);
          const metaLabel = `${mode === "copied" ? "Скопировано" : "Просмотрено"}${when ? ` ${formatRelativeTime(when)}` : ""}`;
          return (
            <MobilePromptPostCard
              key={item.id}
              prompt={prompt}
              metaLabel={metaLabel}
              onOpen={onOpenPrompt}
              onCopy={onCopyPrompt}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}
      </MobilePromptFeed>
    );
  }

  function renderDesktopHistoryList() {
    return (
      <div className="history-list">
        {filtered.map((item) => {
          const prompt = item.prompt;
          if (!prompt) return null;
          const when = eventTime(item, mode);
          const mediaType = prompt.coverMediaType ?? "image";
          const coverUrl = prompt.coverMediaUrl
            ? resolveCardMediaUrl(prompt.coverMediaUrl, mediaType === "video" ? "video" : "image")
            : null;
          return (
            <article key={item.id} className="history-item">
              <div className="history-item-preview">
                {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <div className="history-item-preview-fallback" />}
              </div>
              <div className="history-item-content">
                <h3 className="history-item-title">{prompt.title}</h3>
                <p className="history-item-meta">
                  {mode === "copied" ? "Скопировано" : "Просмотрено"} {when ? formatRelativeTime(when) : ""}
                </p>
                <p className="history-item-excerpt">{getPromptExcerpt(prompt)}</p>
                <div className="history-item-tags">
                  {prompt.keywords?.slice(0, 3).map((entry: { keyword: { id: number; name: string } }) => (
                    <span key={entry.keyword.id} className="history-item-tag">
                      {entry.keyword.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="history-item-actions">
                {mode === "copied" ? (
                  <button type="button" className="history-action-primary" onClick={() => onCopyPrompt(prompt)}>
                    Скопировать снова
                  </button>
                ) : (
                  <button type="button" className="history-action-primary" onClick={() => onOpenPrompt(prompt)}>
                    Открыть
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={isMini ? "history-page history-page--mini" : "history-page"}>
        {isMini && onBack ? (
          <button type="button" className="history-back-btn" onClick={onBack} aria-label="Назад">
            <ArrowLeft size={22} />
          </button>
        ) : null}
        <AuthRequiredState onLogin={onLogin} />
      </div>
    );
  }

  return (
    <div className={isMini ? "history-page history-page--mini" : "history-page"}>
      <header className="history-page-header">
        {isMini && onBack ? (
          <button type="button" className="history-back-btn" onClick={onBack} aria-label="Назад">
            <ArrowLeft size={22} />
          </button>
        ) : null}
        <div>
          <h1 className={`settings-page-title ${isMini ? "history-page-title--mini" : ""}`}>{title}</h1>
          <p className="settings-page-subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="history-toolbar">
        <input
          className="history-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={isMini ? "Поиск..." : "Поиск в истории..."}
        />
        <button type="button" className="btn-secondary history-clear-btn" onClick={() => setConfirmOpen(true)} disabled={!items.length}>
          Очистить историю
        </button>
      </div>

      {loading ? (
        <div className="mobile-prompt-feed">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="mobile-post-card skeleton mobile-post-card-skeleton" />
          ))}
        </div>
      ) : filtered.length ? (
        isMini ? (
          renderHistoryFeed()
        ) : (
          <>
            <div className="hidden md:block">{renderDesktopHistoryList()}</div>
            <div className="md:hidden">{renderHistoryFeed()}</div>
          </>
        )
      ) : (
        <div className="history-empty-card">
          <div className="history-empty-icon" aria-hidden>
            {mode === "copied" ? <Copy size={34} /> : <Eye size={34} />}
          </div>
          <h3 className="history-empty-title">
            {mode === "copied" ? "Пока нет скопированных промптов" : "Пока нет просмотренных промптов"}
          </h3>
          <p className="history-empty-description">
            {mode === "copied"
              ? "Когда вы скопируете промпт, он появится здесь."
              : "Открывайте промпты, чтобы быстро возвращаться к ним позже."}
          </p>
          <button type="button" className="btn-primary history-empty-button" onClick={onNavigatePrompts}>
            Перейти к промптам
          </button>
        </div>
      )}

      {confirmOpen ? (
        <div className="modal-overlay fixed inset-0 z-[80] grid place-items-center p-4">
          <div className="modal-panel max-w-md p-6">
            <h3 className="text-lg font-semibold text-[var(--text)]">
              {mode === "copied" ? "Очистить историю копирования?" : "Очистить историю просмотров?"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Это действие нельзя отменить.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={clearing}>
                Отмена
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleClear()} disabled={clearing}>
                Очистить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
