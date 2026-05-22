import fs from "fs";
import path from "path";
import { config, isSupabaseStorageEnabled, uploadsDir } from "../config";
import type { MediaKind } from "./media.service";

function buildObjectPath(kind: MediaKind, filename: string) {
  const folder = kind === "image" ? "images" : "videos";
  return `${folder}/${filename}`;
}

function buildPublicUrl(objectPath: string) {
  const base = config.supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${config.supabaseStorageBucket}/${objectPath}`;
}

function resolveLocalUploadPath(kind: MediaKind, filename: string) {
  const folder = kind === "image" ? "images" : "videos";
  fs.mkdirSync(path.join(uploadsDir, folder), { recursive: true });
  return {
    diskPath: path.join(uploadsDir, folder, filename),
    publicUrl: `/uploads/${folder}/${filename}`
  };
}

export async function uploadBufferToSupabase(buffer: Buffer, objectPath: string, contentType: string) {
  if (!isSupabaseStorageEnabled()) {
    throw new Error("Supabase storage is not configured");
  }

  const base = config.supabaseUrl.replace(/\/$/, "");
  const endpoint = `${base}/storage/v1/object/${config.supabaseStorageBucket}/${objectPath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: new Uint8Array(buffer)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase upload failed (${response.status}): ${details}`);
  }

  return buildPublicUrl(objectPath);
}

export function createMediaFilename(kind: MediaKind, originalName?: string) {
  const ext = originalName?.includes(".")
    ? originalName.slice(originalName.lastIndexOf("."))
    : kind === "image"
      ? ".jpg"
      : ".mp4";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
}

export function guessContentType(kind: MediaKind, filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  return kind === "image" ? "image/jpeg" : "video/mp4";
}

export async function persistMediaBuffer(
  kind: MediaKind,
  buffer: Buffer,
  originalName?: string,
  contentType?: string
) {
  const filename = createMediaFilename(kind, originalName);
  const mime = contentType ?? guessContentType(kind, filename);

  if (isSupabaseStorageEnabled()) {
    const objectPath = buildObjectPath(kind, filename);
    const url = await uploadBufferToSupabase(buffer, objectPath, mime);
    return { url, type: kind, originalName };
  }

  const { diskPath, publicUrl } = resolveLocalUploadPath(kind, filename);
  fs.writeFileSync(diskPath, buffer);
  return { url: publicUrl, type: kind, originalName };
}
