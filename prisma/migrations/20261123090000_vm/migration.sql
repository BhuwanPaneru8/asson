-- CreateEnum
CREATE TYPE "VmStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REDO');

-- CreateTable
CREATE TABLE "VmBrief" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "refPhotos" TEXT[],
    "areas" JSONB NOT NULL,
    "criteria" JSONB NOT NULL,
    "storeIds" TEXT[],
    "dueAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VmBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSubmission" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "VmStatus" NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "photos" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "feedback" TEXT NOT NULL DEFAULT '',
    "scores" INTEGER[],
    "score" INTEGER,

    CONSTRAINT "VmSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "status" "VmStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VmEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VmBrief_number_key" ON "VmBrief"("number");

-- CreateIndex
CREATE INDEX "VmBrief_createdAt_idx" ON "VmBrief"("createdAt");

-- CreateIndex
CREATE INDEX "VmSubmission_storeId_reviewedAt_idx" ON "VmSubmission"("storeId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VmSubmission_briefId_storeId_key" ON "VmSubmission"("briefId", "storeId");

-- CreateIndex
CREATE INDEX "VmEvent_submissionId_createdAt_idx" ON "VmEvent"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "VmSubmission" ADD CONSTRAINT "VmSubmission_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "VmBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSubmission" ADD CONSTRAINT "VmSubmission_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmEvent" ADD CONSTRAINT "VmEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VmSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "VmSubmission" ADD CONSTRAINT "VmSubmission_score_range" CHECK ("score" IS NULL OR ("score" BETWEEN 0 AND 100));
ALTER TABLE "VmSubmission" ADD CONSTRAINT "VmSubmission_approved_scored" CHECK (("status" = 'APPROVED') = ("score" IS NOT NULL));
ALTER TABLE "VmSubmission" ADD CONSTRAINT "VmSubmission_round_pos" CHECK ("round" >= 1);
ALTER TABLE "VmBrief" ADD CONSTRAINT "VmBrief_ref_photos_max" CHECK (cardinality("refPhotos") <= 6);
