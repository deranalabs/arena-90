import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  DECISION_CHECKPOINT_IDS,
  arenaAgentIdSchema,
  arenaAssetIdSchema,
  moneyMicrosSchema,
  nonBlankStringSchema,
} from "./primitives.js";
import { arenaManifestSchema } from "./manifest.js";
import { agentDecisionSchema } from "./decision.js";
import { arenaEventSchema } from "./event.js";
import { portfolioStateSchema } from "./portfolio.js";
import { canonicalSnapshotSchema } from "./snapshot.js";
import { terminalEvidenceV1Schema } from "./terminal-evidence.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function isStrictJsonValue(
  value: unknown,
  ancestors = new WeakSet<object>(),
): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;

  const object = value;
  if (ancestors.has(object)) return false;
  ancestors.add(object);

  try {
    if (Array.isArray(object)) {
      const keys = Reflect.ownKeys(object);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(object, "length");
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.enumerable ||
        lengthDescriptor.configurable ||
        keys.length !== lengthDescriptor.value + 1
      ) {
        return false;
      }

      for (const key of keys) {
        if (key === "length") continue;
        if (typeof key !== "string") return false;

        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= lengthDescriptor.value ||
          String(index) !== key
        ) {
          return false;
        }

        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          !isStrictJsonValue(descriptor.value, ancestors)
        ) {
          return false;
        }
      }

      return true;
    }

    const prototype = Object.getPrototypeOf(object) as unknown;
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(object);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return false;
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        !isStrictJsonValue(descriptor.value, ancestors)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    ancestors.delete(object);
  }
}

export const jsonValueSchema = z.custom<JsonValue>(isStrictJsonValue, {
  message: "Value must be strict JSON data",
});

export const persistedArenaEventV1Schema = arenaEventSchema
  .extend({ publicPayload: jsonValueSchema })
  .strict();

export type PersistedArenaEventV1 = z.infer<
  typeof persistedArenaEventV1Schema
>;

const arenaWinnerSchema = z.union([arenaAgentIdSchema, z.literal("DRAW")]);

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const object = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key] as JsonValue)}`)
    .join(",")}}`;
}

export function calculatePreSettlementEventLogHash(
  events: readonly PersistedArenaEventV1[],
): string {
  const parsed = events.map((event) => persistedArenaEventV1Schema.parse(event));
  return createHash("sha256")
    .update(canonicalJson(parsed as JsonValue))
    .digest("hex");
}

