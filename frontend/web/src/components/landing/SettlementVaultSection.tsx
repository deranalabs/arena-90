import { Reveal } from "@/components/ui/reveal";

const VAULT_STEPS = [
  {
    id: "01",
    label: "LOCK / ESCROW",
    text: "Funds secured in a PDA Escrow. Never held by any central authority.",
    tone: "white",
  },
  {
    id: "02",
    label: "KAMINO YIELD",
    text: "Idle liquidity is routed to Kamino Finance to generate yield during the 90-minute match window.",
    tone: "yield",
  },
  {
    id: "03",
    label: "P2P PAYOUT",
    text: "TxLINE Oracle triggers settlement. The winning agent's backers take the pool plus the yield.",
    tone: "success",
  },
] as const;

export function SettlementVaultSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-28 pb-24 bg-[linear-gradient(180deg,transparent_0%,rgba(10,11,16,0.8)_100%)]">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-arena-muted clip-chamfer-sm">
            <span className="h-2 w-2 bg-system-success animate-pulse" />
            06. SETTLEMENT PHASE
          </p>
          <h2 className="mt-5 max-w-3xl font-display text-5xl uppercase leading-none text-arena-text md:text-7xl">
            NO HOUSE. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">
              JUST THE ESCROW.
            </span>
          </h2>
          <p className="mt-8 max-w-xl font-sans text-lg leading-relaxed text-arena-muted/85">
            When you back a strategy, your capital is locked in a secure Anchor PDA.
            Trustless P2P settlement.
          </p>

          <div className="mt-8 flex max-w-xl flex-wrap gap-3">
            <span className="border border-system-success/25 bg-system-success/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-system-success clip-chamfer-sm">
              Anchor PDA
            </span>
            <span className="border border-agent-aiku/25 bg-agent-aiku/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-agent-aiku clip-chamfer-sm">
              Kamino Route
            </span>
            <span className="border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-arena-muted clip-chamfer-sm">
              No Custodian
            </span>
          </div>
        </Reveal>

        <div className="relative">
          <div className="absolute right-0 top-0 h-40 w-40 bg-agent-aiku/10 blur-3xl" />
          <Reveal className="mb-8 border-b border-white/10 pb-4" delay={0.08}>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-arena-muted">
              Settlement Roadmap
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-white">
              escrow connected to yield connected to payout
            </p>
          </Reveal>

          <div className="relative lg:pt-10">
            <div className="absolute left-5 top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-white/15 via-agent-aiku/45 to-system-success/45 lg:left-8 lg:right-8 lg:top-[4.5rem] lg:h-px lg:w-auto lg:bg-gradient-to-r" />

            {VAULT_STEPS.map((step, index) => {
              const isYield = step.tone === "yield";
              const isSuccess = step.tone === "success";
              const titleColor = isYield
                ? "text-agent-aiku"
                  : isSuccess
                    ? "text-system-success"
                    : "text-white";
              const nodeColor = isYield
                ? "border-agent-aiku/50 bg-agent-aiku/10 text-agent-aiku"
                : isSuccess
                  ? "border-system-success/50 bg-system-success/10 text-system-success"
                  : "border-white/20 bg-white/5 text-white";
              const offsetClass =
                index === 0
                  ? "lg:translate-y-0"
                  : index === 1
                    ? "lg:translate-y-12"
                    : "lg:translate-y-0";

              return (
                <Reveal
                  amount={0.35}
                  className={`relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-5 pb-10 last:pb-0 lg:inline-grid lg:w-1/3 lg:grid-cols-1 lg:gap-4 lg:pb-0 lg:align-top ${offsetClass}`}
                  delay={0.14 + index * 0.08}
                  key={step.id}
                  y={20}
                >
                  <div className="relative lg:flex lg:justify-center">
                    <div className={`relative z-10 flex h-10 w-10 items-center justify-center border font-mono text-xs clip-chamfer-sm ${nodeColor}`}>
                      {step.id}
                    </div>

                  </div>

                  <div className="pt-1 lg:px-3 lg:text-center">
                    <h3 className={`font-display text-3xl uppercase leading-none ${titleColor}`}>
                      {step.label}
                    </h3>
                    <p className="mt-3 max-w-lg font-sans text-sm leading-6 text-arena-muted/85 lg:mx-auto">
                      {step.text}
                    </p>
                    {index === 1 && (
                      <div className="mt-4 h-1 max-w-xs overflow-hidden bg-white/8 clip-chamfer-sm lg:mx-auto">
                        <div className="h-full w-2/3 bg-gradient-to-r from-agent-aiku to-system-success" />
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
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
