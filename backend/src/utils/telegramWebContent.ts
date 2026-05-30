const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export function urlHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isSamePublicHost(a: string, b: string): boolean {
  const hostA = urlHostname(a);
  const hostB = urlHostname(b);
  return Boolean(hostA && hostB && hostA === hostB);
}

function isHtmlContentType(contentType: string): boolean {
  const value = contentType.toLowerCase();
  return HTML_CONTENT_TYPES.some((type) => value.includes(type));
}

function isImageContentType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("image/");
}

function isVideoContentType(contentType: string): boolean {
  const value = contentType.toLowerCase();
  return value.startsWith("video/") || value.includes("octet-stream");
}

export async function assertTelegramWebAppPage(url: string): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "PromptBankBot/1.0 (Telegram WebApp check)"
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(`Mini App URL отвечает HTTP ${response.status}: ${url}`);
  }
  if (!isHtmlContentType(contentType) && !contentType.includes("text/")) {
    throw new Error(
      `Mini App URL должен отдавать HTML (получен ${contentType || "unknown"}). Проверьте WEBAPP_URL — это адрес mini app, не backend API.`
    );
  }
}

export async function assertTelegramMediaUrl(url: string, expected: "image" | "video"): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "PromptBankBot/1.0 (media check)" }
    });

    if (response.status === 405 || response.status === 404 || !response.ok) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Range: "bytes=0-511",
          "User-Agent": "PromptBankBot/1.0 (media check)"
        }
      });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      throw new Error(`Медиа недоступно (HTTP ${response.status}): ${url}`);
    }
    if (isHtmlContentType(contentType)) {
      throw new Error(
        "Медиа-URL отдаёт HTML (страницу приложения), а не файл. На backend задайте PUBLIC_BACKEND_URL на API с /uploads, например https://prompt-bank-production.up.railway.app"
      );
    }
    if (expected === "image" && !isImageContentType(contentType)) {
      throw new Error(`Ожидалось изображение, получен тип: ${contentType || "unknown"}`);
    }
    if (expected === "video" && !isVideoContentType(contentType)) {
      throw new Error(`Ожидалось видео, получен тип: ${contentType || "unknown"}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Таймаут проверки медиа: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function humanizeTelegramApiError(message: string): string {
  if (/wrong type of the web page content/i.test(message)) {
    return (
      "Telegram отклонил URL: вместо HTML mini app или файла изображения отдаётся другой тип страницы. " +
      "Проверьте WEBAPP_URL (mini app) и PUBLIC_BACKEND_URL (backend с /uploads) на Railway."
    );
  }
  return message;
}
