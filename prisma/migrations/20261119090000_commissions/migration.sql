-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "commission" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "rateBp" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_sane" CHECK ("rateBp" >= 0 AND "rateBp" <= 2000 AND "threshold" >= 0);
-- one rule per shop, and one for "every shop" (partial indexes: not in schema.prisma; Prisma diff ignores them)
CREATE UNIQUE INDEX "CommissionRule_one_per_store" ON "CommissionRule"("storeId") WHERE "storeId" IS NOT NULL;
CREATE UNIQUE INDEX "CommissionRule_one_default" ON "CommissionRule"((1)) WHERE "storeId" IS NULL;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_commission_nonneg" CHECK ("commission" >= 0);
