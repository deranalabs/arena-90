import type {
  PublicArenaStateV1,
  PublicPortfolioV1,
} from "@/lib/arena-api/contracts";
import { Surface } from "@/components/ui/surface";

const identities = {
  alpha: {
    label: "Agent Alpha",
    lens: "Momentum & Repricing",
    descriptor: "Recent change, acceleration, and market response",
    emblem: "A",
  },
  beta: {
    label: "Agent Beta",
    lens: "Structure & Valuation Control",
    descriptor: "Baseline structure, consistency, and margin of safety",
    emblem: "B",
  },
} as const;

function money(micros: string) {
  const value = BigInt(micros);
  const microsPerUnit = BigInt(1_000_000);
  const microsPerCent = BigInt(10_000);
  const whole = value / microsPerUnit;
  const cents = ((value % microsPerUnit) / microsPerCent)
    .toString()
    .padStart(2, "0");
  return `${whole}.${cents} vUSD`;
}

function units(micros: string) {
  const value = BigInt(micros);
  const microsPerUnit = BigInt(1_000_000);
  const whole = value / microsPerUnit;
  const fraction = (value % microsPerUnit)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} units`;
}

function returnPercent(returnBps: number) {
  const sign = returnBps > 0 ? "+" : returnBps < 0 ? "−" : "";
  const absolute = Math.abs(returnBps);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}%`;
}

function standing(agentId: "alpha" | "beta", state: PublicArenaStateV1) {
  const terminal = state.phase === "COMPLETED" && !state.leader.provisional;
  if (state.leader.result === "DRAW") {
    return terminal ? "Draw" : "Level · provisional";
  }
  if (state.leader.result !== agentId) {
    return terminal ? "Runner-up" : "Trailing · provisional";
  }
  return terminal ? "Winner" : "Leader · provisional";
}

type AgentSummaryCardProps = {
  agentId: "alpha" | "beta";
  portfolio: PublicPortfolioV1;
  state: PublicArenaStateV1;
};

export function AgentSummaryCard({ agentId, portfolio, state }: AgentSummaryCardProps) {
  const identity = identities[agentId];
  const titleId = `arena-${agentId}-title`;

  return (
    <Surface
      aria-labelledby={titleId}
      className={`arena-agent arena-agent--${agentId}`}
      role="article"
      tone="ink"
    >
      <div className="arena-agent__topline">
        <span className="arena-agent__emblem" aria-hidden="true">{identity.emblem}</span>
        <div>
          <p>{identity.lens}</p>
          <h2 id={titleId}>{identity.label}</h2>
        </div>
      </div>
      <p className="arena-agent__descriptor">{identity.descriptor}</p>
      <dl className="arena-agent__facts arena-agent__facts--summary">
        <div><dt>Cash</dt><dd>{money(portfolio.cashMicros)}</dd></div>
        <div><dt>NAV</dt><dd>{money(portfolio.navMicros)}</dd></div>
        <div><dt>Return</dt><dd>{returnPercent(portfolio.returnBps)}</dd></div>
        <div><dt>Standing</dt><dd>{standing(agentId, state)}</dd></div>
      </dl>
      <dl className="arena-agent__holdings" aria-label={`${identity.label} units`}>
        <div><dt>{state.manifest.homeTeam.name}</dt><dd>{units(portfolio.unitMicros.HOME)}</dd></div>
        <div><dt>Draw</dt><dd>{units(portfolio.unitMicros.DRAW)}</dd></div>
        <div><dt>{state.manifest.awayTeam.name}</dt><dd>{units(portfolio.unitMicros.AWAY)}</dd></div>
      </dl>
    </Surface>
  );
}
