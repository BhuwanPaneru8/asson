-- CreateEnum
CREATE TYPE "DeliveryFailReason" AS ENUM ('CUSTOMER_REFUSED', 'NOT_REACHABLE', 'NOT_HOME', 'WRONG_ADDRESS', 'COD_NOT_READY', 'RESCHEDULED', 'OTHER');

-- CreateEnum
CREATE TYPE "RtoState" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'LOST');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNING';

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" "DeliveryFailReason" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnToOrigin" (
    "orderId" TEXT NOT NULL,
    "reason" "DeliveryFailReason" NOT NULL,
    "carrier" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedById" TEXT NOT NULL,
    "state" "RtoState" NOT NULL DEFAULT 'IN_TRANSIT',
    "storeId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "damaged" BOOLEAN NOT NULL DEFAULT false,
    "courierCharge" INTEGER NOT NULL DEFAULT 0,
    "claimAmount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReturnToOrigin_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "DeliveryAttempt_orderId_idx" ON "DeliveryAttempt"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_createdAt_idx" ON "DeliveryAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "ReturnToOrigin_state_startedAt_idx" ON "ReturnToOrigin"("state", "startedAt");

-- CreateIndex
CREATE INDEX "ReturnToOrigin_startedAt_idx" ON "ReturnToOrigin"("startedAt");

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnToOrigin" ADD CONSTRAINT "ReturnToOrigin_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnToOrigin" ADD CONSTRAINT "ReturnToOrigin_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "ReturnToOrigin" ADD CONSTRAINT "ReturnToOrigin_money_nonneg" CHECK ("courierCharge" >= 0 AND "claimAmount" >= 0);
-- a received parcel says where; a closed one says when and by whom
ALTER TABLE "ReturnToOrigin" ADD CONSTRAINT "ReturnToOrigin_closed_complete" CHECK (
  ("state" = 'IN_TRANSIT' AND "closedAt" IS NULL) OR
  ("state" = 'RECEIVED' AND "storeId" IS NOT NULL AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL) OR
  ("state" = 'LOST' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL));
