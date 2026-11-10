-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "VisitActionStatus" AS ENUM ('OPEN', 'DONE', 'VERIFIED');

-- CreateTable
CREATE TABLE "VisitTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreVisit" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "auditorName" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "score" INTEGER,
    "criticalFails" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "ackById" TEXT,
    "ackByName" TEXT,
    "ackAt" TIMESTAMP(3),
    "ackNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StoreVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAction" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "VisitActionStatus" NOT NULL DEFAULT 'OPEN',
    "doneById" TEXT,
    "doneByName" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneNote" TEXT NOT NULL DEFAULT '',
    "donePhotos" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreVisit_number_key" ON "StoreVisit"("number");

-- CreateIndex
CREATE INDEX "StoreVisit_storeId_submittedAt_idx" ON "StoreVisit"("storeId", "submittedAt");

-- CreateIndex
CREATE INDEX "StoreVisit_status_idx" ON "StoreVisit"("status");

-- CreateIndex
CREATE INDEX "VisitAction_storeId_status_dueAt_idx" ON "VisitAction"("storeId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisitAction_visitId_itemIndex_key" ON "VisitAction"("visitId", "itemIndex");

-- AddForeignKey
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisitTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAction" ADD CONSTRAINT "VisitAction_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "StoreVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_score_range" CHECK ("score" IS NULL OR ("score" BETWEEN 0 AND 100));
-- a submitted visit has its time and score; a draft has neither
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_submitted" CHECK (("status" = 'DRAFT') = ("submittedAt" IS NULL));
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_ack" CHECK (("status" = 'ACKNOWLEDGED') = ("ackAt" IS NOT NULL));
ALTER TABLE "VisitAction" ADD CONSTRAINT "VisitAction_done" CHECK (("status" = 'OPEN') = ("doneAt" IS NULL));
-- one draft per shop at a time
CREATE UNIQUE INDEX "StoreVisit_one_draft_per_store" ON "StoreVisit" ("storeId") WHERE "status" = 'DRAFT';
