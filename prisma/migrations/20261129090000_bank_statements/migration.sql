-- CreateEnum
CREATE TYPE "StatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED', 'DEBIT');

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "status" "StatementLineStatus" NOT NULL,
    "depositId" TEXT,
    "remittanceId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "matchedById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "importedById" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_key_key" ON "StatementLine"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_depositId_key" ON "StatementLine"("depositId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_remittanceId_key" ON "StatementLine"("remittanceId");

-- CreateIndex
CREATE INDEX "StatementLine_account_date_idx" ON "StatementLine"("account", "date");

-- CreateIndex
CREATE INDEX "StatementLine_status_idx" ON "StatementLine"("status");

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "BankDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "CodRemittance"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_matched" CHECK (("status" = 'MATCHED') = ("depositId" IS NOT NULL OR "remittanceId" IS NOT NULL) AND NOT ("depositId" IS NOT NULL AND "remittanceId" IS NOT NULL));
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_debit" CHECK (("status" = 'DEBIT') = ("amount" < 0));
