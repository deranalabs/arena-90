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
    <main className="relative min-h-screen overflow-hidden bg-arena-bg font-sans text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 cyber-pitch-grid opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-6 bottom-10 top-24 z-0 border border-dashed border-white/10 cyber-pitch-lines opacity-55"
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(10,11,16,0.25)_0%,rgba(10,11,16,0.82)_65%,#0A0B10_100%)]" />
      <div className="pointer-events-none fixed bottom-14 left-1/2 z-0 -translate-x-1/2 font-mono text-[10px] text-zinc-700">
        [3A] CYBER-PITCH BACKGROUND // 1920 X 1080 WEBP
      </div>

      <header className="fixed inset-x-0 top-0 z-50 flex items-start justify-between px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-2">
          <a href="#" className="flex w-fit items-center gap-3">
            <span className="font-display text-xl font-black italic text-white sm:text-2xl">
              ARENA90
            </span>
            <span className="h-4 w-4 bg-arena-red skew-btn" />
          </a>
          <span className="font-mono text-[10px] text-zinc-400">
            V.1.0.0 // PROTOCOL_ENGAGED
          </span>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-system-success">
            <span className="h-2 w-2 animate-pulse bg-system-success skew-btn" />
            SYSTEM_ONLINE
          </span>
          <nav className="mt-1 hidden gap-5 font-mono text-[10px] font-bold text-zinc-400 sm:flex">
            {navItems.map(([label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-white">
                [ {label} ]
              </a>
            ))}
          </nav>
        </div>
      </header>

      <aside className="pointer-events-none fixed bottom-8 left-5 top-32 z-40 hidden w-12 flex-col items-center justify-between lg:flex">
        <div className="h-24 w-px bg-gradient-to-b from-arena-red to-transparent" />
        <div className="-rotate-90 whitespace-nowrap font-mono text-[10px] text-zinc-500">
          ARENA_RAIL // LIVE_CONTROL_ROOM
        </div>
        <div className="h-24 w-px bg-gradient-to-t from-arena-cyan to-transparent" />
      </aside>

      <Panel
        cut="sm"
        className="pointer-events-none fixed bottom-6 right-5 z-40 hidden px-4 py-3 font-mono text-[10px] text-zinc-400 lg:block"
      >
        <div className="text-system-success">HUD_LOCKED</div>
        <div>SCROLL_THROUGH_ARENA</div>
      </Panel>

      <div className="relative z-10">{children}</div>
    </main>
  );
}
