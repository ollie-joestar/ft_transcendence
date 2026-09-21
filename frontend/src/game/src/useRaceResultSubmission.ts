import { useCallback, useEffect, useRef } from "react";
import { submitRaceResult, recordLap, getMyStats } from "../../lib/races.ts";
import type { LapDeltaHandle } from "./LapDeltaPopup.tsx";

interface User {
  username?: string | null;
  avatarUrl?: string | null;
}

interface Params {
  user: User | null;
  // Stable ref to the auth user — read inside per-lap / track-load callbacks.
  userRef: React.RefObject<User | null>;
  amSpectator: boolean;
  // Bumped on each race start / in-place restart — resets the submission state.
  raceKey: number;
  controlsEnabled: boolean;
  finishPending: boolean;
  raceResult: number | null;
  // Stable track identifier (owned by App, written on track load).
  trackNameRef: React.RefObject<string | null>;
  // Effective finish-lap count (0 = infinite = Time Trial / free-roam).
  totalLapsRef: React.RefObject<number>;
  // The per-lap delta popup (owned by App's JSX).
  lapDeltaRef: React.RefObject<LapDeltaHandle | null>;
  // Fired whenever the per-track personal best changes — on track-load seed and
  // on a new best mid-race. Lets the HUD refresh the "Next Rival" target.
  onPbChange?: (pbMs: number | null) => void;
}

// Owns everything about persisting a finished race + per-lap personal bests to
// the backend. Authenticated, non-spectator players only — guests/spectators
// no-op, and failures are swallowed so the finish overlay never blocks.
//
// Returns:
//  - bestLapMsRef: written by App's HUD callback (mirrors the live best lap),
//    read here when submitting the finished race.
//  - handleLapComplete: Scene's onLapComplete callback (records the lap, flashes
//    the PB delta, submits a trial lap on a new best).
//  - seedPb: seeds the per-track personal-best baseline on track load.
export function useRaceResultSubmission({
  user,
  userRef,
  amSpectator,
  raceKey,
  controlsEnabled,
  finishPending,
  raceResult,
  trackNameRef,
  totalLapsRef,
  lapDeltaRef,
  onPbChange,
}: Params) {
  // Mirrored from the HUD callback; read when submitting the finished race.
  const bestLapMsRef = useRef<number | null>(null);
  // raceStart/raceFinish bracket the total race time; submitted guards against
  // double-posting. All reset per race via the raceKey effect below.
  const raceStartMsRef = useRef<number | null>(null);
  const raceFinishMsRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // Personal-best lap (ms) for the current track, seeded from the backend on
  // track load and updated whenever the player beats it. Drives the per-lap
  // delta popup and the trial-lap submission. Persists across in-place restarts
  // (your record carries over), unlike the HUD best which resets each race.
  const pbLapMsRef = useRef<number | null>(null);

  // Per-race reset of all submission state (fresh race or in-place restart).
  // pbLapMsRef is intentionally NOT reset — your record carries across restarts.
  useEffect(() => {
    submittedRef.current = false;
    bestLapMsRef.current = null;
    raceStartMsRef.current = null;
    raceFinishMsRef.current = null;
  }, [raceKey]);

  // Bracket the race clock: start at "GO!" (controls enabled), stop the moment
  // the player crosses the finish line (finishPending flips true).
  useEffect(() => {
    if (controlsEnabled) raceStartMsRef.current = performance.now();
  }, [controlsEnabled]);
  useEffect(() => {
    if (finishPending) raceFinishMsRef.current = performance.now();
  }, [finishPending]);

  // Submit the result once the finishing position resolves. Authenticated
  // racers only — guests and spectators never post. Fires once per race.
  useEffect(() => {
    if (raceResult === null || submittedRef.current) return;
    if (!user || amSpectator) return;
    const lapTimeMs = bestLapMsRef.current;
    if (lapTimeMs === null) return;
    submittedRef.current = true;
    const start = raceStartMsRef.current;
    const finish = raceFinishMsRef.current;
    const raceTimeMs =
      start !== null && finish !== null ? Math.round(finish - start) : null;
    submitRaceResult({
      track: trackNameRef.current ?? "unknown",
      lapTimeMs: Math.round(lapTimeMs),
      raceTimeMs,
      position: raceResult,
    }).catch((err) => console.warn("Failed to submit race result:", err));
  }, [raceResult, user, amSpectator, trackNameRef]);

  // Each completed lap: compare to the player's best and flash a green/red
  // delta popup. In Time Trial (infinite laps) every completed lap is also
  // persisted as a trial row so its time counts toward time-on-track; that
  // feeds the personal best + leaderboard without polluting race history.
  const handleLapComplete = useCallback(
    (lapMs: number, _lapNumber: number, driftMeters: number) => {
      // Every completed lap (all modes, finishing lap included) bumps the running
      // laps-completed + total-time-driven + total-drift counters on the dashboard.
      // Independent of the personal-best / trial logic below. Authenticated racers
      // only. driftMeters is the distance slid during this lap (read-and-reset).
      if (userRef.current && !amSpectator) {
        recordLap(Math.round(lapMs), Math.round(driftMeters)).catch((err) =>
          console.warn("Failed to record lap:", err),
        );
      }
      const prevBest = pbLapMsRef.current;
      const isBest = prevBest === null || lapMs < prevBest;
      lapDeltaRef.current?.show(
        prevBest === null ? null : lapMs - prevBest,
        isBest,
      );
      if (isBest) {
        pbLapMsRef.current = lapMs;
        onPbChange?.(lapMs);
      }
      if (!userRef.current || amSpectator) return;
      // Persist trial laps in Time Trial / free-roam only (totalLaps === 0). Those
      // runs never produce a finish row, so each completed lap is the only record
      // of time spent on the track — post every lap (not just PBs). Finite races
      // skip this: their best lap reaches the leaderboard via the finish row and
      // their full time via raceTimeMs, so posting laps too would double-count.
      if (totalLapsRef.current !== 0) return;
      submitRaceResult({
        track: trackNameRef.current ?? "unknown",
        lapTimeMs: Math.round(lapMs),
        trial: true,
      }).catch((err) => console.warn("Failed to submit trial lap:", err));
    },
    [amSpectator, userRef, trackNameRef, totalLapsRef, lapDeltaRef, onPbChange],
  );

  // Seed the personal-best baseline for a track so the very first lap's delta
  // popup is meaningful (authenticated players only; guests start blank).
  const seedPb = useCallback(
    (trackName: string) => {
      pbLapMsRef.current = null;
      onPbChange?.(null);
      if (!userRef.current) return;
      getMyStats()
        .then((stats) => {
          const entry = stats.bestLapPerTrack.find(
            (b) => b.track === trackName,
          );
          if (entry?.lapTimeMs != null) {
            pbLapMsRef.current = entry.lapTimeMs;
            onPbChange?.(entry.lapTimeMs);
          }
        })
        .catch(() => {
          /* ignore — baseline just stays null */
        });
    },
    [userRef, onPbChange],
  );

  return { bestLapMsRef, pbLapMsRef, handleLapComplete, seedPb };
}
