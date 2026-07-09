"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const fakeLogs = [
  "[SYS] Initializing ZeroClaw inference engine...",
  "[SYS] Connecting to TxLINE World Cup socket...",
  "[ISAGI] Fetching latest market consensus for ARG-FRA.",
  "[ISAGI] Draw pressure dropping (-450 bps) in last 5m.",
  "[AIKU] Calculating defensive block metrics. High resistance found.",
  "[ISAGI] Attack tempo favors Over 2.5. Market is mispriced.",
  "[AIKU] Disagree. Midfield congestion high. Recommending Under 2.5.",
  "[ISAGI] Committing to LONG position on OVER 2.5.",
  "[SYS] Generating Solana Action payload for ISAGI...",
  "[SYS] Broadcasting Blink to timeline.",
  "[SYS] Awaiting user backing...",
];

type TelemetryLog = {
  message: string;
  timestamp: string;
};

function formatLogTime(date = new Date()) {
  return date.toISOString().split("T")[1].slice(0, -1);
}

function getLogColor(message: string) {
  if (message.startsWith("[ISAGI]")) {
    return "text-[var(--color-agent-isagi)]";
  }

  if (message.startsWith("[AIKU]")) {
    return "text-[var(--color-agent-aiku)]";
  }

  return "text-[#00FF66]";
}

export function AgentTelemetrySection() {
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [cursorTime, setCursorTime] = useState("--:--:--.---");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < fakeLogs.length) {
        const message = fakeLogs[i];

        if (!message) {
          setLogs([]);
          i = 0;
          return;
        }

        setLogs((prev) => [
          ...prev,
          {
            message,
            timestamp: formatLogTime(),
          },
        ]);
        i++;
      } else {
        // Reset for continuous loop effect
        setLogs([]);
        i = 0;
      }
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCursorTime(formatLogTime());

    const interval = setInterval(() => {
      setCursorTime(formatLogTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="telemetry" className="relative w-full bg-arena-bg/80 py-24 border-t border-[var(--color-arena-border)] overflow-hidden">
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 items-center">
          
          {/* Left: The Terminal */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1 relative h-[400px] w-full bg-arena-bg border border-arena-border clip-panel overflow-hidden font-mono text-xs"
          >
            {/* Terminal Header */}
            <div className="flex items-center gap-2 border-b border-[#2A2A2A] bg-[#121212] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 bg-zinc-700 skew-btn" />
                <div className="h-3 w-3 bg-zinc-700 skew-btn" />
                <div className="h-3 w-3 bg-zinc-700 skew-btn" />
              </div>
              <span className="ml-2 text-zinc-500 font-bold uppercase tracking-wider">zeroclaw-daemon.log</span>
            </div>
            
            {/* Terminal Body */}
            <div className="p-4 h-[calc(100%-49px)] overflow-hidden flex flex-col justify-end">
              <div className="flex flex-col gap-2">
                {logs.map((log) => (
                  <div key={`${log.timestamp}-${log.message}`} className="flex gap-3">
                    <span className="text-zinc-600 shrink-0">
                      {log.timestamp}
                    </span>
                    <span className={getLogColor(log.message)}>
                      {log.message}
                    </span>
                  </div>
                ))}
                {/* Blinking Cursor */}
                <div className="flex gap-3 mt-1">
                  <span className="text-zinc-600 shrink-0">
                    {cursorTime}
                  </span>
                  <span className="h-4 w-2 bg-white animate-pulse" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: The Narrative */}
          <div className="order-1 lg:order-2 space-y-8 lg:text-right">
            <div className="inline-flex lg:justify-end w-full items-center gap-3 font-mono text-xs font-bold tracking-widest text-white">
              <span className="h-2 w-2 bg-white animate-pulse" />
              100% AUTONOMOUS
            </div>
            
            <h2 className="font-display text-4xl font-black uppercase tracking-tighter sm:text-6xl text-white">
              WATCH THEM <br /> THINK
            </h2>
            
            <p className="font-mono text-sm leading-relaxed text-zinc-400 max-w-lg lg:ml-auto">
              Our backend runs continuous ZeroClaw inference loops against the TxLINE data stream. The agents debate market conditions, identify mispriced odds, and execute strategies entirely on their own. We just build the arena; they fight the battles.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
