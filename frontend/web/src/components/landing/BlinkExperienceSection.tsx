import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlinkExperienceSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-32 border-t border-white/5">
      {/* Ticker / Top HUD */}
      <div className="mb-12 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-arena-muted">
        <span className="text-system-success animate-pulse">■</span>
        <span>{`// SEAMLESS EXECUTION // WEB3 INVISIBLE // SOCIAL LAYER`}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-center max-w-5xl mx-auto">
        
        {/* Left Column: Blueprint Annotations */}
        <div className="hidden lg:flex flex-col gap-24 relative z-10 w-full max-w-[240px] ml-auto">
          
          <div className="relative">
            <div className="bg-arena-surface border-l-2 border-arena-red p-4 clip-chamfer-sm brutalist-shadow">
              <p className="font-mono text-[10px] text-arena-red uppercase tracking-widest mb-1">The Problem</p>
              <p className="font-sans text-xs text-arena-muted leading-relaxed">
                Traditional dApps force 5 clicks. Users miss odds shifts waiting for wallet approvals.
              </p>
            </div>
            {/* Connection Line */}
            <div className="absolute top-1/2 -right-12 w-12 h-px bg-arena-red/50 border-t border-dashed border-arena-red/30" />
          </div>

          <div className="relative">
            <div className="bg-arena-surface border-l-2 border-system-success p-4 clip-chamfer-sm brutalist-shadow">
              <p className="font-mono text-[10px] text-system-success uppercase tracking-widest mb-1">Solana Actions</p>
              <p className="font-sans text-xs text-arena-muted leading-relaxed">
                Dialect wallets expand the payload instantly. 1-click execution.
              </p>
            </div>
            {/* Connection Line */}
            <div className="absolute top-1/2 -right-12 w-12 h-px bg-system-success/50 border-t border-dashed border-system-success/30" />
          </div>

        </div>

        {/* Center Column: The Blink Card (Main Asset) */}
        <div className="relative w-full max-w-md mx-auto z-20">
          
          {/* Header Texts above the card */}
          <div className="text-center mb-8">
             <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted mb-2">
               03. <span className="text-arena-cyan">THE TROJAN</span> HORSE
             </h3>
             <h2 className="font-display text-4xl md:text-5xl leading-[0.9] text-arena-text uppercase">
               BET FROM YOUR <br />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-system-success to-white/20">TIMELINE</span>
             </h2>
          </div>

          <div className="bg-[#0D0D11] border border-white/10 p-5 clip-chamfer shadow-2xl relative">

            {/* Mock Tweet Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-arena-base clip-chamfer-sm border border-white/10 flex items-center justify-center shrink-0">
                <span className="font-display text-xl font-bold">A90</span>
              </div>
              <div>
                <p className="font-sans font-bold text-white text-base">Arena90</p>
                <p className="font-mono text-[11px] text-arena-muted">@Arena90_AI</p>
              </div>
            </div>
            
            <p className="font-sans text-sm text-arena-text/90 leading-relaxed mb-4">
              World Cup Group A: ARG vs FRA.<br/>
              ISAGI detects massive attacking momentum. AIKU calculates a high-probability low block. Choose your champion. ⚡️👇
            </p>

            {/* Blink Action Container */}
            <div className="border border-white/10 bg-arena-base overflow-hidden clip-chamfer-sm">
              {/* Image Placeholder */}
              <div className="relative w-full aspect-[1.91/1] bg-[#14161d] border-b border-white/10 flex items-center justify-center">
                 <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
                 <span className="font-mono text-[10px] tracking-[0.2em] text-zinc-600 z-10 text-center px-4">
                   [1A] BANNER CLASH WIDE<br/>1200X630 WEBP
                 </span>
              </div>
              
              {/* Blink Content */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-system-success clip-chamfer-sm" />
                  <p className="font-mono text-[10px] uppercase text-arena-muted tracking-widest">superteam.fun</p>
                </div>
                <h4 className="font-sans font-bold text-white text-base">The 90-Minute Clash</h4>
                <p className="font-sans text-xs text-arena-muted mt-1 mb-4">Lock in your position. 10 USDC stake.</p>

                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-agent-isagi/10 border border-agent-isagi/30 text-agent-isagi py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-agent-isagi hover:text-white transition-colors clip-chamfer-sm">
                    Back Isagi
                  </button>
                  <button className="bg-agent-aiku/10 border border-agent-aiku/30 text-agent-aiku py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-agent-aiku hover:text-black transition-colors clip-chamfer-sm">
                    Back Aiku
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Blueprint Annotations */}
        <div className="hidden lg:flex flex-col justify-center relative z-10 w-full max-w-[240px]">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 -left-12 w-12 h-px bg-arena-cyan/50 border-t border-dashed border-arena-cyan/30" />
            <div className="bg-arena-surface border-r-2 border-arena-cyan p-4 clip-chamfer-sm brutalist-shadow">
              <p className="font-mono text-[10px] text-arena-cyan uppercase tracking-widest mb-1">Dynamic Engine</p>
              <p className="font-sans text-xs text-arena-muted leading-relaxed">
                Blink pulls live TxLINE data. Card updates automatically. No refreshing needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 flex justify-center">
         <div className="h-24 w-px bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}