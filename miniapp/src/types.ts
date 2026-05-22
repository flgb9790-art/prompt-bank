export type MediaType = "image" | "video";

export type Category = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  /** Число промптов в категории (с сервера). */
  promptCount?: number;
};

export type Keyword = {
  id: number;
  name: string;
};

export type PromptKeyword = {
  keyword: Keyword;
};

export type MediaExample = {
  id: number;
  promptId: number;
  url: string;
  type: MediaType;
  originalName?: string | null;
};

export type Prompt = {
  id: number;
  userId: number;
  title: string;
  /** Полный текст; отсутствует в lite-списке (см. contentExcerpt). */
  content?: string;
  /** Укороченный текст для карточек в lite-списке. */
  contentExcerpt?: string;
  note?: string | null;
  categoryId: number;
  category: Category;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  isFavorite: boolean;
  usageCount: number;
  keywords: PromptKeyword[];
  examples?: MediaExample[];
  /** Клиентский флаг: полные данные (текст + примеры) уже загружены с API. */
  detailLoaded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptListResponse = {
  items: Prompt[];
  total: number;
};

export type BootstrapResponse = {
  categories: Category[];
  tags: TagStat[];
  me: MeResponse;
  prompts: PromptListResponse;
  favorites: Prompt[];
};

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type PromptCreatePayload = {
  userId: number;
  title: string;
  content: string;
  categoryId: number;
  note?: string;
  coverMediaUrl?: string;
  coverMediaType?: MediaType;
  examples: Array<{ url: string; type: MediaType; originalName?: string }>;
};

export type PromptUpdatePayload = {
  title?: string;
  content?: string;
  categoryId?: number;
  note?: string;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
};

export type MeResponse = {
  authenticated: boolean;
  isAdmin: boolean;
  usageTotal?: number;
  stats?: UserStats;
  settings?: UserSettings;
  user: {
    id: number;
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    createdAt?: string;
  } | null;
};

export type UserSettings = {
  saveViewHistory: boolean;
  saveCopyHistory: boolean;
  createdAt?: string;
};

export type UserStats = {
  favoritesCount: number;
  copiedCount: number;
  viewedCount: number;
  createdPromptsCount: number;
  usageCountTotal: number;
};

export type PromptHistoryItem = {
  id: number;
  viewedAt?: string;
  copiedAt?: string;
  source?: string;
  prompt: Prompt | null;
};

export type PromptHistoryResponse = {
  items: PromptHistoryItem[];
  total: number;
};

export type TagStat = {
  id: number;
  name: string;
  count: number;
};
