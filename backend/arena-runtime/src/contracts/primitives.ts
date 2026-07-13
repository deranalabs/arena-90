import { z } from "zod";

export const ARENA_MODES = ["LIVE", "REPLAY"] as const;
export const ARENA_AGENT_IDS = ["alpha", "beta"] as const;
export const ARENA_ASSET_IDS = ["HOME", "DRAW", "AWAY"] as const;
export const CHECKPOINT_IDS = [
  "KICKOFF",
  "M15",
  "M30",
  "HALFTIME",
  "M60",
  "M75",
  "FINAL",
] as const;
export const DECISION_CHECKPOINT_IDS = [
  "KICKOFF",
  "M15",
  "M30",
  "HALFTIME",
  "M60",
  "M75",
] as const;

export const arenaModeSchema = z.enum(ARENA_MODES);
export const arenaAgentIdSchema = z.enum(ARENA_AGENT_IDS);
export const arenaAssetIdSchema = z.enum(ARENA_ASSET_IDS);
export const checkpointIdSchema = z.enum(CHECKPOINT_IDS);
export const decisionCheckpointIdSchema = z.enum(DECISION_CHECKPOINT_IDS);

export const utcDateTimeSchema = z.string().datetime({ offset: false });

export const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value && value.trim().length > 0, {
    message: "Must be non-blank and have no surrounding whitespace",
  });

export const canonicalIntegerStringSchema = z.string().regex(/^(?:0|-?[1-9]\d*)$/, {
  message: "Must be a canonical base-10 integer string",
});

export const nonNegativeIntegerStringSchema = z.string().regex(/^(?:0|[1-9]\d*)$/, {
  message: "Must be a canonical non-negative base-10 integer string",
});

export const positiveIntegerStringSchema = z.string().regex(/^[1-9]\d*$/, {
  message: "Must be a canonical positive base-10 integer string",
});

export const moneyMicrosSchema = nonNegativeIntegerStringSchema;
export const unitMicrosSchema = nonNegativeIntegerStringSchema;

export type ArenaMode = z.infer<typeof arenaModeSchema>;
export type ArenaAgentId = z.infer<typeof arenaAgentIdSchema>;
export type ArenaAssetId = z.infer<typeof arenaAssetIdSchema>;
export type CheckpointId = z.infer<typeof checkpointIdSchema>;
export type DecisionCheckpointId = z.infer<typeof decisionCheckpointIdSchema>;
export type MoneyMicros = z.infer<typeof moneyMicrosSchema>;
export type UnitMicros = z.infer<typeof unitMicrosSchema>;
