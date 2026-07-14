import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  arenaFinalResultV1Schema,
  arenaRunStateV1Schema,
  calculateFinalResultHash,
  calculateSnapshotHash,
} from "../src/contracts/index.js";
import { initializePortfolio, settlePortfolio } from "../src/engine/index.js";

const manifest = {
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
  checkpoints: [...CHECKPOINT_IDS],
  createdAtUtc: "2026-07-13T10:00:00.000Z",
} as const;

const runtimeMetadata = {
  runtimeId: "arena90-runtime",
  runtimeVersion: "6a",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "p0-final-nav-v1",
  agentTimeoutMs: 30_000,
  agents: {
    alpha: {
      adapterId: "zeroclaw",
      adapterVersion: "1",
      strategyId: "alpha-momentum",
      strategyVersion: "1",
    },
    beta: {
      adapterId: "zeroclaw",
      adapterVersion: "1",
      strategyId: "beta-valuation",
      strategyVersion: "1",
    },
  },
} as const;

function readyState() {
  return {
    schemaVersion: 1 as const,
    revision: 0,
    manifest,
    runtimeMetadata,
    phase: "READY" as const,
    portfolios: {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    },
    checkpoints: [],
    lastEventSequence: 1,
  };
}

function kickoffSnapshot() {
  const hashInput = {
    schemaVersion: 1 as const,
    providerSequence: 1,
    snapshotId: "snapshot-kickoff",
    arenaId: "arena-replay-001",
    fixtureId: "fixture-recorded-001",
    checkpointId: "KICKOFF" as const,
    observedAtUtc: "2026-07-13T12:00:00.000Z",
    sourceEventId: "txline-event-001",
    source: "TXLINE_RECORDED" as const,
    match: {
      status: "LIVE" as const,
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
  };

  return { ...hashInput, snapshotHash: calculateSnapshotHash(hashInput) };
}

function snapshotFor(
  checkpointId: "KICKOFF" | "M15",
  providerSequence: number,
  snapshotId: string,
  sourceEventId: string,
) {
  const kickoff = kickoffSnapshot();
  const { snapshotHash: _snapshotHash, ...base } = kickoff;
  const hashInput = {
    ...base,
    providerSequence,
    snapshotId,
    checkpointId,
    sourceEventId,
    match: {
      ...base.match,
      minute: checkpointId === "KICKOFF" ? 0 : 15,
    },
  };

  return { ...hashInput, snapshotHash: calculateSnapshotHash(hashInput) };
}

describe("Arena lifecycle contracts", () => {
  it("hashes the fixed-order final result fields and validates the winner", () => {
    const hashInput = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      winningAssetId: "HOME" as const,
      winner: "alpha" as const,
      alphaFinalNavMicros: "120000000",
      betaFinalNavMicros: "90000000",
    };

    expect(calculateFinalResultHash(hashInput)).toBe(
      "8d17a51f33147618f0fb563bb08c102e8c3613b178a0940eca6ea37ca0ee3d21",
    );
    expect(
      arenaFinalResultV1Schema.parse({
        ...hashInput,
        finalResultHash:
          "8d17a51f33147618f0fb563bb08c102e8c3613b178a0940eca6ea37ca0ee3d21",
      }),
    ).toEqual({
      ...hashInput,
      finalResultHash:
        "8d17a51f33147618f0fb563bb08c102e8c3613b178a0940eca6ea37ca0ee3d21",
    });
  });

  it("accepts a strict READY state and excludes secrets from runtime metadata", () => {
    const state = readyState();

    expect(arenaRunStateV1Schema.parse(state)).toEqual(state);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        runtimeMetadata: {
          ...state.runtimeMetadata,
          apiToken: "must-not-be-persisted",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only the next arena-bound checkpoint as durable pending work", () => {
    const state = {
      ...readyState(),
      revision: 1,
      phase: "RUNNING" as const,
      pendingCheckpoint: {
        checkpointId: "KICKOFF" as const,
        snapshot: kickoffSnapshot(),
      },
      lastEventSequence: 3,
    };

    expect(arenaRunStateV1Schema.parse(state)).toEqual(state);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        pendingCheckpoint: {
          ...state.pendingCheckpoint,
          checkpointId: "M15",
        },
      }).success,
    ).toBe(false);
  });

  it("validates an atomic global-missed checkpoint with unchanged portfolios", () => {
    const initial = readyState().portfolios;
    const checkpoint = {
      checkpointId: "KICKOFF" as const,
      outcome: "GLOBAL_MISSED" as const,
      revealedDecisions: {},
      failures: [{ scope: "GLOBAL" as const, reason: "DATA_FAILURE" }],
      portfoliosBefore: initial,
      portfoliosAfter: structuredClone(initial),
      firstEventSequence: 2,
      lastEventSequence: 3,
    };
    const state = {
      ...readyState(),
      revision: 1,
      phase: "RUNNING" as const,
      checkpoints: [checkpoint],
      lastEventSequence: 3,
    };

    expect(arenaRunStateV1Schema.parse(state)).toEqual(state);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        checkpoints: [
          {
            ...checkpoint,
            portfoliosAfter: {
              ...checkpoint.portfoliosAfter,
              alpha: { ...checkpoint.portfoliosAfter.alpha, cashMicros: "1" },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts COMPLETED only with the full checkpoint prefix and matching final result", () => {
    const initial = readyState().portfolios;
    const decisionCheckpoints = CHECKPOINT_IDS.slice(0, -1);
    const checkpoints = decisionCheckpoints.map((checkpointId, index) => ({
      checkpointId,
      outcome: "GLOBAL_MISSED" as const,
      revealedDecisions: {},
      failures: [{ scope: "GLOBAL" as const, reason: "DATA_FAILURE" }],
      portfoliosBefore: structuredClone(initial),
      portfoliosAfter: structuredClone(initial),
      firstEventSequence: index * 2 + 2,
      lastEventSequence: index * 2 + 3,
    }));
    const portfolios = {
      alpha: settlePortfolio(initial.alpha, "HOME", "100000000"),
      beta: settlePortfolio(initial.beta, "HOME", "100000000"),
    };
    const finalResult = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      winningAssetId: "HOME" as const,
      winner: "DRAW" as const,
      alphaFinalNavMicros: "100000000",
      betaFinalNavMicros: "100000000",
      finalResultHash:
        "f95a489df074ec44b9556c0ac0a8b307c46810be3429b663a9df65183e615ccf",
    };
    const state = {
      ...readyState(),
      revision: 8,
      phase: "COMPLETED" as const,
      portfolios,
      checkpoints,
      finalResult,
      lastEventSequence: 15,
    };

    expect(arenaRunStateV1Schema.parse(state)).toEqual(state);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        finalResult: { ...finalResult, finalResultHash: "0".repeat(64) },
      }).success,
    ).toBe(false);
  });

  it("rejects reused canonical source identities across committed checkpoints", () => {
    const initial = readyState().portfolios;
    const checkpoint = (
      checkpointId: "KICKOFF" | "M15",
      index: number,
      snapshot: ReturnType<typeof snapshotFor>,
    ) => ({
      checkpointId,
      outcome: "GLOBAL_MISSED" as const,
      snapshot,
      revealedDecisions: {},
      failures: [{ scope: "GLOBAL" as const, reason: "SUSPENDED_SNAPSHOT" }],
      portfoliosBefore: structuredClone(initial),
      portfoliosAfter: structuredClone(initial),
      firstEventSequence: index * 2 + 2,
      lastEventSequence: index * 2 + 3,
    });
    const state = {
      ...readyState(),
      revision: 2,
      phase: "RUNNING" as const,
      checkpoints: [
        checkpoint(
          "KICKOFF",
          0,
          snapshotFor("KICKOFF", 1, "snapshot-kickoff", "source-001"),
        ),
        checkpoint(
          "M15",
          1,
          snapshotFor("M15", 2, "snapshot-m15", "source-001"),
        ),
      ],
      lastEventSequence: 5,
    };

    expect(arenaRunStateV1Schema.safeParse(state).success).toBe(false);
  });

  it("rejects portfolio discontinuity between atomic checkpoint commits", () => {
    const initial = readyState().portfolios;
    const changed = {
      ...structuredClone(initial),
      alpha: { ...initial.alpha, cashMicros: "1", navMicros: "1" },
    };
    const checkpoint = (
      checkpointId: "KICKOFF" | "M15",
      index: number,
      portfolios: typeof initial,
    ) => ({
      checkpointId,
      outcome: "GLOBAL_MISSED" as const,
      revealedDecisions: {},
      failures: [{ scope: "GLOBAL" as const, reason: "DATA_FAILURE" }],
      portfoliosBefore: structuredClone(portfolios),
      portfoliosAfter: structuredClone(portfolios),
      firstEventSequence: index * 2 + 2,
      lastEventSequence: index * 2 + 3,
    });
    const state = {
      ...readyState(),
      revision: 2,
      phase: "RUNNING" as const,
      portfolios: changed,
      checkpoints: [
        checkpoint("KICKOFF", 0, initial),
        checkpoint("M15", 1, changed),
      ],
      lastEventSequence: 5,
    };

    expect(arenaRunStateV1Schema.safeParse(state).success).toBe(false);
  });

  it("derives equal READY and first-checkpoint capital from the manifest bankroll", () => {
    const state = readyState();
    const arbitraryPortfolio = {
      ...state.portfolios.alpha,
      cashMicros: "50000000",
      navMicros: "50000000",
    };

    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        portfolios: {
          alpha: { ...arbitraryPortfolio, agentId: "alpha" },
          beta: { ...arbitraryPortfolio, agentId: "beta" },
        },
      }).success,
    ).toBe(false);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        portfolios: {
          alpha: state.portfolios.alpha,
          beta: { ...state.portfolios.beta, cashMicros: "1", navMicros: "1" },
        },
      }).success,
    ).toBe(false);
    expect(
      arenaRunStateV1Schema.safeParse({
        ...state,
        revision: 1,
        phase: "RUNNING",
        portfolios: {
          alpha: { ...arbitraryPortfolio, agentId: "alpha" },
          beta: { ...arbitraryPortfolio, agentId: "beta" },
        },
        checkpoints: [
          {
            checkpointId: "KICKOFF",
            outcome: "GLOBAL_MISSED",
            revealedDecisions: {},
            failures: [{ scope: "GLOBAL", reason: "DATA_FAILURE" }],
            portfoliosBefore: {
              alpha: { ...arbitraryPortfolio, agentId: "alpha" },
              beta: { ...arbitraryPortfolio, agentId: "beta" },
            },
            portfoliosAfter: {
              alpha: { ...arbitraryPortfolio, agentId: "alpha" },
              beta: { ...arbitraryPortfolio, agentId: "beta" },
            },
            firstEventSequence: 2,
            lastEventSequence: 3,
          },
        ],
        lastEventSequence: 3,
      }).success,
    ).toBe(false);
  });
});
