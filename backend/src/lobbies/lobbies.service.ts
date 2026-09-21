/**
 * LobbiesService — data layer for the live multiplayer lobby browser.
 *
 * Multiplayer itself is peer-to-peer (PlayroomKit); the backend keeps no part in
 * running a race. This table is purely a *discovery* registry: the room host
 * heartbeats its lobby here every few seconds, and the dashboard reads the list
 * so players can find and join open rooms.
 *
 * Liveness is driven by `updatedAt`: a lobby that hasn't been heartbeated within
 * STALE_MS is considered dead. Reads filter on that window, and a lightweight
 * interval reaps stale rows so a crashed/closed host doesn't linger.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// A lobby not heartbeated within this window is treated as closed. The client
// heartbeats every ~5s, so 10s tolerates one missed beat before disappearing.
const STALE_MS = 10_000;
const REAP_INTERVAL_MS = 15_000;

export interface LobbyHeartbeat {
  roomCode: string;
  hostUserId: string;
  hostName: string;
  track: string;
  phase: string;
  playerCount: number;
  racerCount: number;
  maxRacers: number;
}

@Injectable()
export class LobbiesService implements OnModuleDestroy {
  private readonly reaper: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    this.reaper = setInterval(() => {
      this.reapStale().catch(() => {
        /* best-effort cleanup; reads already filter stale rows out */
      });
    }, REAP_INTERVAL_MS);
    // Don't keep the process alive just for the reaper.
    this.reaper.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.reaper);
  }

  // Announce or refresh a lobby. Keyed by roomCode; hostUserId comes from the
  // caller's JWT, never the request body. `updatedAt` is bumped automatically
  // (Prisma @updatedAt), which is what keeps the lobby "alive".
  async heartbeat(data: LobbyHeartbeat) {
    return this.prisma.lobby.upsert({
      where: { roomCode: data.roomCode },
      create: {
        roomCode: data.roomCode,
        hostUserId: data.hostUserId,
        hostName: data.hostName,
        track: data.track,
        phase: data.phase,
        playerCount: data.playerCount,
        racerCount: data.racerCount,
        maxRacers: data.maxRacers,
      },
      update: {
        // hostUserId is intentionally not updated — ownership is fixed at
        // creation; a different caller can't hijack an existing roomCode.
        hostName: data.hostName,
        track: data.track,
        phase: data.phase,
        playerCount: data.playerCount,
        racerCount: data.racerCount,
        maxRacers: data.maxRacers,
      },
    });
  }

  // All currently-live lobbies, most-recently-active first.
  async findActive() {
    const cutoff = new Date(Date.now() - STALE_MS);
    return this.prisma.lobby.findMany({
      where: { updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Host removes its lobby on leave. Scoped to the caller so a client can only
  // delete a lobby it owns (the reaper covers crashes where this never fires).
  async remove(roomCode: string, hostUserId: string) {
    await this.prisma.lobby.deleteMany({ where: { roomCode, hostUserId } });
  }

  private async reapStale() {
    const cutoff = new Date(Date.now() - STALE_MS);
    await this.prisma.lobby.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
  }
}
