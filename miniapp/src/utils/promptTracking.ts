import { api } from "../api";

const viewedThisSession = new Set<number>();

export type PromptSource = "web" | "miniapp";

export function resetPromptViewSession() {
  viewedThisSession.clear();
}

export function trackPromptView(promptId: number, source: PromptSource, isAuthenticated: boolean) {
  if (!isAuthenticated || viewedThisSession.has(promptId)) {
    return;
  }
  viewedThisSession.add(promptId);
  void api.recordView(promptId, source).catch(() => undefined);
}

export function recordPromptCopy(promptId: number, source: PromptSource, isAuthenticated: boolean) {
  if (!isAuthenticated) {
    return Promise.resolve();
  }
  return api.recordCopy(promptId, source).catch(() => undefined);
}
