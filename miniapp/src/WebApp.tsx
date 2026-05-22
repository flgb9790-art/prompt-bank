import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Heart, Layers, Sparkles, X } from "lucide-react";
import { api, ApiError, setAuthTelegramId } from "./api";
import type { Category, Prompt, PromptCreatePayload, TagStat, TelegramUser } from "./types";
import type { PromptEditPayload } from "./components/PromptDetailsModal";
import { PromptDetailsModal } from "./components/PromptDetailsModal";
import { PromptForm } from "./components/PromptForm";
import { AuthRequiredModal } from "./components/web/AuthRequiredModal";
import { PromptGrid } from "./components/web/PromptGrid";
import { Sidebar } from "./components/web/Sidebar";
import { SortSelect } from "./components/web/SortSelect";
import { StatsCard } from "./components/web/StatsCard";
import { TelegramAuthModal } from "./components/web/TelegramAuthModal";
import { Topbar } from "./components/web/Topbar";
import { Pagination } from "./components/web/Pagination";
import { ViewToggle } from "./components/web/ViewToggle";
import { WebLayout } from "./components/web/WebLayout";
import { MobileWebShell } from "./components/web/MobileWebShell";
import { AuthButton } from "./components/web/AuthButton";
import { clearPromptShareUrl, parsePromptIdFromLocation, setPromptShareUrl } from "./utils/promptShare";
import { mergePromptUpdate } from "./utils/mergePrompt";

type SortValue = "new" | "old" | "usage";
type ViewMode = "grid" | "list";
type RoutePath = "/" | "/prompts" | "/favorites" | "/categories" | "/tags" | "/recent" | "/settings";

const storageKey = "prompt-bank-web-auth";
const PROMPTS_PER_PAGE = 12;
const PROMPTS_FETCH_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 350;
const telegramAuthUrl = (import.meta.env.VITE_TELEGRAM_AUTH_URL as string | undefined)?.trim();
const telegramBotUsernameFromEnv = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim();

