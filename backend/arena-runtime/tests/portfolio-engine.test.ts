import { describe, expect, it } from "vitest";

import {
  applyDecision,
  determineWinner,
  initializePortfolio,
  markToMarket,
  settlePortfolio,
} from "../src/engine/index.js";

describe("initializePortfolio", () => {
  it("starts an agent with the full bankroll in cash", () => {
    expect(initializePortfolio("alpha", "100000000")).toEqual({
      agentId: "alpha",
      cashMicros: "100000000",
      unitMicros: {
        HOME: "0",
        DRAW: "0",
        AWAY: "0",
      },
      navMicros: "100000000",
      returnBps: 0,
      updatedAtCheckpoint: "KICKOFF",
    });
  });
});

describe("markToMarket", () => {
  it("values every position at canonical prices and updates return", () => {
    expect(
      markToMarket(
        {
          agentId: "alpha",
          cashMicros: "10000000",
          unitMicros: {
            HOME: "20000000",
            DRAW: "5000000",
            AWAY: "2500000",
          },
          navMicros: "0",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
        { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
        "M15",
        "20000000",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "10000000",
      unitMicros: {
        HOME: "20000000",
        DRAW: "5000000",
        AWAY: "2500000",
      },
      navMicros: "22000000",
      returnBps: 1000,
      updatedAtCheckpoint: "M15",
    });
  });

  it("truncates negative return toward zero", () => {
    expect(
      markToMarket(
        {
          agentId: "beta",
          cashMicros: "2",
          unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
          navMicros: "3",
          returnBps: 0,
          updatedAtCheckpoint: "M30",
        },
        { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
        "HALFTIME",
        "3",
      ),
    ).toEqual({
      agentId: "beta",
      cashMicros: "2",
      unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
      navMicros: "2",
      returnBps: -3333,
      updatedAtCheckpoint: "HALFTIME",
    });
  });

  it("truncates each marked asset value to money micros", () => {
    expect(
      markToMarket(
        {
          agentId: "alpha",
          cashMicros: "0",
          unitMicros: { HOME: "1", DRAW: "0", AWAY: "0" },
          navMicros: "1",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
        { HOME: 999_998, DRAW: 1, AWAY: 1 },
        "M15",
        "1",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "0",
      unitMicros: { HOME: "1", DRAW: "0", AWAY: "0" },
      navMicros: "0",
      returnBps: -10000,
      updatedAtCheckpoint: "M15",
    });
  });

  it("keeps NAV exact beyond the JavaScript safe integer range", () => {
    expect(
      markToMarket(
        {
          agentId: "alpha",
          cashMicros: "9007199254740993",
          unitMicros: { HOME: "9007199254740993", DRAW: "0", AWAY: "0" },
          navMicros: "0",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
        { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
        "M15",
        "9007199254740993",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "9007199254740993",
      unitMicros: { HOME: "9007199254740993", DRAW: "0", AWAY: "0" },
      navMicros: "13510798882111489",
      returnBps: 4999,
      updatedAtCheckpoint: "M15",
    });
  });
});

describe("applyDecision", () => {
  it("rebalances from current NAV and leaves rounding residue in cash", () => {
    const portfolio = initializePortfolio("alpha", "100000001");

    expect(
      applyDecision(
        portfolio,
        {
          schemaVersion: 1,
          arenaId: "arena-001",
          snapshotId: "snapshot-015",
          checkpointId: "M15",
          agentId: "alpha",
          action: "TARGET_ALLOCATION",
          targetAllocationBps: {
            cash: 1_000,
            HOME: 4_000,
            DRAW: 3_000,
            AWAY: 2_000,
          },
          publicExplanation: "Target allocation from supplied checkpoint prices.",
        },
        { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
        "100000001",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "10000001",
      unitMicros: {
        HOME: "80000000",
        DRAW: "100000000",
        AWAY: "100000000",
      },
      navMicros: "100000001",
      returnBps: 0,
      updatedAtCheckpoint: "M15",
    });
  });

  it("rejects a decision for a different agent", () => {
    expect(() =>
      applyDecision(
        initializePortfolio("alpha", "100000000"),
        {
          schemaVersion: 1,
          arenaId: "arena-001",
          snapshotId: "snapshot-015",
          checkpointId: "M15",
          agentId: "beta",
          action: "TARGET_ALLOCATION",
          targetAllocationBps: {
            cash: 10_000,
            HOME: 0,
            DRAW: 0,
            AWAY: 0,
          },
          publicExplanation: "Preserve cash.",
        },
        { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
        "100000000",
      ),
    ).toThrow();
  });

  it("keeps cash and units for NO_TRADE while marking the portfolio", () => {
    expect(
      applyDecision(
        {
          agentId: "alpha",
          cashMicros: "10000000",
          unitMicros: {
            HOME: "20000000",
            DRAW: "0",
            AWAY: "0",
          },
          navMicros: "20000000",
          returnBps: 0,
          updatedAtCheckpoint: "M15",
        },
        {
          schemaVersion: 1,
          arenaId: "arena-001",
          snapshotId: "snapshot-030",
          checkpointId: "M30",
          agentId: "alpha",
          action: "NO_TRADE",
          publicExplanation: "Keep existing positions.",
        },
        { HOME: 600_000, DRAW: 250_000, AWAY: 150_000 },
        "20000000",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "10000000",
      unitMicros: {
        HOME: "20000000",
        DRAW: "0",
        AWAY: "0",
      },
      navMicros: "22000000",
      returnBps: 1000,
      updatedAtCheckpoint: "M30",
    });
  });

  it("rebalances from NAV marked at the current checkpoint price", () => {
    expect(
      applyDecision(
        {
          agentId: "beta",
          cashMicros: "0",
          unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
          navMicros: "50000000",
          returnBps: 0,
          updatedAtCheckpoint: "M15",
        },
        {
          schemaVersion: 1,
          arenaId: "arena-001",
          snapshotId: "snapshot-030",
          checkpointId: "M30",
          agentId: "beta",
          action: "TARGET_ALLOCATION",
          targetAllocationBps: { cash: 10_000, HOME: 0, DRAW: 0, AWAY: 0 },
          publicExplanation: "Move current NAV to cash.",
        },
        { HOME: 600_000, DRAW: 250_000, AWAY: 150_000 },
        "50000000",
      ),
    ).toEqual({
      agentId: "beta",
      cashMicros: "60000000",
      unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
      navMicros: "60000000",
      returnBps: 2000,
      updatedAtCheckpoint: "M30",
    });
  });

  it("truncates target values and target units before retaining residue as cash", () => {
    expect(
      applyDecision(
        initializePortfolio("alpha", "10"),
        {
          schemaVersion: 1,
          arenaId: "arena-001",
          snapshotId: "snapshot-015",
          checkpointId: "M15",
          agentId: "alpha",
          action: "TARGET_ALLOCATION",
          targetAllocationBps: { cash: 0, HOME: 3_333, DRAW: 3_333, AWAY: 3_334 },
          publicExplanation: "Allocate across all outcomes.",
        },
        { HOME: 333_333, DRAW: 333_333, AWAY: 333_334 },
        "10",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "4",
      unitMicros: { HOME: "9", DRAW: "9", AWAY: "8" },
      navMicros: "10",
      returnBps: 0,
      updatedAtCheckpoint: "M15",
    });
  });
});

describe("settlePortfolio", () => {
  it("settles HOME at full value and the losing assets at zero", () => {
    expect(
      settlePortfolio(
        {
          agentId: "beta",
          cashMicros: "10000000",
          unitMicros: {
            HOME: "30000000",
            DRAW: "40000000",
            AWAY: "50000000",
          },
          navMicros: "100000000",
          returnBps: 0,
          updatedAtCheckpoint: "M75",
        },
        "HOME",
        "100000000",
      ),
    ).toEqual({
      agentId: "beta",
      cashMicros: "10000000",
      unitMicros: {
        HOME: "30000000",
        DRAW: "40000000",
        AWAY: "50000000",
      },
      navMicros: "40000000",
      returnBps: -6000,
      updatedAtCheckpoint: "FINAL",
    });
  });

  it.each([
    ["DRAW" as const, "50000000", -5000],
    ["AWAY" as const, "60000000", -4000],
  ])("settles %s at full value", (winningAssetId, navMicros, returnBps) => {
    expect(
      settlePortfolio(
        {
          agentId: "beta",
          cashMicros: "10000000",
          unitMicros: {
            HOME: "30000000",
            DRAW: "40000000",
            AWAY: "50000000",
          },
          navMicros: "100000000",
          returnBps: 0,
          updatedAtCheckpoint: "M75",
        },
        winningAssetId,
        "100000000",
      ),
    ).toEqual({
      agentId: "beta",
      cashMicros: "10000000",
      unitMicros: {
        HOME: "30000000",
        DRAW: "40000000",
        AWAY: "50000000",
      },
      navMicros,
      returnBps,
      updatedAtCheckpoint: "FINAL",
    });
  });
});

describe("determineWinner", () => {
  it("returns the agent with the higher final NAV", () => {
    const alpha = {
      ...initializePortfolio("alpha", "100000000"),
      navMicros: "100000001",
      updatedAtCheckpoint: "FINAL" as const,
    };
    const beta = {
      ...initializePortfolio("beta", "100000000"),
      navMicros: "100000000",
      updatedAtCheckpoint: "FINAL" as const,
    };

    expect(determineWinner(alpha, beta)).toBe("alpha");
  });

  it("returns beta when beta has the higher final NAV", () => {
    const alpha = {
      ...initializePortfolio("alpha", "100000000"),
      navMicros: "99999999",
      updatedAtCheckpoint: "FINAL" as const,
    };
    const beta = {
      ...initializePortfolio("beta", "100000000"),
      navMicros: "100000000",
      updatedAtCheckpoint: "FINAL" as const,
    };

    expect(determineWinner(alpha, beta)).toBe("beta");
  });

  it("returns DRAW when final NAV values are equal", () => {
    const alpha = {
      ...initializePortfolio("alpha", "100000000"),
      updatedAtCheckpoint: "FINAL" as const,
    };
    const beta = {
      ...initializePortfolio("beta", "100000000"),
      updatedAtCheckpoint: "FINAL" as const,
    };

    expect(determineWinner(alpha, beta)).toBe("DRAW");
  });
});
