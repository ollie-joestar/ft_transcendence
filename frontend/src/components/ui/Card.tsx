import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}
interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  right?: ReactNode;
}

export function Card({ children, className = "", style, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-md overflow-hidden transition-[border-color,transform] duration-200 hover:border-accent/20 ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, right }: CardHeaderProps) {
  return (
    <div className="flex justify-between items-center px-5 py-[13px] border-b border-border">
      <span className="font-condensed text-xs font-bold text-text tracking-[0.1em] uppercase">
        {title}
      </span>
      {action && (
        <button
          className="bg-none border-none text-accent cursor-pointer font-body text-xs"
          type="button"
        >
          {action}
        </button>
      )}
      {right}
    </div>
  );
}
