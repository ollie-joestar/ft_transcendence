import type { ReactNode, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost" | "ghost_blur" | "sm";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex items-center gap-2 rounded cursor-pointer font-condensed font-bold tracking-widest uppercase transition-all relative " +
  'after:content-[""] after:absolute after:top-0 after:left-[-100%] after:w-full after:h-full ' +
  "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:transition-[left] after:duration-400 " +
  "hover:after:left-full disabled:opacity-50 disabled:cursor-not-allowed disabled:!transform-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "overflow-hidden px-[26px] py-[13px] bg-accent text-white text-sm hover:-translate-y-px",
  ghost:
    "overflow-hidden px-[26px] py-[13px] bg-transparent border border-border text-text text-sm hover:border-accent/40 hover:text-accent",
  ghost_blur:
    "[clip-path:inset(0_round_4px)] px-[26px] py-[13px] bg-white/10 border border-border text-text text-sm hover:border-accent/40 hover:text-accent backdrop-blur",
  sm: "overflow-hidden px-[14px] py-[5px]  bg-accent text-black text-[11px] hover:opacity-85",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full justify-center" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
