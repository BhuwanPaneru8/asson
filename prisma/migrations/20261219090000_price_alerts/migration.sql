-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceAlert_productId_notifiedAt_idx" ON "PriceAlert"("productId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_productId_phone_key" ON "PriceAlert"("productId", "phone");

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

