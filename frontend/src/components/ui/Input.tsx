import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightLabel?: ReactNode;
  error?: boolean;
}

export function Input({
  label,
  rightLabel,
  error = false,
  className = "",
  ...rest
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="font-condensed text-[10px] text-text-strong tracking-[0.18em] uppercase font-semibold">
          {label}
        </label>
        {rightLabel && <div>{rightLabel}</div>}
      </div>
      <input
        className={`bg-surface border text-input-text px-[14px] py-3 rounded w-full font-body text-sm transition-all outline-none placeholder:text-muted
          focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent)]
          ${error ? "border-danger" : "border-border"} ${className}`}
        {...rest}
      />
    </div>
  );
}
