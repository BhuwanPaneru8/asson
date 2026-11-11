-- AlterTable
ALTER TABLE "StatementLine" ADD COLUMN     "expenseId" TEXT,
ADD COLUMN     "paymentId" TEXT;

-- CreateTable
CREATE TABLE "MonthClose" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "snapshot" JSONB NOT NULL,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT NOT NULL DEFAULT '',
    "closes" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthClose_month_key" ON "MonthClose"("month");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_paymentId_key" ON "StatementLine"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_expenseId_key" ON "StatementLine"("expenseId");

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- debits are matched like credits now
ALTER TABLE "StatementLine" DROP CONSTRAINT "StatementLine_debit";
ALTER TABLE "StatementLine" DROP CONSTRAINT "StatementLine_matched";
UPDATE "StatementLine" SET "status" = 'UNMATCHED' WHERE "status" = 'DEBIT';
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_matched" CHECK (
  ("status" = 'MATCHED') = (num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId") = 1)
  AND num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId") <= 1);
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_no_debit_status" CHECK ("status" <> 'DEBIT');
ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_month" CHECK ("month" ~ '^\d{4}-(0[1-9]|1[0-2])$');
-- closed ⇔ has a close time and no later reopen
ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_state" CHECK ("closedAt" IS NOT NULL OR "reopenedAt" IS NOT NULL);
