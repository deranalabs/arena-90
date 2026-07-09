"use client";

import { useEffect, useState } from "react";
import { HudPanel } from "@/components/ui/hud-panel";

const MOCK_LOGS = [
  "> [12:00:01] POLLING TX_LINE STREAM...",
  "> [12:00:04] MATCH: ARG vs FRA [FETCHED]",
  "> [12:00:06] ISAGI_EVAL: 6990 BPS ATTACKING PRESSURE. POSITION: OVER 2.5",
  "> [12:00:08] AIKU_EVAL: 3010 BPS DRAW RESISTANCE. POSITION: UNDER 2.5",
  "> [12:00:10] CLASH DETECTED. GENERATING BLINK PAYLOAD...",
];

export function TelemetrySection() {
  const [logs, setLogs] = useState<string[]>([MOCK_LOGS[0]]);

  useEffect(() => {
    let currentIndex = 1;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const nextLogs = [...prev, MOCK_LOGS[currentIndex]];
        return nextLogs.length > 5 ? nextLogs.slice(nextLogs.length - 5) : nextLogs;
      });
      currentIndex = (currentIndex + 1) % MOCK_LOGS.length;
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 flex flex-col items-center">
      
      {/* Center Copywriting */}
      <div className="flex flex-col items-center text-center gap-4 mb-20 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
          04. <span className="text-system-caution">THE BRAIN</span>
        </p>
        <h2 className="font-display text-5xl md:text-7xl leading-[0.9] text-arena-text uppercase">
          AUTONOMOUS <br className="sm:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">INTELLIGENCE</span>
        </h2>
        <p className="mt-4 font-sans text-sm text-arena-muted/80 leading-relaxed">
          ISAGI and AIKU aren&apos;t just random scripts. They are autonomous agents running on the ZeroClaw engine. They ingest live market data, evaluate momentum, and lock their positions. They never sleep. They never tilt.
        </p>
      </div>

      {/* Floating Terminal Mockup */}
      <div className="relative w-full max-w-3xl bg-transparent border-l-2 border-system-caution/50 pl-6 group">
        
        <div className="font-mono text-[10px] uppercase tracking-widest text-arena-muted mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-system-success animate-pulse clip-chamfer-sm" />
          zeroclaw-agent-daemon // live-logs
        </div>

        <div className="font-mono text-sm md:text-base leading-relaxed text-arena-muted min-h-[200px]">
          <div className="flex flex-col gap-3">
            {logs.map((log, index) => {
              let colorClass = "text-arena-muted";
              if (log.includes("ISAGI_EVAL")) colorClass = "text-agent-isagi";
              if (log.includes("AIKU_EVAL")) colorClass = "text-agent-aiku";
              if (log.includes("CLASH DETECTED")) colorClass = "text-system-success";
              if (log.includes("MATCH:")) colorClass = "text-white";

              return (
                <div key={index} className="flex gap-4 items-start animate-fade-in drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
                  <span className="text-arena-muted/40 shrink-0">~</span>
                  <span className={colorClass}>{log}</span>
                </div>
              );
            })}
            {/* Blinking cursor */}
            <div className="flex gap-3 items-start">
               <span className="text-arena-muted/40 shrink-0">~</span>
               <span className="w-3 h-5 bg-white/70 animate-pulse mt-0.5" />
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