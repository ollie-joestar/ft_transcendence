// Brief grey overlay shown on every client while PlayroomKit migrates the host
// mid-race. It pauses the game for ~0.5s before a fresh countdown resumes the
// race (see useRaceOrchestration's triggerHostHandover). No props beyond
// visibility — the orchestration owns the timing.
import { useTranslation } from "../../hooks/useTranslation.ts";

export function HostChangeOverlay({ visible }: { visible: boolean }) {
  const t = useTranslation("game");
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "color-mix(in srgb, var(--surface-invert) 72%, transparent)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          letterSpacing: "0.08em",
          color: "var(--color-light-white)",
        }}
      >
        {t("changingHost")}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-condensed)",
          fontSize: "12px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:
            "color-mix(in srgb, var(--color-light-white) 60%, transparent)",
        }}
      >
        {t("resyncingRace")}
      </div>
    </div>
  );
}
