"use client";

import { RiotHero } from "@/components/landing/Hero";
import { AgentsSection } from "@/components/landing/AgentsSection";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen w-full bg-[#000000] text-[#F5F5F5] font-sans antialiased">
      
      <nav className="fixed inset-x-0 top-0 z-50 flex items-start justify-between p-6 sm:p-8 pointer-events-none mix-blend-difference">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl font-black italic text-white sm:text-2xl">ARENA90</span>
            <span className="h-4 w-4 bg-[#FF1E56] skew-btn" />
          </div>
          <span className="font-mono text-[10px] text-zinc-400">V.1.0.0 // PROTOCOL_ENGAGED</span>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto text-right">
          <span className="text-[#00FF66] flex items-center gap-2 text-xs font-bold">
            <span className="h-2 w-2 bg-[#00FF66] animate-pulse skew-btn" />
            SYSTEM_ONLINE
          </span>
          <div className="flex gap-6 mt-1 font-mono text-[10px] font-bold text-zinc-400">
            <a href="#agents" className="hover:text-white transition-colors">[ AGENTS ]</a>
            <a href="#oracle" className="hover:text-white transition-colors">[ ORACLE ]</a>
            <a href="#agents" className="hover:text-[var(--color-system-success)] transition-colors">[ LIVE_ARENA ]</a>
          </div>
        </div>
      </nav>

      <RiotHero />
      <AgentsSection />
    </main>
  );
}
