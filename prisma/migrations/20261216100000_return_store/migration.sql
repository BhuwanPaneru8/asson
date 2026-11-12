-- The shop a return was taken at (whose closing it belongs to)
ALTER TABLE "Return" ADD COLUMN "storeId" TEXT;

CREATE INDEX "Return_storeId_createdAt_idx" ON "Return"("storeId", "createdAt");

ALTER TABLE "Return" ADD CONSTRAINT "Return_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1: the till shift the return was taken on
UPDATE "Return" r SET "storeId" = s."storeId"
FROM "Shift" s
WHERE r."shiftId" = s."id" AND r."storeId" IS NULL;

-- Backfill 2: the stock movement the return wrote ("Store return R12" / "... (R12)") on the same order
UPDATE "Return" r SET "storeId" = l."storeId"
FROM (
  SELECT DISTINCT ON (r2."id") r2."id" AS "returnId", il."storeId"
  FROM "Return" r2
  JOIN "InventoryLog" il ON il."orderId" = r2."orderId"
    AND il."reason" IN ('RETURN_RESTOCK', 'DAMAGED')
    AND il."storeId" IS NOT NULL
    AND il."note" ~ ('\mR' || r2."number" || '\M')
  WHERE r2."storeId" IS NULL
  ORDER BY r2."id", il."createdAt"
) l
WHERE r."id" = l."returnId";

-- Backfill 3: older rows without the number in the note — the closest such movement within 5 minutes
UPDATE "Return" r SET "storeId" = l."storeId"
FROM (
  SELECT DISTINCT ON (r2."id") r2."id" AS "returnId", il."storeId"
  FROM "Return" r2
  JOIN "InventoryLog" il ON il."orderId" = r2."orderId"
    AND il."reason" IN ('RETURN_RESTOCK', 'DAMAGED')
    AND il."storeId" IS NOT NULL
    AND il."createdAt" BETWEEN r2."createdAt" - INTERVAL '5 minutes' AND r2."createdAt" + INTERVAL '5 minutes'
  WHERE r2."storeId" IS NULL
  ORDER BY r2."id", abs(extract(epoch FROM il."createdAt" - r2."createdAt"))
) l
WHERE r."id" = l."returnId";
