-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('OPEN', 'HANDED_OVER', 'CANCELLED');

-- CreateTable
CREATE TABLE "Manifest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "storeId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riderName" TEXT,
    "riderPhone" TEXT,
    "handedAt" TIMESTAMP(3),
    "handedById" TEXT,
    "parcels" INTEGER,
    "codTotal" INTEGER,

    CONSTRAINT "Manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestOrder" (
    "manifestId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "cod" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestOrder_pkey" PRIMARY KEY ("manifestId","orderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manifest_number_key" ON "Manifest"("number");

-- CreateIndex
CREATE INDEX "Manifest_storeId_status_idx" ON "Manifest"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManifestOrder_orderId_key" ON "ManifestOrder"("orderId");

-- AddForeignKey
ALTER TABLE "Manifest" ADD CONSTRAINT "Manifest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestOrder" ADD CONSTRAINT "ManifestOrder_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestOrder" ADD CONSTRAINT "ManifestOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- one open manifest per courier per location, so every scan lands on the same list
CREATE UNIQUE INDEX "Manifest_open_carrier" ON "Manifest" ("storeId", lower("carrier")) WHERE "status" = 'OPEN';
ALTER TABLE "ManifestOrder" ADD CONSTRAINT "ManifestOrder_cod_nonneg" CHECK ("cod" >= 0);
ALTER TABLE "Manifest" ADD CONSTRAINT "Manifest_handed_complete" CHECK ("status" <> 'HANDED_OVER' OR ("riderName" IS NOT NULL AND "handedAt" IS NOT NULL AND "parcels" IS NOT NULL AND "codTotal" IS NOT NULL));
