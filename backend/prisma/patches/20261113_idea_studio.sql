-- CreateTable
CREATE TABLE IF NOT EXISTS "IdeaStudioSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "dailyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyCount" INTEGER NOT NULL DEFAULT 10,
    "runAt" TEXT NOT NULL DEFAULT '09:00',
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "language" TEXT NOT NULL DEFAULT 'en',
    "topics" TEXT NOT NULL DEFAULT 'Портреты, предметная съёмка, архитектура, мода, природа, сюрреализм',
    "useWebSearch" BOOLEAN NOT NULL DEFAULT true,
    "ownerTelegramId" TEXT,
    "workerToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaStudioSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdeaStudioBatch" (
    "id" TEXT NOT NULL,
    "dailyKey" TEXT,
    "creatorTelegramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "count" INTEGER NOT NULL,
    "topics" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "useWebSearch" BOOLEAN NOT NULL,
    "sourcePrompt" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaStudioBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdeaStudioDraft" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "imageStatus" TEXT NOT NULL DEFAULT 'pending',
    "imageError" TEXT,
    "imageStale" BOOLEAN NOT NULL DEFAULT false,
    "busyJobId" TEXT,
    "publishError" TEXT,
    "publishUncertain" BOOLEAN NOT NULL DEFAULT false,
    "promptId" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaStudioDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdeaStudioJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "creatorTelegramId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaStudioJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdeaStudioUsage" (
    "id" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IdeaStudioUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaStudioBatch_dailyKey_key" ON "IdeaStudioBatch"("dailyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdeaStudioBatch_createdAt_idx" ON "IdeaStudioBatch"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaStudioDraft_promptId_key" ON "IdeaStudioDraft"("promptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdeaStudioDraft_batchId_createdAt_idx" ON "IdeaStudioDraft"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdeaStudioDraft_fingerprint_idx" ON "IdeaStudioDraft"("fingerprint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdeaStudioJob_status_createdAt_idx" ON "IdeaStudioJob"("status", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaStudioDraft_batchId_fkey' AND conrelid = '"IdeaStudioDraft"'::regclass) THEN
    ALTER TABLE "IdeaStudioDraft" ADD CONSTRAINT "IdeaStudioDraft_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdeaStudioBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaStudioDraft_promptId_fkey' AND conrelid = '"IdeaStudioDraft"'::regclass) THEN
    ALTER TABLE "IdeaStudioDraft" ADD CONSTRAINT "IdeaStudioDraft_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
