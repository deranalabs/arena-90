"use client";

import { useEffect, useRef, useState } from "react";

import { getLandingConfig } from "@/lib/landing-config";
import { cn } from "@/lib/utils";

const LIVE_BRAIN_LOGS = [
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

const MOCK_BRAIN_LOGS = [
  "[SYS_INIT] ZERO_CLAW RUNTIME V1.0.0 ENGAGED...",
  "[SYS_INIT] ALLOCATING MEMORY FOR AUTONOMOUS AGENTS...",
  "[SYS_INIT] LOADING AGENT PROFILES: ISAGI (AGGRESSOR) & AIKU (WALL)",
  "[SYS_INFO] >> DETERMINISTIC TEST RUN USING TXLINE-COMPATIBLE MOCK DATA.",
  "",
  "> [12:00:01] READING TXODDS MOCK PAYLOAD...",
  "> [12:00:04] MATCH: ARG vs FRA [FETCHED]",
  "> [12:00:06] ISAGI_EVAL: 6990 BPS ATTACKING PRESSURE. POSITION: OVER 2.5",
  "> [12:00:08] AIKU_EVAL: 3010 BPS DRAW RESISTANCE. POSITION: UNDER 2.5",
  "> [12:00:10] CRITICAL: CLASH DETECTED. STRATEGIES IN CONFLICT.",
  "> [12:00:11] GENERATING SOLANA BLINK PAYLOAD FOR DEVNET TEST...",
  "> [12:00:12] DETERMINISTIC RUN COMPLETE.",
];

export function TelemetrySection() {
  const { isLive, status } = getLandingConfig();
  const brainLogs = isLive ? LIVE_BRAIN_LOGS : MOCK_BRAIN_LOGS;
  const sectionRef = useRef<HTMLElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [logs, setLogs] = useState<string[]>([""]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasStarted(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.25 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let lineIndex = 0;
    let charIndex = 0;
    let timeout: ReturnType<typeof setTimeout>;

    setLogs([""]);
    setIsTyping(true);

    const typeNextCharacter = () => {
      if (lineIndex >= brainLogs.length) {
        setIsTyping(false);
        return;
      }

      const targetLine = brainLogs[lineIndex];

      if (targetLine === "") {
        setLogs((prev) => {
          const nextLogs = prev.slice(0, lineIndex);
          nextLogs[lineIndex] = "";
          return nextLogs;
        });
        lineIndex++;
        charIndex = 0;
        timeout = setTimeout(typeNextCharacter, 260);
        return;
      }

      setLogs((prev) => {
        const nextLogs = prev.slice(0, lineIndex + 1);
        nextLogs[lineIndex] = targetLine.slice(0, charIndex);
        return nextLogs;
      });

      if (charIndex < targetLine.length) {
        charIndex++;
        timeout = setTimeout(typeNextCharacter, targetLine.startsWith(">") ? 16 : 20);
        return;
      }

      lineIndex++;
      charIndex = 0;
      timeout = setTimeout(typeNextCharacter, 360);
    };

    timeout = setTimeout(typeNextCharacter, 300);

    return () => clearTimeout(timeout);
  }, [brainLogs, hasStarted]);

  return (
    <section
      id="agent-trace"
      className="relative z-10 w-full overflow-hidden border-y border-white/5 bg-[#07080d] py-28"
      ref={sectionRef}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <div className="relative mx-auto w-full max-w-5xl px-6">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-arena-muted">
              04. <span className="text-system-caution">THE BRAIN</span>
            </p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-arena-text md:text-6xl">
              {isLive ? "LIVE AGENT TRACE" : "AGENT EXECUTION TRACE"}
            </h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-system-success">
            <span className="h-2 w-2 bg-system-success animate-pulse" />
            {status.agent}
          </div>
        </div>
      </div>

      <div className="relative border-y border-white/10 bg-[#080a10]/95">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-system-caution/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-system-success/25 to-transparent" />

        <div className="relative mx-auto w-full max-w-5xl px-6">
          <div className="flex flex-col gap-3 border-b border-white/10 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-arena-muted">
                zero_claw.runtime
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-white">
                autonomous evaluation stream
              </p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-arena-muted">
              ARG vs FRA / 12:00 UTC
            </div>
          </div>

          <div className="relative min-h-[390px] overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#080a10] to-transparent" />

            <div className="relative flex min-h-[390px] flex-col justify-end gap-2 py-5 font-mono text-[11px] leading-5 text-arena-muted sm:text-xs">
              {logs.map((log, index) => {
                const targetLog = brainLogs[index] ?? log;
                let colorClass = "text-arena-muted/70";
                let isHighlight = false;

                if (targetLog.includes("[SYS_INFO]")) {
                  colorClass = "text-white";
                  isHighlight = true;
                }
                if (targetLog.includes("ISAGI_EVAL")) {
                  colorClass = "text-agent-isagi";
                  isHighlight = true;
                }
                if (targetLog.includes("AIKU_EVAL")) {
                  colorClass = "text-agent-aiku";
                  isHighlight = true;
                }
                if (targetLog.includes("CRITICAL:")) {
                  colorClass = "text-system-caution font-bold";
                  isHighlight = true;
                }
                if (log === "") {
                  return (
                    <div
                      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 animate-fade-in"
                      key={index}
                    >
                      <span className="text-arena-muted/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {isTyping && index === logs.length - 1 ? (
                        <span className="h-4 w-2 translate-y-0.5 bg-white/80 animate-pulse" />
                      ) : (
                        <span className="h-3" />
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    className={cn(
                      "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 animate-fade-in",
                      isHighlight && "drop-shadow-[0_0_10px_rgba(255,255,255,0.12)]",
                    )}
                    key={index}
                  >
                    <span className="text-arena-muted/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("min-w-0 break-words", colorClass)}>
                      {log}
                      {isTyping && index === logs.length - 1 && (
                        <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 bg-white/80 animate-pulse" />
                      )}
                    </span>
                  </div>
                );
              })}

            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-system-caution">
              Clash detected
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-agent-isagi">
              ISAGI / Over 2.5
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-agent-aiku">
              AIKU / Under 2.5
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
