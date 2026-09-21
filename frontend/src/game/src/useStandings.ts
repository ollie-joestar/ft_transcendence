import { useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { PlayerState } from "playroomkit";
import { ordinal } from "./gameUtils.ts";
import { buildStandings } from "./buildStandings.ts";
import type { CheckpointDef } from "./TrackTypes.ts";

interface UseStandingsParams {
  playersListRef: MutableRefObject<PlayerState[]>;
  localProgressRef: MutableRefObject<{ lap: number; cp: number }>;
  botProgressRef: MutableRefObject<{ lap: number; cp: number }>;
  botEnabledRef: MutableRefObject<boolean>;
  amHostRef: MutableRefObject<boolean>;
  totalLapsRef: MutableRefObject<number>;
  controlsEnabledRef: MutableRefObject<boolean>;
  finishedOpponentIdsRef: MutableRefObject<Set<string>>;
  // Racers flagged as disconnected (see useStaleRacers) — hidden from the board.
  staleIdsRef: MutableRefObject<Set<string>>;
  // Live data for sub-checkpoint progress ordering (see buildStandings).
  checkpointsRef: MutableRefObject<CheckpointDef[]>;
  localPosRef: MutableRefObject<[number, number]>;
  botPosRef: MutableRefObject<[number, number] | null>;
}

// Refresh rate for the in-race standings board. Remote car data only arrives at
// the ~20 Hz broadcast rate, so 10 Hz keeps reordering crisp without burning CPU
// on innerHTML rebuilds.
const STANDINGS_REFRESH_MS = 100;

export function useStandings({
  playersListRef,
  localProgressRef,
  botProgressRef,
  botEnabledRef,
  amHostRef,
  totalLapsRef,
  controlsEnabledRef,
  finishedOpponentIdsRef,
  staleIdsRef,
  checkpointsRef,
  localPosRef,
  botPosRef,
}: UseStandingsParams) {
  const standingsBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (!standingsBodyRef.current) return;
      if (playersListRef.current.length === 0) return;

      const entries = buildStandings({
        playersList: playersListRef.current,
        localProgressRef,
        botProgressRef,
        botEnabledRef,
        amHostRef,
        totalLapsRef,
        staleIdsRef,
        checkpointsRef,
        localPosRef,
        botPosRef,
      });

      // Track opponents that finish — position only resolved when player crosses finish
      if (totalLapsRef.current > 0 && controlsEnabledRef.current) {
        entries
          .filter((e) => !e.isMe && e.finished)
          .forEach((e) => finishedOpponentIdsRef.current.add(e.id));
      }

      standingsBodyRef.current.innerHTML = entries
        .map(
          (entry, i) =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-weight:${entry.isMe ? "700" : "400"};color:${entry.isMe ? "var(--accent)" : "var(--text)"}">` +
            `<span style="width:28px;color:var(--muted);font-size:11px">${ordinal(i + 1)}</span>` +
            // `<span style="width:8px;height:8px;border-radius:50%;background:${entry.color};display:inline-block;flex-shrink:0;border:1px solid rgba(0,0,0,0.15)"></span>` +
            `<span style="flex:1">${entry.name}${entry.isMe ? " ★" : ""}</span>` +
            `<span style="color:${entry.lap > 0 ? "var(--accent)" : "var(--muted)"};font-size:11px">${entry.lap > 0 ? `L${entry.lap}` : "--"}</span>` +
            `</div>`,
        )
        .join("");
    }, STANDINGS_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { standingsBodyRef };
}
