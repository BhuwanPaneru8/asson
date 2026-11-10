-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "editedById" TEXT,
    "editReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_userId_clockIn_idx" ON "Attendance"("userId", "clockIn");

-- CreateIndex
CREATE INDEX "Attendance_storeId_clockIn_idx" ON "Attendance"("storeId", "clockIn");

-- CreateIndex
CREATE INDEX "Attendance_clockOut_idx" ON "Attendance"("clockOut");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_number_key" ON "LeaveRequest"("number");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_fromDate_idx" ON "LeaveRequest"("userId", "fromDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards the database keeps even if code is wrong
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_order" CHECK ("clockOut" IS NULL OR "clockOut" >= "clockIn");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_range" CHECK ("toDate" >= "fromDate" AND "days" > 0);
-- one open entry per person: two devices can never both start a shift (partial index: not in schema.prisma)
CREATE UNIQUE INDEX "Attendance_one_open_per_person" ON "Attendance"("userId") WHERE "clockOut" IS NULL;
