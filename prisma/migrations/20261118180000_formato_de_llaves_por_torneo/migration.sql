-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "bracketFormat" TEXT NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "roundRobinMax" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT false;
