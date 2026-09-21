import { useCallback, useRef, useState } from "react";
import { getLeaderboard } from "../../lib/races.ts";
import type { LeaderboardEntry } from "../../types";

interface User {
  id?: string | null;
}

// The HUD's "Next Rival" slot, derived from the per-track leaderboard and the
// local player's personal best for that track:
//  - 'loading'  : leaderboard not fetched yet
//  - 'none'     : nobody on the board (no one to chase)
//  - 'leader'   : the player holds the fastest lap on this track
//  - 'rival'    : the closest driver still faster than the player — the next
//                 target to beat (their name + time)
export type RivalState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "leader" }
  | { kind: "rival"; username: string; lapTimeMs: number };

// Pure: pick the rival to chase from a leaderboard given the player's best lap.
// The rival is the *slowest* driver who is still faster than the player (i.e.
// the one immediately above them — the next one to overtake). When the player
// has no recorded time, everyone is faster, so the rival is the slowest entry
// on the board (the easiest first target). Self is excluded by id.
export function computeRival(
  myBestMs: number | null,
  board: LeaderboardEntry[],
  myId: string | null | undefined,
): RivalState {
  const others = board.filter((e) => e.userId !== myId);
  if (others.length === 0 && myBestMs !== null) return { kind: "leader" };
  if (others.length === 0) return { kind: "none" };
  const faster =
    myBestMs === null ? others : others.filter((e) => e.lapTimeMs < myBestMs);
  // A recorded time with nobody faster → the player is rank 1.
  if (faster.length === 0)
    return myBestMs !== null ? { kind: "leader" } : { kind: "none" };
  const rival = faster.reduce((a, b) => (b.lapTimeMs > a.lapTimeMs ? b : a));
  return {
    kind: "rival",
    username: rival.username ?? "Anonymous",
    lapTimeMs: rival.lapTimeMs,
  };
}

// Owns the cached per-track leaderboard + the derived "next rival" state shown
// in the HUD. seedRival() fetches the board on track load; recompute() is called
// whenever the player's PB changes mid-race so the rival advances as they climb.
export function useNextRival(user: User | null) {
  const [rival, setRival] = useState<RivalState>({ kind: "loading" });
  const boardRef = useRef<LeaderboardEntry[]>([]);
  // Kept fresh each render so the async fetch / recompute use the live id.
  const idRef = useRef<string | null | undefined>(user?.id);
  idRef.current = user?.id;

  const recompute = useCallback((myBestMs: number | null) => {
    setRival(computeRival(myBestMs, boardRef.current, idRef.current));
  }, []);

  // getMyBest is read at *resolve* time (not call time) so the board lands
  // against the live PB — seedPb resets the PB to null synchronously and refills
  // it asynchronously, so a captured value would be a stale null and always show
  // a rival even when you hold the record.
  const seedRival = useCallback(
    (trackName: string, getMyBest: () => number | null) => {
      setRival({ kind: "loading" });
      getLeaderboard(trackName, 50)
        .then((board) => {
          boardRef.current = board;
          recompute(getMyBest());
        })
        .catch(() => {
          boardRef.current = [];
          setRival({ kind: "none" });
        });
    },
    [recompute],
  );

  return { rival, seedRival, recompute };
}
