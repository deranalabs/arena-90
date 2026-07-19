import {
  CHECKPOINT_IDS,
  type AgentDecision,
  type ArenaFinalResultV2,
  type ArenaManifest,
  type ArenaRunStateV1,
  type CanonicalSnapshot,
  type CheckpointFailureV1,
  type DecisionCheckpointCommitV1,
  type PortfolioState,
  type PersistedArenaEventV1,
} from "../contracts/index.js";
import {
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
  type PublicArenaEventV1,
  type PublicArenaStateV1,
  type PublicCheckpointV1,
  type PublicDecisionV1,
  type PublicFailureV1,
  type PublicFinalResultV2,
  type PublicEventHistoryV1,
  type PublicManifestV1,
  type PublicPortfolioV1,
  type PublicSnapshotV1,
} from "./contracts.js";

export type PublicProjectionErrorCode =
  | "INVALID_STATE"
  | "UNKNOWN_EVENT_TYPE"
  | "INCONSISTENT_EVENT";

export class PublicProjectionError extends Error {
  readonly code: PublicProjectionErrorCode;

  constructor(code: PublicProjectionErrorCode) {
    super("Arena public projection failed");
    this.name = "PublicProjectionError";
    this.code = code;
  }
}

function projectManifest(manifest: ArenaManifest): PublicManifestV1 {
  return {
    schemaVersion: 1,
    arenaId: manifest.arenaId,
    mode: manifest.mode,
    competition: manifest.competition,
    fixtureId: manifest.fixtureId,
    homeTeam: { name: manifest.homeTeam.name, code: manifest.homeTeam.code },
    awayTeam: { name: manifest.awayTeam.name, code: manifest.awayTeam.code },
    kickoffUtc: manifest.kickoffUtc,
    startingBankrollMicros: manifest.startingBankrollMicros,
    currency: manifest.currency,
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      market: asset.market,
      label: asset.label,
    })),
    checkpoints: [...manifest.checkpoints],
    ...(manifest.replayDisclosure === undefined
      ? {}
      : { replayDisclosure: manifest.replayDisclosure }),
    createdAtUtc: manifest.createdAtUtc,
  };
}

function projectSnapshot(snapshot: CanonicalSnapshot): PublicSnapshotV1 {
  return {
    schemaVersion: 1,
    snapshotId: snapshot.snapshotId,
    snapshotHash: snapshot.snapshotHash,
    arenaId: snapshot.arenaId,
    fixtureId: snapshot.fixtureId,
    checkpointId: snapshot.checkpointId,
    observedAtUtc: snapshot.observedAtUtc,
    source: snapshot.source,
    match: {
      status: snapshot.match.status,
      minute: snapshot.match.minute,
      addedTime: snapshot.match.addedTime,
      homeScore: snapshot.match.homeScore,
      awayScore: snapshot.match.awayScore,
    },
    priceMicros: {
      HOME: snapshot.priceMicros.HOME,
      DRAW: snapshot.priceMicros.DRAW,
      AWAY: snapshot.priceMicros.AWAY,
    },
    freshness: {
      marketUpdatedAtUtc: snapshot.freshness.marketUpdatedAtUtc,
      delayed: snapshot.freshness.delayed,
      suspended: snapshot.freshness.suspended,
    },
  };
}

function projectPortfolio(portfolio: PortfolioState): PublicPortfolioV1 {
  return {
    agentId: portfolio.agentId,
    cashMicros: portfolio.cashMicros,
    unitMicros: {
      HOME: portfolio.unitMicros.HOME,
      DRAW: portfolio.unitMicros.DRAW,
      AWAY: portfolio.unitMicros.AWAY,
    },
    navMicros: portfolio.navMicros,
    returnBps: portfolio.returnBps,
    updatedAtCheckpoint: portfolio.updatedAtCheckpoint,
  };
}

