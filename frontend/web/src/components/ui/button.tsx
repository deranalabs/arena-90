import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "arena" | "ghost";
type ButtonSize = "default" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  arena:
    "bg-arena-text text-arena-base shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:bg-agent-isagi hover:shadow-[0_0_60px_rgba(255,42,95,0.4)]",
  ghost:
    "border border-white/10 bg-arena-base/70 text-arena-text hover:border-white/25 hover:bg-white/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-8 py-4 text-sm",
  sm: "px-4 py-2 text-xs",
};

export function Button({
  className,
  size = "default",
  type = "button",
  variant = "arena",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-3 font-mono font-bold uppercase transition-all duration-300 clip-chamfer hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
