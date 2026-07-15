import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicDecisionV1,
  PublicFailureV1,
  PublicPortfolioV1,
} from "./contracts";

type AgentId = "alpha" | "beta";
type Portfolios = { alpha: PublicPortfolioV1; beta: PublicPortfolioV1 };
type Decisions = { alpha?: PublicDecisionV1; beta?: PublicDecisionV1 };

const agentIds = ["alpha", "beta"] as const;

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equal(value, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    equal(leftKeys, rightKeys) &&
    leftKeys.every((key) => equal(leftRecord[key], rightRecord[key]))
  );
}

function validPortfolios(portfolios: Portfolios) {
  return (
    portfolios.alpha.agentId === "alpha" &&
    portfolios.beta.agentId === "beta"
  );
}

function failureFor(
  failures: readonly PublicFailureV1[],
  agentId: AgentId,
) {
  return failures.filter(
    (failure) => failure.scope === "AGENT" && failure.agentId === agentId,
  );
}

function validReveal(options: {
  arenaId: string;
  checkpointId: string;
  snapshotId?: string;
  decisions: Decisions;
  failures: readonly PublicFailureV1[];
  portfoliosBefore: Portfolios;
  portfoliosAfter: Portfolios;
}) {
  if (
    !validPortfolios(options.portfoliosBefore) ||
    !validPortfolios(options.portfoliosAfter) ||
    options.failures.some((failure) => failure.scope === "GLOBAL")
  ) {
    return false;
  }

  for (const agentId of agentIds) {
    const decision = options.decisions[agentId];
    const failures = failureFor(options.failures, agentId);
    if ((decision === undefined) === (failures.length === 0)) return false;
    if (failures.length > 1) return false;
    if (decision) {
      if (
        decision.agentId !== agentId ||
        decision.arenaId !== options.arenaId ||
        decision.checkpointId !== options.checkpointId ||
        (options.snapshotId !== undefined &&
          decision.snapshotId !== options.snapshotId)
      ) {
        return false;
      }
    } else if (
      !equal(
        options.portfoliosBefore[agentId],
        options.portfoliosAfter[agentId],
      )
    ) {
      return false;
    }
  }

  return options.failures.length ===
    agentIds.filter((agentId) => options.decisions[agentId] === undefined).length;
}

function validCompleted(
  state: PublicArenaStateV1,
  events: readonly PublicArenaEventV1[],
) {
  const result = state.finalResult;
  const completedEvents = events.filter(
    (event): event is Extract<PublicArenaEventV1, { type: "COMPLETED" }> =>
      event.type === "COMPLETED" && event.sequence <= state.lastEventSequence,
  );
  const completed = completedEvents[0];
  if (
    !result ||
    completedEvents.length !== 1 ||
    completed.sequence !== state.lastEventSequence ||
    !equal(completed.payload.result, result) ||
    !equal(completed.payload.portfolios, state.portfolios) ||
    state.leader.provisional ||
    state.leader.result !== result.winner ||
    result.arenaId !== state.manifest.arenaId ||
    result.alphaFinalNavMicros !== state.portfolios.alpha.navMicros ||
    result.betaFinalNavMicros !== state.portfolios.beta.navMicros ||
    !validTerminalAccounting(
      state.portfolios.alpha,
      result.winningAssetId,
      state.manifest.startingBankrollMicros,
    ) ||
    !validTerminalAccounting(
      state.portfolios.beta,
      result.winningAssetId,
      state.manifest.startingBankrollMicros,
    ) ||
    state.portfolios.alpha.updatedAtCheckpoint !== "FINAL" ||
    state.portfolios.beta.updatedAtCheckpoint !== "FINAL" ||
    state.nextCheckpointId !== undefined ||
    !state.manifest.assets.some((asset) => asset.id === result.winningAssetId)
  ) {
    return false;
  }

  const alphaNav = BigInt(result.alphaFinalNavMicros);
  const betaNav = BigInt(result.betaFinalNavMicros);
  const expectedWinner = alphaNav > betaNav
    ? "alpha"
    : betaNav > alphaNav
      ? "beta"
      : "DRAW";
  return result.winner === expectedWinner;
}

