-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "mode" "MatchMode" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "status" "MatchStatus" NOT NULL DEFAULT 'WAITING';
