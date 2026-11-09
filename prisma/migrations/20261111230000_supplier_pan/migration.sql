-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "pan" TEXT;

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_pan_format" CHECK ("pan" IS NULL OR "pan" ~ '^[0-9]{9}$');
