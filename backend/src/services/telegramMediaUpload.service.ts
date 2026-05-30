import fs from "fs";
import path from "path";
import { config, uploadsDir } from "../config";
import { guessContentType } from "./storage.service";
import { humanizeTelegramApiError, isSamePublicHost } from "../utils/telegramWebContent";

export type TelegramMediaPayload = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  kind: "image" | "video";
};

const MIN_MEDIA_BYTES = 200;

function filenameFromUrl(url: string, kind: "image" | "video"): string {
  try {
    const base = path.basename(new URL(url).pathname);
    if (base && base !== "/") return base;
  } catch {
    // ignore
  }
  return kind === "image" ? "photo.jpg" : "video.mp4";
}

function resolveLocalUploadPath(publicUrl: string): string | null {
  let pathname = "";
  try {
    pathname = new URL(publicUrl).pathname;
  } catch {
    return null;
  }

  if (!isSamePublicHost(publicUrl, config.publicBackendUrl)) {
    return null;
  }

  const match = pathname.match(/^\/uploads\/(images|videos)\/(.+)$/i);
  if (!match) return null;

  const folder = match[1];
  const relative = match[2].replace(/^thumbs\//, "");
  if (!relative || relative.includes("..")) return null;

  const diskPath = path.join(uploadsDir, folder, relative);
  return fs.existsSync(diskPath) ? diskPath : null;
}

export async function loadTelegramMediaPayload(
  publicUrl: string,
  kind: "image" | "video"
): Promise<TelegramMediaPayload> {
  const localPath = resolveLocalUploadPath(publicUrl);
  if (localPath) {
    const buffer = fs.readFileSync(localPath);
    if (buffer.length < MIN_MEDIA_BYTES) {
      throw new Error(`Файл слишком маленький или пустой: ${publicUrl}`);
    }
    const folder = kind === "image" ? "images" : "videos";
    const contentType = guessContentType(kind, path.basename(localPath));
    return {
      buffer,
      contentType,
      filename: path.basename(localPath),
      kind
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(publicUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "PromptBankBot/1.0 (media download)" }
    });

    if (!response.ok) {
      throw new Error(`Медиа недоступно (HTTP ${response.status}): ${publicUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < MIN_MEDIA_BYTES) {
      throw new Error(`Медиа пустое или слишком маленькое (${buffer.length} B): ${publicUrl}`);
    }

    const contentType =
      (response.headers.get("content-type") ?? "").split(";")[0].trim() ||
      guessContentType(kind, filenameFromUrl(publicUrl, kind));

    return {
      buffer,
      contentType,
      filename: filenameFromUrl(publicUrl, kind),
      kind
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Таймаут загрузки медиа: ${publicUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function callTelegramMultipart<T>(
  token: string,
  method: string,
  fields: Record<string, string>,
  files: Array<{ field: string; payload: TelegramMediaPayload }>
): Promise<T> {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  for (const file of files) {
    const blob = new Blob([new Uint8Array(file.payload.buffer)], { type: file.payload.contentType });
    form.append(file.field, blob, file.payload.filename);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: form
  });

  let data: { ok: boolean; description?: string; result?: T };
  try {
    data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  } catch {
    throw new Error(`Telegram API error (${method}): invalid response`);
  }

  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(humanizeTelegramApiError(data.description || `Telegram API error (${method})`));
  }

  return data.result;
}
