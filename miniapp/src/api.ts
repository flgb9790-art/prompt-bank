import type {
  Category,
  MeResponse,
  Prompt,
  PromptCreatePayload,
  PromptListResponse,
  PromptUpdatePayload,
  TagStat
} from "./types";

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
  getMe() {
    return request<MeResponse>("/api/me");
  },
  getPrompts(params?: GetPromptsParams) {
    const query = buildPromptsQueryString(params);
    return request<PromptListResponse>(`/api/prompts${query ? `?${query}` : ""}`);
  },
  getPrompt(id: number) {
    return request<Prompt>(`/api/prompts/${id}`);
  },
  createPrompt(payload: PromptCreatePayload) {
    return request<Prompt>("/api/prompts", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePrompt(id: number, payload: PromptUpdatePayload) {
    return request<Prompt>(`/api/prompts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deletePrompt(id: number) {
    return request<void>(`/api/prompts/${id}`, { method: "DELETE" });
  },
  toggleFavorite(id: number) {
    return request<Prompt>(`/api/prompts/${id}/favorite`, { method: "POST" });
  },
  increaseUsage(id: number) {
    return request<Prompt>(`/api/prompts/${id}/usage`, { method: "POST" });
  },
  async getCategories() {
    const cacheKey = "prompt-bank-categories";
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Category[];
        if (Array.isArray(parsed) && parsed.length) {
          void request<Category[]>("/api/categories")
            .then((fresh) => sessionStorage.setItem(cacheKey, JSON.stringify(fresh)))
            .catch(() => undefined);
          return parsed;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }
    const fresh = await request<Category[]>("/api/categories");
    sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
    return fresh;
  },
  async getTags() {
    const cacheKey = "prompt-bank-tags";
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TagStat[];
        if (Array.isArray(parsed)) {
          void request<TagStat[]>("/api/tags")
            .then((fresh) => sessionStorage.setItem(cacheKey, JSON.stringify(fresh)))
            .catch(() => undefined);
          return parsed;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }
    const fresh = await request<TagStat[]>("/api/tags");
    sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
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
