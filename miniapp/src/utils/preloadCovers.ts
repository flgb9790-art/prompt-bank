import { resolveCardMediaUrl } from "../api";
import type { Prompt } from "../types";
import { resolvePostMedia } from "./resolvePostMedia";

export function preloadPromptCovers(prompts: Prompt[], limit = 12) {
  if (typeof window === "undefined") return;

  for (const prompt of prompts.slice(0, limit)) {
    const media = resolvePostMedia(prompt);
    if (!media || media.type !== "image") continue;
    const img = new Image();
    img.decoding = "async";
    img.src = resolveCardMediaUrl(media.url, "image");
  }
}
