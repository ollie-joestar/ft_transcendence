// Confirmation modal shown when the player presses Esc. Yes / No, where Yes
// runs onConfirm and No dismisses. `title`/`confirmLabel` adapt the wording to
// the context (leaving a race vs. returning to the dashboard from setup), and
// `message` describes where Yes lands. Styled to match Help/FinishOverlay.
import { useTranslation } from "../../hooks/useTranslation.ts";

export function LeavePrompt({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslation("game");
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "color-mix(in srgb, var(--surface-invert) 75%, transparent)",
      }}
    >
      <div
        style={{
          background: "color-mix(in srgb, var(--surface) 96%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
          borderRadius: "6px",
          padding: "28px 36px",
          minWidth: 300,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            letterSpacing: "0.04em",
            color: "var(--text-strong)",
            marginBottom: "6px",
          }}
        >
          {title ?? t("leaveRace")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--muted)",
            marginBottom: "22px",
          }}
        >
          {message}
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onConfirm}
            style={{
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
            {confirmLabel ?? t("yesLeave")}
          </button>
          <button
            onClick={onCancel}
            style={{
              fontFamily: "var(--font-condensed)",
              fontSize: "13px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "10px 24px",
              borderRadius: "4px",
              border:
                "1px solid color-mix(in srgb, var(--text) 30%, transparent)",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text)",
              fontWeight: 600,
            }}
          >
            {t("noStay")}
          </button>
        </div>
        <div
          style={{
            marginTop: "16px",
            fontFamily: "var(--font-condensed)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {t("escCancel")}
        </div>
      </div>
    </div>
  );
}