function projectDecision(decision: AgentDecision): PublicDecisionV1 {
  const identity = {
    schemaVersion: 1 as const,
    arenaId: decision.arenaId,
    snapshotId: decision.snapshotId,
    checkpointId: decision.checkpointId,
    agentId: decision.agentId,
    publicExplanation: decision.publicExplanation,
  };
  return decision.action === "NO_TRADE"
    ? { ...identity, action: "NO_TRADE" }
    : {
        ...identity,
        action: "TARGET_ALLOCATION",
        targetAllocationBps: {
          cash: decision.targetAllocationBps.cash,
          HOME: decision.targetAllocationBps.HOME,
          DRAW: decision.targetAllocationBps.DRAW,
          AWAY: decision.targetAllocationBps.AWAY,
        },
      };
}

function projectFailure(failure: CheckpointFailureV1): PublicFailureV1 {
  if (failure.scope === "AGENT") {
    switch (failure.reason) {
      case "TIMEOUT":
      case "PROCESS_FAILURE":
      case "MISSING_OUTPUT":
      case "INVALID_OUTPUT":
        return {
          scope: "AGENT",
          agentId: failure.agentId,
          reason: failure.reason,
        };
      default:
        throw new PublicProjectionError("INVALID_STATE");
    }
  }
  switch (failure.reason) {
    case "DATA_FAILURE":
      return { scope: "GLOBAL", reason: "DATA_UNAVAILABLE" };
    case "SUSPENDED_SNAPSHOT":
      return { scope: "GLOBAL", reason: "SUSPENDED_MARKET" };
    default:
      throw new PublicProjectionError("INVALID_STATE");
  }
}

function projectCheckpoint(
  checkpoint: DecisionCheckpointCommitV1,
): PublicCheckpointV1 {
  const snapshot = checkpoint.snapshot;
  const decisions = Object.fromEntries(
    (["alpha", "beta"] as const).flatMap((agentId) => {
      const decision = checkpoint.revealedDecisions[agentId];
      if (decision === undefined) return [];
      if (
        snapshot === undefined ||
        decision.agentId !== agentId ||
        decision.arenaId !== snapshot.arenaId ||
        decision.snapshotId !== snapshot.snapshotId ||
        decision.checkpointId !== checkpoint.checkpointId
      ) {
        throw new PublicProjectionError("INVALID_STATE");
      }
      return [[agentId, projectDecision(decision)]];
    }),
  ) as PublicCheckpointV1["revealedDecisions"];
  return {
    checkpointId: checkpoint.checkpointId,
    outcome: checkpoint.outcome,
    ...(snapshot === undefined ? {} : { snapshot: projectSnapshot(snapshot) }),
    revealedDecisions: decisions,
    failures: checkpoint.failures.map(projectFailure),
    portfoliosBefore: {
      alpha: projectPortfolio(checkpoint.portfoliosBefore.alpha),
      beta: projectPortfolio(checkpoint.portfoliosBefore.beta),
    },
    portfoliosAfter: {
      alpha: projectPortfolio(checkpoint.portfoliosAfter.alpha),
      beta: projectPortfolio(checkpoint.portfoliosAfter.beta),
    },
    firstEventSequence: checkpoint.firstEventSequence,
    lastEventSequence: checkpoint.lastEventSequence,
  };
}

function projectFinalResult(result: ArenaFinalResultV2): PublicFinalResultV2 {
  return {
    schemaVersion: 2,
    arenaId: result.arenaId,
    winnerRule: result.winnerRule,
    winningAssetId: result.winningAssetId,
    winner: result.winner,
    alphaFinalNavMicros: result.alphaFinalNavMicros,
    betaFinalNavMicros: result.betaFinalNavMicros,
    terminalEvidence: structuredClone(result.terminalEvidence),
    completedEventSequence: result.completedEventSequence,
    preSettlementEventLogHash: result.preSettlementEventLogHash,
    finalResultHash: result.finalResultHash,
  };
}

