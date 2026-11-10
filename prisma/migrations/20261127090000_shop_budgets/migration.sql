-- CreateTable
CREATE TABLE "ShopBudget" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "sales" INTEGER NOT NULL,
    "marginPm" INTEGER,
    "costs" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopBudget_month_idx" ON "ShopBudget"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ShopBudget_storeId_month_key" ON "ShopBudget"("storeId", "month");

-- AddForeignKey
ALTER TABLE "ShopBudget" ADD CONSTRAINT "ShopBudget_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ShopBudget" ADD CONSTRAINT "ShopBudget_amounts" CHECK ("sales" >= 0 AND "costs" >= 0 AND ("marginPm" IS NULL OR "marginPm" BETWEEN 0 AND 1000));
ALTER TABLE "ShopBudget" ADD CONSTRAINT "ShopBudget_month" CHECK ("month" ~ '^\d{4}-(0[1-9]|1[0-2])$');
