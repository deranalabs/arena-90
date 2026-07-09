import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type HudPanelProps = HTMLAttributes<HTMLDivElement> & {
  cut?: "md" | "sm";
};

const cutClasses: Record<NonNullable<HudPanelProps["cut"]>, string> = {
  md: "clip-chamfer",
  sm: "clip-chamfer-sm",
};

export function HudPanel({
  children,
  className,
  cut = "md",
  ...props
}: HudPanelProps) {
  return (
    <div
      className={cn(
        "border border-white/14 bg-arena-base/86 shadow-[0_0_38px_rgba(0,0,0,0.46)] backdrop-blur-md",
        cutClasses[cut],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
