-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "source" TEXT,
ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "RecurringCost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_source_key" ON "Expense"("source");

-- CreateIndex
CREATE INDEX "Expense_storeId_date_idx" ON "Expense"("storeId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCost" ADD CONSTRAINT "RecurringCost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "RecurringCost" ADD CONSTRAINT "RecurringCost_amount_pos" CHECK ("amount" > 0);
ALTER TABLE "RecurringCost" ADD CONSTRAINT "RecurringCost_months" CHECK ("startMonth" ~ '^\d{4}-\d{2}$' AND ("endMonth" IS NULL OR ("endMonth" ~ '^\d{4}-\d{2}$' AND "endMonth" >= "startMonth")));
