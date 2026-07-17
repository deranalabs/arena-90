import type { AgentAdapter } from "../adapters/agents/fake.js";
import {
  DECISION_CHECKPOINT_IDS,
  canonicalSnapshotSchema,
  persistedArenaEventV1Schema,
  type ArenaAgentId,
  type ArenaEvent,
  type CanonicalSnapshot,
  type CheckpointId,
  type DecisionCheckpointId,
  type MoneyMicros,
  type PortfolioState,
} from "../contracts/index.js";
import {
  createCheckpointOpeningEvents,
  executePreparedCheckpoint,
} from "./checkpoint-execution.js";

interface DataAdapter {
  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
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

export function createCheckpointOrchestrator(
  config: CheckpointOrchestratorConfig,
): CheckpointOrchestrator {
  let sequence = 0;
  let nextCheckpointIndex = 0;
  const events: ArenaEvent[] = [];
  const completedCheckpoints = new Map<DecisionCheckpointId, CheckpointRunResult>();
  const acceptedSnapshots: CanonicalSnapshot[] = [];

  const snapshotEvents = () => structuredClone(events);
  const snapshotResult = (result: CheckpointRunResult) => structuredClone(result);

  function emitGlobal(
    type: string,
    checkpointId: DecisionCheckpointId,
    occurredAtUtc: string,
    publicPayload: unknown,
  ): void {
    sequence += 1;
    events.push(
      persistedArenaEventV1Schema.parse({
        eventId: `${config.arenaId}:${sequence}`,
        arenaId: config.arenaId,
        sequence,
        type,
        occurredAtUtc,
        checkpointId,
        publicPayload,
      }),
    );
  }

  return {
    async runCheckpoint(checkpointId, portfolios) {
      if (checkpointId === "FINAL") {
        throw new RangeError("FINAL is not a decision checkpoint");
      }
      const decisionCheckpointId: DecisionCheckpointId = checkpointId;
      const cached = completedCheckpoints.get(decisionCheckpointId);
      if (cached !== undefined) return snapshotResult(cached);

      if (decisionCheckpointId !== DECISION_CHECKPOINT_IDS[nextCheckpointIndex]) {
        emitGlobal(
          "GLOBAL_MISSED_DECISION_ROUND",
          decisionCheckpointId,
          new Date().toISOString(),
          { reason: "OUT_OF_ORDER_CHECKPOINT" },
        );
        return { portfolios: structuredClone(portfolios), events: snapshotEvents() };
      }

      function completeGlobalMiss(
        occurredAtUtc: string,
        reason: string,
      ): CheckpointRunResult {
        emitGlobal(
          "GLOBAL_MISSED_DECISION_ROUND",
          decisionCheckpointId,
          occurredAtUtc,
          { reason },
        );
        emitGlobal("ROUND_COMPLETE", decisionCheckpointId, occurredAtUtc, {});
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
        const parsed = canonicalSnapshotSchema.safeParse(
          config.dataAdapter.getSnapshot(decisionCheckpointId),
        );
        if (!parsed.success) {
          return completeGlobalMiss(new Date().toISOString(), "INVALID_SNAPSHOT");
        }
        snapshot = parsed.data;
      } catch {
        return completeGlobalMiss(new Date().toISOString(), "DATA_FAILURE");
      }
      if (snapshot.arenaId !== config.arenaId) {
        return completeGlobalMiss(
          snapshot.observedAtUtc,
          "SNAPSHOT_ARENA_MISMATCH",
        );
      }
      if (snapshot.checkpointId !== decisionCheckpointId) {
        return completeGlobalMiss(
          snapshot.observedAtUtc,
          "SNAPSHOT_CHECKPOINT_MISMATCH",
        );
      }
      if (snapshot.freshness.suspended) {
        return completeGlobalMiss(snapshot.observedAtUtc, "SUSPENDED_SNAPSHOT");
      }

      const openingEvents = createCheckpointOpeningEvents(snapshot, sequence);
      events.push(...openingEvents);
      sequence = openingEvents.at(-1)?.sequence ?? sequence;
      const execution = await executePreparedCheckpoint({
        snapshot,
        acceptedSnapshots,
        portfolios,
        agents: config.agents,
        timeoutMs: config.timeoutMs,
        startingBankrollMicros: config.startingBankrollMicros,
        initialEventSequence: sequence,
        signal: new AbortController().signal,
      });
      events.push(...execution.events);
      acceptedSnapshots.push(snapshot);
      sequence = execution.events.at(-1)?.sequence ?? sequence;
      nextCheckpointIndex += 1;
      const result = {
        portfolios: structuredClone(execution.portfoliosAfter),
        events: snapshotEvents(),
      };
      completedCheckpoints.set(decisionCheckpointId, snapshotResult(result));
      return result;
    },
  };
}
