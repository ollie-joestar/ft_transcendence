import { useTranslation } from "../../hooks/useTranslation.ts";

const CONTROLS: {
  key: string;
  actionKey:
    | "ctrlAccelerate"
    | "ctrlReverse"
    | "ctrlSteerLeft"
    | "ctrlSteerRight"
    | "ctrlHandbrake"
    | "ctrlSpectatorSwitch"
    | "ctrlCamera"
    | "ctrlMinimapZoom"
    | "ctrlMinimapOrient"
    | "ctrlHelp"
    | "ctrlLeave";
}[] = [
  { key: "W / ↑", actionKey: "ctrlAccelerate" },
  { key: "S / ↓", actionKey: "ctrlReverse" },
  { key: "A / ←", actionKey: "ctrlSteerLeft" },
  { key: "D / →", actionKey: "ctrlSteerRight" },
  { key: "Space", actionKey: "ctrlHandbrake" },
  { key: "A / D", actionKey: "ctrlSpectatorSwitch" },
  { key: "C", actionKey: "ctrlCamera" },
  { key: "M", actionKey: "ctrlMinimapZoom" },
  { key: "Shift + M", actionKey: "ctrlMinimapOrient" },
  { key: "H", actionKey: "ctrlHelp" },
  { key: "Esc", actionKey: "ctrlLeave" },
];

export function Help({ visible }: { visible: boolean }) {
  const t = useTranslation("game");
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "color-mix(in srgb, var(--surface-invert) 75%, transparent)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "color-mix(in srgb, var(--surface) 96%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
          borderRadius: "6px",
          padding: "24px 32px",
          minWidth: 340,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-condensed)",
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: "16px",
          }}
        >
          {t("controls")}
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {CONTROLS.map(({ key, actionKey }) => (
              <tr key={key}>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: "var(--text)",
                    paddingRight: "28px",
                    paddingBottom: "6px",
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                  }}
                >
                  {key}
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: "var(--text)",
                    paddingBottom: "6px",
                  }}
                >
                  {t(actionKey)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            marginTop: "14px",
            fontFamily: "var(--font-condensed)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--muted)",
            textAlign: "right",
          }}
        >
          {t("closeHelp")}
        </div>
      </div>
    </div>
  );
}
