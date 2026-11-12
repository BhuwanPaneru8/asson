-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "takenAtStoreId" TEXT;

-- CreateIndex
CREATE INDEX "Order_takenAtStoreId_createdAt_idx" ON "Order"("takenAtStoreId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_takenAtStoreId_fkey" FOREIGN KEY ("takenAtStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

