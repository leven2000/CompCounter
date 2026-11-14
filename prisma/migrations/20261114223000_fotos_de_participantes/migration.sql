-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "photo",
DROP COLUMN "photoType",
ADD COLUMN     "photoVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ParticipantPhoto" (
    "participantId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "ParticipantPhoto_pkey" PRIMARY KEY ("participantId")
);

-- AddForeignKey
ALTER TABLE "ParticipantPhoto" ADD CONSTRAINT "ParticipantPhoto_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

