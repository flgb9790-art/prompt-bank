import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { api, ApiError, invalidateReferenceCaches, confirmPinterestPublication, setAuthTelegramId } from "./api";
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
import { SortSelect } from "./components/web/SortSelect";
import { TelegramAuthModal } from "./components/web/TelegramAuthModal";
import { Topbar } from "./components/web/Topbar";
import { Pagination } from "./components/web/Pagination";
import { ViewModeSwitcher } from "./components/web/ViewModeSwitcher";
import { WebLayout } from "./components/web/WebLayout";
import { MobileWebShell } from "./components/web/MobileWebShell";
import { useMediaMinWidth } from "./hooks/useMediaMinWidth";
import {
  clearPromptShareUrl,
  migrateLegacyPromptQueryToPath,
  parsePromptIdFromLocation,
  parsePromptIdFromPathname,
  setPromptShareUrl
} from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";
import { normalizeTagName } from "./utils/tagFilter";
import type { GetPromptsParams } from "./api";
import { prefetchPromptsPage, takePrefetchedPromptsPage, clearPromptsPrefetch } from "./utils/promptsPrefetch";
import { mergePromptPages } from "./utils/mergePromptPages";
import { useWebSeo } from "./hooks/useWebSeo";
import {
  ensurePromptWithContent,
  hasFullPromptContent,
  hasFullPromptDetails,
  mapPromptsFromApi,
  withPromptDetails
} from "./utils/promptContent";
import {
  WEB_PINTEREST_PAGE_SIZE_DESKTOP,
  WEB_PINTEREST_PAGE_SIZE_MOBILE,
  readViewMode,
  saveViewMode,
  type ViewMode
} from "./utils/viewMode";
import { persistPublicationTemplatesFromPrompt } from "./utils/publicationTemplatesStorage";
import { fetchWebBootstrapOnce } from "./utils/webBootstrapOnce";
import { FavoriteIdsProvider } from "./context/FavoriteIdsContext";
import {
  applyFavoriteIdsToList,
  favoriteIdsFromCache,
  favoriteIdsFromPrompts,
  favoritesTotalFromCache,
  hydrateFavoritesFromBootstrap
} from "./utils/promptFavorite";

type SortValue = "new" | "old" | "usage";
type RoutePath = "/" | "/prompts" | "/favorites" | "/categories" | "/tags" | "/recent" | "/settings" | "/copied" | "/viewed" | "/privacy";

const storageKey = "prompt-bank-web-auth";
const CATEGORIES_CACHE_KEY = "prompt-bank-categories";
const TAGS_CACHE_KEY = "prompt-bank-tags";
const PROMPTS_PER_PAGE = 12;
const SEARCH_DEBOUNCE_MS = 350;
const telegramAuthUrl = (import.meta.env.VITE_TELEGRAM_AUTH_URL as string | undefined)?.trim();
const telegramBotUsernameFromEnv = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim();

function getRoutePath(pathname: string): RoutePath {
  if (parsePromptIdFromPathname(pathname)) return "/";
  if (["/prompts", "/categories", "/tags", "/recent"].includes(pathname)) return "/";
  const allowed: RoutePath[] = ["/", "/prompts", "/favorites", "/categories", "/tags", "/recent", "/settings", "/copied", "/viewed", "/privacy"];
  return allowed.includes(pathname as RoutePath) ? (pathname as RoutePath) : "/";
}

