import { api, type GetPromptsParams } from "../api";
import type { PromptListResponse } from "../types";

export function promptsQueryKey(params: GetPromptsParams): string {
  const parts: string[] = [];
  if (params.search) parts.push(`s=${encodeURIComponent(params.search)}`);
  if (params.category) parts.push(`c=${encodeURIComponent(params.category)}`);
  if (params.tag) parts.push(`t=${encodeURIComponent(params.tag)}`);
  if (params.favorite !== undefined) parts.push(`f=${params.favorite}`);
  if (params.limit !== undefined) parts.push(`l=${params.limit}`);
  if (params.offset !== undefined) parts.push(`o=${params.offset}`);
  if (params.lite) parts.push("lite=1");
  if (params.sort) parts.push(`sort=${params.sort}`);
  return parts.join("&") || "default";
}

const inflight = new Map<string, Promise<PromptListResponse>>();

export function prefetchPromptsPage(params: GetPromptsParams) {
  const key = promptsQueryKey(params);
  if (!inflight.has(key)) {
    inflight.set(key, api.getPrompts(params));
  }
  return inflight.get(key)!;
}

export async function takePrefetchedPromptsPage(
  params: GetPromptsParams
): Promise<PromptListResponse | null> {
  const key = promptsQueryKey(params);
  const pending = inflight.get(key);
  if (!pending) return null;
  inflight.delete(key);
  try {
    return await pending;
  } catch {
    return null;
  }
}

export function cancelPromptsPrefetch(params: GetPromptsParams) {
  inflight.delete(promptsQueryKey(params));
}
