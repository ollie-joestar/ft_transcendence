import { forwardRef } from "react";
import { useTranslation } from "../../hooks/useTranslation.ts";

export const WrongWayIndicator = forwardRef<HTMLDivElement>(
  function WrongWayIndicator(_, ref) {
    const t = useTranslation("game");
    return (
      <div
        ref={ref}
        style={{
          display: "none",
          position: "fixed",
          top: "38%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          pointerEvents: "none",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
          letterSpacing: "0.15em",
          color: "var(--danger)",
          textShadow:
            "0 2px 12px rgba(0,0,0,0.7), 0 0 30px color-mix(in srgb, var(--danger) 40%, transparent)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {t("wrongWay")}
      </div>
    );
  },
);
