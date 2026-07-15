import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "ink" | "paper";
};

export function Surface({ className, tone = "paper", ...props }: SurfaceProps) {
  return <div className={cn("surface", `surface--${tone}`, className)} {...props} />;
}
