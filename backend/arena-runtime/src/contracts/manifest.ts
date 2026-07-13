import { z } from "zod";

import {
  ARENA_ASSET_IDS,
  CHECKPOINT_IDS,
  arenaAssetIdSchema,
  arenaModeSchema,
  checkpointIdSchema,
  nonBlankStringSchema,
  positiveIntegerStringSchema,
  utcDateTimeSchema,
} from "./primitives.js";

const teamSchema = z
  .object({
    name: nonBlankStringSchema,
    code: nonBlankStringSchema,
  })
  .strict();

const arenaAssetSchema = z
  .object({
    id: arenaAssetIdSchema,
    market: z.literal("FULL_TIME_1X2"),
    label: nonBlankStringSchema,
  })
  .strict();

export const arenaManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    mode: arenaModeSchema,
    competition: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    homeTeam: teamSchema,
    awayTeam: teamSchema,
    kickoffUtc: utcDateTimeSchema,
    startingBankrollMicros: positiveIntegerStringSchema,
    currency: z.literal("VIRTUAL_USD_MICROS"),
    assets: z.array(arenaAssetSchema),
    checkpoints: z.array(checkpointIdSchema),
    createdAtUtc: utcDateTimeSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const assetId of ARENA_ASSET_IDS) {
      const occurrences = manifest.assets.filter((asset) => asset.id === assetId).length;
      if (occurrences !== 1) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message: `Asset ${assetId} must occur exactly once`,
        });
      }
    }

    const checkpointsAreExact =
      manifest.checkpoints.length === CHECKPOINT_IDS.length &&
      manifest.checkpoints.every(
        (checkpoint, index) => checkpoint === CHECKPOINT_IDS[index],
      );

    if (!checkpointsAreExact) {
      context.addIssue({
        code: "custom",
        path: ["checkpoints"],
        message: "Checkpoints must contain the approved P0 sequence",
      });
    }
  });

export type ArenaManifest = z.infer<typeof arenaManifestSchema>;
