import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { clearPromptShareUrl, parsePromptIdFromLocation, setPromptShareUrl } from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";
import { normalizeTagName } from "./utils/tagFilter";
import { countCategoriesWithPromptCount, countCategoriesWithPrompts } from "./utils/stats";
import { api, invalidateReferenceCaches, setAuthTelegramId } from "./api";
import type { Category, MeResponse, Prompt, PromptCreatePayload, TelegramUser } from "./types";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { PromptHistoryScreen } from "./components/history/PromptHistoryScreen";
import { recordPromptCopy, trackPromptView } from "./utils/promptTracking";
import type { PromptEditPayload } from "./components/PromptDetailsModal";
import { Layout } from "./components/Layout";
import { BottomNav, type TabKey } from "./components/BottomNav";
import { HomePage } from "./pages/HomePage";
import { PromptsPage } from "./pages/PromptsPage";
import { AddPromptPage } from "./pages/AddPromptPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { SearchPage } from "./pages/SearchPage";
import { BrandSplash } from "./components/BrandSplash";
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
import {
  invalidateFavoritesCache,
  readFavoritesCache,
  writeFavoritesCache
} from "./utils/favoritesCache";
import { hideAppSplash } from "./utils/appSplash";
import { miniRouteDocumentTitle, useDocumentTitle } from "./utils/documentTitle";
import { writeReferenceCache } from "./utils/referenceCache";
import { createPromptLoadingShell } from "./utils/promptShell";

const CATEGORIES_CACHE_KEY = "prompt-bank-categories";
const TAGS_CACHE_KEY = "prompt-bank-tags";

const WebApp = lazy(() => import("./WebApp").then((module) => ({ default: module.WebApp })));

