import fs from "fs";
import path from "path";
import { uploadsDir } from "../config";
import { persistMediaBuffer } from "./storage.service";

export type MediaKind = "image" | "video";

const allowedMimeMap: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video"
};

function ensureDirs() {
  fs.mkdirSync(path.join(uploadsDir, "images"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "videos"), { recursive: true });
}

export function getMediaKindByMime(mimetype: string): MediaKind | null {
  return allowedMimeMap[mimetype] ?? null;
}

export function resolveUploadPath(kind: MediaKind, filename: string) {
  ensureDirs();
  const folder = kind === "image" ? "images" : "videos";
  const diskPath = path.join(uploadsDir, folder, filename);
  const publicUrl = `/uploads/${folder}/${filename}`;
  return { diskPath, publicUrl };
}

export async function saveFromRemoteUrl(remoteUrl: string, kind: MediaKind, originalName?: string) {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch telegram file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? undefined;
  return persistMediaBuffer(kind, Buffer.from(arrayBuffer), originalName, contentType);
}
