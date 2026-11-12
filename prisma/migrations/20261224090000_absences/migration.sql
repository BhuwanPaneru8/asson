-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('OPEN', 'UNPAID', 'LEAVE', 'WORKED');

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "absenceDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'OPEN',
    "leaveRequestId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Absence_shiftId_key" ON "Absence"("shiftId");

-- CreateIndex
CREATE INDEX "Absence_status_date_idx" ON "Absence"("status", "date");

-- CreateIndex
CREATE INDEX "Absence_userId_date_idx" ON "Absence"("userId", "date");

-- CreateIndex
CREATE INDEX "Absence_storeId_status_idx" ON "Absence"("storeId", "status");

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RosterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

