-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ban_reason" TEXT,
ADD COLUMN IF NOT EXISTS "banned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "urls" ADD COLUMN IF NOT EXISTS "claim_token" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "urls_claim_token_idx" ON "urls"("claim_token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "urls_deleted_at_idx" ON "urls"("deleted_at");
