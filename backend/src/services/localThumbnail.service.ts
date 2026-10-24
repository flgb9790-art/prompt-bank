import fs from "node:fs/promises";
import path from "node:path";
import { generateImageThumbnail, thumbFilenameFor } from "./thumbnail.service";

const pending = new Map<string, Promise<string | null>>();
const MAX_PENDING = 24;
let active = 0;
const waiters: Array<() => void> = [];

async function withWorker<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
  else active++;
  try { return await task(); }
  finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}

/** Repair a missing preview from an existing local upload, never from a remote URL. */
export function ensureLocalThumbnail(uploadsRoot: string, filename: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.webp$/.test(filename) || filename.includes("..")) {
    return Promise.resolve(null);
  }
  const target = path.join(uploadsRoot, "images", "thumbs", filename);
  const existing = pending.get(target);
  if (existing) return existing;
  if (pending.size >= MAX_PENDING) return Promise.resolve(null);
  const task = withWorker(async () => {
    try {
      if ((await fs.stat(target).catch(() => null))?.isFile()) return target;
      const imagesDir = path.join(uploadsRoot, "images");
      const files = await fs.readdir(imagesDir, { withFileTypes: true });
      const original = files.find((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name) && thumbFilenameFor(entry.name) === filename);
      if (!original) return null;
      const input = await fs.readFile(path.join(imagesDir, original.name));
      const thumbnail = await generateImageThumbnail(input);
      if (!thumbnail) return null;
      await fs.mkdir(path.dirname(target), { recursive: true });
      // Publish atomically so concurrent readers never receive half an image.
      const temporary = `${target}.${process.pid}.tmp`;
      await fs.writeFile(temporary, thumbnail);
      await fs.rename(temporary, target);
      return target;
    } catch (error) {
      console.warn(`Thumbnail repair failed (${filename}):`, error instanceof Error ? error.message : "unknown error");
      return null;
    }
  }).finally(() => pending.delete(target));
  pending.set(target, task);
  return task;
}
