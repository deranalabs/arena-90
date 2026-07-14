import { z } from "zod";

import {
  arenaAgentIdSchema,
  arenaAssetIdSchema,
  arenaModeSchema,
  checkpointIdSchema,
  decisionCheckpointIdSchema,
  moneyMicrosSchema,
  nonBlankStringSchema,
  positiveIntegerStringSchema,
  unitMicrosSchema,
  utcDateTimeSchema,
} from "../contracts/index.js";

const publicTeamV1Schema = z
  .object({
    name: nonBlankStringSchema,
    code: nonBlankStringSchema,
  })
  .strict();

const publicAssetV1Schema = z
  .object({
    id: arenaAssetIdSchema,
    market: z.literal("FULL_TIME_1X2"),
    label: nonBlankStringSchema,
  })
  .strict();

/**
 * Future HTTP composition must require this manifest to match the exact
 * configured Replay recording or Live fixture binding, not mode alone.
 */
export const publicManifestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    mode: arenaModeSchema,
    competition: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    homeTeam: publicTeamV1Schema,
    awayTeam: publicTeamV1Schema,
    kickoffUtc: utcDateTimeSchema,
    startingBankrollMicros: positiveIntegerStringSchema,
    currency: z.literal("VIRTUAL_USD_MICROS"),
    assets: z.array(publicAssetV1Schema),
    checkpoints: z.array(checkpointIdSchema),
    createdAtUtc: utcDateTimeSchema,
  })
  .strict();

export type PublicManifestV1 = z.infer<typeof publicManifestV1Schema>;

const publicPriceMicrosV1Schema = z
  .object({
    HOME: z.number().int().min(1).max(999_999),
    DRAW: z.number().int().min(1).max(999_999),
    AWAY: z.number().int().min(1).max(999_999),
  })
  .strict()
  .refine(
    (prices) => prices.HOME + prices.DRAW + prices.AWAY === 1_000_000,
    { message: "Public prices must sum to 1000000" },
  );

