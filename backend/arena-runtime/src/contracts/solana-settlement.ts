import { z } from "zod";

import {
  arenaFinalResultV2Schema,
  type ArenaFinalResultV2,
} from "./lifecycle.js";
import {
  arenaManifestSchema,
  calculateArenaIdentityHash,
  calculateArenaManifestHash,
  type ArenaManifest,
} from "./manifest.js";

const hashHexSchema = z.string().regex(/^[0-9a-f]{64}$/);
const u64StringSchema = z.string().regex(/^(?:0|[1-9]\d*)$/).superRefine(
  (value, context) => {
    if (BigInt(value) > 18_446_744_073_709_551_615n) {
      context.addIssue({ code: "custom", message: "Value exceeds u64" });
    }
  },
);
const i64PositiveStringSchema = z.string().regex(/^[1-9]\d*$/).superRefine(
  (value, context) => {
    if (BigInt(value) > 9_223_372_036_854_775_807n) {
      context.addIssue({ code: "custom", message: "Fixture id exceeds i64" });
    }
  },
);

export const solanaArenaPreparationIntentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: z.string().trim().min(1),
    identityHash: hashHexSchema,
    manifestHash: hashHexSchema,
    fixtureId: i64PositiveStringSchema,
    backingDeadlineUtc: z.iso.datetime({ offset: true }),
    feeBps: z.literal(0),
    idempotencyKey: hashHexSchema,
  })
  .strict();

export type SolanaArenaPreparationIntentV1 = z.infer<
  typeof solanaArenaPreparationIntentV1Schema
>;

export const solanaSettlementIntentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: z.string().trim().min(1),
    identityHash: hashHexSchema,
    manifestHash: hashHexSchema,
    fixtureId: i64PositiveStringSchema,
    providerSequence: z.number().int().positive().safe(),
    terminalSourceEventId: z.string().trim().min(1),
    terminalObservedAtUtc: z.iso.datetime({ offset: true }),
    terminalEvidenceHash: hashHexSchema,
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    proofStatKeys: z.tuple([z.literal(1), z.literal(2)]),
    finalResultHash: hashHexSchema,
    alphaFinalNavMicros: u64StringSchema,
    betaFinalNavMicros: u64StringSchema,
    result: z.enum(["alpha", "beta", "DRAW"]),
    idempotencyKey: hashHexSchema,
  })
  .strict();

export type SolanaSettlementIntentV1 = z.infer<
  typeof solanaSettlementIntentV1Schema
>;

export function createSolanaArenaPreparationIntent(
  manifestInput: ArenaManifest,
): SolanaArenaPreparationIntentV1 {
  const manifest = arenaManifestSchema.parse(manifestInput);
  if (manifest.mode !== "LIVE") {
    throw new Error("Replay arenas cannot create Solana preparation intents");
  }
  const identityHash = calculateArenaIdentityHash(manifest.arenaId);
  return solanaArenaPreparationIntentV1Schema.parse({
    schemaVersion: 1,
    arenaId: manifest.arenaId,
    identityHash,
    manifestHash: calculateArenaManifestHash(manifest),
    fixtureId: manifest.fixtureId,
    backingDeadlineUtc: manifest.kickoffUtc,
    feeBps: 0,
    idempotencyKey: identityHash,
  });
}

export function createSolanaSettlementIntent(
  manifestInput: ArenaManifest,
  finalResultInput: ArenaFinalResultV2,
): SolanaSettlementIntentV1 {
  const manifest = arenaManifestSchema.parse(manifestInput);
  const finalResult = arenaFinalResultV2Schema.parse(finalResultInput);
  if (manifest.mode !== "LIVE") {
    throw new Error("Replay arenas cannot create Solana settlement intents");
  }
  if (
    finalResult.arenaId !== manifest.arenaId ||
    finalResult.terminalEvidence.fixtureId !== manifest.fixtureId ||
    finalResult.terminalEvidence.source !== "TXLINE_LIVE"
  ) {
    throw new Error("Final result does not match the Live arena manifest");
  }

  return solanaSettlementIntentV1Schema.parse({
    schemaVersion: 1,
    arenaId: manifest.arenaId,
    identityHash: calculateArenaIdentityHash(manifest.arenaId),
    manifestHash: calculateArenaManifestHash(manifest),
    fixtureId: manifest.fixtureId,
    providerSequence: finalResult.terminalEvidence.providerSequence,
    terminalSourceEventId: finalResult.terminalEvidence.sourceEventId,
    terminalObservedAtUtc: finalResult.terminalEvidence.observedAtUtc,
    terminalEvidenceHash: finalResult.terminalEvidence.terminalEvidenceHash,
    homeScore: finalResult.terminalEvidence.match.homeScore,
    awayScore: finalResult.terminalEvidence.match.awayScore,
    proofStatKeys: [1, 2],
    finalResultHash: finalResult.finalResultHash,
    alphaFinalNavMicros: finalResult.alphaFinalNavMicros,
    betaFinalNavMicros: finalResult.betaFinalNavMicros,
    result: finalResult.winner,
    idempotencyKey: finalResult.finalResultHash,
  });
}
