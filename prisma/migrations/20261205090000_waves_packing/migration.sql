-- CreateEnum
CREATE TYPE "WaveStatus" AS ENUM ('OPEN', 'PICKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PickWave" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "WaveStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedById" TEXT,
    "pickedAt" TIMESTAMP(3),

    CONSTRAINT "PickWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaveOrder" (
    "waveId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "WaveOrder_pkey" PRIMARY KEY ("waveId","orderId")
);

-- CreateTable
CREATE TABLE "PackCheck" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT,
    "scans" JSONB NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "override" TEXT NOT NULL DEFAULT '',
    "weightGrams" INTEGER,
    "box" TEXT,
    "packedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickWave_number_key" ON "PickWave"("number");

-- CreateIndex
CREATE INDEX "PickWave_storeId_status_idx" ON "PickWave"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaveOrder_orderId_key" ON "WaveOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WaveOrder_waveId_slot_key" ON "WaveOrder"("waveId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "PackCheck_orderId_key" ON "PackCheck"("orderId");

-- AddForeignKey
ALTER TABLE "PickWave" ADD CONSTRAINT "PickWave_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaveOrder" ADD CONSTRAINT "WaveOrder_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "PickWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaveOrder" ADD CONSTRAINT "WaveOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackCheck" ADD CONSTRAINT "PackCheck_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "WaveOrder" ADD CONSTRAINT "WaveOrder_slot" CHECK ("slot" >= 1);
ALTER TABLE "PackCheck" ADD CONSTRAINT "PackCheck_weight" CHECK ("weightGrams" IS NULL OR "weightGrams" BETWEEN 1 AND 100000);
ALTER TABLE "PackCheck" ADD CONSTRAINT "PackCheck_override" CHECK ("matched" OR length("override") > 0);
ALTER TABLE "PickWave" ADD CONSTRAINT "PickWave_picked" CHECK (("status" = 'PICKED') = ("pickedAt" IS NOT NULL));
