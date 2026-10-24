/** Dry run by default. --apply changes titles only, guarded against concurrent edits. */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildShortPromptTitle, isShortPromptTitle } from "../src/utils/shortPromptTitle";

if (process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  process.env.DIRECT_URL = process.env.DATABASE_PUBLIC_URL;
}
const prisma = new PrismaClient();

async function main() {
  const prompts = await prisma.prompt.findMany({ select: { id: true, title: true, content: true }, orderBy: { id: "asc" } });
  const changes = prompts.filter((prompt) => !isShortPromptTitle(prompt.title)).map((prompt) => ({
    ...prompt, nextTitle: buildShortPromptTitle(prompt.content)
  }));
  for (const change of changes) console.log(`${change.id}: ${change.nextTitle}`);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ mode: "dry-run", total: prompts.length, changes: changes.length }));
    return;
  }
  const backupDir = path.resolve(process.cwd(), "../backups");
  mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `prompt-titles-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(changes.map(({ id, title, nextTitle }) => ({ id, title, nextTitle })), null, 2));
  const updated = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const change of changes) {
      const result = await tx.prompt.updateMany({
        where: { id: change.id, title: change.title, content: change.content },
        data: { title: change.nextTitle }
      });
      count += result.count;
    }
    return count;
  }, { timeout: 120000 });
  console.log(JSON.stringify({ mode: "applied", total: prompts.length, updated, skippedConcurrentEdits: changes.length - updated, backup }));
}

main().catch((error) => { console.error("Title backfill failed:", error.code || error.name); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