const arenaFinalResultHashInputSchema = z
  .object({
    schemaVersion: z.literal(2),
    arenaId: nonBlankStringSchema,
    winnerRule: z.literal("FINAL_NAV_ONLY_V1"),
    winningAssetId: arenaAssetIdSchema,
    winner: arenaWinnerSchema,
    alphaFinalNavMicros: moneyMicrosSchema,
    betaFinalNavMicros: moneyMicrosSchema,
    terminalEvidence: terminalEvidenceV1Schema,
    completedEventSequence: z.number().int().positive().safe(),
    preSettlementEventLogHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type ArenaFinalResultHashInput = z.infer<
  typeof arenaFinalResultHashInputSchema
>;

function hashFinalResult(input: ArenaFinalResultHashInput): string {
  const canonicalJson = JSON.stringify({
    schemaVersion: input.schemaVersion,
    arenaId: input.arenaId,
    winnerRule: input.winnerRule,
    winningAssetId: input.winningAssetId,
    winner: input.winner,
    alphaFinalNavMicros: input.alphaFinalNavMicros,
    betaFinalNavMicros: input.betaFinalNavMicros,
    terminalEvidence: input.terminalEvidence,
    completedEventSequence: input.completedEventSequence,
    preSettlementEventLogHash: input.preSettlementEventLogHash,
  });

  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function calculateFinalResultHash(
  input: ArenaFinalResultHashInput,
): string {
  return hashFinalResult(arenaFinalResultHashInputSchema.parse(input));
}

export const arenaFinalResultV2Schema = arenaFinalResultHashInputSchema
  .extend({
    finalResultHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .superRefine((result, context) => {
    const alphaNav = BigInt(result.alphaFinalNavMicros);
    const betaNav = BigInt(result.betaFinalNavMicros);
    const expectedWinner =
      alphaNav > betaNav ? "alpha" : betaNav > alphaNav ? "beta" : "DRAW";

    if (result.winner !== expectedWinner) {
      context.addIssue({
        code: "custom",
        path: ["winner"],
        message: "Winner must follow FINAL_NAV_ONLY_V1",
      });
    }

    if (
      result.terminalEvidence.arenaId !== result.arenaId ||
      result.terminalEvidence.winningAssetId !== result.winningAssetId
    ) {
      context.addIssue({
        code: "custom",
        path: ["terminalEvidence"],
        message: "Terminal evidence must match the final result",
      });
    }

    const { finalResultHash, ...hashInput } = result;
    if (finalResultHash !== hashFinalResult(hashInput)) {
      context.addIssue({
        code: "custom",
        path: ["finalResultHash"],
        message: "finalResultHash does not match the canonical final result",
      });
    }
  });

export type ArenaFinalResultV2 = z.infer<typeof arenaFinalResultV2Schema>;

const runtimeComponentSchema = z
  .object({
    adapterId: nonBlankStringSchema,
    adapterVersion: nonBlankStringSchema,
    strategyId: nonBlankStringSchema,
    strategyVersion: nonBlankStringSchema,
  })
  .strict();

export const arenaRuntimeMetadataV1Schema = z
  .object({
    runtimeId: nonBlankStringSchema,
    runtimeVersion: nonBlankStringSchema,
    executionRuleVersion: nonBlankStringSchema,
    winnerRuleVersion: z.literal("FINAL_NAV_ONLY_V1"),
    agentTimeoutMs: z.number().int().positive().safe(),
    agents: z
      .object({
        alpha: runtimeComponentSchema,
        beta: runtimeComponentSchema,
      })
      .strict(),
  })
  .strict();

export type ArenaRuntimeMetadataV1 = z.infer<
  typeof arenaRuntimeMetadataV1Schema
>;

export const preparedCheckpointV1Schema = z
  .object({
    checkpointId: canonicalSnapshotSchema.shape.checkpointId,
    snapshot: canonicalSnapshotSchema,
  })
  .strict()
  .superRefine((prepared, context) => {
    if (prepared.snapshot.checkpointId !== prepared.checkpointId) {
      context.addIssue({
        code: "custom",
        path: ["snapshot", "checkpointId"],
        message: "Prepared snapshot must match its checkpoint",
      });
    }
  });

export type PreparedCheckpointV1 = z.infer<
  typeof preparedCheckpointV1Schema
>;

export const checkpointFailureV1Schema = z.discriminatedUnion("scope", [
  z
    .object({
      scope: z.literal("GLOBAL"),
      reason: nonBlankStringSchema,
    })
    .strict(),
  z
    .object({
      scope: z.literal("AGENT"),
      agentId: arenaAgentIdSchema,
      reason: nonBlankStringSchema,
    })
    .strict(),
]);

const checkpointPortfoliosSchema = z
  .object({
    alpha: portfolioStateSchema,
    beta: portfolioStateSchema,
  })
  .strict();

export const decisionCheckpointCommitV1Schema = z
  .object({
    checkpointId: canonicalSnapshotSchema.shape.checkpointId,
    outcome: z.enum(["REVEALED", "GLOBAL_MISSED"]),
    snapshot: canonicalSnapshotSchema.optional(),
    revealedDecisions: z
      .object({
        alpha: agentDecisionSchema.optional(),
        beta: agentDecisionSchema.optional(),
      })
      .strict(),
    failures: z.array(checkpointFailureV1Schema),
    portfoliosBefore: checkpointPortfoliosSchema,
    portfoliosAfter: checkpointPortfoliosSchema,
    firstEventSequence: z.number().int().positive().safe(),
    lastEventSequence: z.number().int().positive().safe(),
  })
  .strict()
  .superRefine((checkpoint, context) => {
    if (checkpoint.lastEventSequence < checkpoint.firstEventSequence) {
      context.addIssue({
        code: "custom",
        path: ["lastEventSequence"],
        message: "Checkpoint event sequence range is invalid",
      });
    }

    if (
      checkpoint.snapshot !== undefined &&
      checkpoint.snapshot.checkpointId !== checkpoint.checkpointId
    ) {
      context.addIssue({
        code: "custom",
        path: ["snapshot", "checkpointId"],
        message: "Checkpoint snapshot identity does not match",
      });
    }

    for (const agentId of ["alpha", "beta"] as const) {
      const decision = checkpoint.revealedDecisions[agentId];
      if (
        decision !== undefined &&
        (checkpoint.snapshot === undefined ||
          decision.agentId !== agentId ||
          decision.arenaId !== checkpoint.snapshot.arenaId ||
          decision.snapshotId !== checkpoint.snapshot.snapshotId ||
          decision.checkpointId !== checkpoint.checkpointId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["revealedDecisions", agentId],
          message: "Revealed decision identity does not match its checkpoint",
        });
      }
    }

    if (checkpoint.outcome === "GLOBAL_MISSED") {
      if (
        checkpoint.revealedDecisions.alpha !== undefined ||
        checkpoint.revealedDecisions.beta !== undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["revealedDecisions"],
          message: "Global missed checkpoints cannot reveal decisions",
        });
      }
      if (!checkpoint.failures.some((failure) => failure.scope === "GLOBAL")) {
        context.addIssue({
          code: "custom",
          path: ["failures"],
          message: "Global missed checkpoints require a global failure",
        });
      }
      if (
        !isDeepStrictEqual(
          checkpoint.portfoliosBefore,
          checkpoint.portfoliosAfter,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["portfoliosAfter"],
          message: "Global missed checkpoints must preserve both portfolios",
        });
      }
    } else if (checkpoint.snapshot === undefined) {
      context.addIssue({
        code: "custom",
        path: ["snapshot"],
        message: "Revealed checkpoints require a canonical snapshot",
      });
    }
  });

export type CheckpointFailureV1 = z.infer<typeof checkpointFailureV1Schema>;
export type DecisionCheckpointCommitV1 = z.infer<
  typeof decisionCheckpointCommitV1Schema
>;

export const arenaRunStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative().safe(),
    manifest: arenaManifestSchema,
    runtimeMetadata: arenaRuntimeMetadataV1Schema,
    phase: z.enum(["READY", "RUNNING", "FINALIZING", "COMPLETED"]),
    portfolios: checkpointPortfoliosSchema,
    checkpoints: z.array(decisionCheckpointCommitV1Schema).max(6),
    pendingCheckpoint: preparedCheckpointV1Schema.optional(),
    finalResult: arenaFinalResultV2Schema.optional(),
    lastEventSequence: z.number().int().nonnegative().safe(),
  })
  .strict()
  .superRefine((state, context) => {
    const expectedInitialPortfolios = {
      alpha: {
        agentId: "alpha" as const,
        cashMicros: state.manifest.startingBankrollMicros,
        unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
        navMicros: state.manifest.startingBankrollMicros,
        returnBps: 0,
        updatedAtCheckpoint: "KICKOFF" as const,
      },
      beta: {
        agentId: "beta" as const,
        cashMicros: state.manifest.startingBankrollMicros,
        unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
        navMicros: state.manifest.startingBankrollMicros,
        returnBps: 0,
        updatedAtCheckpoint: "KICKOFF" as const,
      },
    };

    if (
      state.checkpoints.length === 0 &&
      !isDeepStrictEqual(state.portfolios, expectedInitialPortfolios)
    ) {
      context.addIssue({
        code: "custom",
        path: ["portfolios"],
        message: "Initial portfolios must equal the manifest bankroll",
      });
    }

    const firstCheckpoint = state.checkpoints[0];
    if (
      firstCheckpoint !== undefined &&
      !isDeepStrictEqual(
        firstCheckpoint.portfoliosBefore,
        expectedInitialPortfolios,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkpoints", 0, "portfoliosBefore"],
        message: "First checkpoint must start from the manifest bankroll",
      });
    }

    if (state.portfolios.alpha.agentId !== "alpha") {
      context.addIssue({
        code: "custom",
        path: ["portfolios", "alpha", "agentId"],
        message: "Alpha portfolio must belong to alpha",
      });
    }
    if (state.portfolios.beta.agentId !== "beta") {
      context.addIssue({
        code: "custom",
        path: ["portfolios", "beta", "agentId"],
        message: "Beta portfolio must belong to beta",
      });
    }

    if (
      state.phase === "READY" &&
      (state.pendingCheckpoint !== undefined ||
        state.checkpoints.length !== 0 ||
        state.finalResult !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "READY state cannot contain lifecycle progress",
      });
    }

    if (
      state.phase === "RUNNING" &&
      state.pendingCheckpoint === undefined &&
      state.checkpoints.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["pendingCheckpoint"],
        message: "RUNNING state requires pending work before the first commit",
      });
    }

    if (
      state.phase === "RUNNING" &&
      (state.checkpoints.length >= 6 || state.finalResult !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "RUNNING state must precede terminal settlement",
      });
    }

    if (
      state.phase === "FINALIZING" &&
      (state.checkpoints.length !== 6 ||
        state.pendingCheckpoint !== undefined ||
        state.finalResult !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "FINALIZING requires all decision checkpoints and no result",
      });
    }

    if (
      state.phase === "COMPLETED" &&
      (state.checkpoints.length !== 6 ||
        state.pendingCheckpoint !== undefined ||
        state.finalResult === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "COMPLETED requires all checkpoints and a final result",
      });
    }

    if (state.pendingCheckpoint !== undefined) {
      const pending = state.pendingCheckpoint;
      const expectedCheckpoint = DECISION_CHECKPOINT_IDS[state.checkpoints.length];
      if (pending.checkpointId !== expectedCheckpoint) {
        context.addIssue({
          code: "custom",
          path: ["pendingCheckpoint", "checkpointId"],
          message: "Pending checkpoint must be the next approved checkpoint",
        });
      }
      if (
        pending.snapshot.arenaId !== state.manifest.arenaId ||
        pending.snapshot.fixtureId !== state.manifest.fixtureId
      ) {
        context.addIssue({
          code: "custom",
          path: ["pendingCheckpoint", "snapshot"],
          message: "Pending snapshot must match the locked arena and fixture",
        });
      }
      const expectedSource =
        state.manifest.mode === "LIVE" ? "TXLINE_LIVE" : "TXLINE_RECORDED";
      if (pending.snapshot.source !== expectedSource) {
        context.addIssue({
          code: "custom",
          path: ["pendingCheckpoint", "snapshot", "source"],
          message: "Pending snapshot source must match the arena mode",
        });
      }
    }

    state.checkpoints.forEach((checkpoint, index) => {
      const expectedCheckpoint = DECISION_CHECKPOINT_IDS[index];
      if (checkpoint.checkpointId !== expectedCheckpoint) {
        context.addIssue({
          code: "custom",
          path: ["checkpoints", index, "checkpointId"],
          message: "Committed checkpoints must form the approved prefix",
        });
      }
      const previousCheckpoint = state.checkpoints[index - 1];
      if (
        previousCheckpoint !== undefined &&
        !isDeepStrictEqual(
          previousCheckpoint.portfoliosAfter,
          checkpoint.portfoliosBefore,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["checkpoints", index, "portfoliosBefore"],
          message: "Checkpoint portfolios must continue from the prior commit",
        });
      }
    });

    const snapshotIds = new Set<string>();
    const sourceEventIds = new Set<string>();
    let previousProviderSequence = 0;
    const expectedSource =
      state.manifest.mode === "LIVE" ? "TXLINE_LIVE" : "TXLINE_RECORDED";

    for (const [index, checkpoint] of state.checkpoints.entries()) {
      const snapshot = checkpoint.snapshot;
      if (snapshot === undefined) continue;

      if (
        snapshot.arenaId !== state.manifest.arenaId ||
        snapshot.fixtureId !== state.manifest.fixtureId ||
        snapshot.source !== expectedSource
      ) {
        context.addIssue({
          code: "custom",
          path: ["checkpoints", index, "snapshot"],
          message: "Checkpoint snapshot must match the locked arena",
        });
      }
      if (
        snapshotIds.has(snapshot.snapshotId) ||
        sourceEventIds.has(snapshot.sourceEventId) ||
        snapshot.providerSequence <= previousProviderSequence
      ) {
        context.addIssue({
          code: "custom",
          path: ["checkpoints", index, "snapshot"],
          message: "Checkpoint snapshot identities must be unique and ordered",
        });
      }
      snapshotIds.add(snapshot.snapshotId);
      sourceEventIds.add(snapshot.sourceEventId);
      previousProviderSequence = snapshot.providerSequence;
    }

    if (state.pendingCheckpoint !== undefined) {
      const snapshot = state.pendingCheckpoint.snapshot;
      if (
        snapshotIds.has(snapshot.snapshotId) ||
        sourceEventIds.has(snapshot.sourceEventId) ||
        snapshot.providerSequence <= previousProviderSequence
      ) {
        context.addIssue({
          code: "custom",
          path: ["pendingCheckpoint", "snapshot"],
          message: "Pending snapshot identity must follow committed snapshots",
        });
      }
    }

    const lastCheckpoint = state.checkpoints.at(-1);
    if (
      lastCheckpoint !== undefined &&
      state.phase !== "COMPLETED" &&
      !isDeepStrictEqual(state.portfolios, lastCheckpoint.portfoliosAfter)
    ) {
      context.addIssue({
        code: "custom",
        path: ["portfolios"],
        message: "Current portfolios must match the latest checkpoint commit",
      });
    }

    if (state.finalResult !== undefined) {
      if (state.finalResult.arenaId !== state.manifest.arenaId) {
        context.addIssue({
          code: "custom",
          path: ["finalResult", "arenaId"],
          message: "Final result must match the locked arena",
        });
      }
      if (
        state.portfolios.alpha.updatedAtCheckpoint !== "FINAL" ||
        state.portfolios.beta.updatedAtCheckpoint !== "FINAL" ||
        state.portfolios.alpha.navMicros !==
          state.finalResult.alphaFinalNavMicros ||
        state.portfolios.beta.navMicros !== state.finalResult.betaFinalNavMicros
      ) {
        context.addIssue({
          code: "custom",
          path: ["portfolios"],
          message: "Settled portfolios must match the final result NAV values",
        });
      }
      const terminalEvidence = state.finalResult.terminalEvidence;
      const expectedTerminalSource =
        state.manifest.mode === "LIVE" ? "TXLINE_LIVE" : "TXLINE_RECORDED";
      const lastSnapshot = state.checkpoints
        .map(({ snapshot }) => snapshot)
        .filter((snapshot) => snapshot !== undefined)
        .at(-1);
      if (
        terminalEvidence.fixtureId !== state.manifest.fixtureId ||
        terminalEvidence.source !== expectedTerminalSource ||
        (lastSnapshot !== undefined &&
          (terminalEvidence.providerSequence <= lastSnapshot.providerSequence ||
            terminalEvidence.sourceEventId === lastSnapshot.sourceEventId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["finalResult", "terminalEvidence"],
          message: "Terminal evidence must follow the locked arena snapshots",
        });
      }
      if (state.finalResult.completedEventSequence !== state.lastEventSequence) {
        context.addIssue({
          code: "custom",
          path: ["finalResult", "completedEventSequence"],
          message: "Final result must bind the terminal event sequence",
        });
      }
    }
  });

