import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  calculateArenaIdentityHash,
  calculateArenaManifestHash,
  calculateFinalResultHash,
  calculateTerminalEvidenceHash,
  createSolanaArenaPreparationIntent,
  createSolanaSettlementIntent,
  solanaSettlementIntentV1Schema,
  type ArenaManifest,
} from "../src/contracts/index.js";

const manifest: ArenaManifest = {
  schemaVersion: 1,
  arenaId: "world-cup-2026-spain-argentina-final",
  mode: "LIVE",
  competition: "World Cup 2026",
  fixtureId: "18257739",
  homeTeam: { name: "Spain", code: "ESP" },
  awayTeam: { name: "Argentina", code: "ARG" },
  kickoffUtc: "2026-07-19T19:00:00.000Z",
  startingBankrollMicros: "100000000",
  currency: "VIRTUAL_USD_MICROS",
  assets: [
    { id: "HOME", market: "FULL_TIME_1X2", label: "Spain win" },
    { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
    { id: "AWAY", market: "FULL_TIME_1X2", label: "Argentina win" },
  ],
  checkpoints: [...CHECKPOINT_IDS],
  createdAtUtc: "2026-07-17T09:00:00.000Z",
};

function finalResult() {
  const terminalInput = {
    schemaVersion: 1 as const,
    providerSequence: 880,
    arenaId: manifest.arenaId,
    fixtureId: manifest.fixtureId,
    observedAtUtc: "2026-07-19T21:00:00.000Z",
    sourceEventId: "txline-live:18257739:880",
    source: "TXLINE_LIVE" as const,
    match: {
      status: "FINISHED" as const,
      minute: 90,
      addedTime: 5,
      homeScore: 2,
      awayScore: 1,
    },
    winningAssetId: "HOME" as const,
  };
  const input = {
    schemaVersion: 2 as const,
    arenaId: manifest.arenaId,
    winnerRule: "FINAL_NAV_ONLY_V1" as const,
    winningAssetId: "HOME" as const,
    winner: "alpha" as const,
    alphaFinalNavMicros: "110000000",
    betaFinalNavMicros: "90000000",
    terminalEvidence: {
      ...terminalInput,
      terminalEvidenceHash: calculateTerminalEvidenceHash(terminalInput),
    },
    completedEventSequence: 42,
    preSettlementEventLogHash: "a".repeat(64),
  };
  return { ...input, finalResultHash: calculateFinalResultHash(input) };
}

describe("Solana settlement intent", () => {
  it("closes supporter backing exactly at Live kickoff", () => {
    expect(createSolanaArenaPreparationIntent(manifest)).toEqual({
      schemaVersion: 1,
      arenaId: manifest.arenaId,
      identityHash: calculateArenaIdentityHash(manifest.arenaId),
      manifestHash: calculateArenaManifestHash(manifest),
      fixtureId: manifest.fixtureId,
      backingDeadlineUtc: manifest.kickoffUtc,
      feeBps: 0,
      idempotencyKey: calculateArenaIdentityHash(manifest.arenaId),
    });
    expect(() =>
      createSolanaArenaPreparationIntent({ ...manifest, mode: "REPLAY" }),
    ).toThrow("Replay arenas cannot create Solana preparation intents");
  });

  it("binds one Live final result to canonical arena hashes", () => {
    const result = finalResult();
    const intent = createSolanaSettlementIntent(manifest, result);

    expect(intent).toEqual({
      schemaVersion: 1,
      arenaId: manifest.arenaId,
      identityHash: calculateArenaIdentityHash(manifest.arenaId),
      manifestHash: calculateArenaManifestHash(manifest),
      fixtureId: manifest.fixtureId,
      providerSequence: 880,
      terminalSourceEventId: "txline-live:18257739:880",
      terminalObservedAtUtc: "2026-07-19T21:00:00.000Z",
      terminalEvidenceHash: result.terminalEvidence.terminalEvidenceHash,
      homeScore: 2,
      awayScore: 1,
      proofStatKeys: [1, 2],
      finalResultHash: result.finalResultHash,
      alphaFinalNavMicros: "110000000",
      betaFinalNavMicros: "90000000",
      result: "alpha",
      idempotencyKey: result.finalResultHash,
    });
  });

  it("rejects Replay and mismatched Live results", () => {
    expect(() =>
      createSolanaSettlementIntent({ ...manifest, mode: "REPLAY" }, finalResult()),
    ).toThrow("Replay arenas cannot create Solana settlement intents");

    const result = finalResult();
    expect(() =>
      createSolanaSettlementIntent(
        { ...manifest, fixtureId: "18257865" },
        result,
      ),
    ).toThrow("Final result does not match the Live arena manifest");
  });

  it("rejects values that cannot cross the Anchor i64/u64 seam", () => {
    const intent = createSolanaSettlementIntent(manifest, finalResult());
    expect(
      solanaSettlementIntentV1Schema.safeParse({
        ...intent,
        fixtureId: "9223372036854775808",
      }).success,
    ).toBe(false);
    expect(
      solanaSettlementIntentV1Schema.safeParse({
        ...intent,
        alphaFinalNavMicros: "18446744073709551616",
      }).success,
    ).toBe(false);
  });
});
