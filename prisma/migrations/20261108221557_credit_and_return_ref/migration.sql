-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "isCredit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Return" ADD COLUMN     "clientRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Return_clientRef_key" ON "Return"("clientRef");

