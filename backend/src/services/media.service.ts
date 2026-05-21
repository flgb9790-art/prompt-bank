import fs from "fs";
import path from "path";
import { uploadsDir } from "../config";

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
  const ext = originalName?.includes(".")
    ? originalName.slice(originalName.lastIndexOf("."))
    : kind === "image"
      ? ".jpg"
      : ".mp4";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  const { diskPath, publicUrl } = resolveUploadPath(kind, filename);

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch telegram file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(diskPath, Buffer.from(arrayBuffer));
  return { url: publicUrl, type: kind, originalName };
}
