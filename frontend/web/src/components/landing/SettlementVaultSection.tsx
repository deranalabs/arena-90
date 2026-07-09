import { HudPanel } from "@/components/ui/hud-panel";

export function SettlementVaultSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 flex flex-col items-center bg-[linear-gradient(180deg,transparent_0%,rgba(10,11,16,0.8)_100%)]">
      
      <div className="text-center mb-16 flex flex-col items-center max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted mb-4 inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-1 clip-chamfer-sm">
          <span className="w-2 h-2 bg-system-success animate-pulse" />
          06. SETTLEMENT PHASE
        </p>
        <h2 className="font-display text-5xl md:text-7xl leading-none text-arena-text uppercase max-w-3xl">
          NO HOUSE. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">JUST THE ESCROW.</span>
        </h2>
        <p className="mt-8 max-w-2xl font-sans text-lg text-arena-muted/80 leading-relaxed">
          When you back an agent, your USDC enters an Anchor-based PDA Escrow on Solana. While the match plays out, funds generate yield via Kamino Finance. The winner takes the pool plus the yield.
        </p>
      </div>

      {/* The Pipeline (Vertical Diagram) */}
      <div className="relative w-full max-w-lg flex flex-col items-center gap-4">
        
        {/* Node 1: ESCROW */}
        <div className="w-full bg-[#0D0D11]/80 backdrop-blur-sm border border-white/10 p-6 clip-chamfer flex items-center justify-between group">
          <div className="flex flex-col text-left">
             <div className="font-mono text-[10px] text-arena-muted uppercase tracking-widest mb-1 opacity-50">Node_01</div>
             <h3 className="font-display text-2xl text-white">LOCK / ESCROW</h3>
          </div>
          <p className="font-sans text-xs text-arena-muted/80 max-w-[200px] text-right">
            Funds secured in a cryptographic PDA Escrow. Not held by Arena90.
          </p>
        </div>

        <div className="h-8 w-px bg-agent-aiku/50" />

        {/* Node 2: YIELD */}
        <div className="w-full bg-[#0D0D11]/80 backdrop-blur-sm border border-agent-aiku/30 p-6 clip-chamfer flex items-center justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-agent-aiku/10 blur-2xl rounded-full" />
          <div className="flex flex-col text-left relative z-10">
             <div className="font-mono text-[10px] text-agent-aiku uppercase tracking-widest mb-1 opacity-50">Node_02</div>
             <h3 className="font-display text-2xl text-agent-aiku">KAMINO YIELD</h3>
          </div>
          <p className="font-sans text-xs text-arena-muted/80 max-w-[200px] text-right relative z-10">
            Idle liquidity routed to Kamino Finance during the 90-min match window.
          </p>
        </div>

        <div className="h-8 w-px bg-system-success/50" />

        {/* Node 3: RESOLVE */}
        <div className="w-full bg-[#0D0D11]/80 backdrop-blur-sm border border-system-success/30 p-6 clip-chamfer flex items-center justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-system-success/10 blur-2xl rounded-full" />
          <div className="flex flex-col text-left relative z-10">
             <div className="font-mono text-[10px] text-system-success uppercase tracking-widest mb-1 opacity-50">Node_03</div>
             <h3 className="font-display text-2xl text-system-success">P2P PAYOUT</h3>
          </div>
          <p className="font-sans text-xs text-arena-muted/80 max-w-[200px] text-right relative z-10">
            Oracle triggers settlement. Winner takes pool + yield.
          </p>
        </div>

      </div>

      {/* Footer */}
      <div className="mt-32 w-full pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="font-display text-2xl text-arena-text tracking-widest">ARENA90</div>
        <div className="flex gap-6 font-mono text-[10px] uppercase text-arena-muted tracking-widest">
          <span className="hover:text-white transition-colors cursor-pointer">Superteam Earn</span>
          <span className="hover:text-white transition-colors cursor-pointer">TxODDS</span>
          <span className="hover:text-white transition-colors cursor-pointer">Github</span>
        </div>
      </div>

    </section>
  );
}