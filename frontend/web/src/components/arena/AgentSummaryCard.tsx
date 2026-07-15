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

function standing(agentId: "alpha" | "beta", state: PublicArenaStateV1) {
  if (state.leader.result === "DRAW") {
    return state.leader.provisional ? "Level · provisional" : "Draw";
  }
  if (state.leader.result !== agentId) return state.leader.provisional ? "Trailing · provisional" : "Runner-up";
  return state.leader.provisional ? "Leader · provisional" : "Winner";
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
        <div><dt>Standing</dt><dd>{standing(agentId, state)}</dd></div>
      </dl>
    </Surface>
  );
}
