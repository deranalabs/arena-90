import type {
  AgentAdapter,
  AgentInvocationRequest,
} from "../adapters/agents/fake.js";
import type {
  AgentDecision,
  ArenaAgentId,
  ArenaAssetId,
  ArenaEvent,
  CanonicalSnapshot,
  CheckpointId,
  DecisionCheckpointId,
  MoneyMicros,
  PortfolioState,
} from "../contracts/index.js";
import {
  DECISION_CHECKPOINT_IDS,
  canonicalSnapshotSchema,
  createAgentDecisionSchema,
} from "../contracts/index.js";
import { applyDecision, markToMarket } from "../engine/index.js";

interface DataAdapter {
  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
  getFinalResult(): ArenaAssetId;
}

interface CheckpointOrchestratorConfig {
  arenaId: string;
  startingBankrollMicros: MoneyMicros;
  dataAdapter: DataAdapter;
  agents: Record<ArenaAgentId, AgentAdapter>;
  timeoutMs: number;
}

interface CheckpointPortfolios {
  alpha: PortfolioState;
  beta: PortfolioState;
}

interface CheckpointRunResult {
  portfolios: CheckpointPortfolios;
  events: ArenaEvent[];
}

interface CheckpointOrchestrator {
  runCheckpoint(
    checkpointId: CheckpointId,
    portfolios: CheckpointPortfolios,
  ): Promise<CheckpointRunResult>;
}

type InvocationFailureReason = "TIMEOUT" | "PROCESS_FAILURE" | "MISSING_OUTPUT";
type InvocationOutcome =
  | { status: "RECEIVED"; output: unknown }
  | { status: "FAILED"; reason: InvocationFailureReason };

function invokeWithTimeout(
  adapter: AgentAdapter,
  request: Omit<AgentInvocationRequest, "signal">,
  timeoutMs: number,
): Promise<InvocationOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      abortController.abort();
      resolve({ status: "FAILED", reason: "TIMEOUT" });
    }, timeoutMs);

    Promise.resolve()
      .then(() => adapter.invoke({ ...request, signal: abortController.signal }))
      .then(
        (output) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(
            output === undefined || output === null
              ? { status: "FAILED", reason: "MISSING_OUTPUT" }
              : { status: "RECEIVED", output },
          );
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve({ status: "FAILED", reason: "PROCESS_FAILURE" });
        },
      );
  });
}

