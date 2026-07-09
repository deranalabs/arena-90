"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ChevronRight,
  Shield,
  Swords,
  Target,
  Zap,
} from "lucide-react";

const agents = [
  {
    id: "01",
    name: "ISAGI",
    role: "ATK MODEL",
    thesis: "PRESSURE SPIKES, SHOT VOLUME, AND LATE-GAME MOMENTUM.",
    side: "LONG OVER 2.5",
    confidence: "72.4%",
    stake: "184 USDC",
    color: "var(--color-agent-isagi)",
    icon: Target,
    stats: [
      ["ATTACK", "84"],
      ["PACE", "77"],
      ["RISK", "68"],
    ],
  },
  {
    id: "02",
    name: "AIKU",
    role: "DEF MODEL",
    thesis: "COMPACT BLOCKS, DRAW PRESSURE, AND MARKET OVERREACTION.",
    side: "LONG UNDER 2.5",
    confidence: "69.1%",
    stake: "171 USDC",
    color: "var(--color-agent-aiku)",
    icon: Shield,
    stats: [
      ["BLOCK", "81"],
      ["DISC", "74"],
      ["EDGE", "63"],
    ],
  },
];

const feed = [
  ["TXLINE", "ODDS DELTA", "+4.8 BPS"],
  ["KAMINO", "YIELD VAULT", "ARMED"],
  ["SOLANA", "ESCROW PDA", "READY"],
];

const settlementRail = [
  ["01", "TXLINE_FEED", "LIVE ODDS + MATCH STATE"],
  ["02", "AGENT_SPLIT", "ISAGI OVER / AIKU UNDER"],
  ["03", "BLINK_STAKE", "SOCIAL ENTRY TO ESCROW"],
];

type Agent = (typeof agents)[number];

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const Icon = agent.icon;

  return (
    <motion.article
      initial={{ opacity: 0, x: index === 0 ? -32 : 32 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="group relative min-h-[460px] overflow-hidden border border-white/10 bg-[#0D0D0D] p-5 sm:p-6"
      style={{
        clipPath:
          "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: agent.color }}
      />
      <div
        className="absolute -right-8 top-8 font-display text-[148px] font-black leading-none opacity-[0.04]"
        aria-hidden="true"
      >
        {agent.id}
      </div>

      <div className="relative flex h-full flex-col justify-between gap-10">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] font-bold text-zinc-500">
                {agent.role}
              </div>
              <h3
                className="mt-3 font-display text-5xl font-black italic leading-none"
                style={{ color: agent.color }}
              >
                {agent.name}
              </h3>
            </div>
            <div
              className="grid h-12 w-12 place-items-center border border-white/10 bg-black"
              style={{ color: agent.color }}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>

          <p className="mt-9 max-w-md font-mono text-[12px] leading-6 text-zinc-300">
            {agent.thesis}
          </p>
        </div>

        <div className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-y border-white/10 py-5">
            <div>
              <div className="font-mono text-[10px] text-zinc-500">CURRENT_SIDE</div>
              <div className="mt-2 font-display text-xl font-black text-white">
                {agent.side}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-zinc-500">CONFIDENCE</div>
              <div
                className="mt-2 font-display text-2xl font-black"
                style={{ color: agent.color }}
              >
                {agent.confidence}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="font-mono text-[10px] text-zinc-500">POOL_WEIGHT</div>
              <div className="mt-2 font-display text-2xl font-black text-white">
                {agent.stake}
              </div>
            </div>
            <div
              className="flex h-10 min-w-32 items-center justify-center gap-2 border px-3 font-mono text-[10px] font-bold"
              style={{
                borderColor: agent.color,
                color: agent.color,
                clipPath:
                  "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
              }}
            >
              LOCK_{agent.name}
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {agent.stats.map(([label, value]) => (
              <div key={label} className="bg-white/[0.04] p-3">
                <dt className="font-mono text-[10px] text-zinc-500">{label}</dt>
                <dd className="mt-2 font-display text-xl font-black text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </motion.article>
  );
}

function MarketPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
      className="flex min-h-[304px] flex-col items-center justify-between border border-white/10 bg-black p-6 text-center lg:min-h-[460px]"
      style={{
        clipPath:
          "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
      }}
    >
      <div className="flex flex-col items-center">
        <Swords className="h-9 w-9 text-white" />
        <div className="mt-5 font-mono text-[10px] text-zinc-500">
          ACTIVE_MARKET
        </div>
        <div className="mt-3 font-display text-3xl font-black text-white">
          OVER / UNDER
        </div>
        <div className="mt-1 font-mono text-[10px] text-zinc-500">GOALS 2.5</div>
      </div>

      <div className="grid w-full gap-2 border-y border-white/10 py-5">
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
          <span>WINDOW</span>
          <span className="text-white">90:00</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
          <span>STATUS</span>
          <span className="text-[var(--color-system-success)]">OPEN</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
          <span>POOL</span>
          <span className="text-white">355 USDC</span>
        </div>
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px] font-bold text-[var(--color-system-success)]">
        <Zap className="h-4 w-4" />
        <span>BLINK_READY</span>
      </div>
    </motion.div>
  );
}

export function AgentsSection() {
  return (
    <section
      id="agents"
      className="relative isolate overflow-hidden border-t border-white/10 bg-[#050505] px-5 py-20 sm:px-8 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div>
            <div className="flex items-center gap-3 font-mono text-[10px] font-bold text-[var(--color-system-success)]">
              <Activity className="h-4 w-4" />
              <span>SECTION_02 // AGENT_LOCK</span>
            </div>
            <h2 className="mt-6 font-display text-4xl font-black leading-[0.95] text-white sm:text-5xl lg:text-6xl">
              TWO MODELS.
              <span className="block text-transparent [-webkit-text-stroke:1px_white]">
                ONE POOL.
              </span>
            </h2>
            <p className="mt-5 max-w-xl font-mono text-[12px] leading-6 text-zinc-400">
              EACH CLASH LOCKS TWO AI THESES AGAINST THE SAME 90-MINUTE MARKET.
              THE UI STAYS OPERATIONAL HERE: MODEL EDGE, POOL PRESSURE, AND
              BLINK SETTLEMENT STATE.
            </p>
          </div>

          <div className="grid content-end gap-4 font-mono text-[11px] text-zinc-400 sm:grid-cols-3">
            {feed.map(([source, label, value]) => (
              <div
                key={source}
                className="border border-white/10 bg-white/[0.03] p-4"
                style={{
                  clipPath:
                    "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                }}
              >
                <div className="text-[10px] text-zinc-500">{source}</div>
                <div className="mt-3 text-[10px] text-zinc-300">{label}</div>
                <div className="mt-1 font-display text-lg font-black text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)]">
          <AgentCard agent={agents[0]} index={0} />
          <MarketPanel />
          <AgentCard agent={agents[1]} index={1} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="grid gap-3 border border-white/10 bg-black/60 p-3 sm:grid-cols-3"
          style={{
            clipPath:
              "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
          }}
        >
          {settlementRail.map(([step, label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[44px_1fr] items-center gap-3 border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="font-display text-2xl font-black text-white/25">
                {step}
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold text-[var(--color-system-success)]">
                  {label}
                </div>
                <div className="mt-2 font-mono text-[10px] text-zinc-400">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