export const publicSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    snapshotId: nonBlankStringSchema,
    snapshotHash: z.string().regex(/^[0-9a-f]{64}$/),
    arenaId: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    checkpointId: decisionCheckpointIdSchema,
    observedAtUtc: utcDateTimeSchema,
    source: z.enum(["TXLINE_RECORDED", "TXLINE_LIVE"]),
    match: z
      .object({
        status: z.enum(["SCHEDULED", "LIVE", "HALFTIME", "FINISHED"]),
        minute: z.number().int().nonnegative(),
        addedTime: z.number().int().nonnegative(),
        homeScore: z.number().int().nonnegative(),
        awayScore: z.number().int().nonnegative(),
      })
      .strict(),
    priceMicros: publicPriceMicrosV1Schema,
    freshness: z
      .object({
        marketUpdatedAtUtc: utcDateTimeSchema,
        delayed: z.boolean(),
        suspended: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const publicPortfolioV1Schema = z
  .object({
    agentId: arenaAgentIdSchema,
    cashMicros: moneyMicrosSchema,
    unitMicros: z
      .object({
        HOME: unitMicrosSchema,
        DRAW: unitMicrosSchema,
        AWAY: unitMicrosSchema,
      })
      .strict(),
    navMicros: moneyMicrosSchema,
    returnBps: z.number().int(),
    updatedAtCheckpoint: checkpointIdSchema,
  })
  .strict();

const publicAllocationBpsV1Schema = z
  .object({
    cash: z.number().int().min(0).max(10_000),
    HOME: z.number().int().min(0).max(10_000),
    DRAW: z.number().int().min(0).max(10_000),
    AWAY: z.number().int().min(0).max(10_000),
  })
  .strict()
  .refine(
    (allocation) =>
      allocation.cash +
        allocation.HOME +
        allocation.DRAW +
        allocation.AWAY ===
      10_000,
    { message: "Public allocations must sum to 10000" },
  );

const publicDecisionIdentityShape = {
  schemaVersion: z.literal(1),
  arenaId: nonBlankStringSchema,
  snapshotId: nonBlankStringSchema,
  checkpointId: decisionCheckpointIdSchema,
  agentId: arenaAgentIdSchema,
  publicExplanation: nonBlankStringSchema,
} as const;

export const publicDecisionV1Schema = z.discriminatedUnion("action", [
  z
    .object({
      ...publicDecisionIdentityShape,
      action: z.literal("NO_TRADE"),
    })
    .strict(),
  z
    .object({
      ...publicDecisionIdentityShape,
      action: z.literal("TARGET_ALLOCATION"),
      targetAllocationBps: publicAllocationBpsV1Schema,
    })
    .strict(),
]);

export const publicAgentFailureReasonV1Schema = z.enum([
  "TIMEOUT",
  "PROCESS_FAILURE",
  "MISSING_OUTPUT",
  "INVALID_OUTPUT",
]);

export const publicGlobalFailureReasonV1Schema = z.enum([
  "DATA_UNAVAILABLE",
  "SUSPENDED_MARKET",
]);

export const publicFailureV1Schema = z.discriminatedUnion("scope", [
  z
    .object({
      scope: z.literal("AGENT"),
      agentId: arenaAgentIdSchema,
      reason: publicAgentFailureReasonV1Schema,
    })
    .strict(),
  z
    .object({
      scope: z.literal("GLOBAL"),
      reason: publicGlobalFailureReasonV1Schema,
    })
    .strict(),
]);

const publicAgentPortfoliosV1Schema = z
  .object({
    alpha: publicPortfolioV1Schema,
    beta: publicPortfolioV1Schema,
  })
  .strict();

const publicRevealedDecisionsV1Schema = z
  .object({
    alpha: publicDecisionV1Schema.optional(),
    beta: publicDecisionV1Schema.optional(),
  })
  .strict();

export const publicCheckpointV1Schema = z
  .object({
    checkpointId: decisionCheckpointIdSchema,
    outcome: z.enum(["REVEALED", "GLOBAL_MISSED"]),
    snapshot: publicSnapshotV1Schema.optional(),
    revealedDecisions: publicRevealedDecisionsV1Schema,
    failures: z.array(publicFailureV1Schema),
    portfoliosBefore: publicAgentPortfoliosV1Schema,
    portfoliosAfter: publicAgentPortfoliosV1Schema,
    firstEventSequence: z.number().int().positive().safe(),
    lastEventSequence: z.number().int().positive().safe(),
  })
  .strict()
  .refine(
    (checkpoint) =>
      checkpoint.lastEventSequence >= checkpoint.firstEventSequence,
    { message: "Public checkpoint event range is invalid" },
  );

export const publicFinalResultV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    winningAssetId: arenaAssetIdSchema,
    winner: z.union([arenaAgentIdSchema, z.literal("DRAW")]),
    alphaFinalNavMicros: moneyMicrosSchema,
    betaFinalNavMicros: moneyMicrosSchema,
    finalResultHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const publicStrategyVersionV1Schema = z
  .object({
    strategyId: nonBlankStringSchema,
    strategyVersion: nonBlankStringSchema,
  })
  .strict();

export const publicRuntimeVersionsV1Schema = z
  .object({
    runtimeVersion: nonBlankStringSchema,
    executionRuleVersion: nonBlankStringSchema,
    winnerRuleVersion: nonBlankStringSchema,
    agents: z
      .object({
        alpha: publicStrategyVersionV1Schema,
        beta: publicStrategyVersionV1Schema,
      })
      .strict(),
  })
  .strict();

export const publicArenaStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    manifest: publicManifestV1Schema,
    phase: z.enum(["READY", "RUNNING", "FINALIZING", "COMPLETED"]),
    runtimeVersions: publicRuntimeVersionsV1Schema,
    currentSnapshot: publicSnapshotV1Schema.optional(),
    portfolios: publicAgentPortfoliosV1Schema,
    checkpoints: z.array(publicCheckpointV1Schema).max(6),
    nextCheckpointId: checkpointIdSchema.optional(),
    leader: z
      .object({
        result: z.union([arenaAgentIdSchema, z.literal("DRAW")]),
        provisional: z.boolean(),
      })
      .strict(),
    finalResult: publicFinalResultV1Schema.optional(),
    lastEventSequence: z.number().int().nonnegative().safe(),
  })
  .strict();

const publicEventBaseShape = {
  schemaVersion: z.literal(1),
  eventId: nonBlankStringSchema,
  arenaId: nonBlankStringSchema,
  sequence: z.number().int().positive().safe(),
  occurredAtUtc: utcDateTimeSchema,
} as const;

const emptyPayloadV1Schema = z.object({}).strict();

