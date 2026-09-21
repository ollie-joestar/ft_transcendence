/**
 * races.ts — frontend client for the race-history / leaderboard backend.
 *
 * Thin wrappers over the shared `api` axios instance (which injects the JWT).
 * Each call unwraps the backend's `{ userdata }` envelope so callers get the
 * payload directly. Used by the game (submit on finish) and the
 * Leaderboard / Races pages.
 */
import api from "./api";
import type {
  LeaderboardEntry,
  UserStats,
  UserPercentile,
  RaceResultRow,
} from "../types";

// Payload sent when a logged-in player finishes a race. userId is taken from
// the JWT on the backend, never sent from here.
export interface SubmitRaceResultPayload {
  track: string;
  lapTimeMs: number;
  raceTimeMs?: number | null;
  position?: number | null;
  // A single time-trial lap (e.g. a new PB during a solo / infinite-laps run).
  // Counts toward personal best + leaderboard, but not race history / stats.
  trial?: boolean;
}

// Record a finished race for the authenticated user.
export async function submitRaceResult(
  payload: SubmitRaceResultPayload,
): Promise<void> {
  await api.post("/races", payload);
}

// Record one completed lap (every mode). Bumps the user's running
// laps-completed + total-time-driven + total-drift counters shown on the
// dashboard. driftMeters = distance slid during the lap (defaults to 0).
export async function recordLap(
  lapTimeMs: number,
  driftMeters = 0,
): Promise<void> {
  await api.post("/races/lap", { lapTimeMs, driftMeters });
}

// Per-track leaderboard, ranked by best lap (ascending).
export async function getLeaderboard(
  track: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const res = await api.get("/races/leaderboard", { params: { track, limit } });
  return res.data.userdata as LeaderboardEntry[];
}

// The authenticated user's aggregate stats (profile header).
export async function getMyStats(): Promise<UserStats> {
  const res = await api.get("/races/me/stats");
  return res.data.userdata as UserStats;
}

// The authenticated user's leaderboard percentile (averaged across tracks).
export async function getMyPercentile(): Promise<UserPercentile> {
  const res = await api.get("/races/me/percentile");
  return res.data.userdata as UserPercentile;
}

// The authenticated user's recent race history (newest first).
export async function getMyHistory(limit = 20): Promise<RaceResultRow[]> {
  const res = await api.get("/races/me", { params: { limit } });
  return res.data.userdata as RaceResultRow[];
}
