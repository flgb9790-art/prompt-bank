import type {
  Category,
  CreatePromptResponse,
  MeResponse,
  Prompt,
  PromptCreatePayload,
  PromptHistoryResponse,
  PromptListResponse,
  PromptUpdatePayload,
  BootstrapResponse,
  PublishTelegramResponse,
  TagStat,
  UserSettings
} from "./types";
import { readReferenceCache, removeReferenceCache, writeReferenceCache } from "./utils/referenceCache";

const configuredBaseUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
const configuredMediaCdn = (import.meta.env.VITE_MEDIA_CDN_URL as string | undefined)?.trim();
const baseUrl = configuredBaseUrl || "";
const mediaCdnBase = configuredMediaCdn?.replace(/\/$/, "") ?? "";
let authTelegramId: string | null = null;

export type GetPromptsParams = {
  search?: string;
  category?: string;
  tag?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
  lite?: boolean;
  sort?: "new" | "old" | "usage";
  /** false — не считать total на сервере (быстрее первый экран). */
  includeTotal?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function setAuthTelegramId(telegramId: string | null) {
  authTelegramId = telegramId;
}

const CATEGORIES_CACHE_KEY = "prompt-bank-categories";
const TAGS_CACHE_KEY = "prompt-bank-tags";

const promptRequests = new Map<number, Promise<Prompt>>();
const promptCache = new Map<number, Prompt>();

export function invalidatePromptCache(id?: number) {
  if (typeof id === "number") {
    promptCache.delete(id);
    return;
  }
  promptCache.clear();
}

export function invalidateReferenceCaches() {
  removeReferenceCache(CATEGORIES_CACHE_KEY);
  removeReferenceCache(TAGS_CACHE_KEY);
}

function buildAuthHeader() {
  return authTelegramId ? ({ "x-telegram-id": authTelegramId } as Record<string, string>) : ({} as Record<string, string>);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(buildAuthHeader())) {
    headers.set(key, value);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...init
  });
  if (!response.ok) {
    let code: string | undefined;
    let message = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      code = payload.error;
      message = payload.message ?? payload.error ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message, code);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  bootstrap(promptLimit = 25) {
    const query = promptLimit ? `?promptLimit=${promptLimit}` : "";
    return request<BootstrapResponse>(`/api/bootstrap${query}`);
  },
  getMe() {
    return request<MeResponse>("/api/me");
  },
  getPrompts(params?: GetPromptsParams) {
    const query = buildPromptsQueryString(params);
    return request<PromptListResponse>(`/api/prompts${query ? `?${query}` : ""}`);
  },
  getPrompt(id: number) {
    const cached = promptCache.get(id);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = promptRequests.get(id);
    if (existing) return existing;

    const pending = request<Prompt>(`/api/prompts/${id}`)
      .then((prompt) => {
        promptCache.set(id, prompt);
        return prompt;
      })
      .finally(() => {
        promptRequests.delete(id);
      });
    promptRequests.set(id, pending);
    return pending;
  },
  prefetchPrompt(id: number) {
    void api.getPrompt(id).catch(() => undefined);
  },
  createPrompt(payload: PromptCreatePayload) {
    return request<CreatePromptResponse>("/api/prompts", { method: "POST", body: JSON.stringify(payload) }).then((prompt) => {
      promptCache.set(prompt.id, prompt);
      return prompt;
    });
  },
  publishPromptToTelegram(promptId: number) {
    return request<PublishTelegramResponse>(`/api/admin/prompts/${promptId}/publish-telegram`, {
      method: "POST"
    }).then((result) => {
      const cached = promptCache.get(promptId);
      if (cached && result.telegramPublication) {
        promptCache.set(promptId, {
          ...cached,
          telegramPublished: result.status === "published",
          telegramPublication: result.telegramPublication
        });
      }
      return result;
    });
  },
  updatePrompt(id: number, payload: PromptUpdatePayload) {
    return request<Prompt>(`/api/prompts/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((prompt) => {
      promptCache.set(id, prompt);
      return prompt;
    });
  },
  deletePrompt(id: number) {
    invalidatePromptCache(id);
    return request<void>(`/api/prompts/${id}`, { method: "DELETE" });
  },
  toggleFavorite(id: number) {
    return request<Prompt>(`/api/prompts/${id}/favorite`, { method: "POST" });
  },
  increaseUsage(id: number) {
    return request<Prompt>(`/api/prompts/${id}/usage`, { method: "POST" });
  },
  recordView(id: number, source: "web" | "miniapp" = "web") {
    return request<{ ok: boolean; recorded: boolean }>(`/api/prompts/${id}/view`, {
      method: "POST",
      body: JSON.stringify({ source })
    });
  },
  recordCopy(id: number, source: "web" | "miniapp" = "web") {
    return request<{ ok: boolean; recorded: boolean; prompt?: Prompt }>(`/api/prompts/${id}/copy`, {
      method: "POST",
      body: JSON.stringify({ source })
    });
  },
  getUserStats() {
    return request<NonNullable<MeResponse["stats"]>>("/api/me/stats");
  },
  getViewedPrompts(limit = 30, offset = 0) {
    return request<PromptHistoryResponse>(`/api/me/viewed-prompts?limit=${limit}&offset=${offset}`);
  },
  getCopiedPrompts(limit = 30, offset = 0) {
    return request<PromptHistoryResponse>(`/api/me/copied-prompts?limit=${limit}&offset=${offset}`);
  },
  clearViewedPrompts() {
    return request<void>("/api/me/viewed-prompts", { method: "DELETE" });
  },
  clearCopiedPrompts() {
    return request<void>("/api/me/copied-prompts", { method: "DELETE" });
  },
  updateSettings(payload: Partial<UserSettings>) {
    return request<UserSettings>("/api/me/settings", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  async getCategories() {
    const cached = readReferenceCache<Category[]>(CATEGORIES_CACHE_KEY);
    if (cached?.length) {
      return cached;
    }
    const fresh = await request<Category[]>("/api/categories");
    writeReferenceCache(CATEGORIES_CACHE_KEY, fresh);
    return fresh;
  },
  async getTags() {
    const cached = readReferenceCache<TagStat[]>(TAGS_CACHE_KEY);
    if (cached) {
      return cached;
    }
    const fresh = await request<TagStat[]>("/api/tags");
    writeReferenceCache(TAGS_CACHE_KEY, fresh);
    return fresh;
  },
  addExample(promptId: number, payload: { url: string; type: "image" | "video"; originalName?: string }) {
    return request(`/api/prompts/${promptId}/examples`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  removeExample(exampleId: number) {
    return request<void>(`/api/examples/${exampleId}`, { method: "DELETE" });
  },
  async upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      body,
      headers: buildAuthHeader()
    });
    if (!response.ok) {
      let code: string | undefined;
      let message = "Upload failed";
      try {
        const payload = (await response.json()) as { error?: string; message?: string };
        code = payload.error;
        message = payload.message ?? payload.error ?? message;
      } catch {
        // ignore parse errors
      }
      throw new ApiError(response.status, message, code);
    }
    return response.json() as Promise<{ url: string; type: "image" | "video"; originalName?: string }>;
  }
};

export function buildPromptsQueryString(params?: GetPromptsParams) {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.category) searchParams.set("category", params.category);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.favorite !== undefined) searchParams.set("favorite", String(params.favorite));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.lite) searchParams.set("lite", "1");
  if (params.includeTotal === false) searchParams.set("total", "0");
  return searchParams.toString();
}

function withMediaOrigin(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  if (mediaCdnBase) {
    return `${mediaCdnBase}${path}`;
  }
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }
  return `${window.location.origin}${path}`;
}

export function resolveMediaUrl(url: string) {
  return withMediaOrigin(url);
}

/** Превью для карточек списка (WebP ~420px). При отсутствии thumb — полный URL. */
export function resolveCardMediaUrl(url: string, type: "image" | "video") {
  if (type !== "image") {
    return resolveMediaUrl(url);
  }

  const full = resolveMediaUrl(url);
  const match = full.match(/\/images\/([^/?#]+)$/i);
  if (!match) {
    return full;
  }

  const thumbName = `${match[1].replace(/\.[^.]+$/i, "")}.webp`;
  return full.replace(/\/images\/[^/?#]+$/i, `/images/thumbs/${thumbName}`);
}
