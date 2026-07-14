import { isDeepStrictEqual } from "node:util";

import type { AgentAdapter } from "../adapters/agents/fake.js";
import {
  DECISION_CHECKPOINT_IDS,
  arenaAssetIdSchema,
  arenaManifestSchema,
  canonicalSnapshotSchema,
  calculateFinalResultHash,
  persistedArenaEventV1Schema,
  arenaRuntimeMetadataV1Schema,
  type ArenaAgentId,
  type ArenaRunStateV1,
  type ArenaRuntimeMetadataV1,
  type PersistedArenaEventV1,
} from "../contracts/index.js";
import {
  determineWinner,
  initializePortfolio,
  settlePortfolio,
} from "../engine/index.js";
import type {
  ArenaLifecycleDataSourceFactory,
  ArenaLifecycleRunner,
  ArenaLifecycleTiming,
} from "./arena-lifecycle.js";
import {
  ArenaLifecycleStoreError,
  type ArenaLifecycleStore,
} from "./lifecycle-store.js";
import {
  CheckpointExecutionAbortedError,
  createCheckpointOpeningEvents,
  executePreparedCheckpoint,
} from "./checkpoint-execution.js";

export interface CreateArenaLifecycleRunnerConfig {
  readonly store: ArenaLifecycleStore;
  readonly dataSourceFactory: ArenaLifecycleDataSourceFactory;
  readonly agents: Readonly<Record<ArenaAgentId, AgentAdapter>>;
  readonly runtimeMetadata: ArenaRuntimeMetadataV1;
  readonly timing: ArenaLifecycleTiming;
  readonly lease: Readonly<{
    ownerId: string;
    ttlMs: number;
    renewEveryMs: number;
  }>;
}

export type ArenaLifecycleRunnerErrorCode =
  | "ARENA_NOT_FOUND"
  | "BUSY"
  | "ABORTED";

export class ArenaLifecycleRunnerError extends Error {
  readonly code: ArenaLifecycleRunnerErrorCode;

  constructor(code: ArenaLifecycleRunnerErrorCode, message: string) {
    super(message);
    this.name = "ArenaLifecycleRunnerError";
    this.code = code;
  }
}

