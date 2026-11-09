-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allLocations" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StaffLocation" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLocation_pkey" PRIMARY KEY ("userId","storeId")
);

-- CreateIndex
CREATE INDEX "StaffLocation_storeId_idx" ON "StaffLocation"("storeId");

-- AddForeignKey
ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nothing changes for anyone on release day: existing staff keep access everywhere until the owner
-- assigns them to specific locations. New staff start with no locations (assigned when hired).
UPDATE "User" SET "allLocations" = true WHERE "role" <> 'CUSTOMER';
