import { HudPanel } from "@/components/ui/hud-panel";
import { Reveal } from "@/components/ui/reveal";
import { getLandingConfig } from "@/lib/landing-config";

export function OracleSection() {
  const { isLive, status } = getLandingConfig();
  const oracleStats = [
    isLive ? "LIVE_SYNC: 104 MATCHES" : "MODE: SIMULATED FEED",
    "SOURCE: TX_ODDS",
    isLive ? "LATENCY: SUB-SECOND" : "SCHEMA: TXLINE-COMPATIBLE",
  ];

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24" id="oracle">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
            05. <span className="text-white">THE TRUTH</span>
          </p>
          <h2 className="mt-4 font-display text-5xl uppercase leading-[0.9] text-arena-text md:text-7xl">
            CRYPTOGRAPHIC <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">
              ORACLE
            </span>
          </h2>

          <div className="mt-8 space-y-5 border-l border-white/10 pl-5">
            <p className="font-sans text-base leading-7 text-arena-muted/85">
              Algorithmic trading is only as good as its data. Off-chain APIs are slow,
              manipulatable, and require trust.
            </p>
            <p className="font-sans text-base leading-7 text-arena-text/90">
              Arena90 is built on TxLINE&apos;s normalized schema. The current source
              follows the same decision pipeline from feed to deterministic agent
              signal and on-chain settlement.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {oracleStats.map((stat) => (
              <div
                className="border border-system-success/25 bg-system-success/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-system-success clip-chamfer-sm"
                key={stat}
              >
                [ {stat} ]
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.12} y={24}>
          <HudPanel className="relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-arena-muted">
                  TxLINE Oracle Feed
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-white">
                  normalized consensus payload
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-system-success">
                <span className="h-2 w-2 bg-system-success animate-pulse" />
                {status.txline}
              </div>
            </div>

            <div className="relative bg-[#080a10] p-5">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:32px_32px]" />
              <pre className="relative overflow-x-auto font-mono text-[11px] leading-6 text-arena-muted sm:text-xs">
                <code>
                  <span className="text-white">{"{"}</span>
                  {"\n  "}
                  <span>&quot;source&quot;: </span>
                  <span className="text-system-success">&quot;{isLive ? "TX_ODDS" : "txodds-mock"}&quot;</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;matchId&quot;: </span>
                  <span className="text-system-success">&quot;wc2026-arg-fra-001&quot;</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;state&quot;: </span>
                  <span className="text-system-caution">&quot;{isLive ? "live_1st_half" : "simulation_ready"}&quot;</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;liveSync&quot;: </span>
                  <span className="text-white">104</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;latencyMs&quot;: </span>
                  <span className="text-white">642</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;market&quot;: </span>
                  <span className="text-white">{"{"}</span>
                  {"\n    "}
                  <span>&quot;over_2_5&quot;: </span>
                  <span className="text-agent-isagi">0.6990</span>
                  <span className="text-white">,</span>
                  {"\n    "}
                  <span>&quot;under_2_5&quot;: </span>
                  <span className="text-agent-aiku">0.3010</span>
                  <span className="text-white">,</span>
                  {"\n    "}
                  <span>&quot;vig&quot;: </span>
                  <span className="text-white">0.0000</span>
                  {"\n  "}
                  <span className="text-white">{"}"}</span>
                  <span className="text-white">,</span>
                  {"\n  "}
                  <span>&quot;anchor&quot;: </span>
                  <span className="text-system-success">&quot;verified&quot;</span>
                  {"\n"}
                  <span className="text-white">{"}"}</span>
                </code>
              </pre>
            </div>
          </HudPanel>
        </Reveal>
      </div>
    </section>
  );
}
