-- CreateEnum
CREATE TYPE "PriceEventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PriceEvent" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "PriceEventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PriceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceEventItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "newPrice" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "originalCompareAt" INTEGER,
    "restoreSkipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PriceEventItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceEvent_number_key" ON "PriceEvent"("number");

-- CreateIndex
CREATE INDEX "PriceEvent_status_startsAt_idx" ON "PriceEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "PriceEventItem_productId_idx" ON "PriceEventItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceEventItem_eventId_productId_key" ON "PriceEventItem"("eventId", "productId");

-- AddForeignKey
ALTER TABLE "PriceEventItem" ADD CONSTRAINT "PriceEventItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PriceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEventItem" ADD CONSTRAINT "PriceEventItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PriceEventItem" ADD CONSTRAINT "PriceEventItem_price" CHECK ("newPrice" > 0);
ALTER TABLE "PriceEvent" ADD CONSTRAINT "PriceEvent_dates" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
