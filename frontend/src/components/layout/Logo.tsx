import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

// ── Logo ──────────────────────────────────────────────────────────────────────

interface LogoProps {
  size?: "sm" | "md";
  linkTo?: string; // override; defaults to /dashboard when logged in, / otherwise
}

export function Logo({ size = "md", linkTo }: LogoProps) {
  const { user } = useAuth();
  const markSize = size === "sm" ? 22 : 39;
  const markFont = size === "sm" ? 13 : 15;

  const destination = linkTo ?? (user ? "/dashboard" : "/");

  const inner = (
    <div className="animate-fade-up flex items-center gap-[10px]">
      <div
        className="bg-accent rounded-[19px] flex items-center justify-center font-display text-black flex-shrink-0"
        style={{ width: markSize, height: markSize, fontSize: markFont }}
      ></div>
      <span
        className={`font-display text-text tracking-[0.15em] leading-[0.9] ${size === "sm" ? "text-[15px]" : "text-[19px]"}`}
      >
        SAKURA DRIFT
        <br />
        サクラドリフト
      </span>
    </div>
  );

  return (
    <Link to={destination} className="no-underline">
      {inner}
    </Link>
  );
}

// ── GhostNumber ───────────────────────────────────────────────────────────────
interface GhostNumberProps {
  value: string;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
  size?: number;
}

export function GhostNumber({
  value,
  bottom = -40,
  left,
  right = -20,
  size = 280,
}: GhostNumberProps) {
  return (
    <div
      className="absolute font-display leading-none select-none pointer-events-none"
      style={{
        fontSize: size,
        bottom,
        left,
        right,
        color: "rgba(245,0,0,0.04)",
      }}
    >
      {value}
    </div>
  );
}
