-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'APPROVED', 'DECLINED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShiftSwap" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "backShiftId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "SwapStatus" NOT NULL DEFAULT 'OFFERED',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftSwap_status_createdAt_idx" ON "ShiftSwap"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftSwap_toUserId_status_idx" ON "ShiftSwap"("toUserId", "status");

-- CreateIndex
CREATE INDEX "ShiftSwap_shiftId_idx" ON "ShiftSwap"("shiftId");

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RosterShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_backShiftId_fkey" FOREIGN KEY ("backShiftId") REFERENCES "RosterShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_two_people" CHECK ("fromUserId" <> "toUserId");
-- one live request per shift at a time
CREATE UNIQUE INDEX "ShiftSwap_one_open" ON "ShiftSwap" ("shiftId") WHERE "status" IN ('OFFERED', 'ACCEPTED');
