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
  telegramPublished?: boolean;
  telegramPublication?: TelegramPublication | null;
  pinterestPublished?: boolean;
  pinterestPublication?: PinterestPublication | null;
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
  keywords: PromptKeyword[];
  examples?: MediaExample[];
  /** Клиентский флаг: полные данные (текст + примеры) уже загружены с API. */
  detailLoaded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TelegramPublication = {
  id: number;
  promptId: number;
  status: "pending" | "published" | "failed" | string;
  telegramMessageId?: string | null;
  telegramChatId?: string | null;
  error?: string | null;
  postText: string;
  mediaType?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
};

export type PinterestPublication = {
  id: number;
  promptId: number;
  status: "pending" | "published" | "failed" | string;
  pinterestPinId?: string | null;
  pinterestBoardId?: string | null;
  publishedUrl?: string | null;
  error?: string | null;
  title: string;
  description: string;
  destinationLink: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
};

export type CreatePromptResponse = Prompt & {
  telegramPublicationStatus?: "published" | "failed";
  telegramPublicationError?: string;
  pinterestPublicationStatus?: "published" | "failed";
  pinterestPublicationError?: string;
};

export type PublishTelegramResponse = {
  status: "published" | "failed";
  error?: string;
  telegramPublication?: TelegramPublication | null;
};

export type PublishPinterestResponse = {
  status: "published" | "failed";
  error?: string;
  pinterestPublication?: PinterestPublication | null;
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
  photo_url?: string;
};

export type PromptCreatePayload = {
  userId: number;
  content: string;
  categoryId: number;
  coverMediaUrl?: string;
  coverMediaType?: MediaType;
  examples: Array<{ url: string; type: MediaType; originalName?: string }>;
  publishToTelegram?: boolean;
  publishToPinterest?: boolean;
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
};

export type PromptUpdatePayload = {
  content?: string;
  categoryId?: number;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
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
