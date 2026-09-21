// ── Race / Match ─────────────────────────────────────────────────────────────

export type RaceMode = "RANKED" | "CASUAL";

// A stored race result row as returned by the backend (GET /races/me, etc.).
export type MatchMode = "NORMAL" | "RANKED" | "AI" | "TOURNAMENT";

export interface RaceResultRow {
  id: string;
  userId: string;
  track: string;
  lapTimeMs: number;
  raceTimeMs: number | null;
  position: number | null;
  mode: MatchMode;
  createdAt: string; // ISO timestamp
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  lapTimeMs: number;
  isCurrentUser?: boolean;
}

// ── Lobby ────────────────────────────────────────────────────────────────────

export interface Lobby {
  id: string;
  track: string;
  players: string; // e.g. "3/8"
  mode: RaceMode;
  ping: number; // ms
}

// A live multiplayer lobby as returned by the backend (GET /lobbies). The host
// heartbeats these; rows here are currently-active rooms, not history.
export interface LobbyRow {
  roomCode: string;
  hostUserId: string;
  hostName: string;
  track: string;
  phase: "lobby" | "racing";
  playerCount: number; // total players present (racers + spectators)
  racerCount: number; // non-spectator drivers
  maxRacers: number; // racer cap; overflow joins as spectators
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp (liveness clock)
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
}

// Aggregate stats for the profile header (GET /races/me/stats).
export interface UserStats {
  totalRaces: number;
  wins: number;
  lapsCompleted: number; // total finish-line crossings ever (all modes)
  totalTimeSec: number; // cumulative lap time driven, in seconds
  totalDriftM: number; // cumulative drift distance, in metres
  bestLapPerTrack: { track: string; lapTimeMs: number }[];
}

// Leaderboard percentile for the dashboard (GET /races/me/percentile).
// topPercent is the average across tracks the user has raced — smaller is
// better (e.g. 0.4 = top 0.4%); null when the user has no recorded laps.
export interface UserPercentile {
  topPercent: number | null;
  trackCount: number;
  ranks: number[]; // the user's position on each ranked track (1 = fastest)
}

// Aggregate profile for any user (GET /users/:username/profile, JWT).
export interface UserProfileResponse {
  id: string;
  username: string;
  joinedAt: string; // ISO timestamp (user.createdAt)
  stats: UserStats;
  percentile: UserPercentile;
  bestsByTrack: { track: string; lapTimeMs: number; rank: number }[];
  career: {
    podiums: number;
    longestWinStreak: number;
    favoriteTrack: string | null;
  };
}

// ── Nav ──────────────────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  to: string;
}