export function createCheckpointOrchestrator(
  config: CheckpointOrchestratorConfig,
): CheckpointOrchestrator {
  let sequence = 0;
  let nextCheckpointIndex = 0;
  const events: ArenaEvent[] = [];
  const completedCheckpoints = new Map<DecisionCheckpointId, CheckpointRunResult>();

  function snapshotEvents(): ArenaEvent[] {
    return structuredClone(events);
  }

  function snapshotResult(result: CheckpointRunResult): CheckpointRunResult {
    return structuredClone(result);
  }

  function emit(
    type: string,
    checkpointId: DecisionCheckpointId,
    occurredAtUtc: string,
    publicPayload: unknown,
    agentId?: ArenaAgentId,
  ): void {
    sequence += 1;
    events.push({
      eventId: `${config.arenaId}:${sequence}`,
      arenaId: config.arenaId,
      sequence,
      type,
      occurredAtUtc,
      checkpointId,
      ...(agentId === undefined ? {} : { agentId }),
      publicPayload,
    });
  }

  return {
    async runCheckpoint(checkpointId, portfolios) {
      if (checkpointId === "FINAL") {
        throw new RangeError("FINAL is not a decision checkpoint");
      }

      const decisionCheckpointId: DecisionCheckpointId = checkpointId;
      const cachedResult = completedCheckpoints.get(decisionCheckpointId);
      if (cachedResult !== undefined) {
        return snapshotResult(cachedResult);
      }

      const expectedCheckpoint = DECISION_CHECKPOINT_IDS[nextCheckpointIndex];
      if (decisionCheckpointId !== expectedCheckpoint) {
        const occurredAtUtc = new Date().toISOString();
        emit(
          "GLOBAL_MISSED_DECISION_ROUND",
          decisionCheckpointId,
          occurredAtUtc,
          { reason: "OUT_OF_ORDER_CHECKPOINT" },
        );
        return { portfolios: structuredClone(portfolios), events: snapshotEvents() };
      }

      function completeGlobalMiss(
        occurredAtUtc: string,
        reason: string,
      ): CheckpointRunResult {
        emit(
          "GLOBAL_MISSED_DECISION_ROUND",
          decisionCheckpointId,
          occurredAtUtc,
          { reason },
        );
        emit("ROUND_COMPLETE", decisionCheckpointId, occurredAtUtc, {});
        nextCheckpointIndex += 1;
        const result = {
          portfolios: structuredClone(portfolios),
          events: snapshotEvents(),
        };
        completedCheckpoints.set(decisionCheckpointId, snapshotResult(result));
        return result;
      }

      let snapshot: CanonicalSnapshot;
      try {
        const snapshotResult = canonicalSnapshotSchema.safeParse(
          config.dataAdapter.getSnapshot(decisionCheckpointId),
        );
        if (!snapshotResult.success) {
          return completeGlobalMiss(new Date().toISOString(), "INVALID_SNAPSHOT");
        }
        snapshot = snapshotResult.data;
      } catch {
        return completeGlobalMiss(new Date().toISOString(), "DATA_FAILURE");
      }

      const occurredAtUtc = snapshot.observedAtUtc;

      if (snapshot.arenaId !== config.arenaId) {
        return completeGlobalMiss(occurredAtUtc, "SNAPSHOT_ARENA_MISMATCH");
      }

      if (snapshot.checkpointId !== decisionCheckpointId) {
        return completeGlobalMiss(occurredAtUtc, "SNAPSHOT_CHECKPOINT_MISMATCH");
      }

      if (snapshot.freshness.suspended) {
        return completeGlobalMiss(occurredAtUtc, "SUSPENDED_SNAPSHOT");
      }

      emit(
        "CHECKPOINT_OPENED",
        decisionCheckpointId,
        occurredAtUtc,
        { snapshotId: snapshot.snapshotId },
      );
      emit("AGENTS_ANALYZING", decisionCheckpointId, occurredAtUtc, {});

      const [alphaInvocation, betaInvocation] = await Promise.all([
        invokeWithTimeout(
          config.agents.alpha,
          {
            snapshot: structuredClone(snapshot),
            portfolio: structuredClone(portfolios.alpha),
            attempt: 0,
            validationErrors: [],
          },
          config.timeoutMs,
        ),
        invokeWithTimeout(
          config.agents.beta,
          {
            snapshot: structuredClone(snapshot),
            portfolio: structuredClone(portfolios.beta),
            attempt: 0,
            validationErrors: [],
          },
          config.timeoutMs,
        ),
      ]);

      async function resolveDecision(
        agentId: ArenaAgentId,
        invocation: InvocationOutcome,
        portfolio: PortfolioState,
      ): Promise<{ decision?: AgentDecision }> {
        if (invocation.status === "FAILED") {
          emit(
            "MISSED_DECISION_ROUND",
            decisionCheckpointId,
            occurredAtUtc,
            { reason: invocation.reason },
            agentId,
          );
          return {};
        }

        const decisionSchema = createAgentDecisionSchema({
          arenaId: config.arenaId,
          snapshotId: snapshot.snapshotId,
          checkpointId: decisionCheckpointId,
          agentId,
        });
        emit(
          "DECISION_RECEIVED",
          decisionCheckpointId,
          occurredAtUtc,
          { status: "RECEIVED" },
          agentId,
        );
        const firstValidation = decisionSchema.safeParse(invocation.output);

        if (firstValidation.success) {
          return { decision: firstValidation.data };
        }

        emit(
          "RECHECKING_DECISION",
          decisionCheckpointId,
          occurredAtUtc,
          { attempt: 1 },
          agentId,
        );
        const repairInvocation = await invokeWithTimeout(
          config.agents[agentId],
          {
            snapshot: structuredClone(snapshot),
            portfolio: structuredClone(portfolio),
            attempt: 1,
            validationErrors: firstValidation.error.issues.map((issue) => issue.message),
          },
          config.timeoutMs,
        );

        if (repairInvocation.status === "FAILED") {
          emit(
            "MISSED_DECISION_ROUND",
            decisionCheckpointId,
            occurredAtUtc,
            { reason: repairInvocation.reason },
            agentId,
          );
          return {};
        }

        emit(
          "DECISION_RECEIVED",
          decisionCheckpointId,
          occurredAtUtc,
          { status: "RECEIVED" },
          agentId,
        );

        const repairValidation = decisionSchema.safeParse(repairInvocation.output);

        if (repairValidation.success) {
          return { decision: repairValidation.data };
        }

        emit(
          "MISSED_DECISION_ROUND",
          decisionCheckpointId,
          occurredAtUtc,
          { reason: "INVALID_OUTPUT" },
          agentId,
        );
        return {};
      }

      const [alphaResolution, betaResolution] = await Promise.all([
        resolveDecision("alpha", alphaInvocation, portfolios.alpha),
        resolveDecision("beta", betaInvocation, portfolios.beta),
      ]);
      const resolutions = { alpha: alphaResolution, beta: betaResolution };
      const decisions: Partial<Record<ArenaAgentId, AgentDecision>> = {
        ...(resolutions.alpha.decision === undefined
          ? {}
          : { alpha: resolutions.alpha.decision }),
        ...(resolutions.beta.decision === undefined
          ? {}
          : { beta: resolutions.beta.decision }),
      };

      const nextPortfolios = {
        alpha:
          resolutions.alpha.decision === undefined
            ? markToMarket(
                portfolios.alpha,
                snapshot.priceMicros,
                decisionCheckpointId,
                config.startingBankrollMicros,
              )
            : applyDecision(
                portfolios.alpha,
                resolutions.alpha.decision,
                snapshot.priceMicros,
                config.startingBankrollMicros,
              ),
        beta:
          resolutions.beta.decision === undefined
            ? markToMarket(
                portfolios.beta,
                snapshot.priceMicros,
                decisionCheckpointId,
                config.startingBankrollMicros,
              )
            : applyDecision(
                portfolios.beta,
                resolutions.beta.decision,
                snapshot.priceMicros,
                config.startingBankrollMicros,
              ),
      };

      emit("ROUND_REVEALED", decisionCheckpointId, occurredAtUtc, { decisions });
      emit("ROUND_COMPLETE", decisionCheckpointId, occurredAtUtc, {});

      nextCheckpointIndex += 1;
      const result = {
        portfolios: nextPortfolios,
        events: snapshotEvents(),
      };
      completedCheckpoints.set(decisionCheckpointId, snapshotResult(result));
      return result;
    },
  };
}
