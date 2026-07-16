import { createHash } from "node:crypto";

import { z } from "zod";

import {
  arenaAssetIdSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
} from "./primitives.js";

const terminalMatchSchema = z
  .object({
    status: z.literal("FINISHED"),
    minute: z.number().int().nonnegative(),
    addedTime: z.number().int().nonnegative(),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
  })
  .strict();

const terminalEvidenceHashInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    providerSequence: z.number().int().positive().safe(),
    arenaId: nonBlankStringSchema,
    fixtureId: nonBlankStringSchema,
    observedAtUtc: utcDateTimeSchema,
    sourceEventId: nonBlankStringSchema,
    source: z.enum(["TXLINE_RECORDED", "TXLINE_LIVE"]),
    match: terminalMatchSchema,
    winningAssetId: arenaAssetIdSchema,
  })
  .strict();

export type TerminalEvidenceHashInputV1 = z.infer<
  typeof terminalEvidenceHashInputSchema
>;

function hashTerminalEvidence(input: TerminalEvidenceHashInputV1): string {
  const canonicalJson = JSON.stringify({
    schemaVersion: input.schemaVersion,
    providerSequence: input.providerSequence,
    arenaId: input.arenaId,
    fixtureId: input.fixtureId,
    observedAtUtc: input.observedAtUtc,
    sourceEventId: input.sourceEventId,
    source: input.source,
    match: {
      status: input.match.status,
      minute: input.match.minute,
      addedTime: input.match.addedTime,
      homeScore: input.match.homeScore,
      awayScore: input.match.awayScore,
    },
    winningAssetId: input.winningAssetId,
  });

  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function calculateTerminalEvidenceHash(
  input: TerminalEvidenceHashInputV1,
): string {
  return hashTerminalEvidence(terminalEvidenceHashInputSchema.parse(input));
}

export const terminalEvidenceV1Schema = terminalEvidenceHashInputSchema
  .extend({
    terminalEvidenceHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .superRefine((evidence, context) => {
    const expectedWinningAsset =
      evidence.match.homeScore > evidence.match.awayScore
        ? "HOME"
        : evidence.match.awayScore > evidence.match.homeScore
          ? "AWAY"
          : "DRAW";
    if (evidence.winningAssetId !== expectedWinningAsset) {
      context.addIssue({
        code: "custom",
        path: ["winningAssetId"],
        message: "Terminal winning asset must match the finished score",
      });
    }

    const { terminalEvidenceHash, ...hashInput } = evidence;
    if (terminalEvidenceHash !== hashTerminalEvidence(hashInput)) {
      context.addIssue({
        code: "custom",
        path: ["terminalEvidenceHash"],
        message: "terminalEvidenceHash does not match terminal evidence",
      });
    }
  });

export type TerminalEvidenceV1 = z.infer<typeof terminalEvidenceV1Schema>;
