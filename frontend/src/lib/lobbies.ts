/**
 * lobbies.ts — frontend client for the live lobby browser backend.
 *
 * Thin wrappers over the shared `api` axios instance (which injects the JWT).
 * The game's host heartbeats its lobby; the dashboard lists + joins lobbies.
 * Each call unwraps the backend's `{ userdata }` envelope.
 */
import api from "./api";
import type { LobbyRow } from "../types";

// Sent by the room host every few seconds to announce/refresh its lobby.
// hostUserId / hostName are taken from the JWT on the backend, never sent here.
export interface LobbyHeartbeatPayload {
  roomCode: string;
  track: string;
  phase: "lobby" | "racing";
  playerCount: number;
  racerCount: number;
  maxRacers: number;
}

// Announce or refresh the caller's lobby (host only).
export async function heartbeatLobby(
  payload: LobbyHeartbeatPayload,
): Promise<void> {
  await api.post("/lobbies/heartbeat", payload);
}

// Currently-active lobbies for the dashboard browser.
export async function getLobbies(): Promise<LobbyRow[]> {
  const res = await api.get("/lobbies");
  return res.data.userdata as LobbyRow[];
}

// Remove the caller's lobby when the host leaves (best-effort).
export async function removeLobby(roomCode: string): Promise<void> {
  await api.delete(`/lobbies/${encodeURIComponent(roomCode)}`);
}
