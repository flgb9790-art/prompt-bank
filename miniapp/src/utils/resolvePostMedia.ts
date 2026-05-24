import type { MediaType, Prompt } from "../types";

export type PostMedia = {
  url: string;
  type: MediaType;
};

export function resolvePostMedia(prompt: Prompt): PostMedia | null {
  if (prompt.coverMediaUrl && prompt.coverMediaType) {
    return { url: prompt.coverMediaUrl, type: prompt.coverMediaType };
  }

  for (const example of prompt.examples ?? []) {
    if (example.type === "image" || example.type === "video") {
      return { url: example.url, type: example.type };
    }
  }

  return null;
}
