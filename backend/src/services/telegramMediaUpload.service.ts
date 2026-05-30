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
/** Лимит Telegram Bot API для sendPhoto / фото в альбоме. */
const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Целевой размер с запасом, чтобы не упираться в лимит. */
const TELEGRAM_PHOTO_TARGET_BYTES = Math.floor(TELEGRAM_PHOTO_MAX_BYTES * 0.92);

let sharpLoader: Promise<typeof import("sharp") | null> | null = null;

async function loadSharp() {
  if (!sharpLoader) {
    sharpLoader = import("sharp")
      .then((module) => module.default)
      .catch(() => null);
  }
  return sharpLoader;
}

async function compressImageForTelegram(
  buffer: Buffer,
  filename: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  if (buffer.length <= TELEGRAM_PHOTO_TARGET_BYTES) {
    return {
      buffer,
      contentType: guessContentType("image", filename),
      filename
    };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    if (buffer.length <= TELEGRAM_PHOTO_MAX_BYTES) {
      return { buffer, contentType: guessContentType("image", filename), filename };
    }
    throw new Error(
      `Фото ${Math.round(buffer.length / 1024 / 1024)} МБ превышает лимит Telegram 10 МБ (модуль сжатия недоступен)`
    );
  }

  const baseName = path.parse(filename).name || "photo";
  let quality = 88;
  let maxEdge = 4096;
  let output = buffer;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    output = await sharp(buffer)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length <= TELEGRAM_PHOTO_TARGET_BYTES) {
      return { buffer: output, contentType: "image/jpeg", filename: `${baseName}.jpg` };
    }

    if (quality > 68) {
      quality -= 8;
    } else if (maxEdge > 1600) {
      maxEdge = Math.floor(maxEdge * 0.82);
      quality = 82;
    } else {
      quality = Math.max(52, quality - 6);
    }
  }

  if (output.length > TELEGRAM_PHOTO_MAX_BYTES) {
    throw new Error(
      `Не удалось сжать фото до 10 МБ для Telegram (осталось ${(output.length / 1024 / 1024).toFixed(1)} МБ)`
    );
  }

  return { buffer: output, contentType: "image/jpeg", filename: `${baseName}.jpg` };
}

async function finalizeImagePayload(
  buffer: Buffer,
  contentType: string,
  filename: string
): Promise<TelegramMediaPayload> {
  const compressed = await compressImageForTelegram(buffer, filename);
  return {
    buffer: compressed.buffer,
    contentType: compressed.contentType,
    filename: compressed.filename,
    kind: "image"
  };
}

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
    const basename = path.basename(localPath);
    if (kind === "image") {
      return finalizeImagePayload(buffer, guessContentType("image", basename), basename);
    }
    return {
      buffer,
      contentType: guessContentType("video", basename),
      filename: basename,
      kind: "video"
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

    const filename = filenameFromUrl(publicUrl, kind);
    const contentType =
      (response.headers.get("content-type") ?? "").split(";")[0].trim() ||
      guessContentType(kind, filename);

    if (kind === "image") {
      return finalizeImagePayload(buffer, contentType, filename);
    }

    return {
      buffer,
      contentType,
      filename,
      kind: "video"
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
