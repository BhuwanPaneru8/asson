-- CreateEnum
CREATE TYPE "VatReturnStatus" AS ENUM ('DRAFT', 'FILED');

-- AlterTable
ALTER TABLE "StatementLine" ADD COLUMN     "vatReturnId" TEXT;

-- CreateTable
CREATE TABLE "VatReturn" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "status" "VatReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "outputVat" INTEGER NOT NULL DEFAULT 0,
    "inputVat" INTEGER NOT NULL DEFAULT 0,
    "unclaimableVat" INTEGER NOT NULL DEFAULT 0,
    "broughtForward" INTEGER NOT NULL DEFAULT 0,
    "payable" INTEGER NOT NULL DEFAULT 0,
    "carryForward" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "ackNo" TEXT,
    "filedAt" TIMESTAMP(3),
    "filedById" TEXT,
    "paidOn" TEXT,
    "paidAmount" INTEGER,
    "paidRef" TEXT,
    "reopenReason" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VatReturn_from_to_idx" ON "VatReturn"("from", "to");

-- CreateIndex
CREATE UNIQUE INDEX "StatementLine_vatReturnId_key" ON "StatementLine"("vatReturnId");

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_vatReturnId_fkey" FOREIGN KEY ("vatReturnId") REFERENCES "VatReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "VatReturn" ADD CONSTRAINT "VatReturn_period" CHECK ("from" ~ '^\d{4}-\d{2}-\d{2}$' AND "to" ~ '^\d{4}-\d{2}-\d{2}$' AND "from" <= "to");
ALTER TABLE "VatReturn" ADD CONSTRAINT "VatReturn_amounts" CHECK ("payable" >= 0 AND "carryForward" >= 0 AND "broughtForward" >= 0 AND "inputVat" >= 0 AND "unclaimableVat" >= 0 AND ("paidAmount" IS NULL OR "paidAmount" > 0));
ALTER TABLE "VatReturn" ADD CONSTRAINT "VatReturn_filed" CHECK (("status" = 'FILED') = ("filedAt" IS NOT NULL));
-- periods never overlap (a trigger, so no extension or special privilege is needed; the lock serialises two at once)
CREATE OR REPLACE FUNCTION vat_return_no_overlap() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('vat-return-periods'));
  IF EXISTS (SELECT 1 FROM "VatReturn" v WHERE v."id" <> NEW."id" AND v."from" <= NEW."to" AND v."to" >= NEW."from") THEN
    RAISE EXCEPTION 'VAT return periods can''t overlap (% to %)', NEW."from", NEW."to";
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER vat_return_no_overlap BEFORE INSERT OR UPDATE OF "from", "to" ON "VatReturn" FOR EACH ROW EXECUTE FUNCTION vat_return_no_overlap();

-- a statement line has one explanation, now including a VAT payment
ALTER TABLE "StatementLine" DROP CONSTRAINT "StatementLine_matched";
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_matched" CHECK (
  ("status" = 'MATCHED') = (num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId", "vatReturnId") = 1)
  AND num_nonnulls("depositId", "remittanceId", "paymentId", "expenseId", "vatReturnId") <= 1);

-- a filed return's period: the purchase bills it claimed can't change (same rule as a closed month)
CREATE OR REPLACE FUNCTION vat_period_filed(d timestamp) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM "VatReturn" v WHERE v."status" = 'FILED'
    AND to_char((d AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') BETWEEN v."from" AND v."to");
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION bill_vat_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."amount" = OLD."amount" AND NEW."vatAmount" = OLD."vatAmount" AND NEW."billDate" = OLD."billDate"
     AND NEW."supplierId" = OLD."supplierId" AND NOT (NEW."status" = 'VOID' AND OLD."status" <> 'VOID') THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND vat_period_filed(OLD."billDate") THEN RAISE EXCEPTION 'That bill is in a filed VAT return: reopen the return to change it'; END IF;
  IF TG_OP <> 'DELETE' AND vat_period_filed(NEW."billDate") THEN RAISE EXCEPTION 'That date is in a filed VAT return: reopen the return to add a bill there'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER bill_vat_lock BEFORE INSERT OR UPDATE OR DELETE ON "SupplierBill" FOR EACH ROW EXECUTE FUNCTION bill_vat_lock();