export function createArenaLifecycleRunner(
  config: CreateArenaLifecycleRunnerConfig,
): ArenaLifecycleRunner {
  const runtimeMetadata = arenaRuntimeMetadataV1Schema.parse(
    config.runtimeMetadata,
  );
  const activeRuns = new Map<string, Promise<ArenaRunStateV1>>();

  async function runArena(arenaId: string, callerSignal: AbortSignal) {
    if (callerSignal.aborted) {
      throw new ArenaLifecycleRunnerError("ABORTED", "Arena lifecycle run was aborted");
    }
    const leaseResult = await config.store.acquire(
      arenaId,
      config.lease.ownerId,
      config.timing.nowMs() + config.lease.ttlMs,
    );
    if (leaseResult === "NOT_FOUND") {
      throw new ArenaLifecycleRunnerError("ARENA_NOT_FOUND", "Arena was not found");
    }
    if (leaseResult === "BUSY") {
      throw new ArenaLifecycleRunnerError("BUSY", "Arena is already running");
    }
    const lease = leaseResult;
    const leaseController = new AbortController();
    const heartbeatController = new AbortController();
    const runSignal = AbortSignal.any([callerSignal, leaseController.signal]);
    let hasStickyLeaseFailure = false;
    let stickyLeaseFailure: unknown;
    let leaseOperationTail: Promise<void> = Promise.resolve();

    function rememberLeaseFailure(error: unknown): void {
      if (hasStickyLeaseFailure) return;
      hasStickyLeaseFailure = true;
      stickyLeaseFailure = error;
      leaseController.abort();
    }

    function runLeaseOperation<T>(
      operation: () => Promise<T>,
      allowAfterFailure = false,
    ): Promise<T> {
      const result = leaseOperationTail.then(async () => {
        if (!allowAfterFailure && hasStickyLeaseFailure) {
          throw stickyLeaseFailure;
        }
        return operation();
      });
      leaseOperationTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }

    function renewLease(expiresAtMs: number): Promise<void> {
      return runLeaseOperation(async () => {
        try {
          await lease.renew(expiresAtMs);
        } catch (error) {
          rememberLeaseFailure(error);
          throw error;
        }
      });
    }

    function commitLease(
      input: Parameters<typeof lease.commit>[0],
    ): Promise<ArenaRunStateV1> {
      return runLeaseOperation(async () => {
        try {
          return await lease.commit(input);
        } catch (error) {
          if (
            error instanceof ArenaLifecycleStoreError &&
            error.code === "LEASE_LOST"
          ) {
            rememberLeaseFailure(error);
          }
          throw error;
        }
      });
    }

    function releaseLease(): Promise<void> {
      return runLeaseOperation(() => lease.release(), true);
    }

    const heartbeat = (async () => {
      while (!heartbeatController.signal.aborted) {
        try {
          await config.timing.wait(
            config.lease.renewEveryMs,
            heartbeatController.signal,
          );
        } catch (error) {
          if (heartbeatController.signal.aborted) return;
          rememberLeaseFailure(error);
          return;
        }
        if (heartbeatController.signal.aborted) return;
        try {
          await renewLease(config.timing.nowMs() + config.lease.ttlMs);
        } catch {
          return;
        }
      }
    })();

    let primaryError: unknown;
    try {
      const persisted = await config.store.read(arenaId, 0);
      if (persisted === "NOT_FOUND") {
        throw new ArenaLifecycleRunnerError("ARENA_NOT_FOUND", "Arena was not found");
      }
      let state = persisted.state;
      if (state.phase === "COMPLETED") return state;
      const dataSource = config.dataSourceFactory(state.manifest);

      function requireActiveRun(): void {
        if (runSignal.aborted) throw new CheckpointExecutionAbortedError();
      }

      async function commitDurably(
        previousState: ArenaRunStateV1,
        input: Parameters<typeof lease.commit>[0],
      ): Promise<ArenaRunStateV1> {
        try {
          return await commitLease(input);
        } catch (commitError) {
          if (commitError instanceof ArenaLifecycleStoreError) {
            throw commitError;
          }

          let reloaded:
            | Awaited<ReturnType<typeof config.store.read>>
            | undefined;
          try {
            reloaded = await config.store.read(
              arenaId,
              previousState.lastEventSequence,
            );
          } catch {
            throw new ArenaLifecycleStoreError(
              "REVISION_CONFLICT",
              "Ambiguous arena lifecycle commit conflicts with durable state",
            );
          }
          if (
            reloaded !== "NOT_FOUND" &&
            isDeepStrictEqual(reloaded.state, input.nextState) &&
            isDeepStrictEqual(reloaded.events, input.appendEvents)
          ) {
            return reloaded.state;
          }
          if (
            reloaded !== "NOT_FOUND" &&
            isDeepStrictEqual(reloaded.state, previousState) &&
            reloaded.events.length === 0
          ) {
            throw commitError;
          }
          throw new ArenaLifecycleStoreError(
            "REVISION_CONFLICT",
            "Ambiguous arena lifecycle commit conflicts with durable state",
          );
        }
      }

      async function commitGlobalMiss(
        current: ArenaRunStateV1,
        checkpointId: (typeof DECISION_CHECKPOINT_IDS)[number],
        reason: string,
        snapshot?: ReturnType<typeof canonicalSnapshotSchema.parse>,
      ): Promise<ArenaRunStateV1> {
        const occurredAtUtc =
          snapshot?.observedAtUtc ?? new Date(config.timing.nowMs()).toISOString();
        const firstEventSequence = current.lastEventSequence + 1;
        const missedEvent = persistedArenaEventV1Schema.parse({
          eventId: `${arenaId}:${firstEventSequence}`,
          arenaId,
          sequence: firstEventSequence,
          type: "GLOBAL_MISSED_DECISION_ROUND",
          occurredAtUtc,
          checkpointId,
          publicPayload: { reason },
        });
        const completedRoundEvent = persistedArenaEventV1Schema.parse({
          eventId: `${arenaId}:${firstEventSequence + 1}`,
          arenaId,
          sequence: firstEventSequence + 1,
          type: "ROUND_COMPLETE",
          occurredAtUtc,
          checkpointId,
          publicPayload: {},
        });
        const completesDecisionRounds =
          current.checkpoints.length + 1 === DECISION_CHECKPOINT_IDS.length;
        const finalizingEvent = completesDecisionRounds
          ? persistedArenaEventV1Schema.parse({
              eventId: `${arenaId}:${firstEventSequence + 2}`,
              arenaId,
              sequence: firstEventSequence + 2,
              type: "FINALIZING",
              occurredAtUtc,
              checkpointId: "FINAL",
              publicPayload: {},
            })
          : undefined;
        return commitDurably(current, {
          nextState: {
            ...current,
            revision: current.revision + 1,
            phase: completesDecisionRounds ? "FINALIZING" : "RUNNING",
            checkpoints: [
              ...current.checkpoints,
              {
                checkpointId,
                outcome: "GLOBAL_MISSED",
                ...(snapshot === undefined ? {} : { snapshot }),
                revealedDecisions: {},
                failures: [{ scope: "GLOBAL", reason }],
                portfoliosBefore: current.portfolios,
                portfoliosAfter: current.portfolios,
                firstEventSequence,
                lastEventSequence: completedRoundEvent.sequence,
              },
            ],
            lastEventSequence:
              finalizingEvent?.sequence ?? completedRoundEvent.sequence,
          },
          appendEvents: [
            missedEvent,
            completedRoundEvent,
            ...(finalizingEvent === undefined ? [] : [finalizingEvent]),
          ],
        });
      }

      while (state.checkpoints.length < DECISION_CHECKPOINT_IDS.length) {
        requireActiveRun();
        if (state.pendingCheckpoint === undefined) {
          const checkpointId = DECISION_CHECKPOINT_IDS[state.checkpoints.length];
          if (checkpointId === undefined) break;
          let snapshot: ReturnType<typeof canonicalSnapshotSchema.parse>;
          try {
            await config.timing.waitForCheckpoint(
              state.manifest,
              checkpointId,
              runSignal,
            );
            requireActiveRun();
            await dataSource.prepare(checkpointId, runSignal);
            requireActiveRun();
            snapshot = canonicalSnapshotSchema.parse(
              dataSource.getSnapshot(checkpointId),
            );
            const previousSnapshots = state.checkpoints.flatMap((checkpoint) =>
              checkpoint.snapshot === undefined ? [] : [checkpoint.snapshot],
            );
            const expectedSource =
              state.manifest.mode === "LIVE" ? "TXLINE_LIVE" : "TXLINE_RECORDED";
            if (
              snapshot.arenaId !== state.manifest.arenaId ||
              snapshot.fixtureId !== state.manifest.fixtureId ||
              snapshot.checkpointId !== checkpointId ||
              snapshot.source !== expectedSource ||
              previousSnapshots.some(
                (previous) =>
                  previous.snapshotId === snapshot.snapshotId ||
                  previous.sourceEventId === snapshot.sourceEventId ||
                  previous.providerSequence >= snapshot.providerSequence,
              )
            ) {
              throw new Error("Invalid lifecycle snapshot");
            }
          } catch {
            if (runSignal.aborted) throw new CheckpointExecutionAbortedError();
            state = await commitGlobalMiss(
              state,
              checkpointId,
              "DATA_FAILURE",
            );
            continue;
          }
          if (snapshot.freshness.suspended) {
            state = await commitGlobalMiss(
              state,
              checkpointId,
              "SUSPENDED_SNAPSHOT",
              snapshot,
            );
            continue;
          }
          const openingEvents = createCheckpointOpeningEvents(
            snapshot,
            state.lastEventSequence,
          );
          requireActiveRun();
          state = await commitDurably(state, {
            nextState: {
              ...state,
              revision: state.revision + 1,
              phase: "RUNNING",
              pendingCheckpoint: { checkpointId, snapshot },
              lastEventSequence: openingEvents[1].sequence,
            },
            appendEvents: openingEvents,
          });
        }

        const pending = state.pendingCheckpoint;
        if (pending === undefined) continue;
        const portfoliosBefore = structuredClone(state.portfolios);
        const execution = await executePreparedCheckpoint({
          snapshot: pending.snapshot,
          portfolios: portfoliosBefore,
          agents: config.agents,
          timeoutMs: state.runtimeMetadata.agentTimeoutMs,
          startingBankrollMicros: state.manifest.startingBankrollMicros,
          initialEventSequence: state.lastEventSequence,
          signal: runSignal,
        });
        requireActiveRun();
        const lastEventSequence =
          execution.events.at(-1)?.sequence ?? state.lastEventSequence;
        const completesDecisionRounds =
          state.checkpoints.length + 1 === DECISION_CHECKPOINT_IDS.length;
        const finalizingEvent = completesDecisionRounds
          ? persistedArenaEventV1Schema.parse({
              eventId: `${arenaId}:${lastEventSequence + 1}`,
              arenaId,
              sequence: lastEventSequence + 1,
              type: "FINALIZING",
              occurredAtUtc: pending.snapshot.observedAtUtc,
              checkpointId: "FINAL",
              publicPayload: {},
            })
          : undefined;
        const { pendingCheckpoint: _pendingCheckpoint, ...withoutPending } = state;
        state = await commitDurably(state, {
          nextState: {
            ...withoutPending,
            revision: state.revision + 1,
            phase: completesDecisionRounds ? "FINALIZING" : "RUNNING",
            portfolios: execution.portfoliosAfter,
            checkpoints: [
              ...state.checkpoints,
              {
                checkpointId: pending.checkpointId,
                outcome: execution.outcome,
                snapshot: pending.snapshot,
                revealedDecisions: { ...execution.revealedDecisions },
                failures: [...execution.failures],
                portfoliosBefore,
                portfoliosAfter: execution.portfoliosAfter,
                firstEventSequence: state.lastEventSequence - 1,
                lastEventSequence,
              },
            ],
            lastEventSequence:
              finalizingEvent?.sequence ?? lastEventSequence,
          },
          appendEvents: [
            ...execution.events,
            ...(finalizingEvent === undefined ? [] : [finalizingEvent]),
          ],
        });
      }

      if (state.phase === "FINALIZING") {
        await config.timing.waitForCheckpoint(
          state.manifest,
          "FINAL",
          runSignal,
        );
        requireActiveRun();
        await dataSource.prepare("FINAL", runSignal);
        requireActiveRun();
        const winningAssetId = arenaAssetIdSchema.parse(
          dataSource.getFinalResult(),
        );
        const portfolios = {
          alpha: settlePortfolio(
            state.portfolios.alpha,
            winningAssetId,
            state.manifest.startingBankrollMicros,
          ),
          beta: settlePortfolio(
            state.portfolios.beta,
            winningAssetId,
            state.manifest.startingBankrollMicros,
          ),
        };
        const finalResultInput = {
          schemaVersion: 1 as const,
          arenaId,
          winningAssetId,
          winner: determineWinner(portfolios.alpha, portfolios.beta),
          alphaFinalNavMicros: portfolios.alpha.navMicros,
          betaFinalNavMicros: portfolios.beta.navMicros,
        };
        const finalResult = {
          ...finalResultInput,
          finalResultHash: calculateFinalResultHash(finalResultInput),
        };
        const completedEvent = persistedArenaEventV1Schema.parse({
          eventId: `${arenaId}:${state.lastEventSequence + 1}`,
          arenaId,
          sequence: state.lastEventSequence + 1,
          type: "COMPLETED",
          occurredAtUtc: new Date(config.timing.nowMs()).toISOString(),
          checkpointId: "FINAL",
          publicPayload: finalResult,
        });
        requireActiveRun();
        state = await commitDurably(state, {
          nextState: {
            ...state,
            revision: state.revision + 1,
            phase: "COMPLETED",
            portfolios,
            finalResult,
            lastEventSequence: completedEvent.sequence,
          },
          appendEvents: [completedEvent],
        });
        if (hasStickyLeaseFailure) throw stickyLeaseFailure;
      }
      if (hasStickyLeaseFailure) throw stickyLeaseFailure;
      return state;
    } catch (error) {
      primaryError =
        hasStickyLeaseFailure
          ? stickyLeaseFailure
          : callerSignal.aborted ||
              error instanceof CheckpointExecutionAbortedError
            ? new ArenaLifecycleRunnerError(
                "ABORTED",
                "Arena lifecycle run was aborted",
              )
            : error;
      throw primaryError;
    } finally {
      heartbeatController.abort();
      await heartbeat;
      const heartbeatFailed = hasStickyLeaseFailure;
      const heartbeatFailure = stickyLeaseFailure;
      try {
        await releaseLease();
      } catch (releaseError) {
        if (primaryError === undefined && !heartbeatFailed) {
          throw releaseError;
        }
      }
      if (heartbeatFailed) throw heartbeatFailure;
    }
  }

  return {
    async create(manifestInput) {
      const manifest = arenaManifestSchema.parse(manifestInput);
      const state: ArenaRunStateV1 = {
        schemaVersion: 1,
        revision: 0,
        manifest,
        runtimeMetadata,
        phase: "READY",
        portfolios: {
          alpha: initializePortfolio("alpha", manifest.startingBankrollMicros),
          beta: initializePortfolio("beta", manifest.startingBankrollMicros),
        },
        checkpoints: [],
        lastEventSequence: 1,
      };
      const readyEvent: PersistedArenaEventV1 = {
        eventId: `${manifest.arenaId}:1`,
        arenaId: manifest.arenaId,
        sequence: 1,
        type: "ARENA_READY",
        occurredAtUtc: manifest.createdAtUtc,
        publicPayload: {},
      };
      return config.store.initialize(state, [readyEvent]);
    },

    run(arenaId, signal) {
      const existing = activeRuns.get(arenaId);
      if (existing !== undefined) return existing;
      const run = runArena(arenaId, signal).finally(() => {
        if (activeRuns.get(arenaId) === run) activeRuns.delete(arenaId);
      });
      activeRuns.set(arenaId, run);
      return run;
    },
  };
}
