-- CreateTable
CREATE TABLE "lobbies" (
    "roomCode" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'lobby',
    "playerCount" INTEGER NOT NULL DEFAULT 1,
    "racerCount" INTEGER NOT NULL DEFAULT 1,
    "maxRacers" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lobbies_pkey" PRIMARY KEY ("roomCode")
);

-- CreateIndex
CREATE INDEX "lobbies_updatedAt_idx" ON "lobbies"("updatedAt");

-- AddForeignKey
ALTER TABLE "lobbies" ADD CONSTRAINT "lobbies_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
