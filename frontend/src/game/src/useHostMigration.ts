import { useEffect, useRef } from "react";

interface Params {
  // Reactive host flag (PlayroomKit may migrate the host on a leave).
  amHost: boolean;
  phase: "lobby" | "racing";
  // Shared host-handover counter + a stable ref to its current value.
  hostEpoch: number;
  hostEpochRef: React.RefObject<number>;
  setHostEpochState: (n: number) => void;
  // Runs the "changing host" pause + re-countdown (from useRaceOrchestration).
  triggerHostHandover: () => void;
}

// Host migration handling. PlayroomKit promotes a new host when the old one
// leaves; this keeps the room from going headless mid-race:
//  - When THIS client becomes host mid-race, it announces a handover by bumping
//    the shared hostEpoch so every client re-syncs. The lobby→host transition
//    isn't a migration, so it's gated on phase === 'racing'.
//  - Every client reacts to a hostEpoch change with a brief "changing host"
//    pause + fresh countdown, then the race resumes where it left off.
export function useHostMigration({
  amHost,
  phase,
  hostEpoch,
  hostEpochRef,
  setHostEpochState,
  triggerHostHandover,
}: Params) {
  const prevAmHostRef = useRef(amHost);
  useEffect(() => {
    const was = prevAmHostRef.current;
    prevAmHostRef.current = amHost;
    if (!was && amHost && phase === "racing") {
      setHostEpochState(hostEpochRef.current + 1);
    }
  }, [amHost, phase, setHostEpochState, hostEpochRef]);

  const hostEpochSeenRef = useRef(hostEpoch);
  useEffect(() => {
    if (hostEpoch === hostEpochSeenRef.current) return;
    hostEpochSeenRef.current = hostEpoch;
    if (phase === "racing") triggerHostHandover();
  }, [hostEpoch, phase, triggerHostHandover]);
}
