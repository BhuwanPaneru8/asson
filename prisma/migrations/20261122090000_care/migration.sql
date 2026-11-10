-- CreateEnum
CREATE TYPE "CareChannel" AS ENUM ('WEB', 'PHONE', 'WHATSAPP', 'SHOP', 'EMAIL', 'SOCIAL');

-- CreateEnum
CREATE TYPE "CareCategory" AS ENUM ('ORDER', 'DELIVERY', 'PAYMENT', 'QUALITY', 'EXCHANGE', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "CareStatus" AS ENUM ('NEW', 'OPEN', 'WAITING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CareMessageKind" AS ENUM ('CUSTOMER', 'REPLY', 'NOTE');

-- CreateTable
CREATE TABLE "CareCase" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "channel" "CareChannel" NOT NULL,
    "category" "CareCategory" NOT NULL,
    "priority" "IssuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CareStatus" NOT NULL DEFAULT 'NEW',
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "userId" TEXT,
    "orderId" TEXT,
    "storeId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "respondBy" TIMESTAMP(3),
    "firstReplyAt" TIMESTAMP(3),
    "lastCustomerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "CareMessageKind" NOT NULL,
    "body" TEXT NOT NULL,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareCase_number_key" ON "CareCase"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CareCase_token_key" ON "CareCase"("token");

-- CreateIndex
CREATE INDEX "CareCase_status_respondBy_idx" ON "CareCase"("status", "respondBy");

-- CreateIndex
CREATE INDEX "CareCase_phone_idx" ON "CareCase"("phone");

-- CreateIndex
CREATE INDEX "CareCase_userId_idx" ON "CareCase"("userId");

-- CreateIndex
CREATE INDEX "CareCase_orderId_idx" ON "CareCase"("orderId");

-- CreateIndex
CREATE INDEX "CareCase_storeId_createdAt_idx" ON "CareCase"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "CareMessage_caseId_createdAt_idx" ON "CareMessage"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareMessage" ADD CONSTRAINT "CareMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CareCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- a resolved case always says when; a case reachable by the customer has a way to reach them back
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_resolved_has_time" CHECK (("status" = 'RESOLVED') = ("resolvedAt" IS NOT NULL));
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_contact" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
