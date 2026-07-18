import type { SVGProps } from "react";

export type ArenaIconName =
  | "source"
  | "checkpoint"
  | "connection"
  | "lifecycle"
  | "standing"
  | "alpha"
  | "margin"
  | "beta"
  | "reversion"
  | "continuation"
  | "play"
  | "pause"
  | "copy"
  | "ready"
  | "lock"
  | "agents"
  | "decision"
  | "retry"
  | "warning"
  | "reveal"
  | "settle"
  | "next"
  | "winner"
  | "proof";

type ArenaIconProps = SVGProps<SVGSVGElement> & { name: ArenaIconName };

export function ArenaIcon({ name, ...props }: ArenaIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "source": return <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7" /></svg>;
    case "checkpoint": return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2M9 3h6" /></svg>;
    case "connection": return <svg {...common}><path d="M5 9a10 10 0 0 1 14 0M8 12a6 6 0 0 1 8 0M11 15a2 2 0 0 1 2 0" /><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" /></svg>;
    case "lifecycle": return <svg {...common}><path d="M5 7h10M5 12h14M5 17h8" /><path d="m16 15 3 2-3 2" /></svg>;
    case "standing": return <svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6" /></svg>;
    case "alpha": return <svg {...common}><path d="M4 17 9 12l3 3 8-9" /><path d="M15 6h5v5" /></svg>;
    case "margin": return <svg {...common}><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" /></svg>;
    case "beta": return <svg {...common}><path d="M4 7h5l3 4 3-4h5M4 17h5l3-4 3 4h5" /></svg>;
    case "reversion": return <svg {...common}><path d="M4 7h9a5 5 0 0 1 0 10H8" /><path d="m8 13-4 4 4 4" /></svg>;
    case "continuation": return <svg {...common}><path d="M4 17 9 12l3 3 7-8" /><path d="M14 7h5v5" /></svg>;
    case "play": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m10 8 5 4-5 4z" fill="currentColor" stroke="none" /></svg>;
    case "pause": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 8.5v7M14.5 8.5v7" /></svg>;
    case "copy": return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="1" /><path d="M16 8V5H5v11h3" /></svg>;
    case "ready": return <svg {...common}><path d="M6 21V4M6 5h11l-2 4 2 4H6" /></svg>;
    case "lock": return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
    case "agents": return <svg {...common}><circle cx="7" cy="7" r="3" /><circle cx="17" cy="7" r="3" /><path d="M2.5 20v-2a4.5 4.5 0 0 1 9 0v2M12.5 20v-2a4.5 4.5 0 0 1 9 0v2" /></svg>;
    case "decision": return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h7" /></svg>;
    case "retry": return <svg {...common}><path d="M19 8a8 8 0 1 0 1 7" /><path d="M19 3v5h-5" /></svg>;
    case "warning": return <svg {...common}><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg>;
    case "reveal": return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "settle": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "next": return <svg {...common}><path d="M4 12h15M14 7l5 5-5 5" /><circle cx="5" cy="12" r="2" /></svg>;
    case "winner": return <svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6" /></svg>;
    case "proof": return <svg {...common}><path d="m12 3 7 3v5c0 4.5-2.9 7.6-7 10-4.1-2.4-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}
