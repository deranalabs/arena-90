import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  agentDecisionSchema,
  arenaEventSchema,
  arenaManifestSchema,
  calculateSnapshotHash,
  canonicalSnapshotSchema,
  createAgentDecisionSchema,
  portfolioStateSchema,
} from "../src/contracts/index.js";

const validManifest = {
  schemaVersion: 1,
  arenaId: "arena-001",
  mode: "REPLAY",
  competition: "Premier League",
  fixtureId: "fixture-001",
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

const validSnapshotHashInput = {
  schemaVersion: 1,
  providerSequence: 2,
  snapshotId: "snapshot-001",
  arenaId: "arena-001",
  fixtureId: "fixture-001",
  checkpointId: "M15",
  observedAtUtc: "2026-07-13T12:15:00.000Z",
  sourceEventId: "event-015",
  source: "TXLINE_RECORDED",
  match: {
    status: "LIVE",
    minute: 15,
    addedTime: 0,
    homeScore: 0,
    awayScore: 0,
  },
  priceMicros: {
    HOME: 500_000,
    DRAW: 300_000,
    AWAY: 200_000,
  },
  freshness: {
    marketUpdatedAtUtc: "2026-07-13T12:14:58.000Z",
    delayed: false,
    suspended: false,
  },
} as const;

const validSnapshot = {
  ...validSnapshotHashInput,
  snapshotHash: calculateSnapshotHash(validSnapshotHashInput),
} as const;

const validDecision = {
  schemaVersion: 1,
  arenaId: "arena-001",
  snapshotId: "snapshot-001",
  checkpointId: "M15",
  agentId: "alpha",
  action: "TARGET_ALLOCATION",
  targetAllocationBps: {
    cash: 1_000,
    HOME: 4_000,
    DRAW: 3_000,
    AWAY: 2_000,
  },
  publicExplanation: "Home probability strengthened while draw remains material.",
} as const;

describe("arenaManifestSchema", () => {
  it("accepts the locked P0 manifest contract", () => {
    expect(arenaManifestSchema.parse(validManifest)).toEqual(validManifest);
  });

  it("rejects a manifest missing a required 1X2 asset", () => {
    const result = arenaManifestSchema.safeParse({
      ...validManifest,
      assets: validManifest.assets.filter((asset) => asset.id !== "DRAW"),
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate assets even when the array has three entries", () => {
    const result = arenaManifestSchema.safeParse({
      ...validManifest,
      assets: [validManifest.assets[0], validManifest.assets[0], validManifest.assets[2]],
    });

    expect(result.success).toBe(false);
  });

  it("rejects checkpoints outside the exact approved order", () => {
    const result = arenaManifestSchema.safeParse({
      ...validManifest,
      checkpoints: ["KICKOFF", "M30", "M15", "HALFTIME", "M60", "M75", "FINAL"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields and non-UTC timestamps", () => {
    expect(
      arenaManifestSchema.safeParse({ ...validManifest, unsupported: true }).success,
    ).toBe(false);
    expect(
      arenaManifestSchema.safeParse({
        ...validManifest,
        kickoffUtc: "2026-07-13T19:00:00+07:00",
      }).success,
    ).toBe(false);
  });
});

describe("canonicalSnapshotSchema", () => {
  it("accepts a canonical snapshot", () => {
    expect(canonicalSnapshotSchema.parse(validSnapshot)).toEqual(validSnapshot);
  });

  it.each([
    ["zero price", { HOME: 0, DRAW: 500_000, AWAY: 500_000 }],
    ["fractional price", { HOME: 499_999.5, DRAW: 300_000.5, AWAY: 200_000 }],
    ["wrong price total", { HOME: 500_000, DRAW: 300_000, AWAY: 199_999 }],
    ["unknown asset", { HOME: 500_000, DRAW: 300_000, AWAY: 200_000, OVER: 1 }],
  ])("rejects malformed prices: %s", (_name, priceMicros) => {
    expect(
      canonicalSnapshotSchema.safeParse({ ...validSnapshot, priceMicros }).success,
    ).toBe(false);
  });

  it("rejects FINAL because settlement has no decision snapshot", () => {
    expect(
      canonicalSnapshotSchema.safeParse({ ...validSnapshot, checkpointId: "FINAL" }).success,
    ).toBe(false);
  });

  it("rejects malformed match fields", () => {
    expect(
      canonicalSnapshotSchema.safeParse({
        ...validSnapshot,
        match: { ...validSnapshot.match, homeScore: -1 },
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive provider sequence and a mismatched snapshot hash", () => {
    expect(
      canonicalSnapshotSchema.safeParse({ ...validSnapshot, providerSequence: 0 }).success,
    ).toBe(false);
    expect(
      canonicalSnapshotSchema.safeParse({
        ...validSnapshot,
        snapshotHash: "0".repeat(64),
      }).success,
    ).toBe(false);
  });
});

describe("agentDecisionSchema", () => {
  it("accepts an allocation totaling 10000 basis points", () => {
    expect(agentDecisionSchema.parse(validDecision)).toEqual(validDecision);
  });

  it("accepts NO_TRADE as an explicit structured action", () => {
    const { targetAllocationBps: _targetAllocationBps, ...identity } = validDecision;

    expect(
      agentDecisionSchema.safeParse({ ...identity, action: "NO_TRADE" }).success,
    ).toBe(true);
  });

  it("enforces action-specific allocation shape", () => {
    const { targetAllocationBps, ...identity } = validDecision;

    expect(
      agentDecisionSchema.safeParse({
        ...identity,
        action: "NO_TRADE",
        targetAllocationBps,
      }).success,
    ).toBe(false);
    expect(
      agentDecisionSchema.safeParse({ ...identity, action: "TARGET_ALLOCATION" }).success,
    ).toBe(false);
  });

  it("rejects allocations that do not total 10000", () => {
    expect(
      agentDecisionSchema.safeParse({
        ...validDecision,
        targetAllocationBps: { ...validDecision.targetAllocationBps, cash: 999 },
      }).success,
    ).toBe(false);
  });

  it("rejects fractional, out-of-range, and unknown allocations", () => {
    expect(
      agentDecisionSchema.safeParse({
        ...validDecision,
        targetAllocationBps: {
          cash: 0.5,
          HOME: 4_999.5,
          DRAW: 3_000,
          AWAY: 2_000,
        },
      }).success,
    ).toBe(false);
    expect(
      agentDecisionSchema.safeParse({
        ...validDecision,
        targetAllocationBps: { cash: 0, HOME: 11_000, DRAW: 0, AWAY: -1 },
      }).success,
    ).toBe(false);
    expect(
      agentDecisionSchema.safeParse({
        ...validDecision,
        targetAllocationBps: {
          ...validDecision.targetAllocationBps,
          OVER_2_5: 0,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects surrounding prose instead of a JSON object", () => {
    expect(agentDecisionSchema.safeParse(JSON.stringify(validDecision)).success).toBe(false);
  });

  it("validates identity against the original request", () => {
    const requestSchema = createAgentDecisionSchema({
      arenaId: "arena-001",
      snapshotId: "snapshot-001",
      checkpointId: "M15",
      agentId: "alpha",
    });

    expect(requestSchema.safeParse(validDecision).success).toBe(true);
    expect(
      requestSchema.safeParse({ ...validDecision, snapshotId: "other-snapshot" }).success,
    ).toBe(false);
    expect(requestSchema.safeParse({ ...validDecision, agentId: "beta" }).success).toBe(false);
  });
});

describe("portfolioStateSchema", () => {
  const portfolio = {
    agentId: "beta",
    cashMicros: "1",
    unitMicros: { HOME: "0", DRAW: "2000000", AWAY: "0" },
    navMicros: "600001",
    returnBps: -9_940,
    updatedAtCheckpoint: "M30",
  } as const;

  it("accepts JSON-safe fixed-point strings", () => {
    expect(portfolioStateSchema.parse(portfolio)).toEqual(portfolio);
  });

  it("rejects numbers, negatives, and non-canonical integer strings", () => {
    expect(
      portfolioStateSchema.safeParse({ ...portfolio, cashMicros: 1 }).success,
    ).toBe(false);
    expect(
      portfolioStateSchema.safeParse({ ...portfolio, navMicros: "-1" }).success,
    ).toBe(false);
    expect(
      portfolioStateSchema.safeParse({ ...portfolio, cashMicros: "01" }).success,
    ).toBe(false);
  });
});

describe("arenaEventSchema", () => {
  const event = {
    eventId: "event-1",
    arenaId: "arena-001",
    sequence: 0,
    type: "ARENA_READY",
    occurredAtUtc: "2026-07-13T10:00:00.000Z",
    publicPayload: { mode: "REPLAY" },
  } as const;

  it("accepts the event contract and extension event names", () => {
    expect(arenaEventSchema.parse(event)).toEqual(event);
    expect(arenaEventSchema.safeParse({ ...event, type: "AUDIT_RECORDED" }).success).toBe(
      true,
    );
  });

  it("rejects negative or fractional sequence values", () => {
    expect(arenaEventSchema.safeParse({ ...event, sequence: -1 }).success).toBe(false);
    expect(arenaEventSchema.safeParse({ ...event, sequence: 1.5 }).success).toBe(false);
  });
});
