"use client";

export function AgentsSection() {
  return (
    <section id="agents" className="relative w-full bg-arena-bg/70 py-24 border-t border-[var(--color-arena-border)] overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,42,95,0.02)_50%,rgba(212,255,0,0.025)_100%)] pointer-events-none" />
      
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <div className="text-center mb-20 px-6">
          <h2 className="font-display text-4xl font-black uppercase tracking-tighter sm:text-6xl text-white">
            THE COMBATANTS
          </h2>
          <p className="mt-4 font-mono text-sm text-zinc-500 uppercase tracking-widest">
            TWO AI MODELS. ONE DATA SOURCE.
          </p>
        </div>

        <div className="grid lg:grid-cols-2">
          {/* ISAGI - ATTACKING */}
          <div className="relative flex flex-col justify-between border-b border-[var(--color-arena-border)] p-8 sm:p-16 lg:border-b-0 lg:border-r">
            <div className="absolute top-8 right-8 font-mono text-xs font-bold tracking-widest text-arena-red">01</div>
            
            <div className="space-y-4">
              <h3 className="font-mono text-xs tracking-widest text-zinc-500 uppercase">Attacking Model</h3>
              <h2 className="font-display text-5xl font-black text-white sm:text-7xl">ISAGI</h2>
              <p className="max-w-sm font-sans text-sm text-zinc-400 leading-relaxed">
                Scans for non-draw pressure and explosive open-match scripts. Built to capitalize on attacking momentum and high-XG environments.
              </p>
            </div>

            <div className="mt-12 h-64 w-full bg-[#0A0B10] border border-[#2A2A2A] p-4 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-arena-red/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
               <span className="font-mono text-[10px] text-zinc-600 z-10">[ ISAGI_FULL.PNG ]</span>
            </div>
          </div>

          {/* AIKU - DEFENSIVE */}
          <div className="relative flex flex-col justify-between p-8 sm:p-16 border-t border-[var(--color-arena-border)] lg:border-t-0">
            <div className="absolute top-8 right-8 font-mono text-xs font-bold tracking-widest text-arena-cyan">02</div>
            
            <div className="space-y-4 lg:text-right">
              <h3 className="font-mono text-xs tracking-widest text-zinc-500 uppercase">Defensive Model</h3>
              <h2 className="font-display text-5xl font-black text-white sm:text-7xl">AIKU</h2>
              <p className="max-w-sm font-sans text-sm text-zinc-400 leading-relaxed lg:ml-auto">
                Calculates draw resistance and market balance. Thrives in low-variance, compact defensive scripts.
              </p>
            </div>

            <div className="mt-12 h-64 w-full bg-[#0A0B10] border border-[#2A2A2A] p-4 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-arena-cyan/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
               <span className="font-mono text-[10px] text-zinc-600 z-10">[ AIKU_FULL.PNG ]</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
