import { useEffect, useMemo, useState } from "react";
import { BarChart3, Heart, Layers, Sparkles } from "lucide-react";
import { api, ApiError, setAuthTelegramId } from "./api";
import type { Category, Prompt, PromptCreatePayload, TagStat, TelegramUser } from "./types";
import { PromptDetailsModal } from "./components/PromptDetailsModal";
import { PromptForm } from "./components/PromptForm";
import { AuthRequiredModal } from "./components/web/AuthRequiredModal";
import { PromptGrid } from "./components/web/PromptGrid";
import { Sidebar } from "./components/web/Sidebar";
import { SortSelect } from "./components/web/SortSelect";
import { StatsCard } from "./components/web/StatsCard";
import { TelegramAuthModal } from "./components/web/TelegramAuthModal";
import { Topbar } from "./components/web/Topbar";
import { ViewToggle } from "./components/web/ViewToggle";
import { WebLayout } from "./components/web/WebLayout";

type SortValue = "new" | "old" | "usage";
type ViewMode = "grid" | "list";
type RoutePath = "/" | "/prompts" | "/favorites" | "/categories" | "/tags" | "/recent" | "/settings";

const storageKey = "prompt-bank-web-auth";
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
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [authRequiredOpen, setAuthRequiredOpen] = useState(false);
  const [telegramAuthModalOpen, setTelegramAuthModalOpen] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(parseSavedUser());
  const [isAdmin, setIsAdmin] = useState(false);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    const onPopState = () => setPath(getRoutePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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

  const categoryCounts = useMemo(() => {
    return prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.category.slug] = (acc[prompt.category.slug] ?? 0) + 1;
      return acc;
    }, {});
  }, [prompts]);

  const stats = useMemo(
    () => ({
      total: prompts.length,
      favorites: prompts.filter((prompt) => prompt.isFavorite).length,
      categories: categories.length,
      usage: prompts.reduce((sum, prompt) => sum + prompt.usageCount, 0)
    }),
    [categories.length, prompts]
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [promptsData, categoriesData, tagsData, me] = await Promise.all([
        api.getPrompts({ limit: 300, search }),
        api.getCategories(),
        api.getTags(),
        api.getMe()
      ]);
      setPrompts(promptsData);
      setCategories(categoriesData);
      setTags(tagsData);
      setIsAdmin(Boolean(me.isAdmin && me.authenticated));
    } catch (err) {
      setError("Не удалось загрузить данные.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search]);

  function navigate(nextPath: RoutePath) {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
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
    await navigator.clipboard.writeText(prompt.content);
    setToast("Промпт скопирован");
    await api.increaseUsage(prompt.id);
    await loadData();
  }

  async function handleToggleFavorite(id: number) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    try {
      await api.toggleFavorite(id);
      await loadData();
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
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
      setSelectedPrompt(undefined);
      setToast("Промпт удален");
      await loadData();
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
      }
    }
  }

  async function handleEditPrompt(promptId: number, data: { title: string; content: string; categoryId: number }) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    try {
      const updated = await api.updatePrompt(promptId, data);
      setSelectedPrompt(updated);
      setToast("Промпт сохранен");
      await loadData();
    } catch (err) {
      if (!handleUnauthorized(err)) {
        setToast("Ошибка загрузки");
      }
    }
  }

  async function handleSavePrompt(payload: PromptCreatePayload) {
    if (!isAuthenticated) {
      askAuth();
      return;
    }
    try {
      await api.createPrompt(payload);
      setToast("Промпт сохранен");
      setIsAddModalOpen(false);
      await loadData();
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
    setIsAddModalOpen(true);
  }

  function loginTelegram() {
    setAuthRequiredOpen(false);
    setTelegramAuthModalOpen(true);
  }

  function logout() {
    setUser(null);
    setIsAdmin(false);
    setToast("Вы вышли");
    loadData();
  }

  const content = (
    <>
      {path === "/" ? (
        <div>
          <h1 className="text-2xl font-bold">Добро пожаловать! 👋</h1>
          <p className="mt-1 text-[15px] text-[#a4adbd]">Здесь хранятся все ваши промпты. Легко находите, копируйте и улучшайте.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard icon={<Layers size={22} />} label="Всего промптов" value={stats.total} iconBg="bg-indigo-500/25 text-indigo-200" />
            <StatsCard icon={<Heart size={22} />} label="Избранных" value={isAuthenticated ? stats.favorites : 0} iconBg="bg-pink-500/20 text-pink-200" />
            <StatsCard icon={<Sparkles size={22} />} label="Категории" value={stats.categories} iconBg="bg-cyan-500/20 text-cyan-200" />
            <StatsCard icon={<BarChart3 size={22} />} label="Использований" value={stats.usage} iconBg="bg-violet-500/25 text-violet-200" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Недавние промпты</h2>
            <div className="flex flex-wrap gap-2">
              <button className={`chip ${!activeCategory ? "active" : ""}`} onClick={() => setActiveCategory(undefined)} type="button">
                Все
              </button>
              {categories.slice(0, 6).map((category) => (
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
            <div className="flex items-center gap-2">
              <SortSelect value={sort} onChange={setSort} />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          <PromptGrid prompts={filteredPrompts.slice(0, 18)} view={viewMode} onOpenPrompt={setSelectedPrompt} onCopyPrompt={handleCopy} onToggleFavorite={handleToggleFavorite} />
        </div>
      ) : null}

      {path === "/prompts" ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Все промпты</h2>
            <div className="flex items-center gap-2">
              <SortSelect value={sort} onChange={setSort} />
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`chip ${!activeCategory ? "active" : ""}`} onClick={() => setActiveCategory(undefined)} type="button">
              Все
            </button>
            {categories.map((category) => (
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
                #{activeTag} ×
              </button>
            ) : null}
          </div>
          <PromptGrid prompts={filteredPrompts} view={viewMode} onOpenPrompt={setSelectedPrompt} onCopyPrompt={handleCopy} onToggleFavorite={handleToggleFavorite} />
        </div>
      ) : null}

      {path === "/favorites" ? (
        isAuthenticated ? (
          <PromptGrid
            prompts={filteredPrompts.filter((prompt) => prompt.isFavorite)}
            view={viewMode}
            onOpenPrompt={setSelectedPrompt}
            onCopyPrompt={handleCopy}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          <div className="glass-card empty-state mt-5">
            <p className="text-base font-medium text-slate-100">Войдите через Telegram, чтобы сохранять промпты в избранное.</p>
          </div>
        )
      ) : null}

      {path === "/categories" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div key={category.id} className="glass-card p-4">
              <p className="text-sm text-slate-300">{category.icon ?? "📂"} {category.name}</p>
              <p className="mt-2 text-2xl font-semibold">{categoryCounts[category.slug] ?? 0}</p>
            </div>
          ))}
        </div>
      ) : null}

      {path === "/tags" ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`chip ${activeTag === tag.name ? "active" : ""}`}
              onClick={() => {
                setActiveTag(tag.name);
                setPromptSearch(tag.name);
                navigate("/prompts");
              }}
            >
              #{tag.name} ({tag.count})
            </button>
          ))}
        </div>
      ) : null}

      {path === "/recent" ? (
        <PromptGrid prompts={[...prompts].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))).slice(0, 30)} view={viewMode} onOpenPrompt={setSelectedPrompt} onCopyPrompt={handleCopy} onToggleFavorite={handleToggleFavorite} />
      ) : null}

      {path === "/settings" ? (
        isAuthenticated ? (
          <div className="glass-card max-w-xl p-5">
            <h2 className="text-lg font-semibold">Настройки</h2>
            <p className="mt-2 text-sm text-muted">Профиль Telegram: {user?.username ? `@${user.username}` : user?.first_name}</p>
            <p className="text-sm text-muted">Добавленных промптов: {prompts.filter((prompt) => String(prompt.userId) === String(user?.id)).length}</p>
            <button type="button" className="mt-4 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-300" onClick={logout}>
              Выйти
            </button>
          </div>
        ) : (
          <div className="glass-card empty-state">
            <p className="text-base font-medium">Нужно войти для доступа к настройкам.</p>
          </div>
        )
      ) : null}
    </>
  );

  return (
    <WebLayout
      sidebar={
        <Sidebar
          currentPath={path}
          categories={categories}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          isAuthenticated={isAuthenticated}
          onNavigate={navigate}
          onSelectCategory={setActiveCategory}
          onLogin={loginTelegram}
        />
      }
      topbar={
        <Topbar
          search={search}
          onSearchChange={setSearch}
          user={user}
          onCreatePrompt={handleCreateClick}
          onLoginTelegram={loginTelegram}
          onOpenSettings={() => navigate("/settings")}
          onLogout={logout}
        />
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="glass-card skeleton h-28" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-4 text-red-300">{error}</div>
      ) : (
        content
      )}

      <PromptDetailsModal
        prompt={selectedPrompt}
        categories={categories}
        canManage={isAdmin}
        desktopMode
        onClose={() => setSelectedPrompt(undefined)}
        onCopy={handleCopy}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeletePrompt}
        onEdit={handleEditPrompt}
      />

      {isAddModalOpen && isAuthenticated ? (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/65 p-4">
          <div className="w-full max-h-[90vh] max-w-[720px] overflow-y-auto rounded-[20px] border border-white/10 bg-[#0b1020] p-5">
            <h3 className="mb-4 text-lg font-semibold">Новый промпт</h3>
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
          loadData();
        }}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-24 right-4 z-[80] rounded-xl border border-white/10 bg-[#0f172a]/95 px-4 py-2 text-sm shadow-xl">
          {toast}
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#070b16]/92 px-3 py-2 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {[
            { label: "Главная", route: "/" as RoutePath },
            { label: "Промпты", route: "/prompts" as RoutePath },
            { label: "Поиск", route: "/tags" as RoutePath },
            { label: "Избранное", route: "/favorites" as RoutePath },
            { label: "Профиль", route: "/settings" as RoutePath }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.route)}
              className={`rounded-xl px-2 py-2 text-[11px] ${path === item.route ? "bg-[var(--primary)]/25 text-white" : "text-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </WebLayout>
  );
}
