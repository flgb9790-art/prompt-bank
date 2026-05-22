import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { clearPromptShareUrl, parsePromptIdFromLocation, setPromptShareUrl } from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";
import { normalizeTagName } from "./utils/tagFilter";
import { countCategoriesWithPromptCount, countCategoriesWithPrompts } from "./utils/stats";
import { api, invalidateReferenceCaches, setAuthTelegramId } from "./api";
import type { Category, Prompt, PromptCreatePayload, TelegramUser } from "./types";
import type { PromptEditPayload } from "./components/PromptDetailsModal";
import { Layout } from "./components/Layout";
import { BottomNav, type TabKey } from "./components/BottomNav";
import { HomePage } from "./pages/HomePage";
import { PromptsPage } from "./pages/PromptsPage";
import { AddPromptPage } from "./pages/AddPromptPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { PromptDetailsModal } from "./components/PromptDetailsModal";
import { isTelegramMiniAppContext, mockTelegramUser, resolveTelegramUser } from "./telegram";
import { runDeferred } from "./utils/deferredPrefetch";
import {
  ensurePromptWithContent,
  hasFullPromptContent,
  hasFullPromptDetails,
  mapPromptsFromApi,
  withPromptDetails
} from "./utils/promptContent";
import { prefetchPromptsPage, takePrefetchedPromptsPage } from "./utils/promptsPrefetch";

const WebApp = lazy(() => import("./WebApp").then((module) => ({ default: module.WebApp })));

const quickTags = ["beauty", "video", "logo", "telegram", "cursor", "ads", "react", "realistic"];
const MINI_PROMPTS_PAGE = 30;
const HOME_RECENT_LIMIT = 8;
const LIST_FILTER_DEBOUNCE_MS = 350;

type ListSortMode = "new" | "old" | "usage" | "favorites";

function miniPromptsQuery(
  offset: number,
  filters: { search: string; category?: string; sort: ListSortMode },
  tag?: string
) {
  const normalizedTag = tag ? normalizeTagName(tag) : undefined;
  if (filters.sort === "favorites") {
    return {
      limit: MINI_PROMPTS_PAGE,
      offset,
      favorite: true as const,
      lite: true as const,
      tag: normalizedTag
    };
  }
  return {
    limit: MINI_PROMPTS_PAGE,
    offset,
    lite: true as const,
    search: filters.search.trim() || undefined,
    category: filters.category,
    tag: normalizedTag,
    sort: filters.sort
  };
}

function isDefaultPromptsList(
  filters: { search: string; category?: string; sort: ListSortMode },
  tag?: string
) {
  return !filters.search && !filters.category && filters.sort === "new" && !tag;
}

function scheduleMiniPrefetch(
  loadedCount: number,
  total: number,
  filters: { search: string; category?: string; sort: ListSortMode },
  tag?: string
) {
  if (loadedCount >= total) return;
  runDeferred(() => prefetchPromptsPage(miniPromptsQuery(loadedCount, filters, tag)));
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
      Загрузка...
    </div>
  );
}

type AppRuntime = "loading" | "telegram" | "web";

function hasTelegramUrlHints(): boolean {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    params.has("tgWebAppData") ||
    params.has("tgWebAppVersion") ||
    hashParams.has("tgWebAppData") ||
    hashParams.has("tgWebAppVersion")
  );
}

function detectInitialRuntime(): AppRuntime {
  if (isTelegramMiniAppContext()) return "telegram";
  if (hasTelegramUrlHints()) return "loading";
  return "web";
}

function waitForTelegramSdkFromHtml(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (!hasTelegramUrlHints()) return Promise.resolve();

  const script = document.querySelector<HTMLScriptElement>('script[src*="telegram-web-app.js"]');
  if (!script) return Promise.resolve();

  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) {
      resolve();
      return;
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => resolve(), { once: true });
    window.setTimeout(resolve, 200);
  });
}

