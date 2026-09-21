-- CreateTable
CREATE TABLE "race_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "lapTimeMs" INTEGER NOT NULL,
    "raceTimeMs" INTEGER,
    "position" INTEGER,
    "mode" "MatchMode" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "race_results_userId_createdAt_idx" ON "race_results"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "race_results_track_lapTimeMs_idx" ON "race_results"("track", "lapTimeMs");

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
