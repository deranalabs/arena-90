import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HudPanel } from "@/components/ui/hud-panel";
import { cn } from "@/lib/utils";

type Agent = {
  accent: "isagi" | "aiku";
  action: string;
  assetLabel: string;
  edge: string;
  name: string;
  position: string;
  signal: string;
  thesis: string;
};

const agents: Agent[] = [
  {
    accent: "isagi",
    action: "Back Over",
    assetLabel: "[2A] ISAGI // 1000x1000 PNG TRANSPARENT",
    edge: "+8.4%",
    name: "ISAGI",
    position: "Over 2.5",
    signal: "Attacking pressure, shot velocity, and late-game variance are rising.",
    thesis:
      "Trades momentum spikes when the match script starts breaking open.",
  },
  {
    accent: "aiku",
    action: "Back Under",
    assetLabel: "[2B] AIKU // 1000x1000 PNG TRANSPARENT",
    edge: "+6.1%",
    name: "AIKU",
    position: "Under 2.5",
    signal: "Defensive block density, tempo drag, and draw resistance remain high.",
    thesis:
      "Protects against noisy overs when structure and clock pressure dominate.",
  },
];

const accentClasses = {
  aiku: {
    border: "border-agent-aiku/28",
    button: "border-agent-aiku/50 text-agent-aiku hover:bg-agent-aiku hover:text-black",
    glow: "from-agent-aiku/18",
    text: "text-agent-aiku",
  },
  isagi: {
    border: "border-agent-isagi/30",
    button: "border-agent-isagi/50 text-agent-isagi hover:bg-agent-isagi hover:text-white",
    glow: "from-agent-isagi/18",
    text: "text-agent-isagi",
  },
} satisfies Record<Agent["accent"], Record<string, string>>;

function AgentSignalCard({ agent }: { agent: Agent }) {
  const accent = accentClasses[agent.accent];

  return (
    <HudPanel
      className={cn(
        "group relative overflow-hidden transition-transform duration-300 hover:-translate-y-1",
        accent.border,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80",
          accent.glow,
        )}
      />

      <div className="relative border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-arena-muted">
              Signal Agent
            </p>
            <h3 className={cn("mt-2 font-display text-5xl leading-none", accent.text)}>
              {agent.name}
            </h3>
          </div>
          <div className="text-right font-mono uppercase">
            <p className="text-[10px] tracking-[0.24em] text-arena-muted">
              Edge
            </p>
            <p className={cn("mt-1 text-xl font-bold", accent.text)}>{agent.edge}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="h-2 overflow-hidden bg-white/8 clip-chamfer-sm">
            <div
              className={cn(
                "h-full w-[68%] bg-gradient-to-r to-transparent",
                agent.accent === "isagi" ? "from-agent-isagi" : "from-agent-aiku",
              )}
            />
          </div>
          <span className={cn("font-mono text-xs font-bold uppercase", accent.text)}>
            {agent.position}
          </span>
        </div>
      </div>

      <div className="relative h-72 overflow-hidden border-b border-white/10 bg-[#14161d]">
        <div
          className={cn(
            "absolute inset-x-8 bottom-0 h-2/3 bg-gradient-to-t to-transparent blur-2xl",
            agent.accent === "isagi" ? "from-agent-isagi/18" : "from-agent-aiku/18",
          )}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.22em] text-zinc-600">
          {agent.assetLabel}
        </div>
      </div>

      <div className="relative p-5">
        <p className="font-sans text-sm leading-6 text-arena-text">{agent.thesis}</p>
        <p className="mt-4 border-l border-white/12 pl-4 font-mono text-[11px] uppercase leading-5 tracking-[0.14em] text-arena-muted">
          {agent.signal}
        </p>

        <Button
          className={cn(
            "mt-6 w-full border bg-arena-base/60 shadow-none hover:shadow-none",
            accent.button,
          )}
          variant="ghost"
        >
          {agent.action} <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </HudPanel>
  );
}

export function AgentDuelSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-32">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-system-success">
            Live Agent Market
          </p>
          <h2 className="mt-3 font-display text-5xl leading-none text-arena-text">
            SIGNALS IN CONFLICT
          </h2>
        </div>
        <div className="hidden text-right font-mono text-xs uppercase tracking-[0.2em] text-arena-muted sm:block">
          TXODDS_MOCK // 90M_WINDOW
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {agents.map((agent) => (
          <AgentSignalCard agent={agent} key={agent.name} />
        ))}
      </div>
    </section>
  );
}
