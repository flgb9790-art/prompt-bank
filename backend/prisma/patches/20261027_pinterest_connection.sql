-- Additive PostgreSQL patch. Does not modify prompts, publications, or legacy migration history.
CREATE TABLE IF NOT EXISTS "PinterestConnection" (
  "id" TEXT PRIMARY KEY,
  "ownerTelegramId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "boardId" TEXT,
  "boardName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "PinterestOAuthState" (
  "stateHash" TEXT PRIMARY KEY,
  "browserHash" TEXT NOT NULL,
  "ownerTelegramId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
