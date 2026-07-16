"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import { useArenaSession } from "@/components/arena/useArenaSession";
import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicCheckpointV1,
  PublicPortfolioV1,
  PublicSnapshotV1,
} from "@/lib/arena-api/contracts";
import type { RuntimeTransport } from "@/lib/arena-api/transport";
import { validateSpectatorView } from "@/lib/arena-api/view-invariants";

type ArenaExperienceProps = {
  arenaId: string;
  experience: "arena" | "replay" | "proof";
  transport?: RuntimeTransport;
};

function formatMicros(value: string) {
  const micros = BigInt(value);
  const microsPerUnit = BigInt(1_000_000);
  const microsPerCent = BigInt(10_000);
  const whole = micros / microsPerUnit;
  const cents = (micros % microsPerUnit) / microsPerCent;
  return `${whole.toString()}.${cents.toString().padStart(2, "0")} vUSD`;
}

function formatReturn(returnBps: number) {
  const sign = returnBps > 0 ? "+" : "";
  return `${sign}${(returnBps / 100).toFixed(2)}%`;
}

const allocationOrder = ["HOME", "DRAW", "AWAY", "cash"] as const;

function allocationFromPortfolio(
  portfolio: PublicPortfolioV1,
  snapshot: PublicSnapshotV1,
) {
  const values = {
    HOME:
      (BigInt(portfolio.unitMicros.HOME) * BigInt(snapshot.priceMicros.HOME)) /
      BigInt(1_000_000),
    DRAW:
      (BigInt(portfolio.unitMicros.DRAW) * BigInt(snapshot.priceMicros.DRAW)) /
      BigInt(1_000_000),
    AWAY:
      (BigInt(portfolio.unitMicros.AWAY) * BigInt(snapshot.priceMicros.AWAY)) /
      BigInt(1_000_000),
    cash: BigInt(portfolio.cashMicros),
  };
  const total = allocationOrder.reduce((sum, asset) => sum + values[asset], BigInt(0));
  if (total === BigInt(0)) return { HOME: 0, DRAW: 0, AWAY: 0, cash: 10_000 };
  const HOME = Number((values.HOME * BigInt(10_000)) / total);
  const DRAW = Number((values.DRAW * BigInt(10_000)) / total);
  const AWAY = Number((values.AWAY * BigInt(10_000)) / total);
  return { HOME, DRAW, AWAY, cash: 10_000 - HOME - DRAW - AWAY };
}

function checkpointLabel(checkpointId: string) {
  const labels: Record<string, string> = {
    KICKOFF: "Kickoff",
    M15: "15′",
    M30: "30′",
    HALFTIME: "Halftime",
    M60: "60′",
    M75: "75′",
    FINAL: "Final settlement",
  };
  return labels[checkpointId] ?? checkpointId;
}

function failureLabel(reason: string) {
  const labels: Record<string, string> = {
    TIMEOUT: "Agent timed out",
    PROCESS_FAILURE: "Agent process unavailable",
    MISSING_OUTPUT: "No decision received",
    INVALID_OUTPUT: "Decision failed validation",
    DATA_UNAVAILABLE: "Verified data unavailable",
    SUSPENDED_MARKET: "Market snapshot suspended",
  };
  return labels[reason] ?? "Decision round unavailable";
}

