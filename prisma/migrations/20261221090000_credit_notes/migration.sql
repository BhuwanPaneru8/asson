-- AlterTable
ALTER TABLE "DamageEntry" ADD COLUMN     "creditNoteId" TEXT;

-- CreateTable
CREATE TABLE "SupplierCredit" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "unallocated" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAllocation" (
    "creditId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "CreditAllocation_pkey" PRIMARY KEY ("creditId","billId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_number_key" ON "SupplierCredit"("number");

-- CreateIndex
CREATE INDEX "SupplierCredit_supplierId_date_idx" ON "SupplierCredit"("supplierId", "date");

-- CreateIndex
CREATE INDEX "SupplierCredit_date_idx" ON "SupplierCredit"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_supplierId_reference_key" ON "SupplierCredit"("supplierId", "reference");

-- AddForeignKey
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "SupplierCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAllocation" ADD CONSTRAINT "CreditAllocation_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "SupplierCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAllocation" ADD CONSTRAINT "CreditAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_amounts" CHECK ("amount" > 0 AND "vatAmount" >= 0 AND "vatAmount" <= "amount" AND "unallocated" >= 0 AND "unallocated" <= "amount");
ALTER TABLE "CreditAllocation" ADD CONSTRAINT "CreditAllocation_amount" CHECK ("amount" > 0);

-- a closed month's credit notes can't change (like payments: allocating later is fine)
CREATE OR REPLACE FUNCTION credit_month_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."amount" = OLD."amount" AND NEW."vatAmount" = OLD."vatAmount" AND NEW."date" = OLD."date" AND NEW."supplierId" = OLD."supplierId"
     AND (NEW."voidedAt" IS NOT DISTINCT FROM OLD."voidedAt") THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND month_is_closed(nepal_month(OLD."date")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(OLD."date"); END IF;
  IF TG_OP <> 'DELETE' AND month_is_closed(nepal_month(NEW."date")) THEN RAISE EXCEPTION 'Month % is closed: reopen it to change its books', nepal_month(NEW."date"); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER credit_month_lock BEFORE INSERT OR UPDATE OR DELETE ON "SupplierCredit" FOR EACH ROW EXECUTE FUNCTION credit_month_lock();

-- and a filed VAT return's credit notes can't change either (their VAT is in it)
CREATE OR REPLACE FUNCTION credit_vat_lock() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."amount" = OLD."amount" AND NEW."vatAmount" = OLD."vatAmount" AND NEW."date" = OLD."date" AND NEW."supplierId" = OLD."supplierId"
     AND (NEW."voidedAt" IS NOT DISTINCT FROM OLD."voidedAt") THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' AND vat_period_filed(OLD."date") THEN RAISE EXCEPTION 'That credit note is in a filed VAT return: reopen the return to change it'; END IF;
  IF TG_OP <> 'DELETE' AND vat_period_filed(NEW."date") THEN RAISE EXCEPTION 'That date is in a filed VAT return: reopen the return to add a credit note there'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER credit_vat_lock BEFORE INSERT OR UPDATE OR DELETE ON "SupplierCredit" FOR EACH ROW EXECUTE FUNCTION credit_vat_lock();
