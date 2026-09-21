import type { ReactNode } from "react";

type BadgeVariant = "accent" | "muted" | "success";
interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const base =
  "inline-flex items-center gap-1 px-2 py-[3px] rounded-[2px] font-condensed text-[10px] font-bold tracking-[0.12em] uppercase";
const variants: Record<BadgeVariant, string> = {
  accent: "bg-accent/10 border border-accent/25 text-accent",
  muted: "bg-transparent border border-border text-text-strong",
  success: "bg-success/8 border border-success/25 text-success",
};

export function Badge({
  variant = "muted",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
