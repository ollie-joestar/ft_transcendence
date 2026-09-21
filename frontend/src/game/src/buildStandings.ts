import { me } from "playroomkit";
import type { PlayerState } from "playroomkit";
import type { MutableRefObject } from "react";
import { colorForId } from "./useMultiplayer.ts";
import { COLORS } from "./options.ts";
import type { CheckpointDef } from "./TrackTypes.ts";

// One row of the race standings — shared by the in-race leaderboard (HUD) and
// the finish overlay so both order racers identically.
export type StandingEntry = {
  id: string;
  name: string;
  color: string;
  lap: number;
  cp: number;
  // Fraction [0,1] travelled along the segment toward the next gate (`cp`),
  // derived by projecting the car's XZ onto the checkpoint centerline. Refines
  // ordering *between* gates so two cars on the same lap+cp aren't tied.
  frac: number;
  // true once this racer has completed all required laps (totalLaps > 0).
  finished: boolean;
  isMe: boolean;
};

export interface BuildStandingsParams {
  playersList: PlayerState[];
  localProgressRef: MutableRefObject<{ lap: number; cp: number }>;
  botProgressRef: MutableRefObject<{ lap: number; cp: number }>;
  botEnabledRef: MutableRefObject<boolean>;
  amHostRef: MutableRefObject<boolean>;
  totalLapsRef: MutableRefObject<number>;
  // Racers flagged as disconnected (see useStaleRacers) — excluded.
  staleIdsRef: MutableRefObject<Set<string>>;
  // Optional live data for the sub-checkpoint progress fraction. When absent
  // (e.g. the finish overlay) `frac` is 0 and ordering falls back to lap+cp.
  checkpointsRef?: MutableRefObject<CheckpointDef[]>;
  localPosRef?: MutableRefObject<[number, number]>;
  // Host's own bot XZ (null on a non-host, which reads state.botPos instead).
  botPosRef?: MutableRefObject<[number, number] | null>;
}

// Fraction [0,1] of how far (x,z) sits along the centerline segment from the
// gate before `cp` to `cp` itself. `cp` is the next required gate index; the
// car is travelling the segment (cp-1 → cp), and cp === N means heading back to
// the finish (gate 0), hence the modulo wrap. Projection is clamped to the
// segment, so it's always monotonic for tie-breaking. Returns 0 when there's no
// usable position/segment.
function segmentFraction(
  cps: CheckpointDef[],
  cp: number,
  x: number,
  z: number,
): number {
  const n = cps.length;
  if (n < 2 || cp < 1) return 0;
  const a = cps[(cp - 1) % n].position;
  const b = cps[cp % n].position;
  const ax = a[0],
    az = a[2];
  const sx = b[0] - ax,
    sz = b[2] - az;
  const segLenSq = sx * sx + sz * sz;
  if (segLenSq < 1e-6) return 0;
  let t = ((x - ax) * sx + (z - az) * sz) / segLenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t;
}

// Build the ordered standings (humans + bot), filtering out spectators and
// stale/disconnected racers, sorted by progress (lap, then gate, then the
// sub-gate fraction). Finishers naturally float to the top since their lap
// exceeds totalLaps.
export function buildStandings({
  playersList,
  localProgressRef,
  botProgressRef,
  botEnabledRef,
  amHostRef,
  totalLapsRef,
  staleIdsRef,
  checkpointsRef,
  localPosRef,
  botPosRef,
}: BuildStandingsParams): StandingEntry[] {
  const myId = me()?.id;
  const totalLaps = totalLapsRef.current;
  const cps = checkpointsRef?.current ?? [];

  const entries: StandingEntry[] = playersList
    .filter((p) => p.state.spectator !== true && !staleIdsRef.current.has(p.id))
    .map((p) => {
      const isMe = p.id === myId;
      const lap = isMe
        ? localProgressRef.current.lap
        : ((p.state.lap as number | undefined) ?? 0);
      const cp = isMe
        ? localProgressRef.current.cp
        : ((p.state.cp as number | undefined) ?? 0);
      const profile = p.getProfile?.();
      const xz = isMe
        ? localPosRef?.current
        : (p.state.pos as [number, number, number] | undefined);
      const frac = xz
        ? segmentFraction(cps, cp, xz[0], (isMe ? xz[1] : xz[2]) ?? 0)
        : 0;
      return {
        id: p.id,
        name:
          (p.state.username as string | undefined) ??
          profile?.name ??
          p.id.slice(0, 8),
        color: profile?.color?.hex ?? colorForId(p.id),
        lap,
        cp,
        frac,
        finished: totalLaps > 0 && lap > totalLaps,
        isMe,
      };
    });

  if (botEnabledRef.current) {
    let botLap = 0,
      botCp = 0;
    let botFrac = 0;
    if (amHostRef.current) {
      botLap = botProgressRef.current.lap;
      botCp = botProgressRef.current.cp;
      // Host's own bot XZ arrives as [x, z] (from the minimap update).
      const bp = botPosRef?.current;
      if (bp) botFrac = segmentFraction(cps, botCp, bp[0], bp[1]);
    } else {
      const hp = playersList.find(
        (p) => (p.state.isHost as boolean | undefined) === true,
      );
      botLap = (hp?.state.botLap as number | undefined) ?? 0;
      botCp = (hp?.state.botCp as number | undefined) ?? 0;
      // Broadcast bot pos is [x, y, z] — z is index 2.
      const bp = hp?.state.botPos as [number, number, number] | undefined;
      if (bp) botFrac = segmentFraction(cps, botCp, bp[0], bp[2]);
    }
    entries.push({
      id: "bot",
      name: "Bot",
      color: `#${COLORS.red.toString(16).padStart(6, "0")}`,
      lap: botLap,
      cp: botCp,
      frac: botFrac,
      finished: totalLaps > 0 && botLap > totalLaps,
      isMe: false,
    });
  }

  entries.sort((a, b) => b.lap - a.lap || b.cp - a.cp || b.frac - a.frac);
  return entries;
}
