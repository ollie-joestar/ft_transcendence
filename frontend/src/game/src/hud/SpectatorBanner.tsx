import { useTranslation } from "../../../hooks/useTranslation.ts";

interface SpectatorBannerProps {
  // Display name of the currently watched car (null = no one to watch).
  spectateName: string | null;
}

// Top-center banner shown while spectating: who you're watching + A/D hint.
export function SpectatorBanner({ spectateName }: SpectatorBannerProps) {
  const t = useTranslation("game");
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        pointerEvents: "none",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
        borderRadius: "4px",
        padding: "8px 16px",
        textAlign: "center",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-condensed)",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {t("spectating")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          letterSpacing: "0.06em",
          color: "var(--accent)",
        }}
      >
        {spectateName ?? t("noOneToWatch")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--muted)",
          marginTop: 2,
        }}
      >
        {t("switchView")}
      </div>
    </div>
  );
}
