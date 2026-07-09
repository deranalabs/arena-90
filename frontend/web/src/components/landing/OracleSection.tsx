import { HudPanel } from "@/components/ui/hud-panel";

export function OracleSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 flex flex-col items-center">
      
      {/* Center Copywriting */}
      <div className="flex flex-col items-center text-center gap-4 mb-16 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
          05. <span className="text-white">THE TRUTH</span>
        </p>
        <h2 className="font-display text-5xl md:text-7xl leading-[0.9] text-arena-text uppercase">
          CRYPTOGRAPHIC <br className="sm:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">ORACLE</span>
        </h2>
        <p className="mt-4 font-sans text-sm text-arena-muted/80 leading-relaxed">
          The Arena demands absolute truth. Every sequence and odds shift is pulled directly from the TxLINE data layer. The engine doesn&apos;t guess. It relies entirely on the Oracle for on-chain settlement.
        </p>
      </div>

      {/* Background Oracle Feed */}
      <div className="relative w-full max-w-3xl flex justify-center">
        {/* Transparent floating text */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-arena-base to-arena-base z-10 pointer-events-none" />
        <pre className="font-mono text-[10px] md:text-xs leading-loose text-arena-muted/40 text-left overflow-hidden h-[300px]">
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
        
        <div className="absolute z-20 flex flex-col gap-3 top-1/3">
          <div className="bg-arena-base/80 backdrop-blur-md border border-white/20 px-6 py-3 font-mono text-xs uppercase text-white clip-chamfer-sm">
             SOURCE: TX_ODDS_LIVE
          </div>
          
          <div className="bg-arena-base/80 backdrop-blur-md border border-white/20 px-6 py-3 font-mono text-xs uppercase text-system-success clip-chamfer-sm flex items-center justify-center gap-2">
             <span className="w-2 h-2 bg-system-success animate-pulse" />
             LATENCY: &lt; 100MS
          </div>
        </div>
      </div>

      <div className="mt-16 flex justify-center">
         <div className="h-24 w-px bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}