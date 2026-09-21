import { useTranslation } from "../../hooks/useTranslation.ts";

export function PreparingOverlay() {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
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
          fontSize: "2.5rem",
          letterSpacing: "0.2em",
          color: "var(--accent)",
        }}
      >
        {t("preparing")}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--muted)",
          letterSpacing: "0.15em",
        }}
      >
        {t("waitingForLoad")}
      </span>
    </div>
  );
}
