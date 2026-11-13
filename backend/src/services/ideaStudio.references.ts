import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uploadsDir } from "../config";
import { StudioError } from "./ideaStudio.validation";
import type { Request, Response, NextFunction } from "express";

export function studioReferencePath(key: string, root = uploadsDir) {
  if (!/^[a-f0-9-]{36}\.jpg$/.test(key))
    throw new StudioError("Референс не найден.", 404);
  return path.join(root, ".studio-references", key);
}
export async function storeStudioReference(buffer: Buffer, root = uploadsDir) {
  if (buffer.length > 10 * 1024 * 1024)
    throw new StudioError("Фото должно быть не больше 10 МБ.");
  let image: Buffer;
  try {
    const source = sharp(buffer, { limitInputPixels: 30000000 });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw Error("unsupported");
    image = await source
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    throw new StudioError(
      "Не удалось прочитать фото. Используйте JPG, PNG или WebP до 30 мегапикселей.",
    );
  }
  const key = `${randomUUID()}.jpg`;
  const file = studioReferencePath(key, root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, image, { mode: 0o600 });
  return key;
}
export async function readStudioReference(key: string, root = uploadsDir) {
  try {
    return await fs.readFile(studioReferencePath(key, root));
  } catch {
    throw new StudioError(
      "Фото персонажа недоступно. Загрузите референс заново для новой подборки; для старой восстановите хранилище.",
      409,
    );
  }
}
export function rejectPrivateUploadPaths(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let mediaPath: string;
  try {
    mediaPath = decodeURIComponent(req.path);
  } catch {
    return res.sendStatus(404);
  }
  if (mediaPath.split(/[\\/]+/).some((segment) => segment.startsWith(".")))
    return res.sendStatus(404);
  next();
}
