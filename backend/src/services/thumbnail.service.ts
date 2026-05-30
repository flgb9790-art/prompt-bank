import path from "path";

let sharpLoader: Promise<typeof import("sharp") | null> | null = null;

async function loadSharp() {
  if (!sharpLoader) {
    sharpLoader = import("sharp")
      .then((module) => module.default)
      .catch(() => null);
  }
  return sharpLoader;
}

export function thumbFilenameFor(originalFilename: string) {
  return `${path.parse(originalFilename).name}.webp`;
}

export async function generateImageThumbnail(buffer: Buffer): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;

  try {
    return await sharp(buffer)
      .rotate()
      .resize(480, 600, { fit: "cover", position: "top", withoutEnlargement: true })
      .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.35 })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toBuffer();
  } catch {
    return null;
  }
}
