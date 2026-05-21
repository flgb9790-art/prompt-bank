export type MediaType = "image" | "video";

export type Category = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
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
  content: string;
  note?: string | null;
  categoryId: number;
  category: Category;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
  isFavorite: boolean;
  usageCount: number;
  keywords: PromptKeyword[];
  examples: MediaExample[];
  createdAt: string;
  updatedAt: string;
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
  user: {
    id: number;
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export type TagStat = {
  id: number;
  name: string;
  count: number;
};
