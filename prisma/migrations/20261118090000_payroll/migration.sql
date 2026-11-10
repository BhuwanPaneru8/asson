-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basic" INTEGER NOT NULL,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "inSsf" BOOLEAN NOT NULL DEFAULT true,
    "married" BOOLEAN NOT NULL DEFAULT false,
    "pan" TEXT,
    "bankAccount" TEXT,
    "joinedOn" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollTaxYear" (
    "id" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "single" JSONB NOT NULL,
    "married" JSONB NOT NULL,
    "ssfFirstBandZero" BOOLEAN NOT NULL DEFAULT true,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollTaxYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basic" INTEGER NOT NULL,
    "allowance" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "leaveDays" INTEGER NOT NULL,
    "unpaidDays" INTEGER NOT NULL,
    "extraUnpaidDays" INTEGER NOT NULL DEFAULT 0,
    "inSsf" BOOLEAN NOT NULL,
    "married" BOOLEAN NOT NULL,
    "earnedBasic" INTEGER NOT NULL,
    "unpaidDeduction" INTEGER NOT NULL,
    "gross" INTEGER NOT NULL,
    "ssfEmployee" INTEGER NOT NULL,
    "ssfEmployer" INTEGER NOT NULL,
    "incomeTax" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employment_userId_key" ON "Employment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollTaxYear_fiscalYear_key" ON "PayrollTaxYear"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_month_key" ON "PayrollRun"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_userId_key" ON "Payslip"("runId", "userId");

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards the database keeps even if code is wrong
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_money" CHECK ("basic" >= 0 AND "allowance" >= 0);
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_sane" CHECK ("net" <= "gross" AND "unpaidDays" >= 0 AND "extraUnpaidDays" >= 0 AND "incomeTax" >= 0);
