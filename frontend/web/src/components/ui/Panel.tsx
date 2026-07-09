import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelVariant = "default" | "red" | "cyan" | "success";
type PanelCut = "md" | "sm";

type PanelProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
  cut?: PanelCut;
  variant?: PanelVariant;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

const variantClasses: Record<PanelVariant, string> = {
  default: "border-arena-border bg-arena-panel/90",
  red: "border-arena-red/60 bg-arena-red/5",
  cyan: "border-arena-cyan/60 bg-arena-cyan/5",
  success: "border-system-success/50 bg-system-success/5",
};

const cutClasses: Record<PanelCut, string> = {
  md: "clip-panel",
  sm: "clip-panel-sm",
};

export function Panel<T extends ElementType = "div">({
  as,
  children,
  className,
  cut = "md",
  variant = "default",
  ...props
}: PanelProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "relative overflow-hidden border",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/25",
        cutClasses[cut],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
