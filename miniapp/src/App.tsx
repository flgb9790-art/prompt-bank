import { useEffect, useMemo, useRef, useState } from "react";
import { clearPromptShareUrl, parsePromptIdFromLocation, setPromptShareUrl } from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";
import { api, setAuthTelegramId } from "./api";
import type { Category, Prompt, PromptCreatePayload, TelegramUser } from "./types";
import type { PromptEditPayload } from "./components/PromptDetailsModal";
import { Layout } from "./components/Layout";
import { BottomNav, type TabKey } from "./components/BottomNav";
import { HomePage } from "./pages/HomePage";
import { PromptsPage } from "./pages/PromptsPage";
import { AddPromptPage } from "./pages/AddPromptPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PromptCard } from "./components/PromptCard";
import { PromptDetailsModal } from "./components/PromptDetailsModal";
import { SearchBar } from "./components/SearchBar";
import { isTelegramMiniAppContext, mockTelegramUser, resolveTelegramUser } from "./telegram";
import { WebApp } from "./WebApp";

const quickTags = ["beauty", "video", "logo", "telegram", "cursor", "ads", "react", "realistic"];

type AppRuntime = "loading" | "telegram" | "web";

function loadTelegramSdk(): Promise<void> {
  if (window.Telegram?.WebApp) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-telegram-webapp="1"]');
  if (existing) {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      window.setTimeout(resolve, 500);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.dataset.telegramWebapp = "1";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export default function App() {
  const [runtime, setRuntime] = useState<AppRuntime>(() => (isTelegramMiniAppContext() ? "telegram" : "loading"));

  useEffect(() => {
    if (runtime !== "loading") return;

    let cancelled = false;

    void (async () => {
      await loadTelegramSdk();
      if (cancelled) return;
      setRuntime(isTelegramMiniAppContext() ? "telegram" : "web");
    })();

    const fallback = window.setTimeout(() => {
      if (!cancelled) {
        setRuntime(isTelegramMiniAppContext() ? "telegram" : "web");
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [runtime]);

  if (runtime === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Загрузка...
      </div>
    );
  }

  if (runtime === "telegram") {
    return <MiniAppApp />;
  }

  return <WebApp />;
}

function MiniAppApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [createdPromptId, setCreatedPromptId] = useState<number>();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<TelegramUser>(() => resolveTelegramUser() ?? mockTelegramUser);
  const [toastMessage, setToastMessage] = useState("");
  const [isMiniAppExpanded, setIsMiniAppExpanded] = useState(true);
  const deepLinkHandledRef = useRef(false);

  const favorites = useMemo(() => prompts.filter((item) => item.isFavorite), [prompts]);
  const stats = useMemo(
    () => ({
      total: prompts.length,
      favorites: favorites.length,
      categories: categories.length,
      usage: prompts.reduce((sum, item) => sum + item.usageCount, 0)
    }),
    [prompts, favorites.length, categories.length]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const low = searchQuery.toLowerCase();
    return prompts.filter((item) => {
      const tags = item.keywords.map((k) => k.keyword.name).join(" ");
      return `${item.title} ${item.content} ${item.category.name} ${tags}`.toLowerCase().includes(low);
    });
  }, [searchQuery, prompts]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [promptsData, categoriesData, me] = await Promise.all([
        api.getPrompts({ limit: 100, lite: true }),
        api.getCategories(),
        api.getMe()
      ]);
      setPrompts(promptsData.map((prompt) => ({ ...prompt, examples: prompt.examples ?? [] })));
      setCategories(categoriesData);
      setIsAdmin(me.isAdmin);
    } catch {
      setError("Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const getWebApp = () => window.Telegram?.WebApp;
    setIsMiniAppExpanded(getWebApp() ? Boolean(getWebApp()?.isExpanded) : true);

    const enforceExpandedSheet = () => {
      const webApp = getWebApp();
      webApp?.ready?.();
      webApp?.expand?.();
    };

    enforceExpandedSheet();
    const actualUser = resolveTelegramUser();
    if (actualUser?.id) {
      setUser(actualUser);
    }
    const viewportHandler = () => {
      const webApp = getWebApp();
      const expanded = Boolean(webApp?.isExpanded);
      setIsMiniAppExpanded(expanded);
      if (!expanded) {
        webApp?.enableVerticalSwipes?.();
        enforceExpandedSheet();
        return;
      }
      webApp?.disableVerticalSwipes?.();
      webApp?.enableClosingConfirmation?.();
    };

    let detachViewportListener: (() => void) | null = null;
    const tryAttachViewportListener = () => {
      const webApp = getWebApp();
      if (!webApp?.onEvent || detachViewportListener) return;
      webApp.onEvent("viewportChanged", viewportHandler);
      detachViewportListener = () => {
        webApp.offEvent?.("viewportChanged", viewportHandler);
      };
    };

    tryAttachViewportListener();
    const attachInterval = setInterval(() => {
      tryAttachViewportListener();
    }, 250);

    const forceExpandInterval = setInterval(() => {
      enforceExpandedSheet();
    }, 700);
    const stopForceExpandTimer = setTimeout(() => {
      clearInterval(forceExpandInterval);
    }, 10000);

    const delayedSync = setTimeout(() => {
      enforceExpandedSheet();
      const webApp = getWebApp();
      if (webApp?.isExpanded) {
        setIsMiniAppExpanded(true);
        webApp?.disableVerticalSwipes?.();
        webApp?.enableClosingConfirmation?.();
      }
      const delayedUser = resolveTelegramUser();
      if (delayedUser?.id) {
        setUser(delayedUser);
      }
    }, 400);
    return () => {
      clearTimeout(delayedSync);
      clearTimeout(stopForceExpandTimer);
      clearInterval(forceExpandInterval);
      clearInterval(attachInterval);
      detachViewportListener?.();
    };
  }, []);

  useEffect(() => {
    if (!document.querySelector('script[data-telegram-webapp="1"]')) {
      void loadTelegramSdk();
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      setAuthTelegramId(String(user.id));
    }
    void loadData();
    return () => {
      setAuthTelegramId(null);
    };
  }, [user.id]);

  async function handleSavePrompt(payload: PromptCreatePayload) {
    if (!isAdmin) {
      setToastMessage("Добавлять промпты могут только администраторы");
      return;
    }
    const created = await api.createPrompt(payload);
    setCreatedPromptId(created.id);
    setPrompts((prev) => [created, ...prev]);
  }

  async function handleToggleFavorite(id: number) {
    const previous = prompts.find((item) => item.id === id);
    if (!previous) return;

    const optimistic = { ...previous, isFavorite: !previous.isFavorite };
    setPrompts((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    if (selectedPrompt?.id === id) setSelectedPrompt(optimistic);

    try {
      const updated = await api.toggleFavorite(id);
      setPrompts((prev) => prev.map((item) => (item.id === id ? mergePromptUpdate(item, updated) : item)));
      if (selectedPrompt?.id === id) {
        setSelectedPrompt((current) => (current ? mergePromptUpdate(current, updated) : updated));
      }
    } catch {
      setPrompts((prev) => prev.map((item) => (item.id === id ? previous : item)));
      if (selectedPrompt?.id === id) setSelectedPrompt(previous);
      setToastMessage("Не удалось обновить избранное");
    }
  }

  async function openPromptById(promptId: number, replaceUrl = false) {
    const cached = prompts.find((item) => item.id === promptId);
    if (cached) {
      await openPrompt(cached, replaceUrl);
      return;
    }
    try {
      const full = await api.getPrompt(promptId);
      await openPrompt(full, replaceUrl);
    } catch {
      clearPromptShareUrl();
    }
  }

  async function openPrompt(prompt: Prompt, replaceUrl = false) {
    setSelectedPrompt({ ...prompt, examples: prompt.examples ?? [] });
    setPromptShareUrl(prompt.id, replaceUrl);
    try {
      const full = await api.getPrompt(prompt.id);
      setSelectedPrompt(full);
    } catch {
      // keep partial prompt in modal
    }
  }

  function closePromptModal() {
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
  }

  useEffect(() => {
    const onPopState = () => {
      const promptId = parsePromptIdFromLocation();
      if (!promptId) {
        setSelectedPrompt(undefined);
        return;
      }
      void openPromptById(promptId, true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [prompts]);

  useEffect(() => {
    if (loading || deepLinkHandledRef.current) return;
    const promptId = parsePromptIdFromLocation();
    if (!promptId) return;
    deepLinkHandledRef.current = true;
    void openPromptById(promptId, true);
  }, [loading, prompts]);

  async function handleDeletePrompt(id: number) {
    await api.deletePrompt(id);
    closePromptModal();
    setPrompts((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSelectTag(tagName: string) {
    closePromptModal();
    setSearchQuery(tagName);
    setTab("search");
  }

  async function handleCopyPrompt(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setToastMessage("Промпт скопирован");
      setPrompts((prev) =>
        prev.map((item) =>
          item.id === prompt.id ? { ...item, usageCount: item.usageCount + 1 } : item
        )
      );
      void api.increaseUsage(prompt.id).catch(() => undefined);
    } catch {
      setToastMessage("Не удалось скопировать промпт");
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function handleEditPrompt(promptId: number, data: PromptEditPayload) {
    await api.updatePrompt(promptId, {
      title: data.title,
      content: data.content,
      categoryId: data.categoryId,
      ...(data.coverMediaUrl !== undefined ? { coverMediaUrl: data.coverMediaUrl } : {}),
      ...(data.coverMediaType !== undefined ? { coverMediaType: data.coverMediaType } : {})
    });
    await Promise.all([
      ...data.removedExampleIds.map((exampleId) => api.removeExample(exampleId)),
      ...data.newExamples.map((example) => api.addExample(promptId, example))
    ]);
    const fresh = await api.getPrompt(promptId);
    setPrompts((prev) => prev.map((item) => (item.id === promptId ? fresh : item)));
    setSelectedPrompt(fresh);
  }

  return (
    <Layout freezeScroll={!isMiniAppExpanded}>
      {tab === "home" && (
        <HomePage
          prompts={prompts}
          stats={stats}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
          onCreate={isAdmin ? () => setTab("add") : undefined}
          showCreateButton={isAdmin}
          onViewAll={() => setTab("prompts")}
        />
      )}
      {tab === "prompts" && (
        <PromptsPage
          prompts={prompts}
          categories={categories}
          loading={loading}
          error={error}
          onOpenPrompt={openPrompt}
          onToggleFavorite={handleToggleFavorite}
          onCopyPrompt={handleCopyPrompt}
          onTagClick={handleSelectTag}
        />
      )}
      {tab === "search" && (
        <div className="space-y-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Введите слово, тег или часть названия..." />
          <div className="flex flex-wrap gap-2">
            {quickTags.map((tag) => (
              <button key={tag} className="chip" onClick={() => setSearchQuery(tag)}>
                {tag}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {searchResults.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                variant="mobile"
                onOpen={openPrompt}
                onCopy={handleCopyPrompt}
                onToggleFavorite={handleToggleFavorite}
                onTagClick={handleSelectTag}
              />
            ))}
          </div>
        </div>
      )}
      {tab === "favorites" && (
        <FavoritesPage
          prompts={favorites}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
        />
      )}
      {tab === "profile" && (
        <ProfilePage user={user} promptsCount={prompts.length} favoritesCount={favorites.length} />
      )}
      {tab === "add" && (
        <AddPromptPage
          categories={categories}
          user={user}
          onSave={handleSavePrompt}
          onCancel={() => setTab("home")}
          successPromptId={createdPromptId}
          onOpenPrompt={() => {
            const created = prompts.find((item) => item.id === createdPromptId);
            if (created) {
              setSelectedPrompt(created);
            }
          }}
          onAddMore={() => setCreatedPromptId(undefined)}
          onGoHome={() => {
            setCreatedPromptId(undefined);
            setTab("home");
          }}
        />
      )}
      <BottomNav current={tab === "add" ? "home" : tab} onChange={setTab} />
      <PromptDetailsModal
        prompt={selectedPrompt}
        categories={categories}
        canManage={isAdmin}
        onClose={closePromptModal}
        onCopy={handleCopyPrompt}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeletePrompt}
        onEdit={handleEditPrompt}
        onShareLinkCopied={() => setToastMessage("Ссылка скопирована")}
        onTagClick={handleSelectTag}
      />
      {toastMessage ? (
        <div className="toast fixed bottom-24 left-1/2 z-[60] -translate-x-1/2">{toastMessage}</div>
      ) : null}
    </Layout>
  );
}
