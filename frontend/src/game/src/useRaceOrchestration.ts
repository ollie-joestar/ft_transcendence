import { useRef, useState, useEffect, useCallback } from "react";
import { me } from "playroomkit";
import type { PlayerState } from "playroomkit";

// Canonical race-lifecycle state. Single source of truth for "what is the race
// doing right now", derived each render from the phase + countdown + finish
// state. Scene gates its car driving / finish detection on `racing` so those
// can never run while we're back in the lobby (the bug that produced spurious
// "you won" popups after leaving a race).
//   idle       — not in a race (lobby / setup menu)
//   preparing  — racing phase, waiting for all players to load
//   countdown  — 3 → 2 → 1 → GO! (also the host-handover pause)
//   racing     — controls live, car + finish logic active
//   finished   — local player crossed the line (result pending or shown)
export type RaceState =
  | "idle"
  | "preparing"
  | "countdown"
  | "racing"
  | "finished";

interface Options {
  phase: "racing" | "lobby";
  // Incremented (room-wide) to force a fresh race without leaving the racing
  // phase — used by the end-of-race "Restart" checklist.
  raceEpoch: number;
  markReady: () => void;
  playersListRef: React.MutableRefObject<PlayerState[]>;
  // Racers flagged as disconnected (see useStaleRacers) — excluded from the
  // ready-check so a dropout during preparing can't stall the countdown.
  staleIdsRef: React.MutableRefObject<Set<string>>;
}

