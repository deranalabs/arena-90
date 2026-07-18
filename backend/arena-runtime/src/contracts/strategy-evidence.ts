import { z } from "zod";

import { nonBlankStringSchema } from "./primitives.js";

const signedPriceMicrosSchema = z.number().int().min(-999_998).max(999_998);

const priceMicrosSchema = z.number().int().min(1).max(999_999);

const priceRecordSchema = z
  .object({
    HOME: priceMicrosSchema,
    DRAW: priceMicrosSchema,
    AWAY: priceMicrosSchema,
  })
  .strict();

const priceDeltaRecordSchema = z
  .object({
    HOME: signedPriceMicrosSchema,
    DRAW: signedPriceMicrosSchema,
    AWAY: signedPriceMicrosSchema,
  })
  .strict();

export const strategyEvidenceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    currentSnapshotId: nonBlankStringSchema,
    anchorSnapshotId: nonBlankStringSchema.nullable(),
    previousSnapshotId: nonBlankStringSchema.nullable(),
    anchorPriceMicros: priceRecordSchema.nullable(),
    previousPriceMicros: priceRecordSchema.nullable(),
    priceDeltaFromAnchorMicros: priceDeltaRecordSchema.nullable(),
    priceDeltaFromPreviousMicros: priceDeltaRecordSchema.nullable(),
    matchDeltaFromPrevious: z
      .object({
        minutesElapsed: z.number().int().nonnegative(),
        homeScoreDelta: z.number().int().nonnegative(),
        awayScoreDelta: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type StrategyEvidenceV1 = z.infer<typeof strategyEvidenceV1Schema>;
