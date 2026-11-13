-- Additive; snapshots preserve each batch's own identity reference and creative calendar.
ALTER TABLE "IdeaStudioSettings" ADD COLUMN IF NOT EXISTS "creativeProfile" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "IdeaStudioSettings" ADD COLUMN IF NOT EXISTS "referenceImageKey" TEXT;
ALTER TABLE "IdeaStudioBatch" ADD COLUMN IF NOT EXISTS "creativeContext" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "IdeaStudioBatch" ADD COLUMN IF NOT EXISTS "referenceImageKey" TEXT;
ALTER TABLE "IdeaStudioSettings" ALTER COLUMN "topics" SET DEFAULT 'Идеи для девушки: роскошная жизнь, красивые места, путешествия, стильные образы и интересные занятия';
-- Replace only the original untouched built-in suggestion, never custom topics.
UPDATE "IdeaStudioSettings" SET "topics"='Идеи для девушки: роскошная жизнь, красивые места, путешествия, стильные образы и интересные занятия'
WHERE "topics"='Портреты, предметная съёмка, архитектура, мода, природа, сюрреализм';
