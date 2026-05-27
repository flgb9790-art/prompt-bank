import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Heart, Layers, Sparkles, X } from "lucide-react";
import { api, ApiError, invalidateReferenceCaches, setAuthTelegramId } from "./api";
import type { Category, MeResponse, Prompt, PromptCreatePayload, TagStat, TelegramUser, CreatePromptResponse } from "./types";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { PromptHistoryScreen } from "./components/history/PromptHistoryScreen";
import { recordPromptCopy, trackPromptView } from "./utils/promptTracking";
import { BrandSplash } from "./components/BrandSplash";
import { PromptDetailsModal, type PromptEditPayload } from "./components/PromptDetailsModal";
const PromptForm = lazy(() => import("./components/PromptForm").then((module) => ({ default: module.PromptForm })));
import { runDeferred } from "./utils/deferredPrefetch";
import { hideAppSplash } from "./utils/appSplash";
import { writeReferenceCache } from "./utils/referenceCache";
import { buildCreatePromptToastMessage } from "./utils/pinterestPost";
import { createPromptLoadingShell } from "./utils/promptShell";

import {
  invalidateFavoritesCache,
  readFavoritesCache,
  writeFavoritesCache
} from "./utils/favoritesCache";
import { AuthRequiredModal } from "./components/web/AuthRequiredModal";
import { PromptGrid } from "./components/web/PromptGrid";
import { Sidebar } from "./components/web/Sidebar";
import { SortSelect } from "./components/web/SortSelect";
import { StatsCard } from "./components/web/StatsCard";
import { TelegramAuthModal } from "./components/web/TelegramAuthModal";
import { Topbar } from "./components/web/Topbar";
import { Pagination } from "./components/web/Pagination";
import { ViewModeSwitcher } from "./components/web/ViewModeSwitcher";
import { WebLayout } from "./components/web/WebLayout";
import { MobileWebShell } from "./components/web/MobileWebShell";
import { AuthButton } from "./components/web/AuthButton";
import { clearPromptShareUrl, parsePromptIdFromLocation, setPromptShareUrl } from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";
import { normalizeTagName } from "./utils/tagFilter";
import { countCategoriesWithPromptCount, countCategoriesWithPrompts } from "./utils/stats";
import type { GetPromptsParams } from "./api";
import { useLoadMoreOnScroll } from "./hooks/useLoadMoreOnScroll";
import { prefetchPromptsPage, takePrefetchedPromptsPage } from "./utils/promptsPrefetch";
import {
  useDocumentTitle,
  webRouteDocumentTitle
} from "./utils/documentTitle";
import {
  ensurePromptWithContent,
  hasFullPromptContent,
  hasFullPromptDetails,
  mapPromptsFromApi,
  withPromptDetails
} from "./utils/promptContent";
import { PINTEREST_PAGE_SIZE, readViewMode, saveViewMode, type ViewMode } from "./utils/viewMode";

type SortValue = "new" | "old" | "usage";
type RoutePath = "/" | "/prompts" | "/favorites" | "/categories" | "/tags" | "/recent" | "/settings" | "/copied" | "/viewed" | "/privacy";

const storageKey = "prompt-bank-web-auth";
const CATEGORIES_CACHE_KEY = "prompt-bank-categories";
const TAGS_CACHE_KEY = "prompt-bank-tags";
const PROMPTS_PER_PAGE = 12;
const BOOTSTRAP_PROMPTS_LIMIT = 12;
const PROMPTS_FETCH_LIMIT = 40;
const FAVORITES_FETCH_LIMIT = 40;
const SEARCH_DEBOUNCE_MS = 350;
const telegramAuthUrl = (import.meta.env.VITE_TELEGRAM_AUTH_URL as string | undefined)?.trim();
const telegramBotUsernameFromEnv = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim();

function getRoutePath(pathname: string): RoutePath {
  const allowed: RoutePath[] = ["/", "/prompts", "/favorites", "/categories", "/tags", "/recent", "/settings", "/copied", "/viewed", "/privacy"];
  return allowed.includes(pathname as RoutePath) ? (pathname as RoutePath) : "/";
}

