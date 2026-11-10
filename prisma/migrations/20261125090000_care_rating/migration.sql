-- AlterTable
ALTER TABLE "CareCase" ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT NOT NULL DEFAULT '';


ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_rating_range" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));
ALTER TABLE "CareCase" ADD CONSTRAINT "CareCase_rating_time" CHECK (("rating" IS NULL) = ("ratedAt" IS NULL));
