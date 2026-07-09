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
  default: "border-2 border-black bg-white brutalist-shadow",
  red: "border-2 border-black bg-[#FFF0F0] brutalist-shadow",
  cyan: "border-2 border-black bg-[#FFFFE0] brutalist-shadow",
  success: "border-2 border-black bg-[#E5FFEE] brutalist-shadow",
};

const cutClasses: Record<PanelCut, string> = {
  md: "",
  sm: "",
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
        "relative overflow-hidden transition-all duration-200",
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
