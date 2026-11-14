-- DropForeignKey
ALTER TABLE "AreaAccess" DROP CONSTRAINT "AreaAccess_areaId_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "photo" BYTEA,
ADD COLUMN     "photoType" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "mesaCode" TEXT;

-- DropTable
DROP TABLE "AreaAccess";

-- CreateTable
CREATE TABLE "MatchJudge" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "MatchJudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchJudge_code_key" ON "MatchJudge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MatchJudge_matchId_seat_key" ON "MatchJudge"("matchId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_mesaCode_key" ON "Tournament"("mesaCode");

-- AddForeignKey
ALTER TABLE "MatchJudge" ADD CONSTRAINT "MatchJudge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

