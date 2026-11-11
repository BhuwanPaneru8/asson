-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortKey" TEXT NOT NULL,
    "zone" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinAssignment" (
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinAssignment_pkey" PRIMARY KEY ("storeId","variantId")
);

-- CreateIndex
CREATE INDEX "Bin_storeId_sortKey_idx" ON "Bin"("storeId", "sortKey");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_storeId_code_key" ON "Bin"("storeId", "code");

-- CreateIndex
CREATE INDEX "BinAssignment_binId_idx" ON "BinAssignment"("binId");

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinAssignment" ADD CONSTRAINT "BinAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinAssignment" ADD CONSTRAINT "BinAssignment_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Bin" ADD CONSTRAINT "Bin_code" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9-]{0,19}$');
-- a variant's home bin must be at the same location as the assignment
CREATE OR REPLACE FUNCTION bin_assignment_same_store() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Bin" b WHERE b."id" = NEW."binId" AND b."storeId" = NEW."storeId") THEN
    RAISE EXCEPTION 'That bin is at another location';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER bin_assignment_same_store BEFORE INSERT OR UPDATE ON "BinAssignment" FOR EACH ROW EXECUTE FUNCTION bin_assignment_same_store();
