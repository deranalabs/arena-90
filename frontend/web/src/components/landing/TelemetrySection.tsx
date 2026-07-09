"use client";

import { useEffect, useState } from "react";

const BRAIN_LOGS = [
  "[SYS_INIT] ZERO_CLAW RUNTIME V1.0.0 ENGAGED...",
  "[SYS_INIT] ALLOCATING MEMORY FOR AUTONOMOUS AGENTS...",
  "[SYS_INIT] LOADING AGENT PROFILES: ISAGI (AGGRESSOR) & AIKU (WALL)",
  "[SYS_INFO] >> AGENTS ARE NOT SCRIPTED. THEY INGEST LIVE DATA AND TRADE AUTONOMOUSLY.",
  "",
  "> [12:00:01] POLLING TX_LINE STREAM...",
  "> [12:00:04] MATCH: ARG vs FRA [FETCHED]",
  "> [12:00:06] ISAGI_EVAL: 6990 BPS ATTACKING PRESSURE. POSITION: OVER 2.5",
  "> [12:00:08] AIKU_EVAL: 3010 BPS DRAW RESISTANCE. POSITION: UNDER 2.5",
  "> [12:00:10] CRITICAL: CLASH DETECTED. STRATEGIES IN CONFLICT.",
  "> [12:00:11] GENERATING SOLANA BLINK PAYLOAD FOR SOCIAL DISTRIBUTION...",
  "> [12:00:12] AWAITING CROWD LIQUIDITY INJECTION...",
];

export function TelemetrySection() {
  const [logs, setLogs] = useState<string[]>([BRAIN_LOGS[0]]);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let currentIndex = 1;
    const interval = setInterval(() => {
      setLogs((prev) => {
        if (currentIndex >= BRAIN_LOGS.length) {
          setIsTyping(false);
          clearInterval(interval);
          return prev;
        }
        const nextLogs = [...prev, BRAIN_LOGS[currentIndex]];
        return nextLogs;
      });
      currentIndex++;
    }, 1200); // Ticking speed

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative z-10 w-full bg-[#050507] border-y border-white/5 py-32 overflow-hidden">
      
      {/* Ambient Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-5xl px-6">
        
        {/* Subtle Header */}
        <div className="mb-12 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
            04. <span className="text-system-caution">THE BRAIN</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-system-success animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-system-success">TERMINAL_LIVE</span>
          </div>
        </div>

        {/* Full-width Terminal Text */}
        <div className="font-mono text-sm md:text-xl lg:text-2xl leading-relaxed md:leading-loose text-arena-muted">
          <div className="flex flex-col gap-4 md:gap-6">
            {logs.map((log, index) => {
              let colorClass = "text-arena-muted/70";
              let isHighlight = false;

              if (log.includes("[SYS_INFO]")) {
                colorClass = "text-white";
                isHighlight = true;
              }
              if (log.includes("ISAGI_EVAL")) {
                colorClass = "text-agent-isagi";
                isHighlight = true;
              }
              if (log.includes("AIKU_EVAL")) {
                colorClass = "text-agent-aiku";
                isHighlight = true;
              }
              if (log.includes("CRITICAL:")) {
                colorClass = "text-system-caution font-bold";
                isHighlight = true;
              }
              if (log === "") return <div key={index} className="h-4 md:h-8" />;

              return (
                <div 
                  key={index} 
                  className={`flex items-start animate-fade-in ${isHighlight ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : ''}`}
                >
                  <span className={colorClass}>{log}</span>
                </div>
              );
            })}
            
            {/* Blinking cursor */}
            {isTyping && (
              <div className="flex items-start mt-2">
                 <span className="w-3 h-6 md:w-4 md:h-8 bg-white/80 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}