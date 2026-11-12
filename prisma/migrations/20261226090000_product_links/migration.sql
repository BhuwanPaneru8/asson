-- CreateEnum
CREATE TYPE "LinkKind" AS ENUM ('BOUGHT_WITH', 'SIMILAR');

-- CreateTable
CREATE TABLE "ProductLink" (
    "productId" TEXT NOT NULL,
    "otherId" TEXT NOT NULL,
    "kind" "LinkKind" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "support" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLink_pkey" PRIMARY KEY ("productId","kind","otherId")
);

-- CreateIndex
CREATE INDEX "ProductLink_productId_kind_score_idx" ON "ProductLink"("productId", "kind", "score");

