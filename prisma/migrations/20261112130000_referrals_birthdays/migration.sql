-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "referralRewardedAt" TIMESTAMP(3),
ADD COLUMN     "referrerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthday" TEXT,
ADD COLUMN     "birthdayRewardYear" INTEGER,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");


ALTER TABLE "User" ADD CONSTRAINT "User_birthday_format" CHECK ("birthday" IS NULL OR "birthday" ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
CREATE INDEX "Order_referrerId_idx" ON "Order"("referrerId");
