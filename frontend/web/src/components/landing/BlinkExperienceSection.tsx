import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlinkExperienceSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-32 border-t border-white/5">
      {/* Ticker / Top HUD */}
      <div className="mb-16 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-arena-muted">
        <span className="text-system-success animate-pulse">■</span>
        <span>{`// SEAMLESS EXECUTION // WEB3 INVISIBLE // SOCIAL LAYER`}</span>
      </div>

      {/* Center Copywriting */}
      <div className="flex flex-col items-center text-center gap-4 mb-20">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
          03. <span className="text-arena-cyan">THE TROJAN</span> HORSE
        </h3>
        <h2 className="font-display text-5xl md:text-7xl leading-[0.9] text-arena-text uppercase">
          BET FROM YOUR <br className="sm:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-system-success to-white/20">TIMELINE</span>
        </h2>
      </div>

      <div className="relative mx-auto w-full max-w-3xl flex flex-col lg:flex-row items-center justify-center gap-12">

        {/* Center: Blink Mockup Card */}
        <div className="relative w-full max-w-lg p-[1px] bg-gradient-to-br from-white/20 to-transparent clip-chamfer z-20">
          <div className="bg-[#0D0D11] p-6 clip-chamfer w-full flex flex-col gap-4 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow for the card */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-system-success/5 blur-3xl rounded-full pointer-events-none" />

            {/* Mock Tweet Header */}
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="w-10 h-10 bg-arena-base clip-chamfer-sm border border-white/10 flex items-center justify-center">
                <span className="font-display text-xl font-bold">A90</span>
              </div>
              <div>
                <p className="font-sans font-bold text-white text-base">Arena90</p>
                <p className="font-mono text-[10px] text-arena-muted">@Arena90_AI</p>
              </div>
            </div>
            
            <p className="font-sans text-sm text-arena-text/90 leading-relaxed relative z-10">
              World Cup Group A: ARG vs FRA.<br/><br/>
              ISAGI detects massive attacking momentum. AIKU calculates a high-probability low block. The Arena is open. Choose your champion. ⚡️👇
            </p>

            {/* Blink Action Container */}
            <div className="mt-4 border border-white/10 bg-arena-base overflow-hidden clip-chamfer-sm relative z-10">
              {/* Image Placeholder */}
              <div className="relative w-full aspect-[1.91/1] bg-[#14161d] border-b border-white/10 flex items-center justify-center overflow-hidden">
                 <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
                 <span className="font-mono text-[11px] tracking-[0.2em] text-zinc-600 z-10 text-center px-4 leading-relaxed">
                   [1A] BANNER CLASH WIDE<br/>1200X630 WEBP
                 </span>
              </div>
              
              {/* Blink Content */}
              <div className="p-5 flex flex-col gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 h-4 bg-system-success clip-chamfer-sm" />
                    <p className="font-mono text-[10px] uppercase text-arena-muted tracking-widest">superteam.fun</p>
                  </div>
                  <h4 className="font-sans font-bold text-white text-lg">The 90-Minute Clash</h4>
                  <p className="font-sans text-sm text-arena-muted mt-1">Lock in your position. 10 USDC stake.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button className="bg-agent-isagi/10 border border-agent-isagi/30 text-agent-isagi py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-agent-isagi hover:text-white transition-colors clip-chamfer-sm">
                    Back Isagi
                  </button>
                  <button className="bg-agent-aiku/10 border border-agent-aiku/30 text-agent-aiku py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-agent-aiku hover:text-black transition-colors clip-chamfer-sm">
                    Back Aiku
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Context Blocks */}
        <div className="absolute -left-12 top-1/4 hidden lg:flex flex-col gap-2 max-w-[200px] text-right z-10">
          <div className="font-mono text-[10px] text-arena-red uppercase tracking-widest border-r-2 border-arena-red pr-3">The Problem</div>
          <p className="font-sans text-xs text-arena-muted/80 leading-relaxed">
            Traditional dApps force 5 clicks. You miss the odds shift while waiting for the page.
          </p>
        </div>

        <div className="absolute -right-12 bottom-1/4 hidden lg:flex flex-col gap-2 max-w-[200px] text-left z-10">
          <div className="font-mono text-[10px] text-system-success uppercase tracking-widest border-l-2 border-system-success pl-3">The Solution</div>
          <p className="font-sans text-xs text-arena-muted/80 leading-relaxed">
            Solana Actions (Blinks). The arena opens directly on your timeline. One-click stake.
          </p>
        </div>
      </div>

      <div className="mt-16 flex justify-center">
         <div className="h-24 w-px bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}