import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation.ts";

// Brief on-finish-line popup showing how the lap just completed compares to the
// player's best lap so far: green + "-0:01.23" when faster (a new personal best),
// red + "+0:02.10" when slower. Used mainly in solo / time-trial runs.
export interface LapDeltaHandle {
  // deltaMs = lap - best (negative = faster); null when there's no prior best
  // to compare against (first lap). isBest marks a new personal best.
  show(deltaMs: number | null, isBest: boolean): void;
}

// Signed mm:ss.cc difference, e.g. "-0:01.23".
function formatDelta(ms: number): string {
  const sign = ms < 0 ? "-" : "+";
  const a = Math.abs(ms);
  const m = Math.floor(a / 60000);
  const s = Math.floor((a % 60000) / 1000);
  const cs = Math.floor((a % 1000) / 10);
  return `${sign}${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// Theme tokens (from the frontend's CSS vars) so the popup tracks light/dark.
const FASTER = "var(--success)";
const SLOWER = "var(--danger)";

export const LapDeltaPopup = forwardRef<LapDeltaHandle>(
  function LapDeltaPopup(_, ref) {
    const t = useTranslation("game");
    const [visible, setVisible] = useState(false);
    const [text, setText] = useState("");
    const [label, setLabel] = useState("");
    const [color, setColor] = useState(FASTER);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        show(deltaMs: number | null, isBest: boolean) {
          setColor(isBest ? FASTER : SLOWER);
          setLabel(isBest ? t("newBestLap") : t("slowerThanBest"));
          setText(deltaMs === null ? "" : formatDelta(deltaMs));
          setVisible(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setVisible(false), 2500);
        },
      }),
      [t],
    );

    return (
      <div
        style={{
          display: visible ? "block" : "none",
          position: "fixed",
          top: "24%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 22,
          pointerEvents: "none",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-condensed)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 3rem)",
            letterSpacing: "0.08em",
            color,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          {text}
        </div>
      </div>
    );
  },
);
