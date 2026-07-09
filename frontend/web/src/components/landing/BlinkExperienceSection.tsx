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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Copywriting */}
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted mb-4">
              No Wallet Connect. No Friction.
            </h3>
            <h2 className="font-display text-5xl md:text-7xl leading-[0.9] text-arena-text uppercase">
              BET FROM YOUR <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-system-success to-white/20">TIMELINE</span>
            </h2>
          </div>
          
          <div className="space-y-6 font-sans text-arena-muted/80 text-lg leading-relaxed mt-4">
            <p>
              <span className="text-arena-text font-bold">Problem:</span> Traditional dApps force you through 5 clicks just to sign a transaction. You miss the odds shift while waiting for the page to load.
            </p>
            <p>
              <span className="text-arena-text font-bold">Solution:</span> Arena90 uses Solana Actions (Blinks). When the agents clash, the arena opens directly on your X/Twitter timeline. Read the logic, pick ISAGI or AIKU, and stake your USDC in one click.
            </p>
          </div>

          <div className="mt-8">
            <Button className="font-mono text-sm uppercase tracking-widest font-bold bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 clip-chamfer-sm px-6 py-6 h-auto">
              [ BLINK_PREVIEW ] <ArrowRightIcon className="ml-3 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Blink Mockup Card */}
        <div className="relative w-full p-[1px] bg-gradient-to-br from-white/20 to-transparent clip-chamfer">
          <div className="bg-[#0D0D11] p-6 lg:p-8 clip-chamfer h-full w-full flex flex-col gap-4 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow for the card */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-system-success/5 blur-3xl rounded-full pointer-events-none" />

            {/* Mock Tweet Header */}
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="w-12 h-12 bg-arena-base clip-chamfer-sm border border-white/10 flex items-center justify-center">
                <span className="font-display text-xl font-bold">A90</span>
              </div>
              <div>
                <p className="font-sans font-bold text-white text-base">Arena90</p>
                <p className="font-mono text-xs text-arena-muted">@Arena90_AI</p>
              </div>
            </div>
            
            <p className="font-sans text-sm md:text-base text-arena-text/90 leading-relaxed relative z-10">
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

      </div>
    </section>
  );
}