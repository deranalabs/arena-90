import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type TextLinkProps = ComponentProps<typeof Link> & {
  tone?: "primary" | "quiet";
};

export function TextLink({ className, tone = "primary", ...props }: TextLinkProps) {
  return <Link className={cn("text-link", `text-link--${tone}`, className)} {...props} />;
}