function matchingCheckpoint(
  state: ArenaRunStateV1,
  event: PersistedArenaEventV1,
): DecisionCheckpointCommitV1 {
  const checkpoint = state.checkpoints.find(
    (candidate) =>
      event.sequence >= candidate.firstEventSequence &&
      event.sequence <= candidate.lastEventSequence,
  );
  if (
    checkpoint === undefined ||
    event.checkpointId !== checkpoint.checkpointId
  ) {
    throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
  return checkpoint;
}

function snapshotForOpeningEvent(
  state: ArenaRunStateV1,
  event: PersistedArenaEventV1,
): CanonicalSnapshot {
  const committed = state.checkpoints.find(
    (checkpoint) =>
      event.sequence >= checkpoint.firstEventSequence &&
      event.sequence <= checkpoint.lastEventSequence,
  );
  if (committed?.snapshot !== undefined) {
    if (event.checkpointId !== committed.checkpointId) {
      throw new PublicProjectionError("INCONSISTENT_EVENT");
    }
    return committed.snapshot;
  }
  const pending = state.pendingCheckpoint;
  if (
    pending === undefined ||
    event.checkpointId !== pending.checkpointId ||
    event.sequence < state.lastEventSequence - 1 ||
    event.sequence > state.lastEventSequence
  ) {
    throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
  return pending.snapshot;
}

function eventAgentFailureReason(
  value: unknown,
): "TIMEOUT" | "PROCESS_FAILURE" | "MISSING_OUTPUT" | "INVALID_OUTPUT" {
  switch (value) {
    case "TIMEOUT":
    case "PROCESS_FAILURE":
    case "MISSING_OUTPUT":
    case "INVALID_OUTPUT":
      return value;
    default:
      throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
}

function eventGlobalFailureReason(
  value: unknown,
): "DATA_UNAVAILABLE" | "SUSPENDED_MARKET" {
  switch (value) {
    case "DATA_FAILURE":
      return "DATA_UNAVAILABLE";
    case "SUSPENDED_SNAPSHOT":
      return "SUSPENDED_MARKET";
    default:
      throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
}

export function projectArenaEvent(
  state: ArenaRunStateV1,
  event: PersistedArenaEventV1,
): PublicArenaEventV1 {
  try {
    if (
      event.arenaId !== state.manifest.arenaId ||
      event.eventId !== `${event.arenaId}:${event.sequence}` ||
      event.sequence < 1 ||
      event.sequence > state.lastEventSequence
    ) {
      throw new PublicProjectionError("INCONSISTENT_EVENT");
    }
    const base = {
      schemaVersion: 1 as const,
      eventId: event.eventId,
      arenaId: event.arenaId,
      sequence: event.sequence,
      occurredAtUtc: event.occurredAtUtc,
    };
    let projected: PublicArenaEventV1;
    switch (event.type) {
      case "ARENA_READY": {
        if (
          event.sequence !== 1 ||
          event.checkpointId !== undefined ||
          event.agentId !== undefined
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = { ...base, type: "ARENA_READY", payload: {} };
        break;
      }
      case "CHECKPOINT_OPENED": {
        if (
          event.agentId !== undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL"
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        const snapshot = snapshotForOpeningEvent(state, event);
        if (
          (event.publicPayload as { snapshotId?: unknown }).snapshotId !==
          snapshot.snapshotId
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "CHECKPOINT_OPENED",
          checkpointId: event.checkpointId,
          payload: { snapshot: projectSnapshot(snapshot) },
        };
        break;
      }
      case "AGENTS_ANALYZING": {
        snapshotForOpeningEvent(state, event);
        if (
          event.agentId !== undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL"
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "AGENTS_ANALYZING",
          checkpointId: event.checkpointId,
          payload: {},
        };
        break;
      }
      case "DECISION_RECEIVED": {
        matchingCheckpoint(state, event);
        if (
          event.agentId === undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL" ||
          (event.publicPayload as { status?: unknown }).status !== "RECEIVED"
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "DECISION_RECEIVED",
          checkpointId: event.checkpointId,
          agentId: event.agentId,
          payload: { status: "RECEIVED" },
        };
        break;
      }
      case "RECHECKING_DECISION": {
        matchingCheckpoint(state, event);
        if (
          event.agentId === undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL" ||
          (event.publicPayload as { attempt?: unknown }).attempt !== 1
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "RECHECKING_DECISION",
          checkpointId: event.checkpointId,
          agentId: event.agentId,
          payload: { attempt: 1 },
        };
        break;
      }
      case "MISSED_DECISION_ROUND": {
        const checkpoint = matchingCheckpoint(state, event);
        if (
          event.agentId === undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL"
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        const reason = eventAgentFailureReason(
          (event.publicPayload as { reason?: unknown }).reason,
        );
        const matchesFailure = checkpoint.failures.some(
          (failure) =>
            failure.scope === "AGENT" &&
            failure.agentId === event.agentId &&
            failure.reason === reason,
        );
        if (!matchesFailure) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "MISSED_DECISION_ROUND",
          checkpointId: event.checkpointId,
          agentId: event.agentId,
          payload: { reason },
        };
        break;
      }
      case "GLOBAL_MISSED_DECISION_ROUND": {
        const checkpoint = matchingCheckpoint(state, event);
        if (
          event.agentId !== undefined ||
          event.checkpointId === undefined ||
          event.checkpointId === "FINAL"
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        const internalReason = (
          event.publicPayload as { reason?: unknown }
        ).reason;
        const reason = eventGlobalFailureReason(internalReason);
        const matchesFailure = checkpoint.failures.some(
          (failure) =>
            failure.scope === "GLOBAL" && failure.reason === internalReason,
        );
        if (!matchesFailure) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "GLOBAL_MISSED_DECISION_ROUND",
          checkpointId: event.checkpointId,
          payload: { reason },
        };
        break;
      }
      case "ROUND_REVEALED": {
        const checkpoint = matchingCheckpoint(state, event);
        if (event.agentId !== undefined) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        const publicCheckpoint = projectCheckpoint(checkpoint);
        projected = {
          ...base,
          type: "ROUND_REVEALED",
          checkpointId: checkpoint.checkpointId,
          payload: {
            decisions: publicCheckpoint.revealedDecisions,
            failures: publicCheckpoint.failures,
            portfoliosBefore: publicCheckpoint.portfoliosBefore,
            portfoliosAfter: publicCheckpoint.portfoliosAfter,
          },
        };
        break;
      }
      case "ROUND_COMPLETE": {
        const checkpoint = matchingCheckpoint(state, event);
        if (event.agentId !== undefined) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        const publicCheckpoint = projectCheckpoint(checkpoint);
        const checkpointIndex = state.checkpoints.indexOf(checkpoint);
        const nextCheckpointId = CHECKPOINT_IDS[checkpointIndex + 1];
        projected = {
          ...base,
          type: "ROUND_COMPLETE",
          checkpointId: checkpoint.checkpointId,
          payload: {
            portfolios: publicCheckpoint.portfoliosAfter,
            ...(nextCheckpointId === undefined ? {} : { nextCheckpointId }),
          },
        };
        break;
      }
      case "FINALIZING": {
        if (
          event.checkpointId !== "FINAL" ||
          event.agentId !== undefined ||
          (state.phase !== "FINALIZING" && state.phase !== "COMPLETED")
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "FINALIZING",
          checkpointId: "FINAL",
          payload: {},
        };
        break;
      }
      case "COMPLETED": {
        if (
          event.checkpointId !== "FINAL" ||
          event.agentId !== undefined ||
          event.sequence !== state.lastEventSequence ||
          state.phase !== "COMPLETED" ||
          state.finalResult === undefined
        ) {
          throw new PublicProjectionError("INCONSISTENT_EVENT");
        }
        projected = {
          ...base,
          type: "COMPLETED",
          checkpointId: "FINAL",
          payload: {
            result: projectFinalResult(state.finalResult),
            portfolios: {
              alpha: projectPortfolio(state.portfolios.alpha),
              beta: projectPortfolio(state.portfolios.beta),
            },
          },
        };
        break;
      }
      default:
        throw new PublicProjectionError("UNKNOWN_EVENT_TYPE");
    }
    return publicArenaEventV1Schema.parse(projected);
  } catch (error) {
    if (error instanceof PublicProjectionError) throw error;
    throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
}

export function projectArenaEventHistory(
  state: ArenaRunStateV1,
  events: readonly PersistedArenaEventV1[],
  afterSequence: number,
): PublicEventHistoryV1 {
  try {
    if (
      !Number.isSafeInteger(afterSequence) ||
      afterSequence < 0 ||
      afterSequence > state.lastEventSequence
    ) {
      throw new PublicProjectionError("INCONSISTENT_EVENT");
    }
    events.forEach((event, index) => {
      if (
        event.arenaId !== state.manifest.arenaId ||
        event.sequence !== afterSequence + index + 1 ||
        event.sequence > state.lastEventSequence
      ) {
        throw new PublicProjectionError("INCONSISTENT_EVENT");
      }
    });
    return publicEventHistoryV1Schema.parse({
      schemaVersion: 1,
      arenaId: state.manifest.arenaId,
      afterSequence,
      lastEventSequence: state.lastEventSequence,
      events: events.map((event) => projectArenaEvent(state, event)),
    });
  } catch (error) {
    if (error instanceof PublicProjectionError) throw error;
    throw new PublicProjectionError("INCONSISTENT_EVENT");
  }
}

export function projectArenaState(
  state: ArenaRunStateV1,
  isDegraded = false,
): PublicArenaStateV1 {
  try {
    if (
      state.portfolios.alpha.agentId !== "alpha" ||
      state.portfolios.beta.agentId !== "beta"
    ) {
      throw new PublicProjectionError("INVALID_STATE");
    }
    const alpha = projectPortfolio(state.portfolios.alpha);
    const beta = projectPortfolio(state.portfolios.beta);
    const alphaNav = BigInt(alpha.navMicros);
    const betaNav = BigInt(beta.navMicros);
    const result =
      alphaNav > betaNav ? "alpha" : betaNav > alphaNav ? "beta" : "DRAW";
    const effectivePhase =
      isDegraded && state.phase !== "COMPLETED" ? "DEGRADED" : state.phase;
    const nextCheckpointId =
      effectivePhase === "COMPLETED"
        ? undefined
        : CHECKPOINT_IDS[state.checkpoints.length];
    const projected = {
      schemaVersion: 1 as const,
      manifest: projectManifest(state.manifest),
      phase: effectivePhase,
      runtimeVersions: {
        runtimeVersion: state.runtimeMetadata.runtimeVersion,
        executionRuleVersion: state.runtimeMetadata.executionRuleVersion,
        winnerRuleVersion: state.runtimeMetadata.winnerRuleVersion,
        agents: {
          alpha: {
            strategyId: state.runtimeMetadata.agents.alpha.strategyId,
            strategyVersion:
              state.runtimeMetadata.agents.alpha.strategyVersion,
          },
          beta: {
            strategyId: state.runtimeMetadata.agents.beta.strategyId,
            strategyVersion: state.runtimeMetadata.agents.beta.strategyVersion,
          },
        },
      },
      ...(state.pendingCheckpoint === undefined
        ? {}
        : { currentSnapshot: projectSnapshot(state.pendingCheckpoint.snapshot) }),
      portfolios: { alpha, beta },
      checkpoints: state.checkpoints.map(projectCheckpoint),
      ...(nextCheckpointId === undefined ? {} : { nextCheckpointId }),
      leader: { result, provisional: effectivePhase !== "COMPLETED" },
      ...(state.finalResult === undefined
        ? {}
        : { finalResult: projectFinalResult(state.finalResult) }),
      lastEventSequence: state.lastEventSequence,
    };
    return publicArenaStateV1Schema.parse(projected);
  } catch (error) {
    if (error instanceof PublicProjectionError) throw error;
    throw new PublicProjectionError("INVALID_STATE");
  }
}
