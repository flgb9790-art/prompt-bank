-- PostgreSQL additive patch. Safe to re-run; does not send or change publications.
-- Legacy prisma/migrations is SQLite and must NOT be applied to PostgreSQL.
BEGIN;
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT;
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "telegramPostUrl" TEXT;
COMMIT;
-- Deliberately no backfill: old messages may contain an announcement only.
-- An administrator must select the existing post containing the prompt.
