import { useEffect, useRef } from "react";
import type { PlayerState } from "playroomkit";

interface Params {
  amHost: boolean;
  phase: "lobby" | "racing";
  // Stable ref to the live roster (read inside the interval).
  playersListRef: React.RefObject<PlayerState[]>;
  // Shared restart counter + a stable ref to its current value.
  raceEpochRef: React.RefObject<number>;
  setRaceEpochState: (n: number) => void;
}

// Host-only end-of-race restart tally. When every racer has voted to restart on
// the finish screen, bump raceEpoch (which restarts the race for everyone).
// Fires once per unanimous vote — the guard only re-arms once the vote drops
// below unanimous (i.e. after the restart clears everyone's restartReady flag).
export function useRestartVote({
  amHost,
  phase,
  playersListRef,
  raceEpochRef,
  setRaceEpochState,
}: Params) {
  const restartFiredRef = useRef(false);
  useEffect(() => {
    if (!amHost || phase !== "racing") {
      restartFiredRef.current = false;
      return;
    }
    const id = setInterval(() => {
      const racers = playersListRef.current.filter(
        (p) => p.state.spectator !== true,
      );
      const allVoted =
        racers.length > 0 && racers.every((p) => p.state.restartReady === true);
      if (!allVoted) {
        restartFiredRef.current = false;
        return;
      }
      if (!restartFiredRef.current) {
        restartFiredRef.current = true;
        setRaceEpochState(raceEpochRef.current + 1);
      }
    }, 300);
    return () => clearInterval(id);
  }, [amHost, phase, playersListRef, raceEpochRef, setRaceEpochState]);
}
