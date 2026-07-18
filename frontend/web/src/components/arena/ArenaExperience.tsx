"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import { AgentPortrait } from "@/components/agents/AgentPortrait";
import { ArenaEventLedger } from "@/components/arena/ArenaEventLedger";
import { ArenaIcon } from "@/components/icons/ArenaIcons";
import { SupporterPanel } from "@/components/solana/SupporterPanel";
import {
  ArenaNextEvent,
  ArenaScoreboard,
  ArenaSectionHeading,
  CompetitionStatusBand,
} from "@/components/arena/ArenaPresentation";
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
import type { SupporterArena } from "@/lib/solana-actions/supporter-arena";
import styles from "./ArenaExperience.module.css";

type ArenaExperienceProps = {
  arenaId: string;
  experience: "arena" | "replay" | "archive" | "proof";
  transport?: RuntimeTransport;
  supporterArena?: SupporterArena;
  publicOrigin?: string;
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
      <AgentPortrait agentId={agentId} priority={alpha} />
      <p className="product-eyebrow">Agent {alpha ? "01" : "02"}</p>
      <h2>Agent {alpha ? "Alpha" : "Beta"}</h2>
      <p className="arena-agent__strategy">
        <ArenaIcon name={alpha ? "reversion" : "continuation"} />
        {alpha ? "Reversion" : "Continuation"}
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
  if (experience === "archive") return "ARCHIVED AUTONOMOUS RUN · RECORDED TXLINE DATA";
  if (experience === "replay") return "AUTONOMOUS REPLAY · RECORDED MATCH DATA";
  return state.manifest.mode === "LIVE" ? "LIVE ARENA" : "REPLAY ARENA";
}

