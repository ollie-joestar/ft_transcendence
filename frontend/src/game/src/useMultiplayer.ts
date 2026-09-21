import { useEffect, useRef, useState, useCallback } from "react";
import {
  insertCoin,
  onPlayerJoin,
  me,
  isHost,
  getRoomCode,
  getState,
  usePlayersList,
} from "playroomkit";
import type { PlayerState } from "playroomkit";
import { NET_BROADCAST_INTERVAL_MS } from "./options.ts";

export interface RemotePlayer {
  id: string;
  color: string;
  playerState: PlayerState;
}

const PLAYER_COLORS = [
  "#ff4444",
  "#44ff44",
  "#ffaa00",
  "#ff44ff",
  "#44ddff",
  "#ff9900",
];

// A lobby holds at most this many drivers. Anyone joining once the cap is
// reached comes in as an auto-spectator (revertible if a seat later frees up).
export const MAX_RACERS = 8;
// …and at most MAX_PLAYERS connections total. The spectator cap is therefore
// *dynamic*: MAX_PLAYERS − (current racers, host included). Alone you can have
// 11 spectators; a full grid of 8 racers leaves room for only 4. Once the room
// hits MAX_PLAYERS a further joiner is bounced with a "room full" overlay.
// These are client-side self-enforced caps (same model as MAX_RACERS).
export const MAX_PLAYERS = 12;
// Largest possible spectator count (when there's a single racer), used only for
// display/upper-bound copy; the live cap is computed against the racer count.
export const MAX_SPECTATORS = MAX_PLAYERS - 1;

export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

interface UserIdentity {
  username: string | null;
  avatarUrl: string | null;
}

