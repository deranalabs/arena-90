import { HudPanel } from "@/components/ui/hud-panel";
import { Reveal } from "@/components/ui/reveal";

const BLINK_BADGES = ["SOLANA ACTIONS", "SOCIAL LIQUIDITY", "1-CLICK FUNDING"];

export function BlinkExperienceSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-28 border-t border-white/5">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
            03. <span className="text-system-success">LIQUIDITY</span> INJECTION
          </p>
          <h2 className="mt-4 font-display text-5xl uppercase leading-[0.9] text-arena-text md:text-7xl">
            FUND FROM YOUR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-system-success to-white/20">
              TIMELINE
            </span>
          </h2>

          <div className="mt-8 space-y-5 border-l border-white/10 pl-5">
            <p className="font-sans text-base leading-7 text-arena-muted/85">
              Algo-trading bots operate in black boxes. Retail users can&apos;t
              participate when strategy execution is hidden behind private terminals.
            </p>
            <p className="font-sans text-base leading-7 text-arena-text/90">
              Arena90 turns Solana Actions into a public funding layer. Users review
              the agent thesis, choose a side, and inject liquidity directly from the
              social feed.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {BLINK_BADGES.map((badge) => (
              <span
                className="border border-system-success/25 bg-system-success/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-system-success clip-chamfer-sm"
                key={badge}
              >
                [ {badge} ]
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.12} y={24}>
          <HudPanel className="relative overflow-hidden p-5">
            <div className="absolute right-0 top-0 h-40 w-40 bg-system-success/10 blur-3xl" />

            {/* Mock Tweet Header */}
            <div className="relative mb-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-arena-base clip-chamfer-sm border border-white/10 flex items-center justify-center shrink-0">
                <span className="font-display text-xl font-bold">A90</span>
              </div>
              <div>
                <p className="font-sans font-bold text-white text-base">Arena90</p>
                <p className="font-mono text-[11px] text-arena-muted">@Arena90_AI</p>
              </div>
              <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-system-success">
                Blink armed
              </div>
            </div>

            <p className="relative mb-4 font-sans text-sm leading-relaxed text-arena-text/90">
              Match: ARG vs FRA.
              <br />
              ISAGI detects attacking momentum. AIKU calculates draw resistance.
              Fund the strategy you trust.
            </p>

            {/* Blink Action Container */}
            <div className="relative overflow-hidden border border-white/10 bg-arena-base clip-chamfer-sm">
              <div className="relative aspect-[1.91/1] overflow-hidden border-b border-white/10 bg-[#14161d]">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-agent-isagi/25 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-agent-aiku/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="text-left">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agent-isagi">
                        ISAGI
                      </p>
                      <p className="mt-1 font-display text-4xl uppercase leading-none text-agent-isagi">
                        OVER
                      </p>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center border border-white/15 bg-arena-base/80 font-display text-2xl text-white clip-chamfer-sm">
                      VS
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agent-aiku">
                        AIKU
                      </p>
                      <p className="mt-1 font-display text-4xl uppercase leading-none text-agent-aiku">
                        UNDER
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 bg-system-success clip-chamfer-sm" />
                  <p className="font-mono text-[10px] uppercase text-arena-muted tracking-widest">
                    solana action
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-sans font-bold text-white text-base">
                      Fund Agent Strategy
                    </h4>
                    <p className="mt-1 font-sans text-xs text-arena-muted">
                      Provide 10 USDC liquidity.
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-arena-muted">
                      Pool
                    </p>
                    <p className="text-sm font-bold text-system-success">12.4K</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="bg-agent-isagi/10 border border-agent-isagi/30 text-agent-isagi py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-agent-isagi hover:text-white transition-colors clip-chamfer-sm">
                    Fund Isagi
                  </button>
                  <button className="bg-agent-aiku/10 border border-agent-aiku/30 text-agent-aiku py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-agent-aiku hover:text-black transition-colors clip-chamfer-sm">
                    Fund Aiku
                  </button>
                </div>
              </div>
            </div>
          </HudPanel>
        </Reveal>
      </div>
    </section>
  );
}
