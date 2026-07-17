import { describe, expect, it, vi } from "vitest";

import {
  CHECKPOINT_IDS,
  calculateFinalResultHash,
  calculateTerminalEvidenceHash,
  type ArenaManifest,
} from "../src/contracts/index.js";
import {
  createSupporterResolverSupervisor,
  type SupporterChainResolver,
} from "../src/services/index.js";

const liveManifest: ArenaManifest = {
  schemaVersion: 1,
  arenaId: "world-cup-final-18257739",
  mode: "LIVE",
  competition: "World Cup Hackathon 2026",
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
  createdAtUtc: "2026-07-17T10:00:00.000Z",
};

function finalResult() {
  const evidenceInput = {
    schemaVersion: 1 as const,
    providerSequence: 880,
    arenaId: liveManifest.arenaId,
    fixtureId: liveManifest.fixtureId,
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
    arenaId: liveManifest.arenaId,
    winnerRule: "FINAL_NAV_ONLY_V1" as const,
    winningAssetId: "HOME" as const,
    winner: "alpha" as const,
    alphaFinalNavMicros: "110000000",
    betaFinalNavMicros: "90000000",
    terminalEvidence: {
      ...evidenceInput,
      terminalEvidenceHash: calculateTerminalEvidenceHash(evidenceInput),
    },
    completedEventSequence: 42,
    preSettlementEventLogHash: "a".repeat(64),
  };
  return { ...input, finalResultHash: calculateFinalResultHash(input) };
}

function resolver(): SupporterChainResolver {
  return {
    prepare: vi.fn(async () => "PREPARED" as const),
    settle: vi.fn(async () => "SETTLED" as const),
  };
}

describe("supporter resolver supervisor", () => {
  it("passes canonical prepare and settlement intents to restricted adapter", async () => {
    const adapter = resolver();
    const supervisor = createSupporterResolverSupervisor(adapter);
    const signal = new AbortController().signal;

    await expect(supervisor.prepare(liveManifest, signal)).resolves.toBe(
      "PREPARED",
    );
    await expect(
      supervisor.settle(liveManifest, finalResult(), signal),
    ).resolves.toBe("SETTLED");

    expect(adapter.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        arenaId: liveManifest.arenaId,
        backingDeadlineUtc: liveManifest.kickoffUtc,
      }),
      signal,
    );
    expect(adapter.settle).toHaveBeenCalledWith(
      expect.objectContaining({
        arenaId: liveManifest.arenaId,
        idempotencyKey: finalResult().finalResultHash,
      }),
      signal,
    );
  });

  it("never invokes chain adapter for Replay", async () => {
    const adapter = resolver();
    const supervisor = createSupporterResolverSupervisor(adapter);
    const replay = { ...liveManifest, mode: "REPLAY" as const };
    const signal = new AbortController().signal;

    await expect(supervisor.prepare(replay, signal)).resolves.toBe(
      "NOT_ELIGIBLE",
    );
    await expect(supervisor.settle(replay, finalResult(), signal)).resolves.toBe(
      "NOT_ELIGIBLE",
    );
    expect(adapter.prepare).not.toHaveBeenCalled();
    expect(adapter.settle).not.toHaveBeenCalled();
  });

  it("stops before adapter invocation when aborted", async () => {
    const adapter = resolver();
    const supervisor = createSupporterResolverSupervisor(adapter);
    const controller = new AbortController();
    controller.abort();

    await expect(
      supervisor.prepare(liveManifest, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(adapter.prepare).not.toHaveBeenCalled();
  });
});
