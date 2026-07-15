import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicDecisionV1,
  PublicFailureV1,
  PublicPortfolioV1,
} from "@/lib/arena-api/contracts";
import { Surface } from "@/components/ui/surface";

type RoundRecord = {
  checkpointId: string;
  outcome: "REVEALED" | "GLOBAL_MISSED";
  decisions: {
    alpha?: PublicDecisionV1;
    beta?: PublicDecisionV1;
  };
  failures: readonly PublicFailureV1[];
  portfoliosBefore: { alpha: PublicPortfolioV1; beta: PublicPortfolioV1 };
  portfoliosAfter: { alpha: PublicPortfolioV1; beta: PublicPortfolioV1 };
};

function percent(bps: number) {
  const sign = bps < 0 ? "−" : "";
  const absolute = Math.abs(bps);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}%`;
}

function Decision({
  agentId,
  decision,
  failure,
  globalMissed,
  assetLabels,
}: {
  agentId: "alpha" | "beta";
  decision?: PublicDecisionV1;
  failure?: PublicFailureV1;
  globalMissed: boolean;
  assetLabels: Record<"cash" | "HOME" | "DRAW" | "AWAY", string>;
}) {
  const label = agentId === "alpha" ? "Agent Alpha" : "Agent Beta";

  return (
    <section className={`round-decision round-decision--${agentId}`} aria-label={`${label} decision`}>
      <h4>{label}</h4>
      {decision ? (
        <>
          <strong>
            {decision.action === "NO_TRADE" ? "No trade" : "Target allocation"}
          </strong>
          <p>{decision.publicExplanation}</p>
          {decision.action === "TARGET_ALLOCATION" ? (
            <dl className="round-allocation">
              {Object.entries(decision.targetAllocationBps).map(([asset, bps]) => (
                <div key={asset}>
                  <dt>{assetLabels[asset as keyof typeof assetLabels]}</dt>
                  <dd>{percent(bps)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      ) : globalMissed || failure?.scope === "AGENT" ? (
        <>
          <strong>{globalMissed ? "Global missed decision round" : "Missed decision round"}</strong>
          <p>
            {failure?.scope === "AGENT"
              ? `No decision applied · ${failure.reason}`
              : "Portfolio preserved; no decision fabricated."}
          </p>
        </>
      ) : (
        <p>Verified decision unavailable.</p>
      )}
    </section>
  );
}

function records(
  state: PublicArenaStateV1,
  events: readonly PublicArenaEventV1[],
): RoundRecord[] {
  const durable = state.checkpoints.map((checkpoint) => ({
    checkpointId: checkpoint.checkpointId,
    outcome: checkpoint.outcome,
    decisions: checkpoint.revealedDecisions,
    failures: checkpoint.failures,
    portfoliosBefore: checkpoint.portfoliosBefore,
    portfoliosAfter: checkpoint.portfoliosAfter,
  }));
  const durableIds = new Set(durable.map((record) => record.checkpointId));
  const newlyRevealed = events
    .filter(
      (event): event is Extract<PublicArenaEventV1, { type: "ROUND_REVEALED" }> =>
        event.type === "ROUND_REVEALED" && !durableIds.has(event.checkpointId),
    )
    .map((event) => ({
      checkpointId: event.checkpointId,
      outcome: "REVEALED" as const,
      decisions: event.payload.decisions,
      failures: event.payload.failures,
      portfoliosBefore: event.payload.portfoliosBefore,
      portfoliosAfter: event.payload.portfoliosAfter,
    }));
  return [...durable, ...newlyRevealed];
}

export function CheckpointHistory({
  state,
  events,
}: {
  state: PublicArenaStateV1;
  events: readonly PublicArenaEventV1[];
}) {
  const revealedRounds = records(state, events);
  const assetLabels = {
    cash: "Cash",
    HOME: state.manifest.homeTeam.name,
    DRAW: "Draw",
    AWAY: state.manifest.awayTeam.name,
  } as const;
  const latestPendingFailure = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === "MISSED_DECISION_ROUND" ||
        event.type === "GLOBAL_MISSED_DECISION_ROUND",
    );

  return (
    <Surface className="round-history">
      <div className="round-history__heading">
        <p className="eyebrow">Append-only competition record</p>
        <h2>Checkpoint history</h2>
      </div>
      {revealedRounds.length === 0 ? (
        <p className="round-history__empty">
          {latestPendingFailure?.type === "GLOBAL_MISSED_DECISION_ROUND"
            ? "Global missed decision round"
            : latestPendingFailure?.type === "MISSED_DECISION_ROUND"
              ? `${latestPendingFailure.agentId === "alpha" ? "Agent Alpha" : "Agent Beta"} missed decision round`
              : "No decision has been revealed."}
        </p>
      ) : (
        <div className="round-history__records">
          {revealedRounds.map((round) => (
            <article
              aria-label={`${round.checkpointId} decision record`}
              className="round-record"
              key={round.checkpointId}
            >
              <header>
                <h3>{round.checkpointId}</h3>
                <span>{round.outcome === "GLOBAL_MISSED" ? "Global missed" : "Simultaneous reveal"}</span>
              </header>
              <div className="round-record__decisions">
                {(["alpha", "beta"] as const).map((agentId) => (
                  <Decision
                    agentId={agentId}
                    decision={round.decisions[agentId]}
                    failure={round.failures.find(
                      (failure) =>
                        failure.scope === "AGENT" && failure.agentId === agentId,
                    )}
                    globalMissed={round.outcome === "GLOBAL_MISSED"}
                    assetLabels={assetLabels}
                    key={agentId}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </Surface>
  );
}
