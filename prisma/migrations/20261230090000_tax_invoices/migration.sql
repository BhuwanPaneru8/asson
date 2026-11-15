-- CreateEnum
CREATE TYPE "CbmsStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "fiscalYear" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "doc" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("fiscalYear","series","doc")
);

-- CreateTable
CREATE TABLE "TaxInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "abbreviated" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateBs" TEXT NOT NULL,
    "dateAd" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "sellerPan" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPan" TEXT,
    "buyerAddress" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "gross" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "taxable" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "issuedById" TEXT,

    CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "returnId" TEXT,
    "storeId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateBs" TEXT NOT NULL,
    "dateAd" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPan" TEXT,
    "lines" JSONB NOT NULL,
    "gross" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "taxable" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "issuedById" TEXT,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePrint" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNoteId" TEXT,
    "copy" INTEGER NOT NULL,
    "printedById" TEXT,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePrint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbmsSync" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNoteId" TEXT,
    "status" "CbmsStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "realtime" BOOLEAN,
    "code" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbmsSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_number_key" ON "TaxInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_orderId_key" ON "TaxInvoice"("orderId");

-- CreateIndex
CREATE INDEX "TaxInvoice_issuedAt_idx" ON "TaxInvoice"("issuedAt");

-- CreateIndex
CREATE INDEX "TaxInvoice_storeId_issuedAt_idx" ON "TaxInvoice"("storeId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_fiscalYear_series_seq_key" ON "TaxInvoice"("fiscalYear", "series", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_returnId_key" ON "CreditNote"("returnId");

-- CreateIndex
CREATE INDEX "CreditNote_issuedAt_idx" ON "CreditNote"("issuedAt");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_fiscalYear_series_seq_key" ON "CreditNote"("fiscalYear", "series", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePrint_invoiceId_copy_key" ON "InvoicePrint"("invoiceId", "copy");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePrint_creditNoteId_copy_key" ON "InvoicePrint"("creditNoteId", "copy");

-- CreateIndex
CREATE UNIQUE INDEX "CbmsSync_invoiceId_key" ON "CbmsSync"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CbmsSync_creditNoteId_key" ON "CbmsSync"("creditNoteId");

-- CreateIndex
CREATE INDEX "CbmsSync_status_createdAt_idx" ON "CbmsSync"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TaxInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePrint" ADD CONSTRAINT "InvoicePrint_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TaxInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePrint" ADD CONSTRAINT "InvoicePrint_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbmsSync" ADD CONSTRAINT "CbmsSync_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TaxInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbmsSync" ADD CONSTRAINT "CbmsSync_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An issued invoice or credit note is never changed or deleted: corrections are credit notes (VAT Rules r.17,
-- Electronic Billing Procedure 2074 §6). Prints are append-only too (copy numbering).
CREATE FUNCTION tax_document_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is issued and can''t be changed (% blocked): issue a credit note instead', TG_TABLE_NAME, TG_OP;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_invoice_immutable BEFORE UPDATE OR DELETE ON "TaxInvoice" FOR EACH ROW EXECUTE FUNCTION tax_document_immutable();
CREATE TRIGGER credit_note_immutable BEFORE UPDATE OR DELETE ON "CreditNote" FOR EACH ROW EXECUTE FUNCTION tax_document_immutable();
CREATE TRIGGER invoice_print_immutable BEFORE UPDATE OR DELETE ON "InvoicePrint" FOR EACH ROW EXECUTE FUNCTION tax_document_immutable();

-- The figures always add up, and each print or sync row belongs to exactly one document.
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_figures" CHECK ("seq" > 0 AND "taxable" + "vat" = "total" AND "gross" - "discount" = "taxable" AND "discount" >= 0 AND "vat" >= 0);
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_figures" CHECK ("seq" > 0 AND "taxable" + "vat" = "total" AND "gross" - "discount" = "taxable" AND "total" > 0);
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_pan_format" CHECK ("buyerPan" IS NULL OR "buyerPan" ~ '^[0-9]{9}$');
ALTER TABLE "InvoicePrint" ADD CONSTRAINT "InvoicePrint_one_document" CHECK (("invoiceId" IS NULL) <> ("creditNoteId" IS NULL) AND "copy" >= 0);
ALTER TABLE "CbmsSync" ADD CONSTRAINT "CbmsSync_one_document" CHECK (("invoiceId" IS NULL) <> ("creditNoteId" IS NULL));