function validTerminalAccounting(
  portfolio: PublicPortfolioV1,
  winningAssetId: "HOME" | "DRAW" | "AWAY",
  startingBankrollMicros: string,
) {
  try {
    const bankroll = BigInt(startingBankrollMicros);
    const winningUnits = portfolio.unitMicros[winningAssetId];
    if (bankroll <= BigInt(0) || typeof winningUnits !== "string") return false;
    const expectedFinalNav = BigInt(portfolio.cashMicros) + BigInt(winningUnits);
    const expectedReturnBps =
      ((expectedFinalNav - bankroll) * BigInt(10_000)) / bankroll;
    return (
      BigInt(portfolio.navMicros) === expectedFinalNav &&
      BigInt(portfolio.returnBps) === expectedReturnBps
    );
  } catch {
    return false;
  }
}

export function validateSpectatorView(
  state: PublicArenaStateV1,
  events: readonly PublicArenaEventV1[],
): boolean {
  if (
    state.portfolios.alpha.agentId !== "alpha" ||
    state.portfolios.beta.agentId !== "beta" ||
    state.currentSnapshot?.arenaId !== undefined &&
      state.currentSnapshot.arenaId !== state.manifest.arenaId ||
    state.currentSnapshot?.fixtureId !== undefined &&
      state.currentSnapshot.fixtureId !== state.manifest.fixtureId
  ) {
    return false;
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (
      event.arenaId !== state.manifest.arenaId ||
      event.sequence !== index + 1
    ) {
      return false;
    }
    if (
      event.type === "ROUND_REVEALED" &&
      !validReveal({
        arenaId: state.manifest.arenaId,
        checkpointId: event.checkpointId,
        decisions: event.payload.decisions,
        failures: event.payload.failures,
        portfoliosBefore: event.payload.portfoliosBefore,
        portfoliosAfter: event.payload.portfoliosAfter,
      })
    ) {
      return false;
    }
  }
  if (state.lastEventSequence > events.length) return false;

  const checkpointIds = new Set<string>();
  for (const checkpoint of state.checkpoints) {
    if (checkpointIds.has(checkpoint.checkpointId)) return false;
    checkpointIds.add(checkpoint.checkpointId);
    if (
      checkpoint.lastEventSequence > state.lastEventSequence ||
      checkpoint.snapshot?.arenaId !== undefined &&
        checkpoint.snapshot.arenaId !== state.manifest.arenaId
    ) {
      return false;
    }
    const range = events.filter(
      (event) =>
        event.sequence >= checkpoint.firstEventSequence &&
        event.sequence <= checkpoint.lastEventSequence &&
        "checkpointId" in event &&
        event.checkpointId === checkpoint.checkpointId,
    );

    if (checkpoint.outcome === "REVEALED") {
      const reveals = range.filter(
        (event): event is Extract<
          PublicArenaEventV1,
          { type: "ROUND_REVEALED" }
        > => event.type === "ROUND_REVEALED",
      );
      if (
        reveals.length !== 1 ||
        !equal(reveals[0].payload.decisions, checkpoint.revealedDecisions) ||
        !equal(reveals[0].payload.failures, checkpoint.failures) ||
        !equal(reveals[0].payload.portfoliosBefore, checkpoint.portfoliosBefore) ||
        !equal(reveals[0].payload.portfoliosAfter, checkpoint.portfoliosAfter) ||
        !validReveal({
          arenaId: state.manifest.arenaId,
          checkpointId: checkpoint.checkpointId,
          snapshotId: checkpoint.snapshot?.snapshotId,
          decisions: checkpoint.revealedDecisions,
          failures: checkpoint.failures,
          portfoliosBefore: checkpoint.portfoliosBefore,
          portfoliosAfter: checkpoint.portfoliosAfter,
        })
      ) {
        return false;
      }
      continue;
    }

    const globalMissed = range.filter(
      (event): event is Extract<
        PublicArenaEventV1,
        { type: "GLOBAL_MISSED_DECISION_ROUND" }
      > => event.type === "GLOBAL_MISSED_DECISION_ROUND",
    );
    const globalFailures = checkpoint.failures.filter(
      (failure) => failure.scope === "GLOBAL",
    );
    if (
      checkpoint.revealedDecisions.alpha !== undefined ||
      checkpoint.revealedDecisions.beta !== undefined ||
      globalMissed.length !== 1 ||
      range.some((event) => event.type === "ROUND_REVEALED") ||
      checkpoint.failures.length !== 1 ||
      globalFailures.length !== 1 ||
      globalMissed[0].payload.reason !== globalFailures[0].reason ||
      !equal(checkpoint.portfoliosBefore, checkpoint.portfoliosAfter)
    ) {
      return false;
    }
  }

  if (state.phase === "COMPLETED") return validCompleted(state, events);
  return state.leader.provisional && state.finalResult === undefined;
}
