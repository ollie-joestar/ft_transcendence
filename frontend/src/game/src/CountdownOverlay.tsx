import { useTranslation } from "../../hooks/useTranslation.ts";

interface CountdownOverlayProps {
  countdown: number | null;
}

export function CountdownOverlay({ countdown }: CountdownOverlayProps) {
  const t = useTranslation("game");
  if (countdown === null) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: countdown === 0 ? "7rem" : "10rem",
          letterSpacing: "0.05em",
          color: "var(--accent)",
          textShadow:
            "0 0 50px color-mix(in srgb, var(--color-light-white) 90%, transparent), 2px 2px 0 color-mix(in srgb, var(--color-light-white) 50%, transparent)",
        }}
      >
        {countdown === 0 ? t("go") : countdown}
      </span>
    </div>
  );
}