const quickTags = ["beauty", "video", "logo", "telegram", "cursor", "ads", "react", "realistic"];
const BOOTSTRAP_PROMPTS_LIMIT = 12;
const MINI_PROMPTS_PAGE = 30;
const HOME_RECENT_LIMIT = 8;
const FAVORITES_FETCH_LIMIT = 40;
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
  return <BrandSplash />;
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
  const [promptsListLoading, setPromptsListLoading] = useState(true);
  const [error, setError] = useState("");
  const fullListLoadedRef = useRef(false);
  const bootstrapStartedRef = useRef(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [createdPromptId, setCreatedPromptId] = useState<number>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPrompts, setSearchPrompts] = useState<Prompt[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userUsageTotal, setUserUsageTotal] = useState(0);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profileScreen, setProfileScreen] = useState<"copied" | "viewed" | null>(null);
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

  const documentTitleSuffix = useMemo(
    () =>
      miniRouteDocumentTitle({
        tab,
        activeTag,
        searchQuery,
        selectedPromptTitle: selectedPrompt?.title,
        profileScreen
      }),
    [tab, activeTag, searchQuery, selectedPrompt?.title, profileScreen]
  );

  useDocumentTitle(documentTitleSuffix);

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

  async function refreshFavoritesList(showSpinner: boolean) {
    if (showSpinner) setFavoritesLoading(true);
    try {
      const data = await api.getPrompts({ favorite: true, limit: FAVORITES_FETCH_LIMIT, lite: true });
      const mapped = mapPromptsFromApi(data.items);
      setFavoritePrompts(mapped);
      writeFavoritesCache(mapped);
    } catch {
      if (showSpinner) setToastMessage("Не удалось загрузить избранное");
    } finally {
      if (showSpinner) setFavoritesLoading(false);
    }
  }

  async function loadDeferredBootstrapData() {
    const cachedFavorites = readFavoritesCache();
    if (cachedFavorites) {
      setFavoritePrompts(cachedFavorites);
    }

    runDeferred(() => {
      void api
        .getTags()
        .then((tags) => writeReferenceCache(TAGS_CACHE_KEY, tags))
        .catch(() => undefined);
      void api
        .getMe()
        .then((meResponse) => {
          setMe(meResponse.authenticated ? meResponse : null);
          setUserUsageTotal(meResponse.usageTotal ?? meResponse.stats?.usageCountTotal ?? 0);
        })
        .catch(() => undefined);
      if (!cachedFavorites) {
        void refreshFavoritesList(false);
      }
    });
  }

  async function loadData() {
    setLoading(true);
    setPromptsListLoading(true);
    fullListLoadedRef.current = false;
    setError("");
    try {
      const data = await api.bootstrap(BOOTSTRAP_PROMPTS_LIMIT);
      const mapped = mapPromptsFromApi(data.prompts.items).map(withPromptDetails);
      setCategories(data.categories);
      writeReferenceCache(CATEGORIES_CACHE_KEY, data.categories);
      setIsAdmin(data.me.isAdmin);
      setPrompts(mapped);
      setPromptsTotal(data.prompts.total);
      syncRecentFromPrompts(mapped);
      fullListLoadedRef.current = mapped.length >= BOOTSTRAP_PROMPTS_LIMIT;
      setPromptsListLoading(false);
      scheduleMiniPrefetch(mapped.length, data.prompts.total, listFiltersRef.current, activeTag);
      void loadDeferredBootstrapData();
    } catch {
      setError("Не удалось загрузить данные.");
      setPromptsListLoading(false);
    } finally {
      setLoading(false);
      hideAppSplash();
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
    const promptId = parsePromptIdFromLocation();
    if (promptId) {
      api.prefetchPrompt(promptId);
    }
  }, []);

  useEffect(() => {
    const actualUser = resolveTelegramUser() ?? mockTelegramUser;
    if (actualUser?.id) {
      setAuthTelegramId(String(actualUser.id));
    }
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;
    void loadData();
    return () => {
      setAuthTelegramId(null);
    };
  }, []);

  useEffect(() => {
    if (tab !== "favorites") return;
    const cached = readFavoritesCache();
    if (cached) {
      setFavoritePrompts(cached);
      return;
    }
    void refreshFavoritesList(true);
  }, [tab]);

  function syncFavoritePrompts(next: Prompt) {
    setFavoritePrompts((prev) => {
      let result: Prompt[];
      if (!next.isFavorite) {
        result = prev.filter((item) => item.id !== next.id);
      } else {
        const index = prev.findIndex((item) => item.id === next.id);
        if (index === -1) {
          result = [next, ...prev];
        } else {
          const copy = [...prev];
          copy[index] = mergePromptUpdate(prev[index], next);
          result = copy;
        }
      }
      writeFavoritesCache(result);
      return result;
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
    await openPrompt(createPromptLoadingShell(promptId), replaceUrl);
  }

  async function openPrompt(prompt: Prompt, replaceUrl = false) {
    const requestId = ++openPromptRequestRef.current;
    setSelectedPrompt({ ...prompt, examples: prompt.examples ?? [] });
    setPromptShareUrl(prompt.id, replaceUrl);
    if (hasFullPromptDetails(prompt)) {
      trackPromptView(prompt.id, "miniapp", true);
      return;
    }
    try {
      const full = withPromptDetails(await api.getPrompt(prompt.id));
      if (openPromptRequestRef.current !== requestId) return;
      setSelectedPrompt(full);
      setPrompts((prev) => prev.map((item) => (item.id === full.id ? mergePromptUpdate(item, full) : item)));
      syncRecentPrompt(full);
      trackPromptView(full.id, "miniapp", true);
    } catch {
      if (openPromptRequestRef.current !== requestId) return;
      closePromptModal();
      setToastMessage("Не удалось загрузить промпт");
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
    invalidateFavoritesCache();
    setPromptsTotal((prev) => Math.max(0, prev - 1));
    void api.getCategories().then(setCategories).catch(() => undefined);
  }

  async function refreshMe() {
    try {
      const next = await api.getMe();
      setMe(next.authenticated ? next : null);
      setUserUsageTotal(next.usageTotal ?? next.stats?.usageCountTotal ?? 0);
    } catch {
      // ignore
    }
  }

  async function handleUpdateSettings(settings: Partial<{ saveViewHistory: boolean; saveCopyHistory: boolean }>) {
    const updated = await api.updateSettings(settings);
    setMe((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              ...updated
            }
          }
        : current
    );
  }

  function handleTabChange(nextTab: TabKey) {
    setProfileScreen(null);
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
      void recordPromptCopy(prompt.id, "miniapp", true).then(() => refreshMe());
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
      {tab === "home" && !loading ? (
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
      ) : null}
      {tab === "prompts" && (
        <PromptsPage
          key={activeTag ?? "all"}
          prompts={prompts}
          categories={categories}
          loading={listReloading || promptsListLoading}
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
          loading={favoritesLoading && !favoritePrompts.length}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
        />
      )}
      {tab === "profile" && profileScreen === "copied" ? (
        <PromptHistoryScreen
          mode="copied"
          variant="mini"
          isAuthenticated
          onBack={() => setProfileScreen(null)}
          onLogin={() => undefined}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onNavigatePrompts={() => {
            setProfileScreen(null);
            handleTabChange("prompts");
          }}
        />
      ) : null}
      {tab === "profile" && profileScreen === "viewed" ? (
        <PromptHistoryScreen
          mode="viewed"
          variant="mini"
          isAuthenticated
          onBack={() => setProfileScreen(null)}
          onLogin={() => undefined}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopyPrompt}
          onToggleFavorite={handleToggleFavorite}
          onNavigatePrompts={() => {
            setProfileScreen(null);
            handleTabChange("prompts");
          }}
        />
      ) : null}
      {tab === "profile" && !profileScreen ? (
        <SettingsScreen
          user={user}
          me={me}
          isAuthenticated
          variant="mini"
          showLogout={false}
          onNavigateCopied={() => setProfileScreen("copied")}
          onNavigateViewed={() => setProfileScreen("viewed")}
          onLogout={() => undefined}
          onLogin={() => undefined}
          onUpdateSettings={handleUpdateSettings}
        />
      ) : null}
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