function parseSavedUser(): TelegramUser | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TelegramUser;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function WebApp() {
  const [path, setPath] = useState<RoutePath>(getRoutePath(window.location.pathname));
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>();
  const [activeTag, setActiveTag] = useState<string>();
  const [sort, setSort] = useState<SortValue>("new");
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode("grid"));
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptsTotal, setPromptsTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [loadingMoreRemote, setLoadingMoreRemote] = useState(false);
  const [favoritePrompts, setFavoritePrompts] = useState<Prompt[]>([]);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  const [loadingMoreFavorites, setLoadingMoreFavorites] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);
  const [telegramAuthModalOpen, setTelegramAuthModalOpen] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(parseSavedUser());
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userUsageTotal, setUserUsageTotal] = useState(0);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [page, setPage] = useState(1);
  const isAuthenticated = Boolean(user);
  const bootstrappedRef = useRef(false);
  const filtersEffectReadyRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const openPromptRequestRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("web-mode");
    return () => document.documentElement.classList.remove("web-mode");
  }, []);

  useEffect(() => {
    if (user) {
      setAuthTelegramId(String(user.id));
      localStorage.setItem(storageKey, JSON.stringify(user));
    } else {
      setAuthTelegramId(null);
      localStorage.removeItem(storageKey);
    }
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeTag, search, sort, path]);

  useEffect(() => {
    if (path === "/settings" && user) {
      void refreshMe();
    }
  }, [path, user?.id]);

  const categoriesWithPrompts = useMemo(
    () => categories.filter((category) => (category.promptCount ?? 0) > 0),
    [categories]
  );

  const tagsWithPrompts = useMemo(() => tags.filter((tag) => tag.count > 0), [tags]);

  const stats = useMemo(
    () => ({
      total: promptsTotal || prompts.length,
      favorites: favoritePrompts.length || prompts.filter((prompt) => prompt.isFavorite).length,
      categories: countCategoriesWithPromptCount(categories) || countCategoriesWithPrompts(prompts),
      usage: isAuthenticated ? userUsageTotal : 0
    }),
    [categories, favoritePrompts.length, isAuthenticated, prompts, promptsTotal, userUsageTotal]
  );

  const documentTitleSuffix = useMemo(
    () =>
      webRouteDocumentTitle({
        path,
        activeTag,
        activeCategory,
        categories,
        selectedPromptTitle: selectedPrompt?.title,
        isAddModalOpen
      }),
    [path, activeTag, activeCategory, categories, selectedPrompt?.title, isAddModalOpen]
  );

  useDocumentTitle(documentTitleSuffix);

  const userPromptsCount = useMemo(() => {
    if (!dbUserId) return 0;
    return prompts.filter((prompt) => prompt.userId === dbUserId).length;
  }, [dbUserId, prompts]);

  async function refreshMe() {
    try {
      const next = await api.getMe();
      setMe(next.authenticated ? next : null);
      setIsAdmin(Boolean(next.isAdmin));
      setDbUserId(next.user?.id ?? null);
      setUserUsageTotal(next.usageTotal ?? next.stats?.usageCountTotal ?? 0);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadBootstrap() {
    setLoading(true);
    setError("");
    try {
      const [categoriesData, tagsData, me] = await Promise.all([
        api.getCategories(),
        api.getTags(),
        api.getMe()
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
      setIsAdmin(Boolean(me.isAdmin));
      setDbUserId(me.user?.id ?? null);
      setUserUsageTotal(me.usageTotal ?? me.stats?.usageCountTotal ?? 0);
      setMe(me.authenticated ? me : null);
    } catch (err) {
      setError("Не удалось загрузить данные.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const hasMoreRemote = prompts.length < promptsTotal;
  const hasMoreFavorites = favoritePrompts.length < favoritesTotal;

  function handleViewModeChange(next: ViewMode) {
    setViewMode(next);
    saveViewMode(next);
  }

  function getFetchLimit() {
    return viewMode === "pinterest" ? PINTEREST_PAGE_SIZE : PROMPTS_FETCH_LIMIT;
  }

  function buildPromptsQuery(offset: number): GetPromptsParams {
    const query = search.trim();
    return {
      limit: getFetchLimit(),
      offset,
      search: query || undefined,
      category: activeCategory,
      tag: activeTag ? normalizeTagName(activeTag) : undefined,
      sort,
      lite: true
    };
  }

  function scheduleWebPrefetch(loadedCount: number, total: number) {
    if (loadedCount >= total) return;
    runDeferred(() => prefetchPromptsPage(buildPromptsQuery(loadedCount)));
  }

  const loadMoreRef = useLoadMoreOnScroll({
    enabled: viewMode !== "pinterest" && !loading && prompts.length > 0,
    loading: loadingMoreRemote || promptsLoading,
    hasMore: hasMoreRemote,
    onLoadMore: () => void loadMoreRemotePrompts()
  });

  async function loadMoreRemotePrompts() {
    if (loadingMoreRemote || !hasMoreRemote) return;
    setLoadingMoreRemote(true);
    const query = buildPromptsQuery(prompts.length);
    try {
      const cached = await takePrefetchedPromptsPage(query);
      const promptsData = cached ?? (await api.getPrompts(query));
      setPrompts((prev) => {
        const merged = [...prev, ...mapPromptsFromApi(promptsData.items)];
        scheduleWebPrefetch(merged.length, promptsData.total);
        return merged;
      });
      setPromptsTotal(promptsData.total);
    } catch (err) {
      console.error(err);
      setToast("Не удалось загрузить ещё промпты");
    } finally {
      setLoadingMoreRemote(false);
    }
  }

  async function loadPrompts() {
    setPromptsLoading(true);
    try {
      const promptsData = await api.getPrompts(buildPromptsQuery(0));
      const mapped = mapPromptsFromApi(promptsData.items);
      setPrompts(mapped);
      setPromptsTotal(promptsData.total);
      scheduleWebPrefetch(mapped.length, promptsData.total);
    } catch (err) {
      setError("Не удалось загрузить промпты.");
      console.error(err);
    } finally {
      setPromptsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.bootstrap(BOOTSTRAP_PROMPTS_LIMIT);
        if (cancelled) return;
        const mapped = mapPromptsFromApi(data.prompts.items).map(withPromptDetails);
        setPrompts(mapped);
        setPromptsTotal(data.prompts.total);
        setCategories(data.categories);
        writeReferenceCache(CATEGORIES_CACHE_KEY, data.categories);
        setIsAdmin(Boolean(data.me.isAdmin));
        setDbUserId(data.me.user?.id ?? null);
        bootstrappedRef.current = true;
        scheduleWebPrefetch(mapped.length, data.prompts.total);

        const cachedFavorites = readFavoritesCache();
        if (cachedFavorites) {
          setFavoritePrompts(cachedFavorites);
        }

        runDeferred(() => {
          void api
            .getTags()
            .then((tags) => {
              setTags(tags);
              writeReferenceCache(TAGS_CACHE_KEY, tags);
            })
            .catch(console.error);
          void api
            .getMe()
            .then((meResponse) => {
              setMe(meResponse.authenticated ? meResponse : null);
              setUserUsageTotal(meResponse.usageTotal ?? meResponse.stats?.usageCountTotal ?? 0);
            })
            .catch(console.error);
          if (!cachedFavorites) {
            void refreshWebFavorites(false);
          }
        });
      } catch (err) {
        if (!cancelled) {
          setError("Не удалось загрузить данные.");
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hideAppSplash();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    if (!filtersEffectReadyRef.current) {
      filtersEffectReadyRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void loadPrompts();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, activeCategory, activeTag, sort]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    setPage(1);
    if (path === "/favorites" && isAuthenticated) {
      void refreshWebFavorites(true);
      return;
    }
    if (path === "/" || path === "/prompts" || path === "/recent") {
      void loadPrompts();
    }
  }, [viewMode]);

  useEffect(() => {
    if (!bootstrappedRef.current || path !== "/recent") return;
    setActiveCategory(undefined);
    setActiveTag(undefined);
    setSearch("");
    setSort("new");
  }, [path]);

  async function refreshWebFavorites(showSpinner: boolean, append = false) {
    if (!isAuthenticated) return;
    if (showSpinner && !append) setFavoritesLoading(true);
    if (append) setLoadingMoreFavorites(true);
    const limit = viewMode === "pinterest" ? PINTEREST_PAGE_SIZE : FAVORITES_FETCH_LIMIT;
    const offset = append ? favoritePrompts.length : 0;
    try {
      const data = await api.getPrompts({ favorite: true, limit, offset, lite: true, sort });
      const mapped = mapPromptsFromApi(data.items);
      setFavoritesTotal(data.total);
      setFavoritePrompts((prev) => (append ? [...prev, ...mapped] : mapped));
      if (!append) writeFavoritesCache(mapped);
    } catch (err) {
      console.error(err);
      if (showSpinner) setToast("Не удалось загрузить избранное");
    } finally {
      if (showSpinner && !append) setFavoritesLoading(false);
      if (append) setLoadingMoreFavorites(false);
    }
  }

  async function loadMoreFavoritesPinterest() {
    if (loadingMoreFavorites || !hasMoreFavorites) return;
    await refreshWebFavorites(false, true);
  }

  useEffect(() => {
    if (path !== "/favorites" || !isAuthenticated) return;
    const cached = readFavoritesCache();
    if (cached) {
      setFavoritePrompts(cached);
      return;
    }
    void refreshWebFavorites(true);
  }, [path, isAuthenticated, sort]);

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

  useEffect(() => {
    const promptId = parsePromptIdFromLocation();
    if (promptId) {
      api.prefetchPrompt(promptId);
    }
  }, []);

  useEffect(() => {
    if (loading || deepLinkHandledRef.current) return;
    const promptId = parsePromptIdFromLocation();
    if (!promptId) return;
    deepLinkHandledRef.current = true;
    void openPromptById(promptId, true);
  }, [loading, prompts]);

  async function openPromptById(promptId: number, replaceUrl = false) {
    const cached = prompts.find((item) => item.id === promptId);
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
      trackPromptView(prompt.id, "web", isAuthenticated);
      return;
    }
    try {
      const full = withPromptDetails(await api.getPrompt(prompt.id));
      if (openPromptRequestRef.current !== requestId) return;
      setSelectedPrompt(full);
      upsertPromptInList(full);
      trackPromptView(full.id, "web", isAuthenticated);
    } catch (err) {
      if (openPromptRequestRef.current !== requestId) return;
      console.error(err);
      closePromptModal();
      setToast("Не удалось загрузить промпт");
    }
  }

  function closePromptModal() {
    openPromptRequestRef.current += 1;
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
  }

  useEffect(() => {
    const onPopState = () => {
      setPath(getRoutePath(window.location.pathname));
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

  function upsertPromptInList(nextPrompt: Prompt) {
    setPrompts((prev) => {
      const index = prev.findIndex((item) => item.id === nextPrompt.id);
      if (index === -1) {
        if (!nextPrompt.category) return prev;
        return [nextPrompt, ...prev];
      }
      const copy = [...prev];
      copy[index] = mergePromptUpdate(prev[index], nextPrompt);
      return copy;
    });
  }

  function navigate(nextPath: RoutePath, options?: { keepTag?: boolean }) {
    if (window.location.pathname !== nextPath) {
      const url = new URL(window.location.href);
      url.pathname = nextPath;
      url.searchParams.delete("prompt");
      window.history.pushState({}, "", `${url.pathname}${url.search}`);
      setSelectedPrompt(undefined);
    }
    if (!options?.keepTag) {
      setActiveTag(undefined);
    }
    setPath(nextPath);
  }

  function askAuth() {
    setAuthRequiredOpen(true);
    setToast("Нужно войти");
  }

  function extractBotUsername(): string | undefined {
    if (telegramBotUsernameFromEnv) return telegramBotUsernameFromEnv;
    if (!telegramAuthUrl) return undefined;
    const match = telegramAuthUrl.match(/t\.me\/@?([^/?#]+)/i);
    return match?.[1];
  }

  function handleUnauthorized(err: unknown): boolean {
    if (err instanceof ApiError && err.status === 401 && err.code === "AUTH_REQUIRED") {
      askAuth();
      return true;
    }
    return false;
  }

  async function handleCopy(prompt: Prompt) {
    try {
      const ready = await ensurePromptWithContent(prompt, (id) => api.getPrompt(id));
      if (!hasFullPromptContent(ready)) {
        setToast("Не удалось загрузить промпт");
        return;
      }
      await navigator.clipboard.writeText(ready.content!);
      setToast("Промпт скопирован");
      setPrompts((prev) =>
        prev.map((item) =>
          item.id === ready.id ? mergePromptUpdate(item, { ...ready, usageCount: item.usageCount + 1 }) : item
        )
      );
      if (isAuthenticated) {
        setUserUsageTotal((prev) => prev + 1);
        void recordPromptCopy(prompt.id, "web", true).then(() => refreshMe());
      }
    } catch {
      setToast("Не удалось скопировать промпт");
    }
  }

  async function handleToggleFavorite(id: number) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    const previous = prompts.find((item) => item.id === id) ?? favoritePrompts.find((item) => item.id === id);
    if (!previous) return;

    const optimistic = { ...previous, isFavorite: !previous.isFavorite };
    setPrompts((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    syncFavoritePrompts(optimistic);
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(optimistic);
    }

    try {
      const updated = await api.toggleFavorite(id);
      upsertPromptInList(updated);
      syncFavoritePrompts(updated);
      if (selectedPrompt?.id === id) {
        setSelectedPrompt((current) => (current ? mergePromptUpdate(current, updated) : updated));
      }
    } catch (err) {
      syncFavoritePrompts(previous);
      setPrompts((prev) => prev.map((item) => (item.id === id ? previous : item)));
      if (selectedPrompt?.id === id) setSelectedPrompt(previous);
      if (!handleUnauthorized(err)) {
        setToast("Не удалось обновить избранное");
      }
    }
  }

  async function handleDeletePrompt(id: number) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    try {
      await api.deletePrompt(id);
      invalidateReferenceCaches();
      closePromptModal();
      setPrompts((prev) => prev.filter((item) => item.id !== id));
      setFavoritePrompts((prev) => prev.filter((item) => item.id !== id));
      invalidateFavoritesCache();
      setPromptsTotal((prev) => Math.max(0, prev - 1));
      setToast("Промпт удален");
      void Promise.all([api.getTags().then(setTags), api.getCategories().then(setCategories)]).catch(console.error);
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
      }
    }
  }

  async function handleEditPrompt(promptId: number, data: PromptEditPayload) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    try {
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
      upsertPromptInList(fresh);
      setSelectedPrompt(fresh);
      setToast("Промпт сохранен");
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка сохранения");
      }
      throw err;
    }
  }

  async function handleSavePrompt(payload: PromptCreatePayload) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    if (!isAdmin) {
      setToast("Добавлять промпты могут только администраторы");
      return;
    }
    try {
      const created = withPromptDetails(await api.createPrompt(payload)) as CreatePromptResponse;
      invalidateReferenceCaches();
      upsertPromptInList(created);
      setPromptsTotal((prev) => prev + 1);
      setToast(
        buildCreatePromptToastMessage({
          telegramPublicationStatus: created.telegramPublicationStatus,
          telegramPublicationError: created.telegramPublicationError,
          pinterestPublicationStatus: created.pinterestPublicationStatus,
          pinterestPublicationError: created.pinterestPublicationError
        })
      );
      setIsAddModalOpen(false);
      void Promise.all([api.getTags().then(setTags), api.getCategories().then(setCategories)]).catch(console.error);
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
      }
    }
  }

  async function handlePublishTelegram(promptId: number) {
    if (!isAdmin) return;
    try {
      const result = await api.publishPromptToTelegram(promptId);
      const fresh = withPromptDetails(await api.getPrompt(promptId));
      upsertPromptInList(fresh);
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt(fresh);
      }
      if (result.status === "published") {
        setToast("Опубликовано в Telegram");
      } else {
        setToast(
          result.error ??
            "Публикация в Telegram не удалась. Проверьте настройки канала и права бота."
        );
      }
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Публикация в Telegram не удалась");
      }
      throw err;
    }
  }

  async function handlePublishPinterest(promptId: number) {
    if (!isAdmin) return;
    try {
      const result = await api.publishPromptToPinterest(promptId);
      const fresh = withPromptDetails(await api.getPrompt(promptId));
      upsertPromptInList(fresh);
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt(fresh);
      }
      if (result.status === "published") {
        setToast("Опубликовано в Pinterest");
      } else {
        setToast(
          result.error ??
            "Публикация в Pinterest не удалась. Проверьте access token, board id и доступность изображения."
        );
      }
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Публикация в Pinterest не удалась");
      }
      throw err;
    }
  }

  function handleCreateClick() {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    if (!isAdmin) {
      setToast("Добавлять промпты могут только администраторы");
      return;
    }
    setIsAddModalOpen(true);
  }

  function loginTelegram() {
    setAuthRequiredOpen(false);
    setTelegramAuthModalOpen(true);
  }

  function logout() {
    setUser(null);
    setDbUserId(null);
    setIsAdmin(false);
    setUserUsageTotal(0);
    setMe(null);
    setToast("Вы вышли");
    if (path === "/copied" || path === "/viewed") {
      navigate("/settings");
    }
    void loadPrompts();
  }

  async function handleUpdateSettings(settings: Partial<{ saveViewHistory: boolean; saveCopyHistory: boolean }>) {
    await api.updateSettings(settings);
    await refreshMe();
  }

  function handleSelectTag(tagName: string) {
    const tag = normalizeTagName(tagName);
    if (!tag) return;
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
    setActiveTag(tag);
    setActiveCategory(undefined);
    setSearch("");
    setPage(1);
    navigate("/prompts", { keepTag: true });
  }

  function renderPromptList(list: Prompt[], options?: { favorites?: boolean }) {
    const isFavorites = Boolean(options?.favorites);

    if (viewMode === "pinterest") {
      return (
        <PromptGrid
          prompts={list}
          view="pinterest"
          pinterestLoading={isFavorites ? favoritesLoading : promptsLoading}
          pinterestLoadingMore={isFavorites ? loadingMoreFavorites : loadingMoreRemote}
          pinterestHasMore={isFavorites ? hasMoreFavorites : hasMoreRemote}
          onPinterestLoadMore={() => {
            if (isFavorites) {
              void loadMoreFavoritesPinterest();
              return;
            }
            void loadMoreRemotePrompts();
          }}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopy}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
        />
      );
    }

    const listTotalPages = Math.max(1, Math.ceil(list.length / PROMPTS_PER_PAGE));
    const listPage = Math.min(page, listTotalPages);
    const start = (listPage - 1) * PROMPTS_PER_PAGE;
    const pageItems = list.slice(start, start + PROMPTS_PER_PAGE);

    return (
      <>
        <PromptGrid
          prompts={pageItems}
          view={viewMode}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopy}
          onToggleFavorite={handleToggleFavorite}
          onTagClick={handleSelectTag}
        />
        <Pagination
          page={listPage}
          totalPages={listTotalPages}
          totalItems={list.length}
          pageSize={PROMPTS_PER_PAGE}
          onPageChange={setPage}
        />
        {hasMoreRemote ? (
          <div ref={loadMoreRef} className="mt-4 flex min-h-10 items-center justify-center">
            {loadingMoreRemote ? (
              <span className="text-sm text-[var(--muted)]">Загрузка...</span>
            ) : (
              <span className="text-xs text-[var(--muted)]">
                {prompts.length} из {promptsTotal}
              </span>
            )}
          </div>
        ) : null}
      </>
    );
  }

  const content = (
    <>
      {path === "/" ? (
        <div>
          <div className="welcome-block">
            <h1 className="welcome-title lg:text-[24px]">Добро пожаловать! 👋</h1>
            <p className="welcome-subtitle">
              {isAdmin
                ? "Здесь хранятся все промпты банка. Легко находите, копируйте и управляйте контентом."
                : "Готовые промпты для работы. Ищите по категориям и тегам, копируйте и сохраняйте в избранное."}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-[18px]">
            <StatsCard icon={<Layers size={22} />} label="Всего промптов" value={stats.total} iconBg="bg-[var(--primary-soft)] text-[var(--primary)]" />
            <StatsCard icon={<Heart size={22} />} label="Избранных" value={isAuthenticated ? stats.favorites : 0} iconBg="bg-[#fdf2f8] text-pink-600" />
            <StatsCard icon={<Sparkles size={22} />} label="Категории" value={stats.categories} iconBg="bg-[var(--blue-soft)] text-[var(--blue)]" />
            <StatsCard icon={<BarChart3 size={22} />} label="Использований" value={stats.usage} iconBg="bg-[var(--purple-soft)] text-[var(--purple)]" />
          </div>

          <div className="mt-8">
            <h2 className="section-title">Недавние промпты</h2>
            <div className="mt-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                <button className={`chip ${!activeCategory ? "active" : ""}`} onClick={() => setActiveCategory(undefined)} type="button">
                  Все
                </button>
                {categoriesWithPrompts.map((category) => (
                  <button
                    key={category.id}
                    className={`chip ${activeCategory === category.slug ? "active" : ""}`}
                    onClick={() => setActiveCategory(category.slug)}
                    type="button"
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <SortSelect value={sort} onChange={setSort} />
                <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
              </div>
            </div>
          </div>

          {renderPromptList(prompts)}
        </div>
      ) : null}

      {path === "/prompts" ? (
        <div>
          {activeTag ? (
            <div className="mb-3">
              <h2 className="text-base font-semibold text-[var(--text)]">
                Тег: {activeTag}
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">({promptsTotal})</span>
              </h2>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{activeTag ? "Промпты по тегу" : "Все промпты"}</h2>
            <div className="flex items-center gap-2">
              <SortSelect value={sort} onChange={setSort} />
              <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`chip ${!activeCategory ? "active" : ""}`} onClick={() => setActiveCategory(undefined)} type="button">
              Все
            </button>
            {categoriesWithPrompts.map((category) => (
              <button
                key={category.id}
                className={`chip ${activeCategory === category.slug ? "active" : ""}`}
                onClick={() => setActiveCategory(category.slug)}
                type="button"
              >
                {category.name}
              </button>
            ))}
            {activeTag ? (
              <button className="chip active" onClick={() => setActiveTag(undefined)} type="button">
                {activeTag} ×
              </button>
            ) : null}
          </div>
          {renderPromptList(prompts)}
        </div>
      ) : null}

      {path === "/favorites" ? (
        isAuthenticated ? (
          <>
            <div className="mb-4 flex items-center justify-end">
              <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
            </div>
            {favoritesLoading && !favoritePrompts.length ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton h-36" />
              ))}
            </div>
          ) : (
            renderPromptList(favoritePrompts, { favorites: true })
          )}
          </>
        ) : (
          <div className="surface-card empty-state mt-5">
            <p className="text-base font-medium text-[var(--text)]">Войдите через Telegram, чтобы сохранять промпты в избранное.</p>
          </div>
        )
      ) : null}

      {path === "/categories" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categoriesWithPrompts.map((category) => (
            <div key={category.id} className="surface-card p-4">
              <p className="text-sm text-[var(--text-soft)]">{category.icon ?? "📂"} {category.name}</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{category.promptCount ?? 0}</p>
            </div>
          ))}
        </div>
      ) : null}

      {path === "/tags" ? (
        <div className="flex flex-wrap gap-2">
          {tagsWithPrompts.length ? (
            tagsWithPrompts.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`chip ${activeTag === normalizeTagName(tag.name) ? "active" : ""}`}
                onClick={() => handleSelectTag(tag.name)}
              >
                {tag.name} ({tag.count})
              </button>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">Пока нет тегов с опубликованными промптами.</p>
          )}
        </div>
      ) : null}

      {path === "/recent" ? (
        <div>
          <div className="mb-4 flex items-center justify-end">
            <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
          </div>
          {renderPromptList(prompts)}
        </div>
      ) : null}

      {path === "/settings" ? (
        <SettingsScreen
          user={user}
          me={me}
          isAuthenticated={isAuthenticated}
          onNavigateCopied={() => navigate("/copied")}
          onNavigateViewed={() => navigate("/viewed")}
          onLogout={logout}
          onLogin={loginTelegram}
          onUpdateSettings={handleUpdateSettings}
          onOpenPrivacyPolicy={() => navigate("/privacy")}
        />
      ) : null}

      {path === "/privacy" ? <PrivacyPolicyPage onBack={() => navigate("/settings")} /> : null}

      {path === "/copied" ? (
        <PromptHistoryScreen
          mode="copied"
          isAuthenticated={isAuthenticated}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onLogin={loginTelegram}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopy}
          onToggleFavorite={handleToggleFavorite}
          onNavigatePrompts={() => navigate("/prompts")}
        />
      ) : null}

      {path === "/viewed" ? (
        <PromptHistoryScreen
          mode="viewed"
          isAuthenticated={isAuthenticated}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onLogin={loginTelegram}
          onOpenPrompt={openPrompt}
          onCopyPrompt={handleCopy}
          onToggleFavorite={handleToggleFavorite}
          onNavigatePrompts={() => navigate("/prompts")}
        />
      ) : null}
    </>
  );

  const body = error ? (
    <div className="surface-card p-4 text-[var(--red)]">{error}</div>
  ) : (
    <div className={promptsLoading ? "pointer-events-none opacity-70 transition-opacity" : "transition-opacity"}>{content}</div>
  );

  const modals = (
    <>
      <PromptDetailsModal
        prompt={selectedPrompt}
        categories={categories}
        canManage={isAdmin}
        desktopMode
        onClose={closePromptModal}
        onCopy={handleCopy}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeletePrompt}
        onEdit={handleEditPrompt}
        onPublishTelegram={isAdmin ? handlePublishTelegram : undefined}
        onPublishPinterest={isAdmin ? handlePublishPinterest : undefined}
        onShareLinkCopied={() => setToast("Ссылка скопирована")}
        onTagClick={handleSelectTag}
      />
      {isAddModalOpen && isAuthenticated && isAdmin ? (
        <div className="modal-overlay fixed inset-0 z-[75] grid place-items-center p-4">
          <div className="modal-panel add-prompt-modal max-h-[90vh] w-full overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--text)]">Новый промпт</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn-ghost-icon h-9 w-9"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
            <Suspense fallback={<div className="skeleton h-64 w-full" />}>
              <PromptForm
                categories={categories}
                user={user!}
                showTelegramPublish={isAdmin}
                onSubmit={handleSavePrompt}
                onCancel={() => setIsAddModalOpen(false)}
              />
            </Suspense>
          </div>
        </div>
      ) : null}
      <AuthRequiredModal open={authRequiredOpen} onClose={() => setAuthRequiredOpen(false)} onLogin={loginTelegram} />
      <TelegramAuthModal
        open={telegramAuthModalOpen}
        botUsername={extractBotUsername()}
        onClose={() => setTelegramAuthModalOpen(false)}
        onAuthSuccess={(telegramUser) => {
          setUser(telegramUser);
          setToast("Успешный вход через Telegram");
          void refreshMe().then(() => loadPrompts());
        }}
      />
      {toast ? <div className="toast fixed bottom-24 right-4 z-[80] lg:bottom-8">{toast}</div> : null}
    </>
  );

  if (loading) {
    return null;
  }

  return (
    <>
      <div className="hidden h-full lg:block">
        <WebLayout
          sidebarOpen={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
          sidebar={
            <Sidebar
              currentPath={path}
              categories={categories}
              activeCategory={activeCategory}
              isAuthenticated={isAuthenticated}
              onNavigate={(route) => {
                navigate(route);
                setSidebarOpen(false);
              }}
              onSelectCategory={setActiveCategory}
              onLogin={loginTelegram}
            />
          }
          topbar={
            <Topbar
              search={search}
              onSearchChange={setSearch}
              user={user}
              canCreate={isAdmin}
              onCreatePrompt={handleCreateClick}
              onLoginTelegram={loginTelegram}
              onOpenSettings={() => navigate("/settings")}
              onLogout={logout}
              onMenuClick={() => setSidebarOpen(true)}
            />
          }
        >
          {body}
        </WebLayout>
      </div>

      <MobileWebShell
        currentPath={path === "/privacy" ? "/settings" : path}
        search={search}
        onSearchChange={setSearch}
        onNavigate={navigate}
        canCreate={isAdmin}
        onCreatePrompt={handleCreateClick}
        headerRight={
          <AuthButton
            user={user}
            onLoginTelegram={loginTelegram}
            onOpenSettings={() => navigate("/settings")}
            onLogout={logout}
          />
        }
      >
        {body}
      </MobileWebShell>

      {modals}
    </>
  );
}
