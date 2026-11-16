-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "dqAt" INTEGER,
ADD COLUMN     "minusMode" TEXT,
ADD COLUMN     "minusValue" INTEGER;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "customRules" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dqAt" INTEGER,
ADD COLUMN     "minusMode" TEXT,
ADD COLUMN     "minusValue" INTEGER;

