import { resolveCardMediaUrl } from "../api";
import type { Prompt } from "../types";

export function preloadPromptCovers(prompts: Prompt[], limit = 4) {
  if (typeof window === "undefined") return;

  for (const prompt of prompts.slice(0, limit)) {
    if (!prompt.coverMediaUrl || prompt.coverMediaType !== "image") continue;
    const img = new Image();
    img.decoding = "async";
    img.src = resolveCardMediaUrl(prompt.coverMediaUrl, "image");
  }
}
