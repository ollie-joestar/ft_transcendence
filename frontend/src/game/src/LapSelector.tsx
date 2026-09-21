import { MIN_LAPS, MAX_LAPS } from "./options.ts";
import { useTranslation } from "../../hooks/useTranslation.ts";

interface LapSelectorProps {
  value: number;
  onChange: (laps: number) => void;
  // Non-host clients see the host's choice read-only.
  disabled?: boolean;
}

const clamp = (n: number) =>
  Math.min(MAX_LAPS, Math.max(MIN_LAPS, Math.round(n)));

// Compact "− N +" stepper for choosing the lap count, clamped to [MIN_LAPS,
// MAX_LAPS]. Shared by the bot-race menu section and the multiplayer lobby.
export function LapSelector({
  value,
  onChange,
  disabled = false,
}: LapSelectorProps) {
  const t = useTranslation("game");
  const laps = clamp(value);

  const btnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    lineHeight: 1,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <button
        type="button"
        style={btnStyle}
        disabled={disabled || laps <= MIN_LAPS}
        onClick={() => onChange(clamp(laps - 1))}
        aria-label={t("fewerLaps")}
      >
        −
      </button>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "15px",
          color: "var(--text)",
          minWidth: 56,
          textAlign: "center",
        }}
      >
        {laps === 1
          ? t("lapCountOne", { count: laps })
          : t("lapCountMany", { count: laps })}
      </span>
      <button
        type="button"
        style={btnStyle}
        disabled={disabled || laps >= MAX_LAPS}
        onClick={() => onChange(clamp(laps + 1))}
        aria-label={t("moreLaps")}
      >
        +
      </button>
    </div>
  );
}
