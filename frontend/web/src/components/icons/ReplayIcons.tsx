import type { SVGProps } from "react";

type ReplayIconName = "archive" | "source" | "events" | "engine" | "winner" | "play" | "proof";

type ReplayIconProps = SVGProps<SVGSVGElement> & { name: ReplayIconName };

export function ReplayIcon({ name, ...props }: ReplayIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "archive": return <svg {...common}><path d="M4 7.5h16v12H4z" /><path d="M3 4.5h18v3H3zM9 11.5h6" /></svg>;
    case "source": return <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7" /></svg>;
    case "events": return <svg {...common}><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="3" cy="5" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="3" cy="19" r=".7" fill="currentColor" stroke="none" /></svg>;
    case "engine": return <svg {...common}><rect x="6" y="6" width="12" height="12" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><path d="M10 10h4v4h-4z" /></svg>;
    case "winner": return <svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 12v5M8 21h8M9 17h6" /></svg>;
    case "play": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m10 8 5 4-5 4z" fill="currentColor" stroke="none" /></svg>;
    case "proof": return <svg {...common}><path d="m12 3 7 3v5c0 4.5-2.9 7.6-7 10-4.1-2.4-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }
}
