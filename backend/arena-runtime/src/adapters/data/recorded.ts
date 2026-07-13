import { z } from "zod";

import {
  CHECKPOINT_IDS,
  arenaAssetIdSchema,
  calculateSnapshotHash,
  canonicalSnapshotSchema,
  checkpointIdSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
  type ArenaAssetId,
  type CanonicalSnapshot,
  type DecisionCheckpointId,
} from "../../contracts/index.js";

const recordedCheckpointSchema = z
  .object({
    providerSequence: z.number().int().positive(),
    checkpointId: checkpointIdSchema,
    snapshotId: nonBlankStringSchema,
    sourceEventId: nonBlankStringSchema,
    observedAtUtc: utcDateTimeSchema,
    match: canonicalSnapshotSchema.shape.match,
    priceMicros: canonicalSnapshotSchema.shape.priceMicros,
    freshness: canonicalSnapshotSchema.shape.freshness,
    finalResult: arenaAssetIdSchema.optional(),
  })
  .passthrough();

const recordedFixtureSchema = z
  .object({
    provider: z.literal("TXLINE_RECORDED"),
    arenaId: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
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
  getFinalResult(): ArenaAssetId;
}

export function createRecordedDataAdapter(input: unknown): RecordedDataAdapter {
  const fixture = recordedFixtureSchema.parse(input);

  return {
    getSnapshot(checkpointId) {
      const record = fixture.records.find((candidate) => candidate.checkpointId === checkpointId);

      if (record === undefined || record.checkpointId === "FINAL") {
        throw new RangeError(`Missing decision checkpoint: ${checkpointId}`);
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

    getFinalResult() {
      const finalRecord = fixture.records.at(-1);

      if (finalRecord?.checkpointId !== "FINAL" || finalRecord.finalResult === undefined) {
        throw new RangeError("Recorded fixture has no valid FINAL result");
      }

      return finalRecord.finalResult;
    },
  };
}
