-- CreateEnum
CREATE TYPE "SopArea" AS ENUM ('SALES', 'CASH', 'FULFILMENT', 'STOCK', 'CUSTOMERS', 'PEOPLE');

-- CreateTable
CREATE TABLE "Sop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" "SopArea" NOT NULL,
    "roles" TEXT[],
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopSignoff" (
    "sopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SopSignoff_pkey" PRIMARY KEY ("sopId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sop_slug_key" ON "Sop"("slug");

-- CreateIndex
CREATE INDEX "Sop_active_area_idx" ON "Sop"("active", "area");

-- CreateIndex
CREATE INDEX "SopSignoff_userId_idx" ON "SopSignoff"("userId");

-- AddForeignKey
ALTER TABLE "SopSignoff" ADD CONSTRAINT "SopSignoff_sopId_fkey" FOREIGN KEY ("sopId") REFERENCES "Sop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