function parseSavedUser(): TelegramUser | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TelegramUser;
    return parsed?.id && parsed.hash && parsed.auth_date && Date.now() / 1000 - parsed.auth_date < 86400 ? parsed : null;
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode("pinterest"));
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptsTotal, setPromptsTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const promptListRequestRef = useRef(0);
  const [favoritePrompts, setFavoritePrompts] = useState<Prompt[]>([]);
  const [favoritesTotal, setFavoritesTotal] = useState(() => favoritesTotalFromCache());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => favoriteIdsFromCache());
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
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
  const isDesktopLayout = useMediaMinWidth(1024);
  const webPinterestPageSize = path === "/" && viewMode !== "pinterest" ? PROMPTS_PER_PAGE : isDesktopLayout ? WEB_PINTEREST_PAGE_SIZE_DESKTOP : WEB_PINTEREST_PAGE_SIZE_MOBILE;

  function scrollWebToTop() {
    document.querySelector<HTMLElement>(".prompt-scroll-root")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    scrollWebToTop();
  }
  const isAuthenticated = Boolean(user);
  const bootstrappedRef = useRef(false);
  const [appBootstrapped, setAppBootstrapped] = useState(false);
  const deepLinkHandledRef = useRef(false);
  const filterLoadReadyRef = useRef(false);
  const openPromptRequestRef = useRef(0);


  useEffect(() => {
    document.documentElement.classList.add("web-mode");
    migrateLegacyPromptQueryToPath();
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
    if (path === "/settings" && user) {
      void refreshMe();
    }
  }, [path, user?.id]);

  const categoriesWithPrompts = useMemo(
    () => categories.filter((category) => (category.promptCount ?? 0) > 0),
    [categories]
  );

  const tagsWithPrompts = useMemo(() => tags.filter((tag) => tag.count > 0), [tags]);

  useWebSeo({
    path,
    activeTag,
    activeCategory,
    categories,
    selectedPrompt,
    isAddModalOpen
  });

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

  function handleViewModeChange(next: ViewMode) {
    setViewMode(next);
    saveViewMode(next);
  }

  function getFetchLimit() {
    return webPinterestPageSize;
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

  function scheduleWebPrefetch(total: number) {
    const nextOffset = page * webPinterestPageSize;
    if (nextOffset >= total) return;
    runDeferred(() => { void prefetchPromptsPage(buildPromptsQuery(nextOffset)).catch(() => undefined); });
  }

  async function loadPrompts() {
    const requestId = ++promptListRequestRef.current;
    setPromptsLoading(true);
    setError("");
    try {
      const offset = (page - 1) * webPinterestPageSize;
      const query = buildPromptsQuery(offset);
      const promptsData = await takePrefetchedPromptsPage(query) ?? await api.getPrompts(query);
      if (requestId !== promptListRequestRef.current) return;
      const mapped = applyFavoriteIdsToList(mapPromptsFromApi(promptsData.items), favoriteIdsRef.current);
      setPrompts(mapped);
      setPromptsTotal(promptsData.total);
      scheduleWebPrefetch(promptsData.total);
    } catch (err) {
      if (requestId !== promptListRequestRef.current) return;
      setError("Не удалось загрузить промпты.");
      console.error(err);
    } finally {
      if (requestId === promptListRequestRef.current) setPromptsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError("");
      try {
        const cachedFavorites = readFavoritesCache();
        if (cachedFavorites) {
          applyWebFavoritesHydration(mapPromptsFromApi(cachedFavorites.items), cachedFavorites.total);
        }

        const data = await fetchWebBootstrapOnce();
        if (cancelled) return;

        const bootstrapFavorites = hydrateFavoritesFromBootstrap(data.favorites, data.favoritesTotal);
        if (bootstrapFavorites.items?.length || bootstrapFavorites.total > 0) {
          applyWebFavoritesHydration(bootstrapFavorites.items ?? [], bootstrapFavorites.total);
        } else if (bootstrapFavorites.ids.size) {
          setFavoriteIdsState(bootstrapFavorites.ids);
          setFavoritesTotal(bootstrapFavorites.total);
        }

        if (data.prompts.total >= 0) {
          setPromptsTotal(data.prompts.total);
        }
        setCategories(data.categories);
        writeReferenceCache(CATEGORIES_CACHE_KEY, data.categories);
        setIsAdmin(Boolean(data.me.isAdmin));
        setDbUserId(data.me.user?.id ?? null);

        const canLoadFavorites = Boolean(user?.id ?? data.me.user?.id);
        if (canLoadFavorites) {
          await refreshWebFavorites(false);
        }

        if (cancelled) return;
        bootstrappedRef.current = true;
        setAppBootstrapped(true);

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
    if (!appBootstrapped) return;
    if (!filterLoadReadyRef.current) {
      filterLoadReadyRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (path === "/favorites") return;
      if (path === "/" || path === "/prompts" || path === "/recent") {
        void loadPrompts();
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [appBootstrapped, search, activeCategory, activeTag, sort]);

  useEffect(() => {
    if (!appBootstrapped) return;
    setPage(1);
  }, [appBootstrapped, activeCategory, activeTag, search, sort, path, viewMode, isDesktopLayout]);

  useEffect(() => {
    if (!appBootstrapped) return;
    if (path === "/favorites") {
      if (isAuthenticated) void refreshWebFavorites(true);
      return;
    }
    if (path === "/" || path === "/prompts" || path === "/recent") {
      void loadPrompts();
    }
  }, [appBootstrapped, page, webPinterestPageSize, path, viewMode]);

  useEffect(() => {
    if (!appBootstrapped || !isAuthenticated || path !== "/favorites") return;
    void refreshWebFavorites(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!bootstrappedRef.current || path !== "/recent") return;
    setActiveCategory(undefined);
    setActiveTag(undefined);
    setSearch("");
    setSort("new");
  }, [path]);

  async function refreshWebFavorites(showSpinner: boolean) {
    if (!isAuthenticated) return;
    if (showSpinner) setFavoritesLoading(true);
    const limit = webPinterestPageSize;
    const offset = (page - 1) * webPinterestPageSize;
    try {
      const data = await api.getPrompts({ favorite: true, limit, offset, lite: true, sort });
      const mapped = mapPromptsFromApi(data.items);
      if (page === 1) {
        applyWebFavoritesHydration(mapped, data.total);
      } else {
        setFavoritesTotal(data.total);
        setFavoritePrompts(mapped);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          for (const id of favoriteIdsFromPrompts(mapped)) next.add(id);
          favoriteIdsRef.current = next;
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      if (showSpinner) setToast("Не удалось загрузить избранное");
    } finally {
      if (showSpinner) setFavoritesLoading(false);
    }
  }

  useEffect(() => {
    if (path !== "/favorites" || !isAuthenticated) return;
    void refreshWebFavorites(true);
  }, [path, isAuthenticated, sort]);

  function syncFavoritePrompts(next: Prompt) {
    syncFavoriteId(next.id, next.isFavorite);
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
      setFavoritesTotal((total) => {
        if (!next.isFavorite) return Math.max(0, total - 1);
        return prev.some((item) => item.id === next.id) ? total : total + 1;
      });
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
    clearPromptShareUrl(path);
  }

  useEffect(() => {
    const onPopState = () => {
      const promptId = parsePromptIdFromLocation();
      if (!promptId) {
        setPath(getRoutePath(window.location.pathname));
        openPromptRequestRef.current += 1;
        setSelectedPrompt(undefined);
        return;
      }
      void openPromptById(promptId, true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [prompts]);

  function setFavoriteIdsState(next: Set<number>) {
    favoriteIdsRef.current = next;
    setFavoriteIds(next);
  }

  function syncFavoriteId(promptId: number, isFavorite: boolean) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.add(promptId);
      else next.delete(promptId);
      favoriteIdsRef.current = next;
      return next;
    });
  }

  function reapplyFavoriteIdsToPrompts() {
    setPrompts((prev) => applyFavoriteIdsToList(prev, favoriteIdsRef.current));
  }

  function applyWebFavoritesHydration(items: Prompt[], total: number) {
    const ids = favoriteIdsFromPrompts(items);
    setFavoriteIdsState(ids);
    setFavoritePrompts(items);
    setFavoritesTotal(total);
    writeFavoritesCache(items, total);
    reapplyFavoriteIdsToPrompts();
  }

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
    syncFavoriteId(nextPrompt.id, nextPrompt.isFavorite);
  }

  function patchPromptEverywhere(patch: Prompt) {
    upsertPromptInList(patch);
    syncFavoritePrompts(patch);
    if (selectedPrompt?.id === patch.id) {
      setSelectedPrompt((current) => (current ? mergePromptUpdate(current, patch) : patch));
    }
  }

  function findPromptInLists(id: number) {
    return (
      prompts.find((item) => item.id === id) ??
      favoritePrompts.find((item) => item.id === id) ??
      (selectedPrompt?.id === id ? selectedPrompt : undefined)
    );
  }

  function navigate(nextPath: RoutePath, options?: { keepTag?: boolean }) {
    nextPath = getRoutePath(nextPath);
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
    const previous = findPromptInLists(id);
    if (!previous) return;

    const optimistic = { ...previous, isFavorite: !previous.isFavorite };
    patchPromptEverywhere(optimistic);

    try {
      const updated = await api.toggleFavorite(id);
      patchPromptEverywhere(updated);
    } catch (err) {
      patchPromptEverywhere(previous);
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
      invalidateReferenceCaches(); clearPromptsPrefetch();
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
        content: data.content,
        categoryId: data.categoryId,
        ...(data.coverMediaUrl !== undefined ? { coverMediaUrl: data.coverMediaUrl } : {}),
        ...(data.coverMediaType !== undefined ? { coverMediaType: data.coverMediaType } : {}),
        ...(data.telegramPostTemplate !== undefined
          ? {
              telegramPostTemplate: data.telegramPostTemplate,
              pinterestTitleTemplate: data.pinterestTitleTemplate,
              pinterestDescriptionTemplate: data.pinterestDescriptionTemplate
            }
          : {})
      });
      await Promise.all([
        ...data.removedExampleIds.map((exampleId) => api.removeExample(exampleId)),
        ...data.newExamples.map((example) => api.addExample(promptId, example))
      ]);
      const fresh = withPromptDetails(await api.getPrompt(promptId));
      persistPublicationTemplatesFromPrompt(fresh);
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
      let created = withPromptDetails(await api.createPrompt(payload)) as CreatePromptResponse;
      let confirmedBoard: string | null = null;
      if (created.pinterestPublicationStatus === "awaiting_confirmation" && created.telegramPostUrl) {
        try { confirmedBoard = await confirmPinterestPublication(created); }
        catch (error) {
          created.pinterestPublicationStatus = "failed";
          created.pinterestPublicationError = error instanceof Error ? error.message : "Проверьте подключение Pinterest в настройках.";
        }
      }
      if (confirmedBoard && created.telegramPostUrl) {
        try {
          const result = await api.publishPromptToPinterest(created.id, created.telegramPostUrl, confirmedBoard);
          created = { ...withPromptDetails(await api.getPrompt(created.id, true)),
            telegramPublicationStatus: created.telegramPublicationStatus,
            pinterestPublicationStatus: result.status, pinterestPublicationError: result.error };
        } catch (error) {
          created.pinterestPublicationStatus = "failed";
          created.pinterestPublicationError = error instanceof Error ? error.message : "Не удалось создать пин. Повторите Pinterest в карточке промпта.";
        }
      }
      persistPublicationTemplatesFromPrompt(created);
      invalidateReferenceCaches(); clearPromptsPrefetch();
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
      const fresh = withPromptDetails(await api.getPrompt(promptId, true));
      persistPublicationTemplatesFromPrompt(fresh);
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
      const preview = await api.getPrompt(promptId, true);
      if (!preview.telegramPostUrl) {
        setToast("Пин не создан: сохраните ссылку на Telegram-пост или сначала опубликуйте промпт в Telegram.");
        return;
      }
      const confirmedBoard = await confirmPinterestPublication(preview);
      if (!confirmedBoard) return;
      const result = await api.publishPromptToPinterest(promptId, preview.telegramPostUrl, confirmedBoard);
      const fresh = withPromptDetails(await api.getPrompt(promptId, true));
      persistPublicationTemplatesFromPrompt(fresh);
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
        setToast(err instanceof Error ? err.message : "Публикация в Pinterest не удалась");
      }
    }
  }

  async function handleSaveTelegramPostLink(promptId: number, link: string) {
    const fresh = withPromptDetails(await api.saveTelegramPostLink(promptId, link));
    upsertPromptInList(fresh);
    if (selectedPrompt?.id === promptId) setSelectedPrompt(fresh);
    setToast("Ссылка на Telegram-пост сохранена. Сообщение в канал не отправлялось.");
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
    clearPromptsPrefetch();
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
    if (!list.length && !(isFavorites ? favoritesLoading : promptsLoading)) {
      return <section className="library-empty" role="status">
        <SearchX size={30} aria-hidden />
        <h2>{isFavorites ? "Ваша коллекция начинается здесь" : "Пока ничего не нашлось"}</h2>
        <p>{isFavorites ? "Нажмите на звёздочку у понравившегося промпта — он появится здесь." : "Попробуйте другое слово или сбросьте фильтры, чтобы увидеть всю библиотеку."}</p>
        <button type="button" className="btn-primary" onClick={() => {
          setSearch(""); setActiveCategory(undefined); setActiveTag(undefined); setPage(1);
          if (isFavorites) navigate("/prompts");
        }}>{isFavorites ? "Посмотреть промпты" : "Сбросить поиск и фильтры"}</button>
      </section>;
    }

    const displayView = path === "/" ? viewMode : "pinterest";

    if (displayView === "pinterest") {
      const total = isFavorites ? favoritesTotal : promptsTotal;
      const totalPages = Math.max(1, Math.ceil(total / webPinterestPageSize));
      const currentPage = Math.min(page, totalPages);

      return (
        <>
          <PromptGrid
            prompts={list}
            view="pinterest"
            pinterestLoading={isFavorites ? favoritesLoading : promptsLoading}
            pinterestPageSize={webPinterestPageSize}
            onOpenPrompt={openPrompt}
            onCopyPrompt={handleCopy}
            onToggleFavorite={handleToggleFavorite}
            onTagClick={handleSelectTag}
          />
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={total}
            pageSize={webPinterestPageSize}
            onPageChange={handlePageChange}
          />
        </>
      );
    }

    const total = isFavorites ? favoritesTotal : promptsTotal;
    return <><PromptGrid prompts={list} view={displayView} onOpenPrompt={openPrompt} onCopyPrompt={handleCopy} onToggleFavorite={handleToggleFavorite} onTagClick={handleSelectTag}/><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / webPinterestPageSize))} totalItems={total} pageSize={webPinterestPageSize} onPageChange={handlePageChange}/></>;
  }

  function focusLibrarySearch() {
    navigate("/");
    requestAnimationFrame(() => document.getElementById("library-search")?.focus());
  }
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); focusLibrarySearch();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const content = (
    <>
      {path === "/" ? <>
        <section className="studio-intro">
          <div>
            <h1>От идеи <span>к результату.</span></h1>
            <p className="studio-description">Промпты, с которых хочется начать. Найдите свой — и попробуйте.</p>
          </div>

        </section>
        <section className="studio-discovery" aria-label="Поиск и фильтры">
          <div className="studio-search"><Search size={20} strokeWidth={1.5}/><input id="library-search" type="search" aria-label="Поиск промптов" value={search} placeholder="Что хотите создать?" onChange={event=>setSearch(event.target.value)}/>{search ? <button className="studio-icon" aria-label="Очистить поиск" onClick={()=>setSearch("")}><X size={16}/></button> : <kbd>⌘ / Ctrl K</kbd>}</div>
          <div className="studio-toolbar">
            <div className="studio-results" role="status">{promptsLoading ? "Ищем…" : <><span>{promptsTotal}</span> {search || activeCategory || activeTag ? "найдено" : "промптов для ваших идей"}</>}</div>
            <div className="studio-tools">
              <details className="studio-filter-menu" onKeyDown={event=>{if(event.key === "Escape"){event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}}}><summary><SlidersHorizontal size={15}/>Фильтры{(activeCategory || activeTag) && <i/>}</summary><div className="studio-filter-panel">
                <label htmlFor="library-category">Категория</label><select id="library-category" className="form-select" value={activeCategory || ""} onChange={event=>setActiveCategory(event.target.value || undefined)}><option value="">Все категории</option>{categoriesWithPrompts.map(category=><option key={category.id} value={category.slug}>{category.name}</option>)}</select>
                <label htmlFor="library-tag">Ключевое слово</label><select id="library-tag" className="form-select" value={activeTag || ""} onChange={event=>setActiveTag(event.target.value || undefined)}><option value="">Любое слово</option>{tagsWithPrompts.map(tag=><option key={tag.id} value={normalizeTagName(tag.name)}>{tag.name}</option>)}</select>
                {(activeCategory || activeTag) && <button className="studio-text-button" onClick={()=>{setActiveCategory(undefined);setActiveTag(undefined);}}>Сбросить фильтры</button>}
              </div></details>
              <SortSelect value={sort} onChange={setSort}/>
              <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange}/>
            </div>
          </div>
          {(activeCategory || activeTag) && <div className="studio-applied-filters">{activeCategory && <button onClick={()=>setActiveCategory(undefined)}>{categories.find(category=>category.slug===activeCategory)?.name}<X size={13}/></button>}{activeTag && <button onClick={()=>setActiveTag(undefined)}>{activeTag}<X size={13}/></button>}</div>}
        </section>
        {renderPromptList(prompts)}
      </> : null}

      {path === "/favorites" ? (
        isAuthenticated ? (
          <>
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
            <button type="button" onClick={loginTelegram} className="btn-primary mt-4">Войти через Telegram</button>
          </div>
        )
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
    <div className="library-empty" role="alert"><SearchX size={28} /><h2>Не удалось загрузить данные</h2><p>Проверьте соединение и попробуйте ещё раз.</p><button type="button" className="btn-primary" onClick={() => window.location.reload()}>Повторить загрузку</button></div>
  ) : (
    <div className="library-content" aria-busy={promptsLoading}>{path === "/favorites" && <div className="studio-page-title"><p className="studio-eyebrow">ВАША КОЛЛЕКЦИЯ</p><h1>Избранное</h1><p>То, к чему хочется вернуться.</p></div>}{content}<footer className="studio-footer"><span>Prompt Bank · Место для следующей идеи</span><div><a href="https://t.me/prmpt_bank" target="_blank" rel="noreferrer">Telegram <ArrowUpRight size={12}/></a><button onClick={()=>navigate("/privacy")}>Конфиденциальность</button></div></footer></div>
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
        onSaveTelegramPostLink={isAdmin ? handleSaveTelegramPostLink : undefined}
        onShareLinkCopied={() => setToast("Ссылка скопирована")}
        onTagClick={handleSelectTag}
        showPublicationTemplates={isAdmin}
      />
      {isAddModalOpen && isAuthenticated && isAdmin ? (
        <div className="modal-overlay modal-overlay--add-prompt-fullscreen fixed inset-0 z-[75] flex items-stretch justify-center">
          <div className="modal-panel modal-panel--add-prompt-fullscreen fade-up flex h-full w-full flex-col">
            <div className="prompt-form-modal-header flex shrink-0 items-center justify-between gap-3">
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
            <div className="prompt-form-modal-body min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<div className="skeleton mx-auto mt-8 h-64 w-full max-w-3xl" />}>
                <PromptForm
                  categories={categories}
                  user={user!}
                  showTelegramPublish={isAdmin}
                  layout="webFullscreen"
                  onSubmit={handleSavePrompt}
                  onCancel={() => setIsAddModalOpen(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
      <AuthRequiredModal open={authRequiredOpen} onClose={() => setAuthRequiredOpen(false)} onLogin={loginTelegram} />
      <TelegramAuthModal
        open={telegramAuthModalOpen}
        botUsername={extractBotUsername()}
        onClose={() => setTelegramAuthModalOpen(false)}
        onAuthSuccess={(telegramUser) => {
          localStorage.setItem(storageKey, JSON.stringify(telegramUser));
          setAuthTelegramId(String(telegramUser.id));
          setUser(telegramUser);
          setToast("Успешный вход через Telegram");
          void refreshMe().then(() => loadPrompts());
        }}
      />
      {toast ? (
        <div className="toast toast--over-modal fixed bottom-24 right-4 z-[110] lg:bottom-8" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </>
  );

  if (loading) {
    return null;
  }

  return (
    <FavoriteIdsProvider favoriteIds={favoriteIds}>
    <>
      {isDesktopLayout ? (
        <div className="h-full">
          <WebLayout topbar={<Topbar currentPath={path} onNavigate={navigate} isAuthenticated={isAuthenticated} canCreate={isAdmin} onCreatePrompt={handleCreateClick} onLoginTelegram={loginTelegram} onFocusSearch={focusLibrarySearch}/>}>
            {body}
          </WebLayout>
        </div>
      ) : (
        <MobileWebShell
          currentPath={path === "/privacy" ? "/settings" : path}
          search={search}
          onSearchChange={setSearch}
          onNavigate={navigate}
          canCreate={isAdmin}
          onCreatePrompt={handleCreateClick}
          headerRight={
            !isAuthenticated ? (
              <button type="button" onClick={loginTelegram} className="btn-secondary shrink-0">
                Войти
              </button>
            ) : null
          }
        >
          {body}
        </MobileWebShell>
      )}

      {modals}
    </>
    </FavoriteIdsProvider>
  );
}