export default function App() {
  const [runtime, setRuntime] = useState<AppRuntime>(detectInitialRuntime);

  useEffect(() => {
    if (runtime !== "loading") return;

    let cancelled = false;

    void (async () => {
      await waitForTelegramSdkFromHtml();
      if (cancelled) return;
      setRuntime(isTelegramMiniAppContext() ? "telegram" : "web");
    })();

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (runtime === "loading") {
    return <AppLoadingScreen />;
  }

  if (runtime === "telegram") {
    return <MiniAppApp />;
  }

  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <WebApp />
    </Suspense>
  );
}

function MiniAppApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<Prompt[]>([]);
  const [promptsTotal, setPromptsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listReloading, setListReloading] = useState(false);
  const listFiltersRef = useRef<{ search: string; category?: string; sort: ListSortMode }>({
    search: "",
    sort: "new"
  });
  const [favoritePrompts, setFavoritePrompts] = useState<Prompt[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [createdPromptId, setCreatedPromptId] = useState<number>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPrompts, setSearchPrompts] = useState<Prompt[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userUsageTotal, setUserUsageTotal] = useState(0);
  const [user, setUser] = useState<TelegramUser>(() => resolveTelegramUser() ?? mockTelegramUser);
  const [toastMessage, setToastMessage] = useState("");
  const [isMiniAppExpanded, setIsMiniAppExpanded] = useState(true);
  const deepLinkHandledRef = useRef(false);
  const openPromptRequestRef = useRef(0);
  const favorites = useMemo(() => prompts.filter((item) => item.isFavorite), [prompts]);
  const favoritesForView = tab === "favorites" ? favoritePrompts : favorites;
  const hasMorePrompts = prompts.length < promptsTotal;

  const stats = useMemo(
    () => ({
      total: promptsTotal || prompts.length,
      favorites: favoritesForView.length || favorites.length,
      categories: countCategoriesWithPromptCount(categories) || countCategoriesWithPrompts(prompts),
      usage: userUsageTotal
    }),
    [categories, prompts, promptsTotal, favorites.length, favoritesForView.length, userUsageTotal]
  );

  useEffect(() => {
    if (tab !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchPrompts([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void api
        .getPrompts({ search: q, limit: 50, lite: true })
        .then((data) => setSearchPrompts(mapPromptsFromApi(data.items)))
        .catch(() => setToastMessage("Не удалось выполнить поиск"))
        .finally(() => setSearchLoading(false));
    }, LIST_FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery, tab]);

  function syncRecentFromPrompts(source: Prompt[]) {
    setRecentPrompts(source.slice(0, HOME_RECENT_LIMIT));
  }

  function syncRecentPrompt(next: Prompt) {
    setRecentPrompts((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index === -1) return prev;
      const copy = [...prev];
      copy[index] = mergePromptUpdate(prev[index], next);
      return copy;
    });
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const promptsData = await api.getPrompts({
        limit: MINI_PROMPTS_PAGE,
        offset: 0,
        lite: true,
        sort: "new"
      });
      const mapped = mapPromptsFromApi(promptsData.items);
      setPrompts(mapped);
      setPromptsTotal(promptsData.total);
      syncRecentFromPrompts(mapped);
      scheduleMiniPrefetch(mapped.length, promptsData.total, listFiltersRef.current, activeTag);
      setLoading(false);

      try {
        const [categoriesData, me] = await Promise.all([api.getCategories(), api.getMe()]);
        setCategories(categoriesData);
        setIsAdmin(me.isAdmin);
        setUserUsageTotal(me.usageTotal ?? 0);
      } catch {
        setToastMessage("Категории загрузятся чуть позже");
      }
    } catch {
      setError("Не удалось загрузить данные.");
      setLoading(false);
    }
  }

  async function reloadPromptsList() {
    setListReloading(true);
    setError("");
    try {
      const query = miniPromptsQuery(0, listFiltersRef.current, activeTag);
      const promptsData = await api.getPrompts(query);
      const mapped = mapPromptsFromApi(promptsData.items);
      setPrompts(mapped);
      setPromptsTotal(promptsData.total);
      if (isDefaultPromptsList(listFiltersRef.current, activeTag)) {
        syncRecentFromPrompts(mapped);
      }
      scheduleMiniPrefetch(mapped.length, promptsData.total, listFiltersRef.current, activeTag);
    } catch {
      setError("Не удалось загрузить промпты.");
    } finally {
      setListReloading(false);
    }
  }

  async function loadMorePrompts() {
    if (loadingMore || !hasMorePrompts) return;
    setLoadingMore(true);
    const query = miniPromptsQuery(prompts.length, listFiltersRef.current, activeTag);
    try {
      const cached = await takePrefetchedPromptsPage(query);
      const promptsData = cached ?? (await api.getPrompts(query));
      setPrompts((prev) => {
        const merged = [...prev, ...mapPromptsFromApi(promptsData.items)];
        scheduleMiniPrefetch(merged.length, promptsData.total, listFiltersRef.current, activeTag);
        return merged;
      });
      setPromptsTotal(promptsData.total);
    } catch {
      setToastMessage("Не удалось загрузить ещё промпты");
    } finally {
      setLoadingMore(false);
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
    if (user?.id) {
      setAuthTelegramId(String(user.id));
    }
    void loadData();
    return () => {
      setAuthTelegramId(null);
    };
  }, [user.id]);

  useEffect(() => {
    if (tab !== "favorites") return;

    let cancelled = false;
    setFavoritesLoading(true);
    void api
      .getPrompts({ favorite: true, limit: 100, lite: true })
      .then((data) => {
        if (!cancelled) {
          setFavoritePrompts(mapPromptsFromApi(data.items));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToastMessage("Не удалось загрузить избранное");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  function syncFavoritePrompts(next: Prompt) {
    setFavoritePrompts((prev) => {
      if (!next.isFavorite) {
        return prev.filter((item) => item.id !== next.id);
      }
      const index = prev.findIndex((item) => item.id === next.id);
      if (index === -1) {
        return [next, ...prev];
      }
      const copy = [...prev];
      copy[index] = mergePromptUpdate(prev[index], next);
      return copy;
    });
  }

  async function handleSavePrompt(payload: PromptCreatePayload) {
    if (!isAdmin) {
      setToastMessage("Добавлять промпты могут только администраторы");
      return;
    }
    const created = withPromptDetails(await api.createPrompt(payload));
    invalidateReferenceCaches();
    setCreatedPromptId(created.id);
    setPrompts((prev) => [created, ...prev]);
    setRecentPrompts((prev) => [created, ...prev].slice(0, HOME_RECENT_LIMIT));
    setPromptsTotal((prev) => prev + 1);
    void api.getCategories().then(setCategories).catch(() => undefined);
  }

  async function handleToggleFavorite(id: number) {
    const previous = prompts.find((item) => item.id === id) ?? favoritePrompts.find((item) => item.id === id);
    if (!previous) return;

    const optimistic = { ...previous, isFavorite: !previous.isFavorite };
    setPrompts((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    syncFavoritePrompts(optimistic);
    syncRecentPrompt(optimistic);
    if (selectedPrompt?.id === id) setSelectedPrompt(optimistic);

    try {
      const updated = await api.toggleFavorite(id);
      setPrompts((prev) => prev.map((item) => (item.id === id ? mergePromptUpdate(item, updated) : item)));
      if (selectedPrompt?.id === id) {
        setSelectedPrompt((current) => (current ? mergePromptUpdate(current, updated) : updated));
      }
      syncFavoritePrompts(updated);
      syncRecentPrompt(updated);
    } catch {
      syncFavoritePrompts(previous);
      syncRecentPrompt(previous);
      setPrompts((prev) => prev.map((item) => (item.id === id ? previous : item)));
      if (selectedPrompt?.id === id) setSelectedPrompt(previous);
      setToastMessage("Не удалось обновить избранное");
    }
  }

  async function openPromptById(promptId: number, replaceUrl = false) {
    const cached = prompts.find((item) => item.id === promptId) ?? recentPrompts.find((item) => item.id === promptId);
    if (cached) {
      await openPrompt(cached, replaceUrl);
      return;
    }
    try {
      const full = withPromptDetails(await api.getPrompt(promptId));
      await openPrompt(full, replaceUrl);
    } catch {
      clearPromptShareUrl();
    }
  }

  async function openPrompt(prompt: Prompt, replaceUrl = false) {
    const requestId = ++openPromptRequestRef.current;
    setSelectedPrompt({ ...prompt, examples: prompt.examples ?? [] });
    setPromptShareUrl(prompt.id, replaceUrl);
    if (hasFullPromptDetails(prompt)) {
      return;
    }
    try {
      const full = withPromptDetails(await api.getPrompt(prompt.id));
      if (openPromptRequestRef.current !== requestId) return;
      setSelectedPrompt(full);
      setPrompts((prev) => prev.map((item) => (item.id === full.id ? mergePromptUpdate(item, full) : item)));
      syncRecentPrompt(full);
    } catch {
      if (openPromptRequestRef.current !== requestId) return;
    }
  }

  function closePromptModal() {
    openPromptRequestRef.current += 1;
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
  }

  useEffect(() => {
    const onPopState = () => {
      const promptId = parsePromptIdFromLocation();
      if (!promptId) {
        openPromptRequestRef.current += 1;
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
    invalidateReferenceCaches();
    closePromptModal();
    setPrompts((prev) => prev.filter((item) => item.id !== id));
    setRecentPrompts((prev) => prev.filter((item) => item.id !== id));
    setFavoritePrompts((prev) => prev.filter((item) => item.id !== id));
    setPromptsTotal((prev) => Math.max(0, prev - 1));
    void api.getCategories().then(setCategories).catch(() => undefined);
  }

  function handleTabChange(nextTab: TabKey) {
    setActiveTag(undefined);
    if (nextTab !== "search") {
      setSearchQuery("");
    }
    setTab(nextTab);
  }

  function handleSelectTag(tagName: string) {
    closePromptModal();
    setActiveTag(tagName);
    setSearchQuery("");
    listFiltersRef.current = { search: "", category: undefined, sort: "new" };
    setTab("prompts");
    setToastMessage(`Промпты с тегом: ${tagName}`);
    void reloadPromptsList();
  }

  async function handleCopyPrompt(prompt: Prompt) {
    try {
      const ready = await ensurePromptWithContent(prompt, (id) => api.getPrompt(id));
      if (!hasFullPromptContent(ready)) {
        setToastMessage("Не удалось загрузить промпт");
        return;
      }
      await navigator.clipboard.writeText(ready.content!);
      setToastMessage("Промпт скопирован");
      setPrompts((prev) =>
        prev.map((item) =>
          item.id === ready.id ? mergePromptUpdate(item, { ...ready, usageCount: item.usageCount + 1 }) : item
        )
      );
      setUserUsageTotal((prev) => prev + 1);
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
    const fresh = withPromptDetails(await api.getPrompt(promptId));
    setPrompts((prev) => prev.map((item) => (item.id === promptId ? fresh : item)));
    syncRecentPrompt(fresh);
    setSelectedPrompt(fresh);
  }

  return (
    <Layout freezeScroll={!isMiniAppExpanded}>
      {tab === "home" && (
        <HomePage
          recentPrompts={recentPrompts}
          recentLoading={loading}
          stats={stats}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
          onCreate={isAdmin ? () => handleTabChange("add") : undefined}
          showCreateButton={isAdmin}
          isAdmin={isAdmin}
          onViewAll={() => handleTabChange("prompts")}
        />
      )}
      {tab === "prompts" && (
        <PromptsPage
          key={activeTag ?? "all"}
          prompts={prompts}
          categories={categories}
          loading={loading || listReloading}
          loadingMore={loadingMore}
          hasMore={hasMorePrompts}
          onLoadMore={loadMorePrompts}
          error={error}
          onOpenPrompt={openPrompt}
          onToggleFavorite={handleToggleFavorite}
          onCopyPrompt={handleCopyPrompt}
          onTagClick={handleSelectTag}
          activeTag={activeTag}
          onClearTag={() => setActiveTag(undefined)}
          onFiltersChange={(filters) => {
            listFiltersRef.current = filters;
            void reloadPromptsList();
          }}
          filterDebounceMs={LIST_FILTER_DEBOUNCE_MS}
        />
      )}
      {tab === "search" && (
        <SearchPage
          query={searchQuery}
          onQueryChange={setSearchQuery}
          quickTags={quickTags}
          results={searchPrompts}
          loading={searchLoading}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
        />
      )}
      {tab === "favorites" && (
        <FavoritesPage
          prompts={favoritesForView}
          loading={favoritesLoading}
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
          onCancel={() => handleTabChange("home")}
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
            handleTabChange("home");
          }}
        />
      )}
      <BottomNav current={tab === "add" ? "home" : tab} onChange={handleTabChange} />
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
