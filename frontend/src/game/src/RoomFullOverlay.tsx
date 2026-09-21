import { MAX_PLAYERS } from "./useMultiplayer.ts";
import { useTranslation } from "../../hooks/useTranslation.ts";

// Shown when a player joins a room that is already full (8 racers + 16
// spectators = 24 connections). They can't participate; the only action is to
// head back to the lobby browser.
export function RoomFullOverlay({ onExit }: { onExit: () => void }) {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2.5rem",
          letterSpacing: "0.2em",
          color: "var(--accent)",
        }}
      >
        {t("roomFull")}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--muted)",
          letterSpacing: "0.15em",
        }}
      >
        {t("raceIsFull", { max: MAX_PLAYERS })}
      </span>
      <button
        onClick={onExit}
        style={{
          marginTop: "8px",
          fontFamily: "var(--font-condensed)",
          fontSize: "13px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "10px 24px",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          background: "var(--accent)",
          color: "var(--surface)",
          fontWeight: 700,
        }}
      >
        {t("backToLobbies")}
      </button>
    </div>
  );
}
