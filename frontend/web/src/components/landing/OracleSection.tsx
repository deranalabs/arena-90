import { HudPanel } from "@/components/ui/hud-panel";

export function OracleSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-32 border-t border-white/5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* Left: JSON Oracle Mockup */}
        <div className="relative order-2 lg:order-1">
          <HudPanel className="w-full bg-[#0D0D11] border-white/10 p-0 overflow-hidden clip-chamfer">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#14161d] px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-arena-muted">
                RAW_JSON_FEED // ARG_VS_FRA
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-system-success animate-pulse clip-chamfer-sm" />
                <span className="font-mono text-[10px] uppercase text-system-success">LIVE_SYNC</span>
              </div>
            </div>
            
            <div className="p-6 overflow-x-auto bg-[#08080A]">
              <pre className="font-mono text-xs leading-loose">
                <span className="text-white">{"{"}</span>
                <br />
                <span className="text-arena-muted">  &quot;matchId&quot;:</span> <span className="text-system-success">&quot;wc2026-arg-fra-group-001&quot;</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">  &quot;status&quot;:</span> <span className="text-system-caution">&quot;live_1st_half&quot;</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">  &quot;odds&quot;:</span> <span className="text-white">{"{"}</span>
                <br />
                <span className="text-arena-muted">    &quot;home&quot;:</span> <span className="text-agent-isagi">2.55</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">    &quot;draw&quot;:</span> <span className="text-agent-aiku">3.10</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">    &quot;away&quot;:</span> <span className="text-agent-isagi">2.80</span>
                <br />
                <span className="text-white">  {"}"},</span>
                <br />
                <span className="text-arena-muted">  &quot;impliedProbability&quot;:</span> <span className="text-white">{"{"}</span>
                <br />
                <span className="text-arena-muted">    &quot;home&quot;:</span> <span className="text-white">0.3922</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">    &quot;draw&quot;:</span> <span className="text-white">0.3226</span><span className="text-white">,</span>
                <br />
                <span className="text-arena-muted">    &quot;away&quot;:</span> <span className="text-white">0.3571</span>
                <br />
                <span className="text-white">  {"}"}</span>
                <br />
                <span className="text-white">{"}"}</span>
              </pre>
            </div>
          </HudPanel>

          {/* Floating Data Labels */}
          <div className="absolute -right-4 -bottom-4 flex flex-col gap-2">
            <div className="bg-arena-base border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase text-arena-muted clip-chamfer-sm shadow-2xl">
              SOURCE: TX_ODDS_LIVE
            </div>
            <div className="bg-arena-base border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase text-arena-muted clip-chamfer-sm shadow-2xl">
              LATENCY: &lt; 100MS
            </div>
          </div>
        </div>

        {/* Right: Copywriting */}
        <div className="order-1 lg:order-2 flex flex-col gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted mb-2">
              05. <span className="text-white">THE TRUTH</span>
            </p>
            <h2 className="font-display text-5xl md:text-6xl leading-none text-arena-text">
              CRYPTOGRAPHIC <br className="sm:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">ORACLE</span>
            </h2>
          </div>
          
          <div className="space-y-6 font-sans text-arena-muted/80 text-lg leading-relaxed mt-4">
            <p>
              The Arena demands absolute truth. Every attacking sequence, possession drop, and odds shift is pulled directly from the TxLINE data layer. 
            </p>
            <p>
              104 World Cup matches, normalized into a single JSON schema. The engine doesn&apos;t guess. It relies entirely on the Oracle for both pre-match evaluation and post-match on-chain settlement.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}