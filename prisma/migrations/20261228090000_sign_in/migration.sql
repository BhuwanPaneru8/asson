-- AlterTable
ALTER TABLE "StaffInvite" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'INVITE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" TEXT;

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginCode_target_purpose_createdAt_idx" ON "LoginCode"("target", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