function getRoutePath(pathname: string): RoutePath {
  const allowed: RoutePath[] = ["/", "/prompts", "/favorites", "/categories", "/tags", "/recent", "/settings"];
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
  const [promptSearch, setPromptSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>();
  const [activeTag, setActiveTag] = useState<string>();
  const [sort, setSort] = useState<SortValue>("new");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);
  const [telegramAuthModalOpen, setTelegramAuthModalOpen] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(parseSavedUser());
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const isAuthenticated = Boolean(user);
  const bootstrappedRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
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

  const filteredPrompts = useMemo(() => {
    const low = promptSearch.trim().toLowerCase();
    const byCategory = activeCategory
      ? prompts.filter((prompt) => prompt.category.slug === activeCategory)
      : [...prompts];
    const byTag = activeTag
      ? byCategory.filter((prompt) => prompt.keywords.some((item) => item.keyword.name === activeTag))
      : byCategory;
    const bySearch = low
      ? byTag.filter((prompt) => {
          const text = `${prompt.title} ${prompt.content} ${prompt.category.name} ${prompt.keywords.map((k) => k.keyword.name).join(" ")}`.toLowerCase();
          return text.includes(low);
        })
      : byTag;
    if (sort === "new") bySearch.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
    if (sort === "old") bySearch.sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
    if (sort === "usage") bySearch.sort((a, b) => b.usageCount - a.usageCount);
    return bySearch;
  }, [activeCategory, activeTag, promptSearch, prompts, sort]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeTag, promptSearch, sort, path]);

  const categoryCounts = useMemo(() => {
    return prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.category.slug] = (acc[prompt.category.slug] ?? 0) + 1;
      return acc;
    }, {});
  }, [prompts]);

  const categoriesWithPrompts = useMemo(
    () => categories.filter((category) => (categoryCounts[category.slug] ?? 0) > 0),
    [categories, categoryCounts]
  );

  const tagsWithPrompts = useMemo(() => tags.filter((tag) => tag.count > 0), [tags]);

  const stats = useMemo(
    () => ({
      total: prompts.length,
      favorites: prompts.filter((prompt) => prompt.isFavorite).length,
      categories: categories.length,
      usage: prompts.reduce((sum, prompt) => sum + prompt.usageCount, 0)
    }),
    [categories.length, prompts]
  );

  const userPromptsCount = useMemo(() => {
    if (!dbUserId) return 0;
    return prompts.filter((prompt) => prompt.userId === dbUserId).length;
  }, [dbUserId, prompts]);

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
    } catch (err) {
      setError("Не удалось загрузить данные.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrompts(searchValue = search) {
    setPromptsLoading(true);
    try {
      const promptsData = await api.getPrompts({
        limit: PROMPTS_FETCH_LIMIT,
        search: searchValue.trim() || undefined,
        lite: true
      });
      setPrompts(
        promptsData.map((prompt) => ({
          ...prompt,
          examples: prompt.examples ?? []
        }))
      );
    } catch (err) {
      setError("Не удалось загрузить промпты.");
      console.error(err);
    } finally {
      setPromptsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadBootstrap();
      bootstrappedRef.current = true;
      await loadPrompts();
    })();
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const timer = setTimeout(() => {
      void loadPrompts(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

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
    try {
      const full = await api.getPrompt(promptId);
      await openPrompt(full, replaceUrl);
    } catch (err) {
      console.error(err);
      clearPromptShareUrl();
    }
  }

  async function openPrompt(prompt: Prompt, replaceUrl = false) {
    setSelectedPrompt({ ...prompt, examples: prompt.examples ?? [] });
    setPromptShareUrl(prompt.id, replaceUrl);
    try {
      const full = await api.getPrompt(prompt.id);
      setSelectedPrompt(full);
    } catch (err) {
      console.error(err);
    }
  }

  function closePromptModal() {
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
  }

  useEffect(() => {
    const onPopState = () => {
      setPath(getRoutePath(window.location.pathname));
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

  function navigate(nextPath: RoutePath) {
    if (window.location.pathname !== nextPath) {
      const url = new URL(window.location.href);
      url.pathname = nextPath;
      url.searchParams.delete("prompt");
      window.history.pushState({}, "", `${url.pathname}${url.search}`);
      setSelectedPrompt(undefined);
    }
    setActiveTag(undefined);
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
    await navigator.clipboard.writeText(prompt.content);
    setToast("Промпт скопирован");
    setPrompts((prev) =>
      prev.map((item) =>
        item.id === prompt.id ? { ...item, usageCount: item.usageCount + 1 } : item
      )
    );
    void api.increaseUsage(prompt.id).catch(console.error);
  }

  async function handleToggleFavorite(id: number) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    const previous = prompts.find((item) => item.id === id);
    if (!previous) return;

    const optimistic = { ...previous, isFavorite: !previous.isFavorite };
    setPrompts((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(optimistic);
    }

    try {
      const updated = await api.toggleFavorite(id);
      upsertPromptInList(updated);
      if (selectedPrompt?.id === id) {
        setSelectedPrompt((current) => (current ? mergePromptUpdate(current, updated) : updated));
      }
    } catch (err) {
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
      closePromptModal();
      setPrompts((prev) => prev.filter((item) => item.id !== id));
      setToast("Промпт удален");
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
      const fresh = await api.getPrompt(promptId);
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
      const created = await api.createPrompt(payload);
      upsertPromptInList(created);
      setToast("Промпт сохранен");
      setIsAddModalOpen(false);
      void api.getTags().then(setTags).catch(console.error);
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
      }
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
    setToast("Вы вышли");
    void loadPrompts();
  }

  function handleSelectTag(tagName: string) {
    setSelectedPrompt(undefined);
    clearPromptShareUrl();
    setActiveTag(tagName);
    setActiveCategory(undefined);
    setPromptSearch("");
    setPage(1);
    navigate("/prompts");
  }

  function renderPromptList(list: Prompt[]) {
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
      </>
    );
  }

  const content = (
    <>
      {path === "/" ? (
        <div>
          <div className="welcome-block">
            <h1 className="welcome-title lg:text-[24px]">Добро пожаловать! 👋</h1>
            <p className="welcome-subtitle">Здесь хранятся все ваши промпты. Легко находите, копируйте и улучшайте.</p>
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
              <div className="hidden items-center gap-3 lg:flex">
                <SortSelect value={sort} onChange={setSort} />
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            </div>
          </div>

          {renderPromptList(filteredPrompts)}
        </div>
      ) : null}

      {path === "/prompts" ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Все промпты</h2>
            <div className="flex items-center gap-2">
              <SortSelect value={sort} onChange={setSort} />
              <ViewToggle value={viewMode} onChange={setViewMode} />
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
          {renderPromptList(filteredPrompts)}
        </div>
      ) : null}

      {path === "/favorites" ? (
        isAuthenticated ? (
          renderPromptList(filteredPrompts.filter((prompt) => prompt.isFavorite))
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
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{categoryCounts[category.slug] ?? 0}</p>
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
                className={`chip ${activeTag === tag.name ? "active" : ""}`}
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
        renderPromptList([...prompts].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))))
      ) : null}

      {path === "/settings" ? (
        isAuthenticated ? (
          <div className="surface-card max-w-xl p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Настройки</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Профиль Telegram: {user?.username ? `@${user.username}` : user?.first_name}</p>
            <p className="text-sm text-[var(--muted)]">Добавленных промптов: {userPromptsCount}</p>
            <button type="button" className="btn-secondary mt-4 text-[var(--red)]" onClick={logout}>
              Выйти
            </button>
          </div>
        ) : (
          <div className="surface-card empty-state">
            <p className="text-base font-medium text-[var(--text)]">Нужно войти для доступа к настройкам.</p>
          </div>
        )
      ) : null}
    </>
  );

  const body = loading ? (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="skeleton h-28" />
      ))}
    </div>
  ) : error ? (
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
            <PromptForm categories={categories} user={user!} onSubmit={handleSavePrompt} onCancel={() => setIsAddModalOpen(false)} />
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
          void loadBootstrap().then(() => loadPrompts());
        }}
      />
      {toast ? <div className="toast fixed bottom-24 right-4 z-[80] lg:bottom-8">{toast}</div> : null}
    </>
  );

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
              categoryCounts={categoryCounts}
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
        currentPath={path}
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
