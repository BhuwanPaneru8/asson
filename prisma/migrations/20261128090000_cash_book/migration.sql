-- CreateEnum
CREATE TYPE "CashKind" AS ENUM ('OPENING', 'FLOAT_OUT', 'SHIFT_IN', 'DEPOSIT', 'DEPOSIT_FIX', 'PETTY', 'COUNT');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('RECORDED', 'VERIFIED', 'DISPUTED');

-- CreateTable
CREATE TABLE "CashEntry" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "CashKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "source" TEXT,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDeposit" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bank" TEXT NOT NULL,
    "slipNo" TEXT NOT NULL,
    "slipPhoto" TEXT,
    "depositedOn" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'RECORDED',
    "bankAmount" INTEGER,
    "checkNote" TEXT NOT NULL DEFAULT '',
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashEntry_source_key" ON "CashEntry"("source");

-- CreateIndex
CREATE INDEX "CashEntry_storeId_createdAt_idx" ON "CashEntry"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankDeposit_number_key" ON "BankDeposit"("number");

-- CreateIndex
CREATE INDEX "BankDeposit_storeId_status_idx" ON "BankDeposit"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankDeposit_bank_slipNo_key" ON "BankDeposit"("bank", "slipNo");

-- AddForeignKey
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_nonzero" CHECK ("amount" <> 0 OR "kind" = 'COUNT'); -- a count that matched is still a count
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_amount_pos" CHECK ("amount" > 0 AND ("bankAmount" IS NULL OR "bankAmount" >= 0));
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_checked" CHECK (("status" = 'RECORDED') = ("checkedAt" IS NULL));
-- the cash book is append-only (like the audit log)
CREATE OR REPLACE FUNCTION cash_entry_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'CashEntry is append-only (% blocked)', TG_OP; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER cash_entry_no_update BEFORE UPDATE OR DELETE ON "CashEntry" FOR EACH ROW EXECUTE FUNCTION cash_entry_append_only();
