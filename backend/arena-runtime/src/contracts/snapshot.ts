import { createHash } from "node:crypto";

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

const canonicalSnapshotHashInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    providerSequence: z.number().int().positive(),
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

type CanonicalSnapshotHashInput = z.infer<typeof canonicalSnapshotHashInputSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

export function calculateSnapshotHash(input: CanonicalSnapshotHashInput): string {
  const snapshot = canonicalSnapshotHashInputSchema.parse(input);
  return hashCanonicalSnapshot(snapshot);
}

function hashCanonicalSnapshot(snapshot: CanonicalSnapshotHashInput): string {
  const canonicalJson = JSON.stringify(canonicalize(snapshot));

  return createHash("sha256").update(canonicalJson).digest("hex");
}

export const canonicalSnapshotSchema = canonicalSnapshotHashInputSchema
  .extend({
    snapshotHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const { snapshotHash, ...hashInput } = snapshot;
    const validatedHashInput = canonicalSnapshotHashInputSchema.safeParse(hashInput);

    if (
      validatedHashInput.success &&
      snapshotHash !== hashCanonicalSnapshot(validatedHashInput.data)
    ) {
      context.addIssue({
        code: "custom",
        path: ["snapshotHash"],
        message: "snapshotHash does not match canonical snapshot payload",
      });
    }
  });

export type CanonicalSnapshot = z.infer<typeof canonicalSnapshotSchema>;
