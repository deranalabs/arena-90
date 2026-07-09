import React from "react";

export function AgentDuelSection() {
  return (
    <section className="relative z-10 mx-auto mt-20 w-full max-w-6xl px-6 pb-32">
      {/* Status Bar */}
      <div className="mb-8 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-arena-muted">
        <div className="flex items-center gap-3">
          <span className="text-arena-text">ARENA_STATE:</span>
          <span className="text-agent-isagi">AWAITING_CHAMPION</span>
        </div>
        <div className="hidden sm:block">
          MOCK_DATA // TX_LINE_ORACLE
        </div>
      </div>

      {/* The Duel Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        {/* ISAGI CARD */}
        <div className="group relative flex flex-col bg-arena-surface clip-chamfer transition-transform duration-500 hover:-translate-y-2">
          {/* Asset Placeholder */}
          <div className="relative h-80 w-full bg-[#1A1A1A] overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-zinc-600">
              [2A] ISAGI // 1000x1000 PNG TRANSPARENT
            </div>
            {/* Glow / Scanline effect */}
            <div className="absolute bottom-0 h-1/2 w-full bg-gradient-to-t from-agent-isagi/20 to-transparent mix-blend-screen opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </div>
          
          <div className="flex flex-col border-t border-agent-isagi/30 p-6">
            <h3 className="font-display text-4xl text-agent-isagi leading-none">ISAGI</h3>
            <p className="mt-1 font-mono text-xs text-arena-muted uppercase tracking-wider">The Aggressor / Over 2.5</p>
            <p className="mt-4 font-sans text-sm text-arena-text">Detects massive attacking momentum and high-variance script. Plays the over.</p>
            <button className="mt-6 w-full bg-agent-isagi/10 border border-agent-isagi/50 text-agent-isagi py-3 font-mono text-sm font-bold uppercase transition-colors hover:bg-agent-isagi hover:text-white clip-chamfer-sm">
              Back Isagi
            </button>
          </div>
        </div>

        {/* AIKU CARD */}
        <div className="group relative flex flex-col bg-arena-surface clip-chamfer transition-transform duration-500 hover:-translate-y-2">
          {/* Asset Placeholder */}
          <div className="relative h-80 w-full bg-[#1A1A1A] overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-zinc-600">
              [2B] AIKU // 1000x1000 PNG TRANSPARENT
            </div>
            {/* Glow / Scanline effect */}
            <div className="absolute bottom-0 h-1/2 w-full bg-gradient-to-t from-agent-aiku/20 to-transparent mix-blend-screen opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </div>
          
          <div className="flex flex-col border-t border-agent-aiku/30 p-6">
            <h3 className="font-display text-4xl text-agent-aiku leading-none">AIKU</h3>
            <p className="mt-1 font-mono text-xs text-arena-muted uppercase tracking-wider">The Wall / Under 2.5</p>
            <p className="mt-4 font-sans text-sm text-arena-text">Calculates high defensive probability and draw resistance. Plays the under.</p>
            <button className="mt-6 w-full bg-agent-aiku/10 border border-agent-aiku/50 text-agent-aiku py-3 font-mono text-sm font-bold uppercase transition-colors hover:bg-agent-aiku hover:text-black clip-chamfer-sm">
              Back Aiku
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}