function AllocationBar({
  portfolio,
  snapshot,
  labels,
  label,
}: {
  portfolio: PublicPortfolioV1;
  snapshot: PublicSnapshotV1;
  labels: Record<"HOME" | "DRAW" | "AWAY" | "cash", string>;
  label: string;
}) {
  const allocation = allocationFromPortfolio(portfolio, snapshot);
  return (
    <div className="arena-allocation" aria-label={label}>
      <div className="arena-allocation__bar" aria-hidden="true">
        {allocationOrder.map((asset) => (
          <span
            className={`arena-allocation__segment arena-allocation__segment--${asset.toLowerCase()}`}
            key={asset}
            style={{ "--allocation-size": allocation[asset] } as CSSProperties}
          />
        ))}
      </div>
      <ul>
        {allocationOrder.map((asset) => (
          <li key={asset}>
            <span>{labels[asset]}</span>
            <strong>{(allocation[asset] / 100).toFixed(1)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function connectionMessage(status: ReturnType<typeof useArenaSession>["status"]) {
  switch (status) {
    case "BOOTSTRAPPING":
      return "Loading verified arena state…";
    case "CONNECTING":
      return "Connecting to the public event stream…";
    case "FOLLOWING":
      return "Following confirmed public events.";
    case "RECONNECTING":
      return "Connection interrupted. Rejoining from the last confirmed event…";
    case "TERMINAL":
      return "Arena event record complete.";
    default:
      return "Preparing spectator session…";
  }
}

function AgentCard({
  agentId,
  portfolio,
  leader,
  snapshot,
  latestCheckpoint,
  labels,
}: {
  agentId: "alpha" | "beta";
  portfolio: PublicPortfolioV1;
  leader: PublicArenaStateV1["leader"];
  snapshot?: PublicSnapshotV1;
  latestCheckpoint?: PublicCheckpointV1;
  labels: Record<"HOME" | "DRAW" | "AWAY" | "cash", string>;
}) {
  const alpha = agentId === "alpha";
  const leading = leader.result === agentId;
  const decision = latestCheckpoint?.revealedDecisions[agentId];
  const failure = latestCheckpoint?.failures.find(
    (candidate) => candidate.scope === "AGENT" && candidate.agentId === agentId,
  );
  const globalFailure = latestCheckpoint?.failures.find(
    (candidate) => candidate.scope === "GLOBAL",
  );
  return (
    <article className={`arena-agent arena-agent--${agentId}`}>
      <p className="product-eyebrow">Agent {alpha ? "01" : "02"}</p>
      <h2>Agent {alpha ? "Alpha" : "Beta"}</h2>
      <p className="arena-agent__strategy">
        {alpha ? "Momentum & Repricing" : "Structure & Valuation Control"}
      </p>
      <dl className="arena-metrics">
        <div><dt>NAV</dt><dd>{formatMicros(portfolio.navMicros)}</dd></div>
        <div><dt>Return</dt><dd>{formatReturn(portfolio.returnBps)}</dd></div>
        <div><dt>Cash</dt><dd>{formatMicros(portfolio.cashMicros)}</dd></div>
        <div>
          <dt>Standing</dt>
          <dd>{leading ? (leader.provisional ? "Provisional leader" : "Winner") : leader.result === "DRAW" ? "Level" : "Chasing"}</dd>
        </div>
      </dl>
      {snapshot ? (
        <AllocationBar
          portfolio={portfolio}
          snapshot={snapshot}
          labels={labels}
          label={`Agent ${alpha ? "Alpha" : "Beta"} current allocation`}
        />
      ) : null}
      <div className="arena-agent__latest">
        <span>Latest revealed response</span>
        <strong>
          {decision?.action === "NO_TRADE"
            ? "NO TRADE"
            : decision?.action === "TARGET_ALLOCATION"
              ? "TARGET ALLOCATION"
              : failure
                ? "MISSED DECISION ROUND"
                : globalFailure
                  ? "GLOBAL MISSED DECISION ROUND"
                : "WAITING FOR REVEAL"}
        </strong>
        <p>
          {decision?.publicExplanation ??
            (failure
              ? `${failureLabel(failure.reason)}. Portfolio preserved.`
              : globalFailure
                ? `${failureLabel(globalFailure.reason)}. Both portfolios preserved.`
              : "No decision content is public before simultaneous reveal.")}
        </p>
      </div>
    </article>
  );
}

function currentRoundStatus(
  state: PublicArenaStateV1,
  events: readonly PublicArenaEventV1[],
) {
  if (state.phase === "COMPLETED") {
    return { label: "ROUND RECORD COMPLETE", detail: "Final settlement committed." };
  }
  if (state.phase === "FINALIZING") {
    return { label: "FINALIZING", detail: "Waiting for verified terminal settlement." };
  }
  const afterSequence = state.checkpoints.at(-1)?.lastEventSequence ?? 1;
  const active = events.filter((event) => event.sequence > afterSequence);
  const rechecking = active.filter((event) => event.type === "RECHECKING_DECISION").length;
  if (rechecking > 0) {
    return { label: "RECHECKING DECISION", detail: "A constrained validation retry is in progress." };
  }
  const received = new Set(
    active
      .filter((event) => event.type === "DECISION_RECEIVED")
      .map((event) => event.agentId),
  ).size;
  if (received > 0) {
    return {
      label: `DECISIONS RECEIVED ${received}/2`,
      detail: "Allocations remain hidden until both outcomes are committed.",
    };
  }
  if (active.some((event) => event.type === "AGENTS_ANALYZING")) {
    return { label: "BOTH AGENTS ANALYZING", detail: "Independent decisions use the same locked snapshot." };
  }
  if (active.some((event) => event.type === "CHECKPOINT_OPENED")) {
    return { label: "SNAPSHOT LOCKED", detail: "The decision round is ready for both agents." };
  }
  return {
    label: state.phase === "READY" ? "ARENA READY" : "ROUND COMPLETE",
    detail: state.nextCheckpointId
      ? `Waiting for ${checkpointLabel(state.nextCheckpointId)}.`
      : "Waiting for verified terminal settlement.",
  };
}

function experienceEyebrow(
  experience: ArenaExperienceProps["experience"],
  state: PublicArenaStateV1,
) {
  if (experience === "proof") return "PUBLIC EVENT RECORD";
  if (experience === "replay") return "AUTONOMOUS REPLAY · RECORDED MATCH DATA";
  return state.manifest.mode === "LIVE" ? "LIVE ARENA" : "REPLAY ARENA";
}

export function ArenaExperience({
  arenaId,
  experience,
  transport,
}: ArenaExperienceProps) {
  const session = useArenaSession(arenaId, transport);
  const inconsistent = session.state
    ? !validateSpectatorView(session.state, session.events)
    : false;
  const modeMismatch =
    experience === "replay" &&
    session.state !== undefined &&
    session.state.manifest.mode !== "REPLAY";
  const unavailable = session.status === "FAILED" || inconsistent || modeMismatch;
  const state = unavailable ? undefined : session.state;

  if (unavailable) {
    return (
      <main className="arena-experience" aria-label={`Arena90 ${experience} ${arenaId}`}>
        <section className="arena-unavailable" aria-labelledby="arena-unavailable-title">
          <p className="product-eyebrow">Verified state unavailable</p>
          <h1 id="arena-unavailable-title">Arena unavailable</h1>
          <p>Verified public arena data is unavailable. No unverified fallback is shown.</p>
          <Link className="product-text-link" href="/replays">Explore Replays →</Link>
        </section>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="arena-experience" aria-label={`Arena90 ${experience} ${arenaId}`}>
        <p className="arena-loading" role="status">Loading verified arena state…</p>
      </main>
    );
  }

  const resultTitle = state.finalResult
    ? state.finalResult.winner === "DRAW"
      ? "Arena draw"
      : `Agent ${state.finalResult.winner === "alpha" ? "Alpha" : "Beta"} wins`
    : undefined;
  const latestCheckpoint = state.checkpoints.at(-1);
  const labels = {
    HOME: state.manifest.homeTeam.name,
    DRAW: "Draw",
    AWAY: state.manifest.awayTeam.name,
    cash: "Cash",
  };
  const roundStatus = currentRoundStatus(state, session.events);
  const freshness = state.currentSnapshot?.freshness;

  return (
    <main
      className="arena-experience"
      aria-label={`Arena90 ${experience} ${arenaId}`}
    >
      <section className="arena-overview" aria-labelledby="arena-fixture-title">
        <div className="arena-overview__copy">
          <p className="product-eyebrow">{experienceEyebrow(experience, state)}</p>
          {experience === "replay" ? <p className="arena-overview__statement">The match is recorded. The decisions are new.</p> : null}
          <h1 id="arena-fixture-title">
            {state.manifest.homeTeam.name} <span>vs</span> {state.manifest.awayTeam.name}
          </h1>
          <p>
            Both agents receive the same locked snapshot and equal virtual bankroll.
          </p>
        </div>
        <div className="arena-state-panel">
          <strong>{state.phase}</strong>
          <span>{state.manifest.mode}</span>
          <p className={session.status === "RECONNECTING" ? "is-warning" : undefined} role="status">
            {connectionMessage(session.status)}
          </p>
        </div>
      </section>

      {state.currentSnapshot ? (
        <section className="arena-match-state" aria-label="Latest verified match state">
          <div><span>Source</span><strong>{state.currentSnapshot.source}</strong></div>
          <div><span>Minute</span><strong>{state.currentSnapshot.match.minute}′</strong></div>
          <div><span>Score</span><strong>{state.currentSnapshot.match.homeScore}–{state.currentSnapshot.match.awayScore}</strong></div>
          <div><span>Snapshot</span><strong>{state.currentSnapshot.checkpointId}</strong></div>
          <div>
            <span>Freshness</span>
            <strong>
              {freshness?.suspended
                ? "MARKET SUSPENDED"
                : freshness?.delayed
                  ? "DATA DELAYED"
                  : state.currentSnapshot.source === "TXLINE_LIVE"
                    ? "DATA LIVE"
                    : "RECORDED DATA"}
            </strong>
          </div>
        </section>
      ) : null}

      <section className="arena-round-status" aria-live="polite">
        <span>Current competition state</span>
        <strong>{roundStatus.label}</strong>
        <p>{roundStatus.detail}</p>
      </section>

      <section className="arena-agent-grid" aria-label="Agent comparison">
        <AgentCard
          agentId="alpha"
          portfolio={state.portfolios.alpha}
          leader={state.leader}
          snapshot={state.currentSnapshot}
          latestCheckpoint={latestCheckpoint}
          labels={labels}
        />
        <div className="arena-equal-conditions" aria-label="Equal competition conditions">
          <span>Same snapshot</span><strong>VS</strong><span>Equal bankroll</span>
        </div>
        <AgentCard
          agentId="beta"
          portfolio={state.portfolios.beta}
          leader={state.leader}
          snapshot={state.currentSnapshot}
          latestCheckpoint={latestCheckpoint}
          labels={labels}
        />
      </section>

      {state.checkpoints.length > 0 ? (
        <section className="arena-rounds" aria-labelledby="arena-rounds-title">
          <p className="product-eyebrow">Decision record</p>
          <h2 id="arena-rounds-title">Simultaneous checkpoint reveals</h2>
          <div className="arena-round-list">
            {[...state.checkpoints].reverse().map((checkpoint) => (
              <article
                className="arena-round"
                key={checkpoint.checkpointId}
                role="group"
                aria-label={`${checkpoint.checkpointId} simultaneous reveal`}
              >
                <header>
                  <div>
                    <h3>{checkpointLabel(checkpoint.checkpointId)}</h3>
                    {checkpoint.snapshot ? (
                      <p>{checkpoint.snapshot.match.minute}′ · {checkpoint.snapshot.match.homeScore}–{checkpoint.snapshot.match.awayScore}</p>
                    ) : null}
                  </div>
                  <span>{checkpoint.outcome === "GLOBAL_MISSED" ? "GLOBAL MISSED DECISION ROUND" : "ROUND REVEALED"}</span>
                </header>
                {checkpoint.outcome === "GLOBAL_MISSED" ? (
                  <div className="arena-round__global-failure">
                    <strong>Both portfolios preserved</strong>
                    <p>{failureLabel(checkpoint.failures[0]?.reason ?? "DATA_UNAVAILABLE")}. No fallback trade was created.</p>
                  </div>
                ) : (
                  <div>
                    {(["alpha", "beta"] as const).map((agentId) => {
                      const decision = checkpoint.revealedDecisions[agentId];
                      const failure = checkpoint.failures.find(
                        (candidate) => candidate.scope === "AGENT" && candidate.agentId === agentId,
                      );
                      return (
                        <section key={agentId}>
                          <strong>Agent {agentId === "alpha" ? "Alpha" : "Beta"}</strong>
                          <span className="arena-round__action">
                            {decision?.action === "TARGET_ALLOCATION"
                              ? "TARGET ALLOCATION"
                              : decision?.action === "NO_TRADE"
                                ? "NO TRADE"
                                : "MISSED DECISION ROUND"}
                          </span>
                          <p>
                            {decision?.publicExplanation ??
                              `${failureLabel(failure?.reason ?? "MISSING_OUTPUT")}. Portfolio preserved.`}
                          </p>
                          {checkpoint.snapshot ? (
                            <details>
                              <summary>View allocation change</summary>
                              <div className="arena-round__allocations">
                                <AllocationBar
                                  portfolio={checkpoint.portfoliosBefore[agentId]}
                                  snapshot={checkpoint.snapshot}
                                  labels={labels}
                                  label={`Agent ${agentId} allocation before ${checkpoint.checkpointId}`}
                                />
                                <span aria-hidden="true">→</span>
                                <AllocationBar
                                  portfolio={checkpoint.portfoliosAfter[agentId]}
                                  snapshot={checkpoint.snapshot}
                                  labels={labels}
                                  label={`Agent ${agentId} allocation after ${checkpoint.checkpointId}`}
                                />
                              </div>
                            </details>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="arena-next-round" aria-label="Next decision round">
        <span>{state.phase === "COMPLETED" ? "Competition record" : "Next decision"}</span>
        <strong>
          {state.phase === "COMPLETED"
            ? "Final settlement complete"
            : checkpointLabel(state.nextCheckpointId ?? "FINAL")}
        </strong>
      </section>

      {resultTitle && state.finalResult ? (
        <section className="arena-result" aria-labelledby="arena-result-title">
          <p className="product-eyebrow">Verified terminal result</p>
          <h2 id="arena-result-title">{resultTitle}</h2>
          <dl>
            <div>
              <dt>Final score</dt>
              <dd>
                {state.finalResult.terminalEvidence.match.homeScore}–
                {state.finalResult.terminalEvidence.match.awayScore}
              </dd>
            </div>
            <div><dt>Winning asset</dt><dd>{state.finalResult.winningAssetId}</dd></div>
            <div><dt>Alpha final NAV</dt><dd>{formatMicros(state.finalResult.alphaFinalNavMicros)}</dd></div>
            <div><dt>Beta final NAV</dt><dd>{formatMicros(state.finalResult.betaFinalNavMicros)}</dd></div>
            <div><dt>Winner rule</dt><dd>{state.finalResult.winnerRule}</dd></div>
            <div><dt>Terminal source</dt><dd>{state.finalResult.terminalEvidence.source}</dd></div>
            <div><dt>Final snapshot hash</dt><dd>{state.finalResult.terminalEvidence.terminalEvidenceHash}</dd></div>
            <div><dt>Pre-settlement event log hash</dt><dd>{state.finalResult.preSettlementEventLogHash}</dd></div>
            <div><dt>Final result hash</dt><dd>{state.finalResult.finalResultHash}</dd></div>
          </dl>
          <Link className="product-text-link" href={`/arena/${arenaId}/proof`}>Inspect public proof <span aria-hidden="true">→</span></Link>
        </section>
      ) : state.phase === "FINALIZING" ? (
        <section className="arena-result" aria-label="Provisional result">
          <p className="product-eyebrow">Finalizing</p>
          <h2>Verifying final result</h2>
          <p>The current leader remains provisional until terminal accounting completes.</p>
        </section>
      ) : null}

      {experience === "proof" ? (
        <section className="arena-proof" aria-labelledby="arena-proof-title">
          <p className="product-eyebrow">Architecture evidence</p>
          <h2 id="arena-proof-title">Deterministic system boundary</h2>
          <p>Agents choose strategy. Arena90 controls validation, execution, accounting, and winner resolution.</p>
          <dl>
            <div><dt>Confirmed event sequence</dt><dd>{state.lastEventSequence}</dd></div>
            <div><dt>Runtime version</dt><dd>{state.runtimeVersions.runtimeVersion}</dd></div>
            <div><dt>Execution rules</dt><dd>{state.runtimeVersions.executionRuleVersion}</dd></div>
            <div><dt>Winner rules</dt><dd>{state.runtimeVersions.winnerRuleVersion}</dd></div>
            <div><dt>Current snapshot hash</dt><dd>{state.currentSnapshot?.snapshotHash ?? "No checkpoint snapshot yet"}</dd></div>
            <div><dt>Public events loaded</dt><dd>{session.events.length}</dd></div>
            {state.finalResult ? (
              <>
                <div><dt>Terminal provider sequence</dt><dd>{state.finalResult.terminalEvidence.providerSequence}</dd></div>
                <div><dt>Terminal provider event</dt><dd>{state.finalResult.terminalEvidence.sourceEventId}</dd></div>
                <div><dt>Terminal observed at</dt><dd>{state.finalResult.terminalEvidence.observedAtUtc}</dd></div>
                <div><dt>Completed event sequence</dt><dd>{state.finalResult.completedEventSequence}</dd></div>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
