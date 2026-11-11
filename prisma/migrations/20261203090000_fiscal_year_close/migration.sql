-- CreateTable
CREATE TABLE "FiscalYearClose" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "snapshot" JSONB,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYearClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYearClose_label_key" ON "FiscalYearClose"("label");


ALTER TABLE "FiscalYearClose" ADD CONSTRAINT "FiscalYearClose_label" CHECK ("label" ~ '^\d{4}/\d{2}$');
ALTER TABLE "FiscalYearClose" ADD CONSTRAINT "FiscalYearClose_period" CHECK ("from" ~ '^\d{4}-\d{2}-\d{2}$' AND "to" ~ '^\d{4}-\d{2}-\d{2}$' AND "from" < "to");
