-- CreateEnum
CREATE TYPE "DamageKind" AS ENUM ('IN', 'REPAIRED', 'WRITTEN_OFF', 'TO_SUPPLIER');

-- CreateTable
CREATE TABLE "DamageEntry" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "kind" "DamageKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "source" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT,
    "creditExpected" INTEGER,
    "creditReceived" INTEGER,
    "creditAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DamageEntry_storeId_variantId_idx" ON "DamageEntry"("storeId", "variantId");

-- CreateIndex
CREATE INDEX "DamageEntry_kind_createdAt_idx" ON "DamageEntry"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "DamageEntry_supplierId_kind_idx" ON "DamageEntry"("supplierId", "kind");

-- AddForeignKey
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- in is positive, everything else takes units out
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_sign" CHECK (("kind" = 'IN' AND "quantity" > 0) OR ("kind" <> 'IN' AND "quantity" < 0));
ALTER TABLE "DamageEntry" ADD CONSTRAINT "DamageEntry_supplier" CHECK ("kind" <> 'TO_SUPPLIER' OR "supplierId" IS NOT NULL);
-- append-only: credits are the only thing filled in later
CREATE OR REPLACE FUNCTION damage_entry_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Damage entries are never deleted'; END IF;
  IF NEW."storeId" <> OLD."storeId" OR NEW."variantId" <> OLD."variantId" OR NEW."kind" <> OLD."kind" OR NEW."quantity" <> OLD."quantity" OR NEW."source" <> OLD."source" THEN
    RAISE EXCEPTION 'Damage entries are append-only (only a supplier credit can be recorded afterwards)';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER damage_entry_append_only BEFORE UPDATE OR DELETE ON "DamageEntry" FOR EACH ROW EXECUTE FUNCTION damage_entry_append_only();
