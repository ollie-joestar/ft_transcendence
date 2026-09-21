import { BLANK, formatTime } from "../gameUtils.ts";
import type { RivalState } from "../useNextRival.ts";
import { useTranslation } from "../../../hooks/useTranslation.ts";

interface HudPanelProps {
  // Shown only while racing and not spectating (display toggle, stays mounted).
  visible: boolean;
  lapNumRef: React.RefObject<HTMLSpanElement | null>;
  speedRef: React.RefObject<HTMLSpanElement | null>;
  lapTimeRef: React.RefObject<HTMLSpanElement | null>;
  bestLapRef: React.RefObject<HTMLSpanElement | null>;
  lastLapRef: React.RefObject<HTMLSpanElement | null>;
  botTakeoverLabelRef: React.RefObject<HTMLSpanElement | null>;
  // The "Next Rival" target for the current track (from the leaderboard).
  rival: RivalState;
}

// "Next Rival" block: the closest driver still ahead of you on this track, or a
// celebratory banner when you hold the fastest lap. Changes rarely (track load /
// new PB), so a React prop is fine here — unlike the per-frame HUD values.
function NextRival({ rival }: { rival: RivalState }) {
  const t = useTranslation("game");
  if (rival.kind === "loading" || rival.kind === "none") return null;

  if (rival.kind === "leader") {
    return (
      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop:
            "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            letterSpacing: "0.06em",
            color: "var(--accent)",
            textShadow:
              "0 0 12px color-mix(in srgb, var(--accent) 70%, transparent)",
            animation: "crownGlow 1.8s ease-in-out infinite",
          }}
        >
          {t("fastestOnTrack")}
        </span>
        <span
          style={{
            fontFamily: "var(--font-condensed)",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {t("youHoldRecord")}
        </span>
        <style>{`@keyframes crownGlow {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop:
          "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-condensed)",
          fontSize: "10px",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {t("nextRival")}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 1,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "12ch",
            color: "var(--text)",
          }}
        >
          {rival.username}
        </span>
        <span style={{ color: "var(--accent)" }}>
          {formatTime(rival.lapTimeMs)}
        </span>
      </div>
    </div>
  );
}

// Top-left HUD: lap number, speed, lap/best/last times, bot-takeover label,
// controls hint. All values are written imperatively via the forwarded refs
// (no setState per frame).
export function HudPanel({
  visible,
  lapNumRef,
  speedRef,
  lapTimeRef,
  bestLapRef,
  lastLapRef,
  botTakeoverLabelRef,
  rival,
}: HudPanelProps) {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        pointerEvents: "none",
        display: visible ? "block" : "none",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
        borderRadius: "4px",
        padding: "10px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        lineHeight: 1.8,
        color: "var(--text)",
      }}
    >
      <div>
        <span
          ref={lapNumRef}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            letterSpacing: "0.08em",
            color: "var(--accent)",
          }}
        />
      </div>
      <div>
        {t("hudSpeed")} <span ref={speedRef}>0 km/h</span>
      </div>
      <div>
        {t("hudLap")}&nbsp;&nbsp;<span ref={lapTimeRef}>{BLANK}</span>
      </div>
      <div>
        {t("hudBest")} <span ref={bestLapRef}>{BLANK}</span>
      </div>
      <div>
        {t("hudLast")} <span ref={lastLapRef}>{BLANK}</span>
      </div>
      <NextRival rival={rival} />
      <div style={{ marginTop: 4, minHeight: "1.4em" }}>
        <span
          ref={botTakeoverLabelRef}
          style={{
            display: "none",
            color: "var(--danger)",
            fontFamily: "var(--font-condensed)",
            fontSize: "11px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {t("botCtrl")}
        </span>
      </div>
      <div
        style={{
          marginTop: 2,
          color: "var(--muted)",
          fontFamily: "var(--font-condensed)",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {t("hudControls")}
      </div>
    </div>
  );
}
