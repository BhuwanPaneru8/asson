-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupStoreId" TEXT;

-- CreateIndex
CREATE INDEX "Order_pickupStoreId_status_idx" ON "Order"("pickupStoreId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupStoreId_fkey" FOREIGN KEY ("pickupStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