export function useRaceOrchestration({
  phase,
  raceEpoch,
  markReady,
  playersListRef,
  staleIdsRef,
}: Options) {
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const waitingForPlayersRef = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [controlsEnabled, setControlsEnabled] = useState(false);
  const controlsEnabledRef = useRef(false);
  controlsEnabledRef.current = controlsEnabled;
  const sceneReadyRef = useRef(false);

  const [finishPending, setFinishPending] = useState(false);
  const [raceResult, setRaceResult] = useState<number | null>(null);
  const raceResultSetRef = useRef(false);
  const totalLapsRef = useRef(0);
  const finishedOpponentIdsRef = useRef<Set<string>>(new Set());
  const [raceKey, setRaceKey] = useState(0);

  const localProgressRef = useRef({ lap: 0, cp: 0 });
  const botProgressRef = useRef({ lap: 0, cp: 0 });

  // Host handover: when PlayroomKit migrates the host mid-race, every client
  // briefly shows a "changing host" overlay, then runs a fresh countdown and
  // resumes. `racePaused` freezes the sim from the pause through the countdown;
  // the countdown's GO unfreezes and re-enables controls. Cars keep their
  // velocity across the freeze, so the race continues rather than restarting.
  const [hostHandover, setHostHandover] = useState(false);
  const [racePaused, setRacePaused] = useState(false);

  // Live mirror of the phase, read inside the finish callbacks (which are
  // memoised over refs) so a finish can never resolve outside the racing phase.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Shared reset run at the start of every race (fresh start or restart):
  // clear finish/result state, re-enter the "preparing" → countdown sequence,
  // and bump raceKey so the Scene teleports cars back to the start line.
  const beginRace = useCallback(() => {
    setFinishPending(false);
    setRaceResult(null);
    raceResultSetRef.current = false;
    finishedOpponentIdsRef.current = new Set();
    me()?.setState("ready", false);
    me()?.setState("restartReady", false);
    botProgressRef.current = { lap: 1, cp: 1 };
    setWaitingForPlayers(true);
    waitingForPlayersRef.current = true;
    setControlsEnabled(false);
    setCountdown(null);
    setRaceKey((k) => k + 1);
    if (sceneReadyRef.current) markReady();
  }, [markReady]);

  // Phase transition: lobby clears any leftover result; racing begins a race
  useEffect(() => {
    if (phase === "racing") {
      beginRace();
    } else {
      // Back in the lobby: fully tear down the live-race state, not just the
      // result. Leaving `controlsEnabled` true here was the root cause of the
      // "won the race while in the lobby" bug — Scene kept driving the car and
      // detecting the finish line because its gates only checked controls.
      setFinishPending(false);
      setRaceResult(null);
      raceResultSetRef.current = false;
      finishedOpponentIdsRef.current = new Set();
      setControlsEnabled(false);
      controlsEnabledRef.current = false;
      setCountdown(null);
      setWaitingForPlayers(false);
      waitingForPlayersRef.current = false;
      setHostHandover(false);
      setRacePaused(false);
    }
  }, [phase, beginRace]);

  // Restart: raceEpoch bumps while staying in the racing phase
  const epochRef = useRef(raceEpoch);
  useEffect(() => {
    if (raceEpoch === epochRef.current) return;
    epochRef.current = raceEpoch;
    if (phase === "racing") beginRace();
  }, [raceEpoch, phase, beginRace]);

  // Poll until every player has marked themselves ready
  useEffect(() => {
    if (!waitingForPlayers) return;
    const id = setInterval(() => {
      // Exclude disconnected racers so a dropout mid-preparing can't stall the
      // start (the local player is never flagged stale, so this is non-empty).
      const list = playersListRef.current.filter(
        (p) => !staleIdsRef.current.has(p.id),
      );
      if (list.length === 0) return;
      if (list.every((p) => p.state.ready === true)) {
        setWaitingForPlayers(false);
        waitingForPlayersRef.current = false;
        setCountdown(3);
      }
    }, 300);
    return () => clearInterval(id);
  }, [waitingForPlayers, playersListRef, staleIdsRef]);

  // Countdown: 3 → 2 → 1 → GO! → enable controls
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const id = setTimeout(
        () => setCountdown((c) => (c !== null ? c - 1 : null)),
        1000,
      );
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setCountdown(null);
      setControlsEnabled(true);
      setRacePaused(false); // unfreeze (no-op outside a host handover)
    }, 900);
    return () => clearTimeout(id);
  }, [countdown]);

  // Begin a host-handover sequence: freeze + "changing host" overlay for 0.5s,
  // then a fresh countdown (which re-enables controls and unfreezes at GO).
  const triggerHostHandover = useCallback(() => {
    setHostHandover(true);
    setRacePaused(true);
    setControlsEnabled(false);
    setCountdown(null);
    setTimeout(() => {
      setHostHandover(false);
      setCountdown(3);
    }, 500);
  }, []);

  const handleSceneReady = useCallback(() => {
    sceneReadyRef.current = true;
    if (waitingForPlayersRef.current) markReady();
  }, [markReady]);

  const handleBotProgressUpdate = useCallback((lap: number, cp: number) => {
    botProgressRef.current = { lap, cp };
  }, []);

  const handlePlayerFinished = useCallback(() => {
    // Defence in depth: ignore a finish that arrives outside the racing phase
    // (e.g. a late frame after returning to the lobby).
    if (phaseRef.current !== "racing") return;
    if (raceResultSetRef.current) return;
    raceResultSetRef.current = true;
    setControlsEnabled(false);
    setFinishPending(true);
    setTimeout(() => {
      // Live sweep: catch any remote players who finished in the polling gap
      const myId = me()?.id;
      playersListRef.current
        .filter(
          (p) =>
            p.id !== myId &&
            ((p.state.lap as number | undefined) ?? 0) > totalLapsRef.current,
        )
        .forEach((p) => finishedOpponentIdsRef.current.add(p.id));
      setFinishPending(false);
      setRaceResult(finishedOpponentIdsRef.current.size + 1);
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBotFinished = useCallback(() => {
    if (phaseRef.current !== "racing") return;
    finishedOpponentIdsRef.current.add("bot");
  }, []);

  // Derived canonical lifecycle state (see RaceState). Computed each render from
  // the lifecycle flags, so it can never go stale relative to the phase — that
  // is what makes Scene's `racing`-gated logic robust against leftover flags.
  const raceState: RaceState =
    phase !== "racing"
      ? "idle"
      : finishPending || raceResult !== null
        ? "finished"
        : controlsEnabled
          ? "racing"
          : countdown !== null || hostHandover
            ? "countdown"
            : "preparing";

  return {
    raceState,
    waitingForPlayers,
    countdown,
    controlsEnabled,
    controlsEnabledRef,
    raceKey,
    hostHandover,
    racePaused,
    triggerHostHandover,
    finishPending,
    raceResult,
    totalLapsRef,
    finishedOpponentIdsRef,
    localProgressRef,
    botProgressRef,
    handleSceneReady,
    handlePlayerFinished,
    handleBotFinished,
    handleBotProgressUpdate,
  };
}
