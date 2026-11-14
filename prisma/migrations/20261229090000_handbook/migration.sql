-- Handbook reading progress (Admin → Handbook)
CREATE TABLE "HandbookRead" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quizScore" INTEGER,
    "quizAt" TIMESTAMP(3),

    CONSTRAINT "HandbookRead_pkey" PRIMARY KEY ("userId","slug")
);

CREATE INDEX "HandbookRead_userId_idx" ON "HandbookRead"("userId");
