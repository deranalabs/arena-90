import { z } from "zod";

import {
  arenaAgentIdSchema,
  checkpointIdSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
} from "./primitives.js";

export const MINIMUM_ARENA_EVENT_TYPES = [
  "ARENA_READY",
  "CHECKPOINT_OPENED",
  "AGENTS_ANALYZING",
  "DECISION_RECEIVED",
  "RECHECKING_DECISION",
  "MISSED_DECISION_ROUND",
  "GLOBAL_MISSED_DECISION_ROUND",
  "ROUND_REVEALED",
  "ROUND_COMPLETE",
  "FINALIZING",
  "COMPLETED",
] as const;

export const minimumArenaEventTypeSchema = z.enum(MINIMUM_ARENA_EVENT_TYPES);

export const arenaEventSchema = z
  .object({
    eventId: nonBlankStringSchema,
    arenaId: nonBlankStringSchema,
    sequence: z.number().int().nonnegative(),
    type: nonBlankStringSchema,
    occurredAtUtc: utcDateTimeSchema,
    checkpointId: checkpointIdSchema.optional(),
    agentId: arenaAgentIdSchema.optional(),
    publicPayload: z.unknown(),
  })
  .strict();

export type MinimumArenaEventType = z.infer<typeof minimumArenaEventTypeSchema>;
export type ArenaEvent = z.infer<typeof arenaEventSchema>;
