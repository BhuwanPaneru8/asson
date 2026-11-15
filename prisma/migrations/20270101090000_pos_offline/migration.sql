-- CreateEnum
CREATE TYPE "PosExceptionKind" AS ENUM ('STOCK_SHORT', 'SHIFT_CLOSED', 'DAY_LOCKED', 'PRICE_UNVERIFIED');

-- CreateTable
CREATE TABLE "PosDevice" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "shiftId" TEXT,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "oldestPendingAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosException" (
    "id" TEXT NOT NULL,
    "kind" "PosExceptionKind" NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolveNote" TEXT,

    CONSTRAINT "PosException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosDevice_storeId_pending_idx" ON "PosDevice"("storeId", "pending");

-- CreateIndex
CREATE INDEX "PosDevice_shiftId_pending_idx" ON "PosDevice"("shiftId", "pending");

-- CreateIndex
CREATE INDEX "PosException_orderId_idx" ON "PosException"("orderId");

-- CreateIndex
CREATE INDEX "PosException_storeId_resolvedAt_idx" ON "PosException"("storeId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "PosDevice" ADD CONSTRAINT "PosDevice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosException" ADD CONSTRAINT "PosException_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosException" ADD CONSTRAINT "PosException_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

