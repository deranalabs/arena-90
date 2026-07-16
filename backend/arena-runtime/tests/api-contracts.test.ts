import { describe, expect, it } from "vitest";

import {
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicApiErrorEnvelopeV1Schema,
  publicCheckpointV1Schema,
  publicEventHistoryV1Schema,
  publicFinalResultV2Schema,
  publicManifestV1Schema,
  publicPortfolioV1Schema,
  publicSnapshotV1Schema,
  calculateTerminalEvidenceHash,
} from "../src/index.js";

const publicSnapshot = {
  schemaVersion: 1,
  snapshotId: "snapshot-kickoff",
  snapshotHash: "a".repeat(64),
  arenaId: "arena-replay-001",
  fixtureId: "fixture-recorded-001",
  checkpointId: "KICKOFF",
  observedAtUtc: "2026-07-13T12:00:00.000Z",
  source: "TXLINE_RECORDED",
  match: {
    status: "LIVE",
    minute: 0,
    addedTime: 0,
    homeScore: 0,
    awayScore: 0,
  },
  priceMicros: { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
  freshness: {
    marketUpdatedAtUtc: "2026-07-13T11:59:58.000Z",
    delayed: false,
    suspended: false,
  },
} as const;

const publicPortfolio = {
  agentId: "alpha",
  cashMicros: "100000000",
  unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
  navMicros: "100000000",
  returnBps: 0,
  updatedAtCheckpoint: "KICKOFF",
} as const;

const publicManifest = {
  schemaVersion: 1,
  arenaId: "arena-replay-001",
  mode: "REPLAY",
  competition: "Premier League",
  fixtureId: "fixture-recorded-001",
  homeTeam: { name: "Home FC", code: "HOM" },
  awayTeam: { name: "Away FC", code: "AWY" },
  kickoffUtc: "2026-07-13T12:00:00.000Z",
  startingBankrollMicros: "100000000",
  currency: "VIRTUAL_USD_MICROS",
  assets: [
    { id: "HOME", market: "FULL_TIME_1X2", label: "Home win" },
    { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
    { id: "AWAY", market: "FULL_TIME_1X2", label: "Away win" },
  ],
  checkpoints: [
    "KICKOFF",
    "M15",
    "M30",
    "HALFTIME",
    "M60",
    "M75",
    "FINAL",
  ],
  createdAtUtc: "2026-07-13T10:00:00.000Z",
} as const;

describe("Arena public API contracts", () => {
  it("accepts the spectator manifest and rejects unknown fields", () => {
    expect(publicManifestV1Schema.parse(publicManifest)).toEqual(publicManifest);
    expect(
      publicManifestV1Schema.safeParse({
        ...publicManifest,
        providerBinding: "private-provider-id",
      }).success,
    ).toBe(false);
  });

  it("accepts the complete strict V1 spectator DTO family", () => {
    const betaPortfolio = { ...publicPortfolio, agentId: "beta" as const };
    const decision = {
      schemaVersion: 1,
      arenaId: publicManifest.arenaId,
      snapshotId: publicSnapshot.snapshotId,
      checkpointId: "KICKOFF",
      agentId: "alpha",
      action: "NO_TRADE",
      publicExplanation: "No verified edge at kickoff.",
    } as const;
    const checkpoint = {
      checkpointId: "KICKOFF",
      outcome: "REVEALED",
      snapshot: publicSnapshot,
      revealedDecisions: { alpha: decision },
      failures: [
        { scope: "AGENT", agentId: "beta", reason: "TIMEOUT" },
      ],
      portfoliosBefore: { alpha: publicPortfolio, beta: betaPortfolio },
      portfoliosAfter: { alpha: publicPortfolio, beta: betaPortfolio },
      firstEventSequence: 2,
      lastEventSequence: 8,
    } as const;
    const terminalEvidenceInput = {
      schemaVersion: 1 as const,
      providerSequence: 7,
      arenaId: publicManifest.arenaId,
      fixtureId: publicManifest.fixtureId,
      observedAtUtc: "2026-07-13T13:52:00.000Z",
      sourceEventId: "txline-event-007",
      source: "TXLINE_RECORDED" as const,
      match: {
        status: "FINISHED" as const,
        minute: 90,
        addedTime: 4,
        homeScore: 2,
        awayScore: 1,
      },
      winningAssetId: "HOME" as const,
    };
    const finalResult = {
      schemaVersion: 2,
      arenaId: publicManifest.arenaId,
      winnerRule: "FINAL_NAV_ONLY_V1",
      winningAssetId: "HOME",
      winner: "DRAW",
      alphaFinalNavMicros: "100000000",
      betaFinalNavMicros: "100000000",
      terminalEvidence: {
        ...terminalEvidenceInput,
        terminalEvidenceHash: calculateTerminalEvidenceHash(
          terminalEvidenceInput,
        ),
      },
      completedEventSequence: 39,
      preSettlementEventLogHash: "c".repeat(64),
      finalResultHash: "b".repeat(64),
    } as const;
    const state = {
      schemaVersion: 1,
      manifest: publicManifest,
      phase: "RUNNING",
      runtimeVersions: {
        runtimeVersion: "7.1",
        executionRuleVersion: "p0-v1",
        winnerRuleVersion: "FINAL_NAV_ONLY_V1",
        agents: {
          alpha: { strategyId: "alpha-momentum", strategyVersion: "1" },
          beta: { strategyId: "beta-valuation", strategyVersion: "1" },
        },
      },
      portfolios: { alpha: publicPortfolio, beta: betaPortfolio },
      checkpoints: [checkpoint],
      nextCheckpointId: "M15",
      leader: { result: "DRAW", provisional: true },
      lastEventSequence: 8,
    } as const;
    const event = {
      schemaVersion: 1,
      eventId: "arena-replay-001:7",
      arenaId: publicManifest.arenaId,
      sequence: 7,
      type: "ROUND_REVEALED",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "KICKOFF",
      payload: {
        decisions: { alpha: decision },
        failures: checkpoint.failures,
        portfoliosBefore: checkpoint.portfoliosBefore,
        portfoliosAfter: checkpoint.portfoliosAfter,
      },
    } as const;

    expect(publicSnapshotV1Schema.parse(publicSnapshot)).toEqual(publicSnapshot);
    expect(publicPortfolioV1Schema.parse(publicPortfolio)).toEqual(publicPortfolio);
    expect(publicCheckpointV1Schema.parse(checkpoint)).toEqual(checkpoint);
    expect(publicFinalResultV2Schema.parse(finalResult)).toEqual(finalResult);
    expect(publicArenaStateV1Schema.parse(state)).toEqual(state);
    expect(publicArenaEventV1Schema.parse(event)).toEqual(event);
    expect(
      publicEventHistoryV1Schema.parse({
        schemaVersion: 1,
        arenaId: publicManifest.arenaId,
        afterSequence: 6,
        lastEventSequence: 7,
        events: [event],
      }),
    ).toEqual({
      schemaVersion: 1,
      arenaId: publicManifest.arenaId,
      afterSequence: 6,
      lastEventSequence: 7,
      events: [event],
    });
    expect(
      publicApiErrorEnvelopeV1Schema.parse({
        schemaVersion: 1,
        error: { code: "INVALID_REQUEST", message: "Invalid request." },
      }),
    ).toEqual({
      schemaVersion: 1,
      error: { code: "INVALID_REQUEST", message: "Invalid request." },
    });
  });
});