export type ArenaRunStateV1 = z.infer<typeof arenaRunStateV1Schema>;

const EVENT_HISTORY_INTEGRITY_MESSAGE =
  "Persisted event history must be ordered and complete";
const EVENT_RANGE_INTEGRITY_MESSAGE =
  "Checkpoint event ranges must match persisted history";

export const arenaLifecyclePersistenceV1Schema = z
  .object({
    state: arenaRunStateV1Schema,
    events: z.array(persistedArenaEventV1Schema),
  })
  .strict()
  .superRefine((persistence, context) => {
    const { state, events } = persistence;
    events.forEach((event, index) => {
      if (
        event.arenaId !== state.manifest.arenaId ||
        event.sequence !== index + 1
      ) {
        context.addIssue({
          code: "custom",
          path: ["events", index],
          message: EVENT_HISTORY_INTEGRITY_MESSAGE,
        });
      }
    });
    if (state.lastEventSequence !== events.length) {
      context.addIssue({
        code: "custom",
        path: ["state", "lastEventSequence"],
        message: EVENT_HISTORY_INTEGRITY_MESSAGE,
      });
    }

    let previousRangeEnd: number | undefined;
    state.checkpoints.forEach((checkpoint, checkpointIndex) => {
      const { firstEventSequence, lastEventSequence, checkpointId } = checkpoint;
      const rangeEvents = events.filter(
        (event) =>
          event.sequence >= firstEventSequence &&
          event.sequence <= lastEventSequence,
      );
      const allCheckpointEvents = events.filter(
        (event) => event.checkpointId === checkpointId,
      );
      const expectedRangeLength = lastEventSequence - firstEventSequence + 1;
      const rangeIsContiguous =
        previousRangeEnd === undefined ||
        firstEventSequence === previousRangeEnd + 1;
      const rangeIsBound =
        firstEventSequence >= 1 &&
        lastEventSequence <= state.lastEventSequence &&
        expectedRangeLength > 0 &&
        rangeEvents.length === expectedRangeLength &&
        rangeEvents.every((event) => event.checkpointId === checkpointId) &&
        allCheckpointEvents.length === expectedRangeLength &&
        allCheckpointEvents[0]?.sequence === firstEventSequence &&
        allCheckpointEvents.at(-1)?.sequence === lastEventSequence;

      if (!rangeIsContiguous || !rangeIsBound) {
        context.addIssue({
          code: "custom",
          path: ["state", "checkpoints", checkpointIndex],
          message: EVENT_RANGE_INTEGRITY_MESSAGE,
        });
      }
      previousRangeEnd = lastEventSequence;
    });

    const completedEvents = events.filter((event) => event.type === "COMPLETED");
    if (state.phase === "COMPLETED" && state.finalResult !== undefined) {
      const completedEvent = completedEvents[0];
      if (
        completedEvents.length !== 1 ||
        completedEvent?.sequence !== state.lastEventSequence ||
        completedEvent.checkpointId !== "FINAL" ||
        !isDeepStrictEqual(completedEvent.publicPayload, state.finalResult)
      ) {
        context.addIssue({
          code: "custom",
          path: ["events"],
          message: "Completed state requires one matching terminal event",
        });
      }
      if (
        state.finalResult.preSettlementEventLogHash !==
        calculatePreSettlementEventLogHash(events.slice(0, -1))
      ) {
        context.addIssue({
          code: "custom",
          path: ["state", "finalResult", "preSettlementEventLogHash"],
          message: "Final result must bind the pre-settlement event log",
        });
      }
    } else if (completedEvents.length !== 0) {
      context.addIssue({
        code: "custom",
        path: ["events"],
        message: "Non-completed state cannot contain a terminal event",
      });
    }
  });

export type ArenaLifecyclePersistenceV1 = z.infer<
  typeof arenaLifecyclePersistenceV1Schema
>;