export const publicArenaEventV1Schema = z.discriminatedUnion("type", [
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("ARENA_READY"),
      payload: emptyPayloadV1Schema,
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("CHECKPOINT_OPENED"),
      checkpointId: decisionCheckpointIdSchema,
      payload: z.object({ snapshot: publicSnapshotV1Schema }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("AGENTS_ANALYZING"),
      checkpointId: decisionCheckpointIdSchema,
      payload: emptyPayloadV1Schema,
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("DECISION_RECEIVED"),
      checkpointId: decisionCheckpointIdSchema,
      agentId: arenaAgentIdSchema,
      payload: z.object({ status: z.literal("RECEIVED") }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("RECHECKING_DECISION"),
      checkpointId: decisionCheckpointIdSchema,
      agentId: arenaAgentIdSchema,
      payload: z.object({ attempt: z.literal(1) }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("MISSED_DECISION_ROUND"),
      checkpointId: decisionCheckpointIdSchema,
      agentId: arenaAgentIdSchema,
      payload: z.object({ reason: publicAgentFailureReasonV1Schema }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("GLOBAL_MISSED_DECISION_ROUND"),
      checkpointId: decisionCheckpointIdSchema,
      payload: z.object({ reason: publicGlobalFailureReasonV1Schema }).strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("ROUND_REVEALED"),
      checkpointId: decisionCheckpointIdSchema,
      payload: z
        .object({
          decisions: publicRevealedDecisionsV1Schema,
          failures: z.array(publicFailureV1Schema),
          portfoliosBefore: publicAgentPortfoliosV1Schema,
          portfoliosAfter: publicAgentPortfoliosV1Schema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("ROUND_COMPLETE"),
      checkpointId: decisionCheckpointIdSchema,
      payload: z
        .object({
          portfolios: publicAgentPortfoliosV1Schema,
          nextCheckpointId: checkpointIdSchema.optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("FINALIZING"),
      checkpointId: z.literal("FINAL"),
      payload: emptyPayloadV1Schema,
    })
    .strict(),
  z
    .object({
      ...publicEventBaseShape,
      type: z.literal("COMPLETED"),
      checkpointId: z.literal("FINAL"),
      payload: z
        .object({
          result: publicFinalResultV1Schema,
          portfolios: publicAgentPortfoliosV1Schema,
        })
        .strict(),
    })
    .strict(),
]);

export const publicEventHistoryV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    afterSequence: z.number().int().nonnegative().safe(),
    lastEventSequence: z.number().int().nonnegative().safe(),
    events: z.array(publicArenaEventV1Schema),
  })
  .strict()
  .superRefine((history, context) => {
    history.events.forEach((event, index) => {
      if (
        event.arenaId !== history.arenaId ||
        event.sequence !== history.afterSequence + index + 1 ||
        event.sequence > history.lastEventSequence
      ) {
        context.addIssue({
          code: "custom",
          path: ["events", index],
          message: "Public event history must be contiguous and arena-bound",
        });
      }
    });
  });

export const publicApiErrorCodeV1Schema = z.enum([
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "ARENA_NOT_FOUND",
  "ARENA_CONFLICT",
  "ARENA_CAPACITY_REACHED",
  "INVALID_EVENT_CURSOR",
  "EVENT_CURSOR_AHEAD",
  "MODE_NOT_CONFIGURED",
  "NOT_READY",
  "INTERNAL_ERROR",
]);

export const publicApiErrorEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    error: z
      .object({
        code: publicApiErrorCodeV1Schema,
        message: nonBlankStringSchema,
      })
      .strict(),
  })
  .strict();

export type PublicSnapshotV1 = z.infer<typeof publicSnapshotV1Schema>;
export type PublicPortfolioV1 = z.infer<typeof publicPortfolioV1Schema>;
export type PublicDecisionV1 = z.infer<typeof publicDecisionV1Schema>;
export type PublicAgentFailureReasonV1 = z.infer<
  typeof publicAgentFailureReasonV1Schema
>;
export type PublicGlobalFailureReasonV1 = z.infer<
  typeof publicGlobalFailureReasonV1Schema
>;
export type PublicFailureV1 = z.infer<typeof publicFailureV1Schema>;
export type PublicCheckpointV1 = z.infer<typeof publicCheckpointV1Schema>;
export type PublicFinalResultV1 = z.infer<typeof publicFinalResultV1Schema>;
export type PublicArenaStateV1 = z.infer<typeof publicArenaStateV1Schema>;
export type PublicArenaEventV1 = z.infer<typeof publicArenaEventV1Schema>;
export type PublicEventHistoryV1 = z.infer<typeof publicEventHistoryV1Schema>;
export type PublicApiErrorEnvelopeV1 = z.infer<
  typeof publicApiErrorEnvelopeV1Schema
>;
export type PublicApiErrorCodeV1 = z.infer<
  typeof publicApiErrorCodeV1Schema
>;
