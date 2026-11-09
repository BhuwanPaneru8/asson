-- CreateTable
CREATE TABLE "Look" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "story" TEXT,
    "heroImage" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Look_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookItem" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "LookItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Look_slug_key" ON "Look"("slug");

-- CreateIndex
CREATE INDEX "Look_published_position_idx" ON "Look"("published", "position");

-- CreateIndex
CREATE INDEX "LookItem_productId_idx" ON "LookItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LookItem_lookId_productId_key" ON "LookItem"("lookId", "productId");

-- AddForeignKey
ALTER TABLE "LookItem" ADD CONSTRAINT "LookItem_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "Look"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookItem" ADD CONSTRAINT "LookItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

