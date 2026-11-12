import type { CorsOptions } from "cors";

export function createApiCorsOptions(urls: string[], development = false): CorsOptions {
  const origins = new Set<string>();
  for (const value of urls) {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (!development && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) continue;
      origins.add(url.origin);
    } catch {
      // Ignore missing or invalid configured URLs.
    }
  }
  if (development) {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }
  return { origin: [...origins], credentials: true };
}