export function useMultiplayer(user: UserIdentity) {
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const mapRef = useRef<Map<string, RemotePlayer>>(new Map());
  const connectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [amHost, setAmHost] = useState(false);
  const [amSpectator, setAmSpectator] = useState(false);
  // Set when the room is already full (MAX_PLAYERS connections) on join — the
  // player can't participate and is shown a "room full" overlay.
  const [roomFull, setRoomFull] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const lastSendRef = useRef(0);
  const lastBotSendRef = useRef(0);
  // Monotonic broadcast counter — increments every send regardless of movement,
  // so remote clients can tell "still connected but parked" from "disconnected"
  // (see useStaleRacers). A car that stops moving still ticks seq each broadcast.
  const seqRef = useRef(0);
  // Ref so the effect closure reads the latest user without re-running
  const userRef = useRef(user);
  userRef.current = user;

  // false = don't re-render on every position update
  const playersList = usePlayersList(false) as PlayerState[];
  // Stable ref so the join/cap logic and callbacks read the latest roster
  // (spectator flags mutate in place) without re-running.
  const playersRef = useRef<PlayerState[]>([]);
  playersRef.current = playersList;

  // Count the racers (non-spectators) other than me — used for the racer cap.
  const otherRacerCount = () => {
    const myId = me()?.id;
    return playersRef.current.filter(
      (p) => p.id !== myId && p.state.spectator !== true,
    ).length;
  };

  // Count the spectators other than me — used for the spectator / room cap.
  const otherSpectatorCount = () => {
    const myId = me()?.id;
    return playersRef.current.filter(
      (p) => p.id !== myId && p.state.spectator === true,
    ).length;
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      await insertCoin({ skipLobby: true });
      const myState = me();
      // A non-host joins as an auto-assigned spectator when the room is already
      // racing OR the host hasn't explicitly opened a Multiplayer lobby yet
      // (lobbyOpen). They can switch to racer once the host opens the lobby.
      // The host itself is never force-spectated (it's the one configuring).
      const racing = getState("phase") === "racing";
      const lobbyOpen = getState("lobbyOpen") === true;
      const autoSpec = !isHost() && (racing || !lobbyOpen);
      if (myState) {
        myState.setState("username", userRef.current.username ?? "Guest");
        myState.setState("avatarUrl", userRef.current.avatarUrl ?? null);
        myState.setState("isHost", isHost());
        myState.setState("spectator", autoSpec);
        myState.setState("autoSpectator", autoSpec);
        myState.setState("lobbyReady", false);
        myState.setState("restartReady", false);
        myState.setState("status", autoSpec ? "spectating" : "lobby");
      }
      connectedRef.current = true;
      setIsConnected(true);
      setAmHost(isHost());
      setAmSpectator(autoSpec);
      setRoomCode(getRoomCode());

      onPlayerJoin((playerState: PlayerState) => {
        if (playerState.id === me()!.id) return;
        const remote: RemotePlayer = {
          id: playerState.id,
          color: colorForId(playerState.id),
          playerState,
        };
        mapRef.current.set(playerState.id, remote);
        setRemotePlayers(Array.from(mapRef.current.values()));

        playerState.onQuit(() => {
          mapRef.current.delete(playerState.id);
          setRemotePlayers(Array.from(mapRef.current.values()));
        });
      });

      // Capacity enforcement, deferred so PlayroomKit can sync the existing
      // roster first. Two caps, both self-enforced client-side:
      //  - racer cap: if we came in as a racer but MAX_RACERS drivers are
      //    already seated, drop to an auto-spectator (revertible).
      //  - room cap: if we'd be a spectator but the room already holds
      //    MAX_PLAYERS connections, bounce with a room-full overlay instead of
      //    taking a slot. The spectator cap is dynamic — MAX_PLAYERS minus the
      //    current racers — so a full grid leaves fewer spectator slots.
      setTimeout(() => {
        const m = me();
        if (!m) return;
        // Demote to spectator if the racer slots are full.
        if (m.state.spectator !== true && otherRacerCount() >= MAX_RACERS) {
          m.setState("spectator", true);
          m.setState("autoSpectator", true);
          m.setState("status", "spectating");
          m.setState("lobbyReady", false);
          setAmSpectator(true);
        }
        // Spectator slots full (room at MAX_PLAYERS) → room is full. Cap is
        // MAX_PLAYERS − racers; comparing other-spectators against it (I'm the
        // +1) is equivalent to "total connections would exceed MAX_PLAYERS".
        if (
          m.state.spectator === true &&
          otherSpectatorCount() >= MAX_PLAYERS - otherRacerCount()
        ) {
          setRoomFull(true);
        }
      }, 250);
    })();
  }, []);

  // PlayroomKit migrates the host automatically when the current host leaves,
  // but amHost is captured once at connect. Poll isHost() and update amHost (and
  // the shared per-player `isHost` flag) when migration makes this client the new
  // host — this re-activates all the host-gated work (lobby heartbeat, the
  // restart-vote tally, the host-leave cleanup) that would otherwise go dead.
  const amHostRef = useRef(false);
  amHostRef.current = amHost;
  useEffect(() => {
    const id = setInterval(() => {
      if (!connectedRef.current) return;
      const host = isHost();
      if (host !== amHostRef.current) {
        setAmHost(host);
        me()?.setState("isHost", host);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const markReady = useCallback(() => {
    me()?.setState("ready", true);
  }, []);

  // Lobby ready-check toggle (distinct from the scene-loaded "ready" above)
  const setLobbyReady = useCallback((v: boolean) => {
    me()?.setState("lobbyReady", v);
  }, []);

  // End-of-race restart checklist toggle
  const setRestartReady = useCallback((v: boolean) => {
    me()?.setState("restartReady", v);
  }, []);

  const setStatus = useCallback((s: string) => {
    me()?.setState("status", s);
  }, []);

  // Manual spectator toggle (lobby). Becoming a spectator also drops any
  // ready flag so the player isn't counted toward the ready-check. Joining as a
  // racer is blocked when the racer slots are already full (stay spectating).
  const setSpectator = useCallback((v: boolean) => {
    const m = me();
    if (!m) return;
    if (!v && otherRacerCount() >= MAX_RACERS) return;
    m.setState("spectator", v);
    m.setState("autoSpectator", false);
    m.setState("status", v ? "spectating" : "lobby");
    if (v) m.setState("lobbyReady", false);
    setAmSpectator(v);
  }, []);

  // Force a non-host client into spectator. Used when the host closes the
  // Multiplayer lobby (switches the race to bot / time-trial): only the host
  // drives those, so any joiner still holding a racer seat must drop to
  // spectating. Marked auto so the seat is reclaimed if a Multiplayer lobby
  // opens again (see clearAutoSpectator). No-op for the host or an existing
  // spectator.
  const autoSpectate = useCallback(() => {
    const m = me();
    if (!m || isHost()) return;
    if (m.state.spectator === true) return;
    m.setState("spectator", true);
    m.setState("autoSpectator", true);
    m.setState("status", "spectating");
    m.setState("lobbyReady", false);
    setAmSpectator(true);
  }, []);

  // Clear an auto-assigned spectator (late joiner) once the race ends. A
  // player who manually chose to spectate keeps that choice. Only reclaims a
  // seat while a Multiplayer lobby is actually open — otherwise (host still in
  // the setup menu) the forced spectator stays a spectator.
  const clearAutoSpectator = useCallback(() => {
    const m = me();
    if (!m) return;
    if (getState("lobbyOpen") !== true) return;
    if (m.state.autoSpectator === true) {
      // Only reclaim a racer seat if the lobby isn't already full — otherwise
      // an overflow auto-spectator stays spectating.
      if (otherRacerCount() >= MAX_RACERS) return;
      m.setState("autoSpectator", false);
      m.setState("spectator", false);
      m.setState("status", "lobby");
      setAmSpectator(false);
    }
  }, []);

  // Throttled to NET_BROADCAST_HZ (see options.ts) — sends position + progress
  const broadcast = useCallback(
    (
      pos: [number, number, number],
      quat: [number, number, number, number],
      lap: number,
      cp: number,
    ) => {
      if (!connectedRef.current) return;
      const now = performance.now();
      if (now - lastSendRef.current < NET_BROADCAST_INTERVAL_MS) return;
      lastSendRef.current = now;
      const m = me();
      if (!m) return;
      m.setState("pos", pos);
      m.setState("quat", quat);
      m.setState("lap", lap);
      m.setState("cp", cp);
      seqRef.current += 1;
      m.setState("seq", seqRef.current);
    },
    [],
  );

  const broadcastBot = useCallback(
    (
      pos: [number, number, number],
      quat: [number, number, number, number],
      lap: number,
      cp: number,
    ) => {
      if (!connectedRef.current) return;
      const now = performance.now();
      if (now - lastBotSendRef.current < NET_BROADCAST_INTERVAL_MS) return;
      lastBotSendRef.current = now;
      const m = me();
      if (!m) return;
      m.setState("botPos", pos);
      m.setState("botQuat", quat);
      m.setState("botLap", lap);
      m.setState("botCp", cp);
    },
    [],
  );

  return {
    remotePlayers,
    broadcast,
    broadcastBot,
    playersList,
    isConnected,
    amHost,
    amSpectator,
    roomFull,
    roomCode,
    markReady,
    setLobbyReady,
    setRestartReady,
    setStatus,
    setSpectator,
    autoSpectate,
    clearAutoSpectator,
  };
}
