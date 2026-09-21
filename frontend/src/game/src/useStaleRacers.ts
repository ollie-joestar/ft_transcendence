import { useEffect, useRef, useState } from "react";
import type { RemotePlayer } from "./useMultiplayer.ts";

// Flags racers whose broadcast has gone silent (disconnected / dropped) so the
// game can drop their frozen ghost car + leaderboard row promptly, instead of
// waiting for PlayroomKit's slower quit timeout. Liveness is the monotonic `seq`
// counter (incremented on every broadcast in useMultiplayer), so a parked-but-
// connected car never goes stale — only a truly silent peer does. Resuming
// broadcasts clears the flag, and players who fully quit are pruned.
const STALE_MS = 5000;
const POLL_MS = 1000;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function useStaleRacers(
  remotePlayers: RemotePlayer[],
  active: boolean,
): Set<string> {
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  // id → { last seen seq, time first seen at that seq }
  const seenRef = useRef<Map<string, { seq: number; t: number }>>(new Map());

  useEffect(() => {
    if (!active) {
      seenRef.current.clear();
      setStaleIds((prev) => (prev.size ? new Set() : prev));
      return;
    }
    const id = setInterval(() => {
      const now = performance.now();
      const next = new Set<string>();
      const live = new Set<string>();
      for (const r of remotePlayers) {
        live.add(r.id);
        // Spectators have no car / don't broadcast — never flag them.
        if (r.playerState.state?.spectator === true) continue;
        const seq = (r.playerState.state?.seq as number | undefined) ?? -1;
        const prev = seenRef.current.get(r.id);
        if (!prev || prev.seq !== seq) {
          seenRef.current.set(r.id, { seq, t: now });
        } else if (now - prev.t > STALE_MS) {
          next.add(r.id);
        }
      }
      // Forget players who left entirely (PlayroomKit quit removed them).
      for (const key of seenRef.current.keys()) {
        if (!live.has(key)) seenRef.current.delete(key);
      }
      setStaleIds((prev) => (sameSet(prev, next) ? prev : next));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [remotePlayers, active]);

  return staleIds;
}
