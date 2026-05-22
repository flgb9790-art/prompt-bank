/**
 * Однократно создаёт WebP-превью для уже загруженных обложек в uploads/images/.
 * Запуск: npx tsx scripts/backfill-thumbs.ts
 */
import fs from "fs";
import path from "path";
import { uploadsDir } from "../src/config";
import { generateImageThumbnail, thumbFilenameFor } from "../src/services/thumbnail.service";

async function main() {
  const imagesDir = path.join(uploadsDir, "images");
  const thumbsDir = path.join(imagesDir, "thumbs");
  fs.mkdirSync(thumbsDir, { recursive: true });

  const files = fs.readdirSync(imagesDir).filter((name) => {
    if (name === "thumbs") return false;
    return /\.(jpe?g|png|webp)$/i.test(name);
  });

  let created = 0;
  let skipped = 0;

  for (const filename of files) {
    const thumbName = thumbFilenameFor(filename);
    const thumbPath = path.join(thumbsDir, thumbName);
    if (fs.existsSync(thumbPath)) {
      skipped += 1;
      continue;
    }

    const buffer = fs.readFileSync(path.join(imagesDir, filename));
    const thumb = await generateImageThumbnail(buffer);
    if (!thumb) {
      console.warn(`Skip (no sharp?): ${filename}`);
      skipped += 1;
      continue;
    }

    fs.writeFileSync(thumbPath, thumb);
    created += 1;
    console.log(`Thumb: ${thumbName}`);
  }

  console.log(`Done. Created ${created}, skipped ${skipped}.`);
}

void main();
