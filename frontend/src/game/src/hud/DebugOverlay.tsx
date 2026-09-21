interface DebugOverlayProps {
  // Toggled with the I key (stays mounted, display toggle).
  visible: boolean;
  // Debug text is written into this <pre> via textContent each frame.
  contentRef: React.RefObject<HTMLPreElement | null>;
}

// Bottom-right debug readout (car pos, checkpoints, next CPs).
export function DebugOverlay({ visible, contentRef }: DebugOverlayProps) {
  return (
    <div
      style={{
        display: visible ? "block" : "none",
        position: "fixed",
        bottom: 16,
        right: 16,
        pointerEvents: "none",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        lineHeight: 1.6,
        color: "var(--accent)",
      }}
    >
      <pre ref={contentRef} style={{ margin: 0 }} />
    </div>
  );
}
