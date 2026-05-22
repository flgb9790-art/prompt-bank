import { useEffect, useMemo, useState } from "react";
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
import { PromptDetailsModal } from "./components/PromptDetailsModal";
import { SearchBar } from "./components/SearchBar";
import { mockTelegramUser, resolveTelegramUser } from "./telegram";
import { WebApp } from "./WebApp";

const quickTags = ["beauty", "video", "logo", "telegram", "cursor", "ads", "react", "realistic"];

export default function App() {
  const isTelegramMiniApp = Boolean(window.Telegram?.WebApp?.initData);
  if (!isTelegramMiniApp) {
    return <WebApp />;
  }
  return <MiniAppApp />;
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
    if (!document.querySelector('script[data-telegram-webapp="1"]')) {
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-web-app.js";
      script.async = true;
      script.dataset.telegramWebapp = "1";
      document.head.appendChild(script);
    }

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
      // Lock accidental collapsing only after mini app is fully expanded.
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
    setAuthTelegramId(String(user.id));
    loadData();
    return () => {
      setAuthTelegramId(null);
    };
  }, [user.id]);

  async function handleSavePrompt(payload: PromptCreatePayload) {
    const created = await api.createPrompt(payload);
    setCreatedPromptId(created.id);
    setPrompts((prev) => [created, ...prev]);
  }

  async function handleToggleFavorite(id: number) {
    const updated = await api.toggleFavorite(id);
    setPrompts((prev) => prev.map((item) => (item.id === id ? updated : item)));
    if (selectedPrompt?.id === id) setSelectedPrompt(updated);
  }

  async function openPrompt(prompt: Prompt) {
    setSelectedPrompt({ ...prompt, examples: prompt.examples ?? [] });
    try {
      const full = await api.getPrompt(prompt.id);
      setSelectedPrompt(full);
    } catch {
      // keep partial prompt in modal
    }
  }

  async function handleDeletePrompt(id: number) {
    await api.deletePrompt(id);
    setSelectedPrompt(undefined);
    setPrompts((prev) => prev.filter((item) => item.id !== id));
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
          onCreate={() => setTab("add")}
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
        />
      )}
      {tab === "search" && (
        <div className="space-y-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Введите слово, тег или часть названия..." />
          <div className="flex flex-wrap gap-2">
            {quickTags.map((tag) => (
              <button key={tag} className="chip" onClick={() => setSearchQuery(tag)}>
                #{tag}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {searchResults.map((prompt) => (
              <div key={prompt.id} className="glass-card p-3.5">
                <p className="font-medium">{prompt.title}</p>
                <p className="mt-1 text-xs text-slate-300">{prompt.category.name}</p>
                <button className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs" onClick={() => openPrompt(prompt)}>
                  Открыть
                </button>
              </div>
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
        onClose={() => setSelectedPrompt(undefined)}
        onCopy={handleCopyPrompt}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeletePrompt}
        onEdit={handleEditPrompt}
      />
      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0f172a]/95 px-4 py-2 text-sm text-white shadow-[0_10px_35px_rgba(0,0,0,0.55)] backdrop-blur">
          {toastMessage}
        </div>
      ) : null}
    </Layout>
  );
}
