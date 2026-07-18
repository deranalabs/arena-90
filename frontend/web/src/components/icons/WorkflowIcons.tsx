import type { SVGProps } from "react";

export type WorkflowIconName = "feed" | "snapshot" | "agents" | "validate" | "execute" | "reveal" | "settle";

type WorkflowIconProps = SVGProps<SVGSVGElement> & { name: WorkflowIconName };

export function WorkflowIcon({ name, ...props }: WorkflowIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "feed": return <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7" /></svg>;
    case "snapshot": return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
    case "agents": return <svg {...common}><circle cx="7" cy="7" r="3" /><circle cx="17" cy="7" r="3" /><path d="M2.5 20v-2a4.5 4.5 0 0 1 9 0v2M12.5 20v-2a4.5 4.5 0 0 1 9 0v2M12 3v8" /></svg>;
    case "validate": return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 14l2 2 4-5" /></svg>;
    case "execute": return <svg {...common}><rect x="6" y="6" width="12" height="12" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><path d="m10 14 4-4M10 10h4v4" /></svg>;
    case "reveal": return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "settle": return <svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6" /></svg>;
  }
}
