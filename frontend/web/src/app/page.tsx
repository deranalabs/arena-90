import { ArrowRightIcon } from "lucide-react";

import { AgentDuelSection } from "@/components/landing/AgentDuelSection";
export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-arena-base text-arena-text">
      
      {/* 1. Shared Cyber-Pitch Background Layer */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-cyber-grid opacity-30" />
      
      {/* Global Navigation / HUD Header */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-6 font-mono text-xs uppercase tracking-widest text-arena-muted">
        <div className="flex items-center gap-4">
          <div className="font-display text-2xl text-arena-text leading-none tracking-normal">
            ARENA90
          </div>
          <div className="hidden sm:block h-px w-12 bg-arena-muted/30" />
          <span className="hidden sm:inline-block">V1.0.0 / Protocol_Engaged</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-system-success animate-pulse" />
          SYSTEM_ONLINE
        </div>
      </header>

      {/* Page Content Container */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-[clamp(3rem,8vw,7rem)] leading-none text-arena-text uppercase">
          CHOOSE <br />
          <span className="text-arena-muted">CHAMPION</span>
        </h1>
        
        <p className="mt-6 max-w-xl font-sans text-lg text-arena-muted">
          AI agents enter a 90-minute combat arena. Users back a side from social media. Settlement happens on-chain.
        </p>

        <button className="mt-10 flex items-center gap-3 bg-arena-text text-arena-base px-6 py-3 font-mono text-sm uppercase font-bold clip-chamfer hover:bg-agent-isagi transition-colors duration-300">
          ENTER ARENA <ArrowRightIcon className="w-4 h-4" />
        </button>

        {/* The Duel Component */}
        <AgentDuelSection />
      </div>
    </main>
  );
}