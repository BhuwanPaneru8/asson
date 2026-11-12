-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "minStaff" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "RosterShift" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterWeek" (
    "storeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "publishedById" TEXT NOT NULL,

    CONSTRAINT "RosterWeek_pkey" PRIMARY KEY ("storeId","weekStart")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "RosterShift_storeId_date_idx" ON "RosterShift"("storeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RosterShift_userId_date_key" ON "RosterShift"("userId", "date");

-- AddForeignKey
ALTER TABLE "RosterShift" ADD CONSTRAINT "RosterShift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterShift" ADD CONSTRAINT "RosterShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterWeek" ADD CONSTRAINT "RosterWeek_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- times are HH:MM on the same day; dates are YYYY-MM-DD
ALTER TABLE "RosterShift" ADD CONSTRAINT "RosterShift_times" CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$' AND "start" ~ '^([01]\d|2[0-3]):[0-5]\d$' AND "end" ~ '^([01]\d|2[0-3]):[0-5]\d$' AND "end" > "start");
ALTER TABLE "Store" ADD CONSTRAINT "Store_minStaff" CHECK ("minStaff" BETWEEN 0 AND 50);
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_date" CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$');
