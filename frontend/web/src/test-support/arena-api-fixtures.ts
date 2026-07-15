const occurredAtUtc = "2026-07-13T12:00:00.000Z";

export function publicPortfolio(agentId: "alpha" | "beta") {
  return {
    agentId,
    cashMicros: "100000000",
    unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
    navMicros: "100000000",
    returnBps: 0,
    updatedAtCheckpoint: "KICKOFF",
  };
}

export function publicSnapshot() {
  return {
    schemaVersion: 1,
    snapshotId: "snapshot-kickoff",
    snapshotHash: "a".repeat(64),
    arenaId: "arena-replay-001",
    fixtureId: "fixture-recorded-001",
    checkpointId: "KICKOFF",
    observedAtUtc: occurredAtUtc,
    source: "TXLINE_RECORDED",
    match: {
      status: "LIVE",
      minute: 0,
      addedTime: 0,
      homeScore: 0,
      awayScore: 0,
    },
    priceMicros: { HOME: 400000, DRAW: 300000, AWAY: 300000 },
    freshness: {
      marketUpdatedAtUtc: occurredAtUtc,
      delayed: false,
      suspended: false,
    },
  };
}

export function publicState(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    manifest: {
      schemaVersion: 1,
      arenaId: "arena-replay-001",
      mode: "REPLAY",
      competition: "Premier League",
      fixtureId: "fixture-recorded-001",
      homeTeam: { name: "Home FC", code: "HOM" },
      awayTeam: { name: "Away FC", code: "AWY" },
      kickoffUtc: occurredAtUtc,
      startingBankrollMicros: "100000000",
      currency: "VIRTUAL_USD_MICROS",
      assets: [
        { id: "HOME", market: "FULL_TIME_1X2", label: "Home win" },
        { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
        { id: "AWAY", market: "FULL_TIME_1X2", label: "Away win" },
      ],
      checkpoints: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      createdAtUtc: occurredAtUtc,
    },
    phase: "READY",
    runtimeVersions: {
      runtimeVersion: "runtime-v1",
      executionRuleVersion: "execution-v1",
      winnerRuleVersion: "winner-v1",
      agents: {
        alpha: { strategyId: "alpha", strategyVersion: "1" },
        beta: { strategyId: "beta", strategyVersion: "1" },
      },
    },
    portfolios: {
      alpha: publicPortfolio("alpha"),
      beta: publicPortfolio("beta"),
    },
    checkpoints: [],
    nextCheckpointId: "KICKOFF",
    leader: { result: "DRAW", provisional: true },
    lastEventSequence: 1,
    ...overrides,
  };
}

export function publicEvent(
  sequence: number,
  type = "ARENA_READY",
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    arenaId: "arena-replay-001",
    sequence,
    occurredAtUtc,
    type,
    payload: {},
    ...overrides,
  };
}

export function publicHistory(events: unknown[], afterSequence = 0) {
  return {
    schemaVersion: 1,
    arenaId: "arena-replay-001",
    afterSequence,
    lastEventSequence: afterSequence + events.length,
    events,
  };
}

export const publicOccurredAtUtc = occurredAtUtc;
