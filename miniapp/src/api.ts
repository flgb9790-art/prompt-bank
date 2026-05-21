import type { Category, MeResponse, MediaType, Prompt, PromptCreatePayload, TagStat } from "./types";

const configuredBaseUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
const baseUrl = configuredBaseUrl || "";
let authTelegramId: string | null = null;

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
  getPrompts(params?: { search?: string; category?: string; favorite?: boolean; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.favorite !== undefined) searchParams.set("favorite", String(params.favorite));
    if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
    const query = searchParams.toString();
    return request<Prompt[]>(`/api/prompts${query ? `?${query}` : ""}`);
  },
  getPrompt(id: number) {
    return request<Prompt>(`/api/prompts/${id}`);
  },
  createPrompt(payload: PromptCreatePayload) {
    return request<Prompt>("/api/prompts", { method: "POST", body: JSON.stringify(payload) });
  },
  updatePrompt(
    id: number,
    payload: Partial<Omit<PromptCreatePayload, "examples" | "userId">> & {
      coverMediaUrl?: string | null;
      coverMediaType?: MediaType | null;
    }
  ) {
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
  getCategories() {
    return request<Category[]>("/api/categories");
  },
  getTags() {
    return request<TagStat[]>("/api/tags");
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

export function resolveMediaUrl(url: string) {
  if (url.startsWith("http")) {
    return url;
  }
  if (baseUrl) {
    return `${baseUrl}${url}`;
  }
  return `${window.location.origin}${url}`;
}
