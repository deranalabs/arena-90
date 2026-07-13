import { z } from "zod";

import {
  decisionCheckpointIdSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
} from "./primitives.js";

const priceMicrosSchema = z.number().int().min(1).max(999_999);

const priceMicrosRecordSchema = z
  .object({
    HOME: priceMicrosSchema,
    DRAW: priceMicrosSchema,
    AWAY: priceMicrosSchema,
  })
  .strict()
  .superRefine((prices, context) => {
    if (prices.HOME + prices.DRAW + prices.AWAY !== 1_000_000) {
      context.addIssue({
        code: "custom",
        message: "HOME, DRAW, and AWAY prices must sum to 1000000",
      });
    }
  });

export const canonicalSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshotId: nonBlankStringSchema,
    arenaId: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    checkpointId: decisionCheckpointIdSchema,
    observedAtUtc: utcDateTimeSchema,
    sourceEventId: nonBlankStringSchema,
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
    priceMicros: priceMicrosRecordSchema,
    freshness: z
      .object({
        marketUpdatedAtUtc: utcDateTimeSchema,
        delayed: z.boolean(),
        suspended: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type CanonicalSnapshot = z.infer<typeof canonicalSnapshotSchema>;
