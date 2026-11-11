-- CreateEnum
CREATE TYPE "StatutoryKind" AS ENUM ('TDS', 'SSF');

-- AlterTable
ALTER TABLE "StatementLine" ADD COLUMN     "statutoryId" TEXT;

-- CreateTable
CREATE TABLE "StatutoryDeposit" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" "StatutoryKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueOn" TEXT NOT NULL,
    "paidOn" TEXT,
    "paidAmount" INTEGER,
    "reference" TEXT,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutoryDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatutoryDeposit_paidOn_idx" ON "StatutoryDeposit"("paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "StatutoryDeposit_runId_kind_key" ON "StatutoryDeposit"("runId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_statutoryId_key" ON "StatementLine"("statutoryId");

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_statutoryId_fkey" FOREIGN KEY ("statutoryId") REFERENCES "StatutoryDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryDeposit" ADD CONSTRAINT "StatutoryDeposit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "StatutoryDeposit" ADD CONSTRAINT "StatutoryDeposit_amounts" CHECK ("amount" > 0 AND ("paidAmount" IS NULL OR "paidAmount" > 0));
ALTER TABLE "StatutoryDeposit" ADD CONSTRAINT "StatutoryDeposit_paid" CHECK (("paidOn" IS NULL) = ("paidAmount" IS NULL));

ALTER TABLE "StatementLine" DROP CONSTRAINT "StatementLine_matched";
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_matched" CHECK (
  ("status" = 'MATCHED') = (num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId", "vatReturnId", "statutoryId") = 1)
  AND num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId", "vatReturnId", "statutoryId") <= 1);

-- payroll already paid before this existed: create what it owes (due 25 days after the month)
INSERT INTO "StatutoryDeposit" ("id", "runId", "kind", "amount", "dueOn")
SELECT 'sd_' || r."id" || '_tds', r."id", 'TDS', SUM(p."incomeTax"), to_char((r."month" || '-01')::date + interval '1 month' + interval '24 days', 'YYYY-MM-DD')
FROM "PayrollRun" r JOIN "Payslip" p ON p."runId" = r."id" WHERE r."status" = 'PAID' GROUP BY r."id" HAVING SUM(p."incomeTax") > 0;
INSERT INTO "StatutoryDeposit" ("id", "runId", "kind", "amount", "dueOn")
SELECT 'sd_' || r."id" || '_ssf', r."id", 'SSF', SUM(p."ssfEmployee" + p."ssfEmployer"), to_char((r."month" || '-01')::date + interval '1 month' + interval '24 days', 'YYYY-MM-DD')
FROM "PayrollRun" r JOIN "Payslip" p ON p."runId" = r."id" WHERE r."status" = 'PAID' GROUP BY r."id" HAVING SUM(p."ssfEmployee" + p."ssfEmployer") > 0;
