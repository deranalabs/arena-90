import { HudPanel } from "@/components/ui/hud-panel";

export function SettlementVaultSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-32 border-t border-white/5 bg-[linear-gradient(180deg,transparent_0%,rgba(10,11,16,0.8)_100%)]">
      
      <div className="text-center mb-20 flex flex-col items-center">
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

      {/* The 3 Steps Vault Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: ESCROW */}
        <HudPanel className="bg-[#0D0D11] border-white/10 p-8 clip-chamfer transition-transform duration-300 hover:-translate-y-2 group">
          <div className="font-mono text-[10px] text-arena-muted uppercase tracking-widest mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
            Step_01
          </div>
          <h3 className="font-display text-3xl text-white mb-2">LOCK</h3>
          <p className="font-sans text-sm text-arena-muted/80">
            Funds secured in a cryptographic PDA Escrow. Not held by Arena90 or any central authority.
          </p>
        </HudPanel>

        {/* Card 2: YIELD */}
        <HudPanel className="bg-[#0D0D11] border-agent-aiku/20 p-8 clip-chamfer transition-transform duration-300 hover:-translate-y-2 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-agent-aiku/5 blur-2xl rounded-full" />
          <div className="font-mono text-[10px] text-agent-aiku uppercase tracking-widest mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
            Step_02
          </div>
          <h3 className="font-display text-3xl text-agent-aiku mb-2">YIELD</h3>
          <p className="font-sans text-sm text-arena-muted/80 relative z-10">
            Idle liquidity is routed to Kamino Finance to generate interest during the 90-minute match window.
          </p>
        </HudPanel>

        {/* Card 3: RESOLVE */}
        <HudPanel className="bg-[#0D0D11] border-system-success/20 p-8 clip-chamfer transition-transform duration-300 hover:-translate-y-2 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-system-success/5 blur-2xl rounded-full" />
          <div className="font-mono text-[10px] text-system-success uppercase tracking-widest mb-4 opacity-50 group-hover:opacity-100 transition-opacity">
            Step_03
          </div>
          <h3 className="font-display text-3xl text-system-success mb-2">RESOLVE</h3>
          <p className="font-sans text-sm text-arena-muted/80 relative z-10">
            Final whistle blows. Oracle triggers P2P payout via TxLINE CPI. Instant, trustless settlement.
          </p>
        </HudPanel>

      </div>

      {/* Footer / Final CTA */}
      <div className="mt-32 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
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