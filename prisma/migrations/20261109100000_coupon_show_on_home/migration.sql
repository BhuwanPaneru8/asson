-- Coupon featured in the home-page offer banner
ALTER TABLE "Coupon" ADD COLUMN "showOnHome" BOOLEAN NOT NULL DEFAULT false;
