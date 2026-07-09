"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

function AgentAssetSlot({
  assetId,
  agent,
  alignment,
}: {
  assetId: string;
  agent: string;
  alignment: "left" | "right";
}) {
  const isRight = alignment === "right";
  const color = isRight ? "var(--color-agent-aiku)" : "var(--color-agent-isagi)";

  return (
    <div
      className={`absolute bottom-0 h-[85%] w-[45%] border-t bg-white/[0.025] ${
        isRight
          ? "right-[-5%] border-l"
          : "left-[-5%] border-r"
      } flex skew-container flex-col items-center justify-center overflow-hidden`}
      style={{ borderColor: color }}
    >
      <div
        className="absolute inset-8 border border-dashed opacity-40"
        style={{ borderColor: color }}
      />
      <div
        className="absolute bottom-0 h-[72%] w-[58%] rounded-t-full opacity-20 blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">
        <div
          className="grid h-24 w-24 place-items-center rounded-full border border-dashed bg-black/50 font-display text-3xl font-black"
          style={{ borderColor: color, color }}
        >
          {assetId}
        </div>
        <div>
          <div className="font-display text-2xl font-black italic text-white">
            {agent}
          </div>
          <div className="mt-2 text-[10px] leading-5 text-zinc-500">
            PNG TRANSPARENT
            <br />
            1000 X 1000 // BUST-UP
          </div>
        </div>
      </div>
    </div>
  );
}

export function RiotHero() {
  return (
    <section className="relative flex min-h-[94svh] w-full flex-col items-center justify-center overflow-hidden px-6">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-1/2 h-full -translate-y-1/2 bg-[var(--color-agent-isagi)] opacity-10 blur-[150px] mix-blend-screen" />
        <div className="absolute top-1/2 right-0 w-1/2 h-full -translate-y-1/2 bg-[var(--color-agent-aiku)] opacity-10 blur-[150px] mix-blend-screen" />
        <div className="absolute inset-x-6 bottom-16 top-28 border border-dashed border-white/10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60" />
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center font-mono text-[10px] text-zinc-700">
          [3A] CYBER-PITCH BACKGROUND // 1920 X 1080 WEBP
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-20 z-10 mx-auto max-w-[1400px] pointer-events-none">
        <AgentAssetSlot assetId="2A" agent="ISAGI" alignment="left" />
        <AgentAssetSlot assetId="2B" agent="AIKU" alignment="right" />
      </div>

      <div className="relative z-20 mt-[-6vh] flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="flex justify-center gap-4 font-mono text-[11px] font-bold text-[var(--color-text-secondary)]">
            <span>TXLINE_DATA</span>
            <span>{"//"}</span>
            <span className="text-[var(--color-system-success)]">LIVE_MATCH</span>
          </div>

          <h1 className="font-display text-6xl font-black uppercase leading-[0.9] sm:text-7xl lg:text-8xl xl:text-[112px] drop-shadow-2xl">
            CHOOSE <br />
            <span className="italic text-transparent" style={{ WebkitTextStroke: "2px white" }}>
              CHAMPION
            </span>
          </h1>
          <div className="mx-auto mt-5 max-w-2xl">
            <p className="font-mono text-[13px] leading-6 text-[var(--color-text-secondary)]">
              90-MINUTE AI PREDICTION COMBAT. <br />
              TXLINE ODDS, SOLANA SETTLEMENT, BLINK-READY STAKES.
            </p>
          </div>
          <div className="flex justify-center mt-10">
            <a
              href="#agents"
              className="group relative flex h-[52px] items-center justify-center gap-3 bg-[#F5F5F5] px-7 font-mono text-[12px] font-bold text-black transition-all hover:bg-white hover:scale-[1.02] active:scale-95"
              style={{ clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}
            >
              <span className="opacity-50">{">_"}</span>
              <span>JOIN THE ARENA</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black text-[10px] font-bold">
              A
            </div>
            <div className="font-mono text-[10px] text-[var(--color-agent-isagi)]">
              ISAGI // ATK
            </div>
          </div>
          <div className="h-1 w-32 bg-[var(--color-agent-isagi)]/30">
            <div className="h-full w-full bg-[var(--color-agent-isagi)]" />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="font-mono text-[10px] text-[var(--color-agent-aiku)]">
            AIKU // DEF
          </div>
          <div className="h-1 w-32 bg-[var(--color-agent-aiku)]/30">
            <div className="h-full w-full bg-[var(--color-agent-aiku)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
