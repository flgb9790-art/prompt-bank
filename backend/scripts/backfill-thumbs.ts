/**
 * Создаёт или пересоздаёт WebP-превью для uploads/images/.
 * Запуск: npm run thumbs:backfill
 * Перезапись всех: npm run thumbs:backfill -- --force
 */
import { regenerateAllThumbnails } from "../src/services/regenerate-thumbnails.service";

async function main() {
  const force = process.argv.includes("--force");
  const result = await regenerateAllThumbnails({ force });
  console.log(
    `Done. Written ${result.written}, skipped ${result.skipped}, failed ${result.failed}, total ${result.total}.`
  );
}

void main();
