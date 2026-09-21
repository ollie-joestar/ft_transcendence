import { useEffect } from "react";
import type { PlayerState } from "playroomkit";
import { heartbeatLobby, removeLobby } from "../../lib/lobbies.ts";
import { MAX_RACERS } from "./useMultiplayer.ts";

interface User {
  username?: string | null;
  avatarUrl?: string | null;
}

interface Params {
  amHost: boolean;
  isConnected: boolean;
  roomCode: string | null;
  user: User | null;
  phase: "lobby" | "racing";
  // Roster size — re-fires the heartbeat on join/quit so the count stays fresh.
  rosterSize: number;
  // Stable ref to the live roster (read inside the interval).
  playersListRef: React.RefObject<PlayerState[]>;
  // Stable track identifier (owned by App, written on track load).
  trackNameRef: React.RefObject<string | null>;
}

// Host-only lobby discovery. Announces this room to the backend so it appears
// in the dashboard lobby browser: heartbeats every 5s, and immediately whenever
// the roster size or phase changes (so the displayed count stays fresh). Only
// the host announces, and only when authenticated (the POST needs a JWT). The
// backend reaps stale lobbies, so a missed heartbeat just removes us within ~10s.
export function useLobbyHeartbeat({
  amHost,
  isConnected,
  roomCode,
  user,
  phase,
  rosterSize,
  playersListRef,
  trackNameRef,
}: Params) {
  useEffect(() => {
    if (!amHost || !isConnected || !roomCode || !user) return;
    const send = () => {
      const players = playersListRef.current;
      const racerCount = players.filter(
        (p) => p.state.spectator !== true,
      ).length;
      heartbeatLobby({
        roomCode,
        track: trackNameRef.current ?? "unknown",
        phase,
        playerCount: players.length,
        racerCount,
        maxRacers: MAX_RACERS,
      }).catch(() => {
        /* best-effort — never block the game on the browser */
      });
    };
    send();
    const id = setInterval(send, 5000);
    return () => clearInterval(id);
    // rosterSize covers join/quit; phase covers lobby↔racing.
  }, [
    amHost,
    isConnected,
    roomCode,
    user,
    phase,
    rosterSize,
    playersListRef,
    trackNameRef,
  ]);

  // Remove the lobby announcement when the host leaves (best-effort; the
  // staleness reaper covers a crash or a navigation that skips this cleanup).
  useEffect(() => {
    if (!amHost || !roomCode || !user) return;
    return () => {
      removeLobby(roomCode).catch(() => {});
    };
  }, [amHost, roomCode, user]);
}
