import { z } from "zod";

import {
  CHECKPOINT_IDS,
  arenaAssetIdSchema,
  calculateSnapshotHash,
  calculateTerminalEvidenceHash,
  canonicalSnapshotSchema,
  checkpointIdSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
  type CanonicalSnapshot,
  type DecisionCheckpointId,
  type TerminalEvidenceV1,
} from "../../contracts/index.js";

const recordedCheckpointSchema = z
  .object({
    providerSequence: z.number().int().positive(),
    checkpointId: checkpointIdSchema,
    snapshotId: nonBlankStringSchema,
    sourceEventId: nonBlankStringSchema,
    marketMessageId: nonBlankStringSchema.optional(),
    observedAtUtc: utcDateTimeSchema,
    match: canonicalSnapshotSchema.shape.match,
    marketAvailable: z.boolean().optional().default(true),
    providerPrices: z
      .object({
        HOME: z.number().int().positive(),
        DRAW: z.number().int().positive(),
        AWAY: z.number().int().positive(),
      })
      .strict()
      .optional(),
    priceMicros: canonicalSnapshotSchema.shape.priceMicros.optional(),
    freshness: canonicalSnapshotSchema.shape.freshness,
    finalResult: arenaAssetIdSchema.optional(),
  })
  .passthrough();

const recordedFixtureSchema = z
  .object({
    provider: z.literal("TXLINE_RECORDED"),
    arenaId: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    provenance: z
      .object({
        source: z.literal("TXLINE_HISTORICAL_API"),
        sourceFixtureId: z.number().int().positive(),
        sourceKickoffUtc: utcDateTimeSchema,
        capturedAtUtc: utcDateTimeSchema,
        scoreEventCount: z.number().int().positive(),
        oddsUpdateCount: z.number().int().positive(),
        inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict()
      .optional(),
    records: z.array(recordedCheckpointSchema),
  })
  .strict()
  .superRefine((fixture, context) => {
    const providerSequences = new Set<number>();
    const snapshotIds = new Set<string>();
    const sourceEventIds = new Set<string>();
    const orderIsExact =
      fixture.records.length === CHECKPOINT_IDS.length &&
      fixture.records.every(
        (record, index) => record.checkpointId === CHECKPOINT_IDS[index],
      );

    if (!orderIsExact) {
      context.addIssue({
        code: "custom",
        path: ["records"],
        message: "Recorded checkpoints must use the approved P0 order",
      });
    }

    fixture.records.forEach((record, index) => {
      const previousRecord = fixture.records[index - 1];
      if (
        providerSequences.has(record.providerSequence) ||
        (previousRecord !== undefined &&
          record.providerSequence <= previousRecord.providerSequence)
      ) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "providerSequence"],
          message: "providerSequence values must be unique and strictly increasing",
        });
      }
      providerSequences.add(record.providerSequence);

      if (snapshotIds.has(record.snapshotId)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "snapshotId"],
          message: "snapshotId values must be unique",
        });
      }
      snapshotIds.add(record.snapshotId);

      if (sourceEventIds.has(record.sourceEventId)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "sourceEventId"],
          message: "sourceEventId values must be unique",
        });
      }
      sourceEventIds.add(record.sourceEventId);

      const shouldHaveFinalResult = record.checkpointId === "FINAL";
      if (shouldHaveFinalResult !== (record.finalResult !== undefined)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "finalResult"],
          message: "Only FINAL must contain finalResult",
        });
      }

      if (record.checkpointId !== "FINAL" && (!record.marketAvailable || record.priceMicros === undefined)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "priceMicros"],
          message: "Decision checkpoints require an available canonical market",
        });
      }
      if (record.marketAvailable !== (record.priceMicros !== undefined)) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "marketAvailable"],
          message: "Market availability must match canonical price presence",
        });
      }

      if (record.checkpointId === "FINAL") {
        const scoreResult =
          record.match.homeScore > record.match.awayScore
            ? "HOME"
            : record.match.awayScore > record.match.homeScore
              ? "AWAY"
              : "DRAW";

        if (record.match.status !== "FINISHED" || record.finalResult !== scoreResult) {
          context.addIssue({
            code: "custom",
            path: ["records", index, "finalResult"],
            message: "FINAL result must match the finished score",
          });
        }
      }
    });
  });

interface RecordedDataAdapter {
  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
  getTerminalEvidence(): TerminalEvidenceV1;
}

export function createRecordedDataAdapter(input: unknown): RecordedDataAdapter {
  const fixture = recordedFixtureSchema.parse(input);

  return {
    getSnapshot(checkpointId) {
      const record = fixture.records.find((candidate) => candidate.checkpointId === checkpointId);

      if (record === undefined || record.checkpointId === "FINAL") {
        throw new RangeError(`Missing decision checkpoint: ${checkpointId}`);
      }
      if (record.priceMicros === undefined) {
        throw new RangeError(`Missing decision market: ${checkpointId}`);
      }

      const hashInput = {
        schemaVersion: 1,
        providerSequence: record.providerSequence,
        snapshotId: record.snapshotId,
        arenaId: fixture.arenaId,
        fixtureId: fixture.fixtureId,
        checkpointId: record.checkpointId,
        observedAtUtc: record.observedAtUtc,
        sourceEventId: record.sourceEventId,
        source: "TXLINE_RECORDED",
        match: record.match,
        priceMicros: record.priceMicros,
        freshness: record.freshness,
      } as const;

      return canonicalSnapshotSchema.parse({
        ...hashInput,
        snapshotHash: calculateSnapshotHash(hashInput),
      });
    },

    getTerminalEvidence() {
      const finalRecord = fixture.records.at(-1);

      if (finalRecord?.checkpointId !== "FINAL" || finalRecord.finalResult === undefined) {
        throw new RangeError("Recorded fixture has no valid FINAL result");
      }

      const hashInput = {
        schemaVersion: 1 as const,
        providerSequence: finalRecord.providerSequence,
        arenaId: fixture.arenaId,
        fixtureId: fixture.fixtureId,
        observedAtUtc: finalRecord.observedAtUtc,
        sourceEventId: finalRecord.sourceEventId,
        source: "TXLINE_RECORDED" as const,
        match: {
          status: "FINISHED" as const,
          minute: finalRecord.match.minute,
          addedTime: finalRecord.match.addedTime,
          homeScore: finalRecord.match.homeScore,
          awayScore: finalRecord.match.awayScore,
        },
        winningAssetId: finalRecord.finalResult,
      };
      return {
        ...hashInput,
        terminalEvidenceHash: calculateTerminalEvidenceHash(hashInput),
      };
    },
  };
}
