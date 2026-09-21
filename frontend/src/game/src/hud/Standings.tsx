import { useTranslation } from "../../../hooks/useTranslation.ts";

interface StandingsProps {
  // The standings rows are written into this div via innerHTML by useStandings
  // (~10 Hz). App mounts this only while racing.
  bodyRef: React.RefObject<HTMLDivElement | null>;
}

// Top-right race standings shell. Row contents are owned by useStandings.
// Named "Standings" to avoid confusion with the site-wide /leaderboard page.
export function Standings({ bodyRef }: StandingsProps) {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        pointerEvents: "none",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
        borderRadius: "4px",
        padding: "10px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        lineHeight: 1.6,
        color: "var(--text)",
        minWidth: 190,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-condensed)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: "8px",
        }}
      >
        {t("standings")}
      </div>
      <div ref={bodyRef} />
    </div>
  );
}
