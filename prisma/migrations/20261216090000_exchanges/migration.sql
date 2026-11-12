-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "RefundMethod" ADD VALUE 'EXCHANGE';

-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "replacementId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'OPEN',
    "returnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeItem" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "newVariantId" TEXT NOT NULL,

    CONSTRAINT "ExchangeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_number_key" ON "Exchange"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_replacementId_key" ON "Exchange"("replacementId");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_returnId_key" ON "Exchange"("returnId");

-- CreateIndex
CREATE INDEX "Exchange_orderId_idx" ON "Exchange"("orderId");

-- CreateIndex
CREATE INDEX "Exchange_status_createdAt_idx" ON "Exchange"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExchangeItem_orderItemId_idx" ON "ExchangeItem"("orderItemId");

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_quantity" CHECK ("quantity" > 0);
-- an exchange is never its own replacement
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_not_self" CHECK ("orderId" <> "replacementId");
