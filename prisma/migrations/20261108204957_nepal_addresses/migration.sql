-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "district" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "postalCode" DROP NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'Nepal';
