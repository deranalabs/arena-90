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
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-32 border-t border-white/5">
      
      {/* Section Header */}
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted mb-2">
            04. <span className="text-system-caution">THE BRAIN</span>
          </p>
          <h2 className="font-display text-5xl md:text-6xl leading-none text-arena-text">
            AUTONOMOUS <br className="sm:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-arena-muted to-white/20">INTELLIGENCE</span>
          </h2>
        </div>
        <div className="text-left md:text-right max-w-md font-sans text-sm leading-relaxed text-arena-muted/80">
          ISAGI and AIKU aren&apos;t just random scripts. They are autonomous agents running on the ZeroClaw engine. They ingest live market data, evaluate momentum, and lock their positions. They never sleep. They never tilt.
        </div>
      </div>

      {/* Terminal Mockup */}
      <HudPanel className="w-full bg-[#0D0D11] border-white/10 p-0 overflow-hidden clip-chamfer group">
        
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#14161d] px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-arena-muted/30" />
              <div className="w-2 h-2 rounded-full bg-arena-muted/30" />
              <div className="w-2 h-2 rounded-full bg-arena-muted/30" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-arena-muted">
              zeroclaw-agent-daemon // live-logs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-system-success animate-pulse clip-chamfer-sm" />
            <span className="font-mono text-[10px] uppercase text-system-success">Connected</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="relative p-6 md:p-8 font-mono text-xs md:text-sm leading-loose text-arena-muted bg-[#08080A] min-h-[200px]">
          
          {/* Scanline overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
          
          <div className="flex flex-col gap-2 relative z-10">
            {logs.map((log, index) => {
              // Colorize based on content
              let colorClass = "text-arena-muted";
              if (log.includes("ISAGI_EVAL")) colorClass = "text-agent-isagi";
              if (log.includes("AIKU_EVAL")) colorClass = "text-agent-aiku";
              if (log.includes("CLASH DETECTED")) colorClass = "text-system-success";
              if (log.includes("MATCH:")) colorClass = "text-white";

              return (
                <div key={index} className="flex gap-3 items-start animate-fade-in">
                  <span className="text-arena-muted/40 shrink-0">~</span>
                  <span className={colorClass}>{log}</span>
                </div>
              );
            })}
            {/* Blinking cursor */}
            <div className="flex gap-3 items-start">
               <span className="text-arena-muted/40 shrink-0">~</span>
               <span className="w-2 h-4 bg-white/50 animate-pulse mt-0.5" />
            </div>
          </div>
        </div>
      </HudPanel>

    </section>
  );
}