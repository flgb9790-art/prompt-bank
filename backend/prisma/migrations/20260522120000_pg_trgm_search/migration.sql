-- Ускоряет поиск по title/content (ILIKE / similarity). Безопасно повторять.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Prompt_title_trgm_idx" ON "Prompt" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Prompt_content_trgm_idx" ON "Prompt" USING gin (content gin_trgm_ops);
