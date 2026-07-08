import { readFileSync } from "node:fs";
import { join } from "node:path";

type AgentId = "isagi" | "aiku";
type Prediction = "Over 2.5" | "Under 2.5";

type AgentDecision = {
  agentId: AgentId;
  displayName: string;
  prediction: Prediction;
  confidenceBps: number;
  stakeLamports: string;
  rationale: string;
  scores: {
    attackingPressureBps: number;
    drawProbabilityBps: number;
    marketBalanceBps: number;
  };
};

type ClashState = {
  generatedAtUtc: string;
  match: {
    competition: string;
    venue: string;
    kickoffUtc: string;
    homeTeam: { name: string; fifaCode: string };
    awayTeam: { name: string; fifaCode: string };
    odds: { home: number; draw: number; away: number };
  };
  market: {
    label: string;
    line: number;
  };
  agents: AgentDecision[];
  clash: {
    headline: string;
    status: string;
  };
};

const CLASH_STATE_PATH = join(
  process.cwd(),
  "..",
  "..",
  "backend",
  "solana-actions",
  "mock",
  "clash-state.json",
);

function readClashState(): ClashState {
  return JSON.parse(readFileSync(CLASH_STATE_PATH, "utf-8")) as ClashState;
}

function formatUtc(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatBps(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}

function stakeUnits(value: string): number {
  return Number.parseInt(value, 10) / 1_000_000;
}

function AgentPanel({
  agent,
  side,
}: {
  agent: AgentDecision;
  side: "blue" | "red";
}) {
  const isBlue = side === "blue";
  const color = isBlue ? "text-sky-200" : "text-rose-200";
  const bar = isBlue ? "bg-sky-400" : "bg-rose-400";
  const border = isBlue ? "border-sky-400/45" : "border-rose-400/45";
  const accent = isBlue ? "from-sky-500/20" : "from-rose-500/20";

  return (
    <article
      className={`relative overflow-hidden rounded-lg border ${border} bg-zinc-950/86 p-5 shadow-2xl shadow-black/30`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} to-transparent`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            {isBlue ? "Attacking Model" : "Defensive Model"}
          </p>
          <h2 className={`mt-2 text-4xl font-black ${color}`}>
            {agent.displayName}
          </h2>
        </div>
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-right">
          <p className="text-xs text-zinc-500">Stake</p>
          <p className="text-lg font-bold text-zinc-50">
            {stakeUnits(agent.stakeLamports).toFixed(0)} USDC
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        <div>
          <p className="text-sm text-zinc-500">Position</p>
          <p className="mt-1 text-3xl font-black text-zinc-50">
            {agent.prediction}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Confidence</span>
            <span className="font-semibold text-zinc-100">
              {formatBps(agent.confidenceBps)}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: `${agent.confidenceBps / 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mt-7 min-h-20 text-sm leading-6 text-zinc-300">
        {agent.rationale}
      </p>

      <dl className="mt-7 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
          <dt className="text-[11px] uppercase text-zinc-500">Attack</dt>
          <dd className="mt-1 font-bold text-zinc-100">
            {formatBps(agent.scores.attackingPressureBps)}
          </dd>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
          <dt className="text-[11px] uppercase text-zinc-500">Draw</dt>
          <dd className="mt-1 font-bold text-zinc-100">
            {formatBps(agent.scores.drawProbabilityBps)}
          </dd>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
          <dt className="text-[11px] uppercase text-zinc-500">Balance</dt>
          <dd className="mt-1 font-bold text-zinc-100">
            {formatBps(agent.scores.marketBalanceBps)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function Home() {
  const state = readClashState();
  const [isagi, aiku] = state.agents;
  const totalStake = state.agents.reduce(
    (sum, agent) => sum + stakeUnits(agent.stakeLamports),
    0,
  );

  if (!isagi || !aiku) {
    throw new Error("clash-state.json must include ISAGI and AIKU decisions");
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-zinc-50">
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 arena-grid opacity-70" />
        <div className="relative mx-auto grid min-h-[92vh] max-w-7xl grid-rows-[auto_1fr_auto] px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-emerald-400/50 bg-emerald-400/10 font-black text-emerald-200">
                A90
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Arena90
                </p>
                <p className="text-sm text-zinc-300">
                  {state.match.competition}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-200">
                {state.clash.status.toUpperCase()}
              </span>
              <span className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300">
                {formatUtc(state.generatedAtUtc)} UTC
              </span>
            </div>
          </header>

          <div className="grid items-center gap-6 py-6 lg:grid-cols-[1fr_340px_1fr]">
            <AgentPanel agent={isagi} side="blue" />

            <section className="relative overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/88 p-5 text-center shadow-2xl shadow-black/40">
              <div className="mx-auto flex h-56 max-w-xs items-center justify-center rounded-lg border border-emerald-400/35 bg-[linear-gradient(90deg,#0f3b33_0_49%,#f8fafc_49%_51%,#3b121b_51%_100%)] p-4">
                <div className="relative h-full w-full rounded-md border-2 border-white/70">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70" />
                  <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
                  <div className="absolute left-3 top-1/2 h-20 w-10 -translate-y-1/2 border-2 border-l-0 border-white/70" />
                  <div className="absolute right-3 top-1/2 h-20 w-10 -translate-y-1/2 border-2 border-r-0 border-white/70" />
                  <div className="absolute left-[22%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-sky-300 shadow-[0_0_26px_#7dd3fc]" />
                  <div className="absolute right-[22%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-rose-300 shadow-[0_0_26px_#fda4af]" />
                </div>
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                {state.market.label}
              </p>
              <h1 className="mt-3 text-balance text-4xl font-black leading-tight text-zinc-50">
                {state.match.homeTeam.name} vs {state.match.awayTeam.name}
              </h1>
              <p className="mt-3 text-sm text-zinc-400">{state.match.venue}</p>
              <p className="mt-1 text-sm text-zinc-400">
                Kickoff {formatUtc(state.match.kickoffUtc)} UTC
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-xs text-zinc-500">
                    {state.match.homeTeam.fifaCode}
                  </p>
                  <p className="mt-1 font-black">{state.match.odds.home}</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-xs text-zinc-500">DRAW</p>
                  <p className="mt-1 font-black">{state.match.odds.draw}</p>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-xs text-zinc-500">
                    {state.match.awayTeam.fifaCode}
                  </p>
                  <p className="mt-1 font-black">{state.match.odds.away}</p>
                </div>
              </div>
            </section>

            <AgentPanel agent={aiku} side="red" />
          </div>

          <footer className="grid gap-3 border-t border-zinc-800/90 pt-4 md:grid-cols-3">
            <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Total Pool
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-200">
                {totalStake.toFixed(0)} USDC
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Match Id
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-200">
                {state.clash.headline}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Settlement Layer
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-200">
                Solana escrow vault prepared for USDC staking
              </p>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
