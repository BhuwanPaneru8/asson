-- CreateTable
CREATE TABLE "FunnelStat" (
    "day" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FunnelStat_pkey" PRIMARY KEY ("day","step")
);

-- CreateTable
CREATE TABLE "ProductStat" (
    "day" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "adds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductStat_pkey" PRIMARY KEY ("day","productId")
);

-- CreateIndex
CREATE INDEX "ProductStat_productId_idx" ON "ProductStat"("productId");

-- AddForeignKey
ALTER TABLE "ProductStat" ADD CONSTRAINT "ProductStat_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

