-- CreateEnum
CREATE TYPE "StoreKind" AS ENUM ('SHOP', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hours" TEXT,
ADD COLUMN     "kind" "StoreKind" NOT NULL DEFAULT 'SHOP',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StoreStock" (
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreStock_pkey" PRIMARY KEY ("storeId","variantId")
);

-- CreateTable
CREATE TABLE "OrderAllocation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "variantId" TEXT,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pickedAt" TIMESTAMP(3),
    "pickedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "received" INTEGER,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreStock_variantId_idx" ON "StoreStock"("variantId");

-- CreateIndex
CREATE INDEX "OrderAllocation_storeId_pickedAt_idx" ON "OrderAllocation"("storeId", "pickedAt");

-- CreateIndex
CREATE INDEX "OrderAllocation_orderId_idx" ON "OrderAllocation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_number_key" ON "StockTransfer"("number");

-- CreateIndex
CREATE INDEX "StockTransfer_status_createdAt_idx" ON "StockTransfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_fromId_status_idx" ON "StockTransfer"("fromId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_toId_status_idx" ON "StockTransfer"("toId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItem_transferId_variantId_key" ON "StockTransferItem"("transferId", "variantId");

-- CreateIndex
CREATE INDEX "InventoryLog_storeId_createdAt_idx" ON "InventoryLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Store_active_priority_idx" ON "Store"("active", "priority");

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreStock" ADD CONSTRAINT "StoreStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreStock" ADD CONSTRAINT "StoreStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Multi-location stock: hand-written part (review with the rest).
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "StoreStock" ADD CONSTRAINT "StoreStock_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_quantities"
  CHECK ("quantity" > 0 AND ("received" IS NULL OR ("received" >= 0 AND "received" <= "quantity")));
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_distinct_ends" CHECK ("fromId" <> "toId");

-- Everything on hand today sits at the flagship (created here if the till was never opened).
-- The owner can rename it, mark it a warehouse, or transfer stock out once more locations exist.
INSERT INTO "Store" ("id", "code", "name", "address", "kind", "priority", "pickup", "active")
VALUES ('loc_' || substr(md5(random()::text || clock_timestamp()::text), 1, 21), 'FLAGSHIP', 'Asson Flagship', 'Kathmandu, Nepal', 'SHOP', 10, false, true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StoreStock" ("storeId", "variantId", "quantity")
SELECT s."id", v."id", v."stock"
FROM "Variant" v CROSS JOIN (SELECT "id" FROM "Store" WHERE "code" = 'FLAGSHIP') s
WHERE v."stock" > 0;

-- Variant.stock = SUM(StoreStock.quantity), maintained here so no code path can drift.
CREATE FUNCTION store_stock_sync() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."quantity" <> 0 THEN
      UPDATE "Variant" SET "stock" = "stock" + NEW."quantity" WHERE "id" = NEW."variantId";
    END IF;
  ELSE
    IF NEW."variantId" <> OLD."variantId" OR NEW."storeId" <> OLD."storeId" THEN
      RAISE EXCEPTION 'StoreStock rows cannot be re-keyed; move stock with a transfer';
    END IF;
    IF NEW."quantity" <> OLD."quantity" THEN
      UPDATE "Variant" SET "stock" = "stock" + (NEW."quantity" - OLD."quantity") WHERE "id" = NEW."variantId";
    END IF;
  END IF;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER store_stock_sync
AFTER INSERT OR UPDATE ON "StoreStock"
FOR EACH ROW EXECUTE FUNCTION store_stock_sync();

-- A location's stock row can only disappear when it is empty, or together with its variant.
CREATE FUNCTION store_stock_no_delete() RETURNS trigger AS $$
BEGIN
  IF OLD."quantity" <> 0 AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'StoreStock row still holds % unit(s); adjust it to zero first', OLD."quantity";
  END IF;
  RETURN OLD;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER store_stock_no_delete
BEFORE DELETE ON "StoreStock"
FOR EACH ROW EXECUTE FUNCTION store_stock_no_delete();

-- Direct writes to Variant.stock are rejected: change StoreStock (lib/stock.ts) instead.
-- pg_trigger_depth() = 1 means the statement came from the application, not from store_stock_sync.
CREATE FUNCTION variant_stock_guard() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' AND NEW."stock" <> 0 THEN
      RAISE EXCEPTION 'Variant.stock is derived from StoreStock: create variants with stock 0, then add stock at a location';
    ELSIF TG_OP = 'UPDATE' AND NEW."stock" IS DISTINCT FROM OLD."stock" THEN
      RAISE EXCEPTION 'Variant.stock is derived from StoreStock: change stock at a location (lib/stock.ts)';
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER variant_stock_guard
BEFORE INSERT OR UPDATE OF "stock" ON "Variant"
FOR EACH ROW EXECUTE FUNCTION variant_stock_guard();
