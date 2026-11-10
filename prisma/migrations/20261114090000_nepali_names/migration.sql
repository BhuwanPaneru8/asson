-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "descriptionNe" TEXT,
ADD COLUMN     "nameNe" TEXT;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "descriptionNe" TEXT,
ADD COLUMN     "nameNe" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "descriptionNe" TEXT,
ADD COLUMN     "nameNe" TEXT;

