-- CreateTable
CREATE TABLE "DeliveryRate" (
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "etaMinDays" INTEGER NOT NULL,
    "etaMaxDays" INTEGER NOT NULL,
    "expressAvailable" BOOLEAN NOT NULL DEFAULT false,
    "codAvailable" BOOLEAN NOT NULL DEFAULT true,
    "serviceable" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("district")
);

-- CreateIndex
CREATE INDEX "DeliveryRate_province_idx" ON "DeliveryRate"("province");
