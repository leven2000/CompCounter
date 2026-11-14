-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ORGANIZER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ORGANIZER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" BYTEA,
    "logoType" TEXT,
    "colorPrimary" TEXT NOT NULL DEFAULT '#b91c1c',
    "colorAccent" TEXT NOT NULL DEFAULT '#111827',
    "tvTheme" TEXT NOT NULL DEFAULT 'dark',
    "corner1Name" TEXT NOT NULL DEFAULT 'Rojo',
    "corner1Color" TEXT NOT NULL DEFAULT '#dc2626',
    "corner2Name" TEXT NOT NULL DEFAULT 'Azul',
    "corner2Color" TEXT NOT NULL DEFAULT '#2563eb',
    "showFlags" BOOLEAN NOT NULL DEFAULT true,
    "showTeams" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "judges" INTEGER NOT NULL DEFAULT 3,
    "currentMatchId" TEXT,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaAccess" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "seat" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,

    CONSTRAINT "AreaAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleset" TEXT NOT NULL,
    "gender" TEXT,
    "ageGroup" TEXT,
    "level" TEXT,
    "weightMin" DOUBLE PRECISION,
    "weightMax" DOUBLE PRECISION,
    "rounds" INTEGER NOT NULL,
    "roundSeconds" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'AUTO',
    "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT false,
    "autoLadder" BOOLEAN NOT NULL DEFAULT true,
    "bracketFormat" TEXT,
    "areaId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "team" TEXT,
    "country" TEXT,
    "gender" TEXT,
    "birthYear" INTEGER,
    "level" TEXT,
    "weight" DOUBLE PRECISION,
    "weighIn" DOUBLE PRECISION,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "seed" INTEGER,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "number" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "redEntryId" TEXT,
    "blueEntryId" TEXT,
    "winnerEntryId" TEXT,
    "winMethod" TEXT,
    "nextMatchId" TEXT,
    "nextSlot" TEXT,
    "loserNextMatchId" TEXT,
    "loserNextSlot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "clockRunning" BOOLEAN NOT NULL DEFAULT false,
    "clockRemainingMs" INTEGER NOT NULL DEFAULT 0,
    "clockStartedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "corner" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "judge" INTEGER,
    "round" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE INDEX "Tournament_orgId_idx" ON "Tournament"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Area_currentMatchId_key" ON "Area"("currentMatchId");

-- CreateIndex
CREATE INDEX "Area_tournamentId_idx" ON "Area"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaAccess_code_key" ON "AreaAccess"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AreaAccess_areaId_role_seat_key" ON "AreaAccess"("areaId", "role", "seat");

-- CreateIndex
CREATE INDEX "Category_tournamentId_idx" ON "Category"("tournamentId");

-- CreateIndex
CREATE INDEX "Participant_tournamentId_idx" ON "Participant"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_categoryId_participantId_key" ON "Entry"("categoryId", "participantId");

-- CreateIndex
CREATE INDEX "Match_categoryId_idx" ON "Match"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEvent_clientId_key" ON "ScoreEvent"("clientId");

-- CreateIndex
CREATE INDEX "ScoreEvent_matchId_idx" ON "ScoreEvent"("matchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_currentMatchId_fkey" FOREIGN KEY ("currentMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaAccess" ADD CONSTRAINT "AreaAccess_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_redEntryId_fkey" FOREIGN KEY ("redEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_blueEntryId_fkey" FOREIGN KEY ("blueEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