export function ArenaExperience({
  arenaId,
  experience,
  transport,
  supporterArena,
  publicOrigin,
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
      <main className={`arena-experience ${styles.arenaPage}`} aria-label={`Arena90 ${experience} ${arenaId}`}>
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
      <main className={`arena-experience ${styles.arenaPage}`} aria-label={`Arena90 ${experience} ${arenaId}`}>
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
  const latestCheckpointSnapshot = [...state.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.snapshot)?.snapshot;
  const displaySnapshot = state.currentSnapshot ?? latestCheckpointSnapshot;
  const terminalEvidence = state.finalResult?.terminalEvidence;
  const displayMatch = state.currentSnapshot?.match ?? terminalEvidence?.match ?? displaySnapshot?.match;
  const displaySource = state.currentSnapshot?.source ?? terminalEvidence?.source ?? displaySnapshot?.source;
  const displayCheckpoint = state.currentSnapshot?.checkpointId ?? (terminalEvidence ? "Final" : displaySnapshot?.checkpointId);
  const labels = {
    HOME: state.manifest.homeTeam.name,
    DRAW: "Draw",
    AWAY: state.manifest.awayTeam.name,
    cash: "Cash",
  };
  const roundStatus = currentRoundStatus(state, session.events);
  const freshness = state.currentSnapshot?.freshness ?? displaySnapshot?.freshness;
  const freshnessLabel = freshness?.suspended
    ? "MARKET SUSPENDED"
    : freshness?.delayed
      ? "DATA DELAYED"
      : displaySource === "TXLINE_LIVE"
        ? "DATA LIVE"
        : displaySource
          ? "RECORDED DATA"
          : undefined;
  const alphaNav = BigInt(state.portfolios.alpha.navMicros);
  const betaNav = BigInt(state.portfolios.beta.navMicros);
  const leadMarginMicros = alphaNav >= betaNav
    ? alphaNav - betaNav
    : betaNav - alphaNav;
  const standing = state.leader.result === "DRAW"
    ? "Level"
    : `Agent ${state.leader.result === "alpha" ? "Alpha" : "Beta"} ${state.leader.provisional ? "leads" : "wins"}`;

  return (
    <main
      className={`arena-experience ${styles.arenaPage}`}
      aria-label={`Arena90 ${experience} ${arenaId}`}
    >
      <ArenaScoreboard
        awayScore={displayMatch?.awayScore}
        awayTeam={state.manifest.awayTeam.name}
        checkpoint={displayCheckpoint}
        connection={connectionMessage(session.status)}
        connectionWarning={session.status === "RECONNECTING"}
        eyebrow={experienceEyebrow(experience, state)}
        freshness={freshnessLabel}
        homeScore={displayMatch?.homeScore}
        homeTeam={state.manifest.homeTeam.name}
        minute={displayMatch?.minute}
        mode={state.manifest.mode}
        phase={state.phase}
        scoreLabel={terminalEvidence ? `Final score ${terminalEvidence.match.homeScore} to ${terminalEvidence.match.awayScore} at ${terminalEvidence.match.minute} minutes` : undefined}
        source={displaySource}
        statement={
          experience === "archive"
            ? "Archived completed run. The event playback below does not invoke the agents again."
            : experience === "replay"
              ? "The match is recorded. New decisions are generated during this Replay session."
              : undefined
        }
      />

      <CompetitionStatusBand detail={roundStatus.detail} label={roundStatus.label} />

      <section className="arena-leader-strip" aria-label="Competition leader">
        <div><ArenaIcon name="standing" /><span>Standing</span><strong>{standing}</strong></div>
        <div><ArenaIcon name="alpha" /><span>Alpha NAV</span><strong>{formatMicros(state.portfolios.alpha.navMicros)}</strong></div>
        <div><ArenaIcon name="margin" /><span>Lead margin</span><strong>{formatMicros(leadMarginMicros.toString())}</strong></div>
        <div><ArenaIcon name="beta" /><span>Beta NAV</span><strong>{formatMicros(state.portfolios.beta.navMicros)}</strong></div>
      </section>

      {state.manifest.mode === "LIVE" && supporterArena ? (
        <SupporterPanel
          arenaAddress={supporterArena.arenaAddress}
          backingDeadlineUtc={supporterArena.backingDeadlineUtc}
          finalResultHash={state.finalResult?.finalResultHash}
          programId={supporterArena.programId}
          publicOrigin={publicOrigin}
          rpcUrl={supporterArena.rpcUrl}
        />
      ) : null}

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

      <ArenaEventLedger
        connection={connectionMessage(session.status)}
        events={session.events}
        recordedPlayback={experience === "archive"}
      />

      {state.checkpoints.length > 0 ? (
        <section className="arena-rounds" aria-labelledby="arena-rounds-title">
          <ArenaSectionHeading
            detail="The newest committed round stays open. Earlier rounds remain available as a compact audit trail."
            eyebrow="Latest simultaneous reveal"
            title="Simultaneous checkpoint reveals"
            titleId="arena-rounds-title"
          />
          <div className="arena-round-list">
            {[...state.checkpoints].reverse().map((checkpoint, index) => (
              <details className="arena-round-disclosure" key={checkpoint.checkpointId} open={index === 0}>
                <summary>
                  <span className="arena-round-disclosure__checkpoint">
                    <ArenaIcon name="checkpoint" />
                    <span>{checkpointLabel(checkpoint.checkpointId)}</span>
                  </span>
                  <strong>{checkpoint.outcome === "GLOBAL_MISSED" ? "GLOBAL MISSED" : index === 0 ? "LATEST REVEAL" : "ROUND REVEALED"}</strong>
                </summary>
                <article
                  className={`arena-round${index === 0 ? " arena-round--latest" : ""}`}
                  role="group"
                  aria-label={`${checkpoint.checkpointId} simultaneous reveal`}
                >
                  <header>
                    <div>
                      <h3>{checkpointLabel(checkpoint.checkpointId)}</h3>
                      {checkpoint.snapshot ? (
                        <p>Score {checkpoint.snapshot.match.homeScore}–{checkpoint.snapshot.match.awayScore}</p>
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
                              <summary>
                                <ArenaIcon name="margin" />
                                <span>View allocation change</span>
                              </summary>
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
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <ArenaNextEvent
        label={state.phase === "COMPLETED" ? "Competition record" : "Next decision"}
        value={state.phase === "COMPLETED" ? "Final settlement complete" : checkpointLabel(state.nextCheckpointId ?? "FINAL")}
      />

      {resultTitle && state.finalResult ? (
        <section className="arena-result arena-result--terminal" aria-labelledby="arena-result-title">
          <div className="arena-result__hero">
            <div>
              <p className="product-eyebrow arena-icon-label"><ArenaIcon name="winner" />Verified terminal result</p>
              <h2 id="arena-result-title">{resultTitle}</h2>
              <p>Final accounting is committed under {state.finalResult.winnerRule}.</p>
            </div>
            <div className="arena-result__score" aria-label="Final score">
              <span>Final score</span>
              <strong>
                {state.finalResult.terminalEvidence.match.homeScore}–
                {state.finalResult.terminalEvidence.match.awayScore}
              </strong>
            </div>
          </div>
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
          <Link className="product-text-link arena-proof-link" href={`/arena/${arenaId}/proof`}><ArenaIcon name="proof" />Inspect public proof <span aria-hidden="true">→</span></Link>
        </section>
      ) : state.phase === "FINALIZING" ? (
        <section className="arena-result arena-result--finalizing" aria-label="Provisional result">
          <p className="product-eyebrow">Finalizing</p>
          <h2>Verifying final result</h2>
          <p>The current leader remains provisional until terminal accounting completes.</p>
        </section>
      ) : null}

      {experience === "proof" ? (
        <section className="arena-proof" aria-labelledby="arena-proof-title">
          <ArenaSectionHeading
            detail="Agents choose strategy. Arena90 controls validation, execution, accounting, and winner resolution."
            eyebrow="Architecture evidence"
            title="Deterministic system boundary"
            titleId="arena-proof-title"
          />
          <dl>
            <div><dt>Confirmed event sequence</dt><dd>{state.lastEventSequence}</dd></div>
            <div><dt>Runtime version</dt><dd>{state.runtimeVersions.runtimeVersion}</dd></div>
            <div><dt>Execution rules</dt><dd>{state.runtimeVersions.executionRuleVersion}</dd></div>
            <div><dt>Winner rules</dt><dd>{state.runtimeVersions.winnerRuleVersion}</dd></div>
            <div><dt>Latest checkpoint snapshot hash</dt><dd>{displaySnapshot?.snapshotHash ?? "No checkpoint snapshot committed"}</dd></div>
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
