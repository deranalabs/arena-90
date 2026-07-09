import type { ReactNode } from "react";

import { Panel } from "@/components/ui/Panel";

const navItems = [
  ["AGENTS", "#agents"],
  ["BLINKS", "#blink-ux"],
  ["LOGS", "#telemetry"],
  ["ORACLE", "#oracle"],
];

export function GlobalArenaLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F4F0] font-sans text-black">
      {/* Brutalist Grid Pattern */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-10" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 0)", backgroundSize: "32px 32px" }}></div>

      <header className="fixed inset-x-0 top-0 z-50 flex items-start justify-between px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-2">
          <a href="#" className="flex w-fit items-center gap-2 border-2 border-black bg-white px-3 py-1 brutalist-shadow">
            <span className="font-display text-xl font-bold uppercase tracking-tight text-black sm:text-2xl">
              ARENA90
            </span>
            <span className="h-4 w-4 bg-arena-red border-2 border-black" />
          </a>
          <span className="font-mono text-[10px] font-bold uppercase text-black bg-white border-2 border-black px-2 py-0.5 w-fit">
            V.1.0.0 / PROTOCOL_ENGAGED
          </span>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-black border-2 border-black bg-white px-3 py-1 brutalist-shadow">
            <span className="h-2 w-2 animate-pulse bg-system-success border border-black" />
            SYSTEM_ONLINE
          </span>
          <nav className="mt-1 hidden gap-3 font-mono text-[10px] font-bold text-black sm:flex">
            {navItems.map(([label, href]) => (
              <a key={label} href={href} className="border-2 border-black bg-white px-2 py-1 transition-all hover:bg-arena-cyan brutalist-shadow hover:brutalist-shadow-hover">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <aside className="pointer-events-none fixed bottom-8 left-5 top-32 z-40 hidden w-12 flex-col items-center justify-between lg:flex border-r-2 border-black bg-white/50 backdrop-blur-sm">
        <div className="h-24 w-1 bg-black" />
        <div className="-rotate-90 whitespace-nowrap font-mono text-[10px] font-bold uppercase text-black">
          ARENA_RAIL / LIVE_CONTROL
        </div>
        <div className="h-24 w-1 bg-black" />
      </aside>

      <Panel
        className="pointer-events-none fixed bottom-6 right-5 z-40 hidden px-4 py-2 font-mono text-[10px] font-bold uppercase text-black lg:block"
      >
        <div className="text-system-success">HUD_LOCKED</div>
        <div>SCROLL_THROUGH_ARENA</div>
      </Panel>

      <div className="relative z-10">{children}</div>
    </main>
  );
}
