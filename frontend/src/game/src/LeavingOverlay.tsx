// Shown the instant the player leaves the room (→ dashboard). exitToDashboard
// does a full-page reload to tear the Canvas/Rapier/PlayroomKit room down
// cleanly; on a cold server that reload isn't instant, so this overlay covers
// the menu underneath right away — otherwise the menu lingers and the exit
// looks like it didn't register (prompting a confused second click).
import { useTranslation } from "../../hooks/useTranslation.ts";

export function LeavingOverlay() {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          letterSpacing: "0.2em",
          color: "var(--accent)",
        }}
      >
        {t("leaving")}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--muted)",
          letterSpacing: "0.15em",
        }}
      >
        {t("returningToDashboard")}
      </span>
    </div>
  );
}
