-- CreateTable
CREATE TABLE "SearchStat" (
    "day" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "zeroResults" INTEGER NOT NULL DEFAULT 0,
    "lastResults" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SearchStat_pkey" PRIMARY KEY ("day","term")
);

-- CreateIndex
CREATE INDEX "SearchStat_term_idx" ON "SearchStat"("term");

