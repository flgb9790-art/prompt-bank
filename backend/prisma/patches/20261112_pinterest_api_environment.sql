-- Additive and repeatable. Existing connections and publications remain production records.
ALTER TABLE "PinterestConnection"
  ADD COLUMN IF NOT EXISTS "apiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.pinterest.com/v5';

ALTER TABLE "PinterestPublication"
  ADD COLUMN IF NOT EXISTS "apiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.pinterest.com/v5';
