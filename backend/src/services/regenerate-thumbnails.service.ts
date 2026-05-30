import fs from "fs";
import path from "path";
import { uploadsDir } from "../config";
import { generateImageThumbnail, thumbFilenameFor } from "./thumbnail.service";

const THUMB_FORMAT_MARKER = ".thumbs-format-v6";

export function thumbFormatMarkerPath() {
  return path.join(uploadsDir, "images", "thumbs", THUMB_FORMAT_MARKER);
}

export function needsThumbnailRegeneration() {
  return !fs.existsSync(thumbFormatMarkerPath());
}

export async function regenerateAllThumbnails(options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const imagesDir = path.join(uploadsDir, "images");
  const thumbsDir = path.join(imagesDir, "thumbs");
  fs.mkdirSync(thumbsDir, { recursive: true });

  const files = fs.readdirSync(imagesDir).filter((name) => {
    if (name === "thumbs" || name.startsWith(".")) return false;
    return /\.(jpe?g|png|webp)$/i.test(name);
  });

  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    const thumbPath = path.join(thumbsDir, thumbFilenameFor(filename));
    if (!force && fs.existsSync(thumbPath)) {
      skipped += 1;
      continue;
    }

    try {
      const buffer = fs.readFileSync(path.join(imagesDir, filename));
      const thumb = await generateImageThumbnail(buffer);
      if (!thumb) {
        failed += 1;
        continue;
      }
      fs.writeFileSync(thumbPath, thumb);
      written += 1;
    } catch {
      failed += 1;
    }
  }

  fs.writeFileSync(thumbFormatMarkerPath(), new Date().toISOString());
  return { written, skipped, failed, total: files.length };
}
