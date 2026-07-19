import { describe, expect, it } from "vitest";

import {
  PublicProjectionError,
  projectArenaEvent,
  projectArenaEventHistory,
  projectArenaState,
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
} from "../src/index.js";
import {
  CHECKPOINT_IDS,
  MINIMUM_ARENA_EVENT_TYPES,
  calculateFinalResultHash,
  calculateSnapshotHash,
  calculateTerminalEvidenceHash,
  type PersistedArenaEventV1,
  type ArenaRunStateV1,
} from "../src/contracts/index.js";
import { initializePortfolio } from "../src/engine/index.js";

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
  runtimeId: "arena90-runtime-private",
  runtimeVersion: "7.1",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "FINAL_NAV_ONLY_V1",
  agentTimeoutMs: 30_000,
  agents: {
    alpha: {
      adapterId: "/private/zeroclaw-alpha",
      adapterVersion: "secret-adapter-version",
      strategyId: "alpha-momentum",
      strategyVersion: "1",
    },
    beta: {
      adapterId: "/private/zeroclaw-beta",
      adapterVersion: "secret-adapter-version",
      strategyId: "beta-valuation",
      strategyVersion: "1",
    },
  },
} as const;

function kickoffSnapshot() {
  const hashInput = {
    schemaVersion: 1 as const,
    providerSequence: 91,
    snapshotId: "snapshot-kickoff",
    arenaId: manifest.arenaId,
    fixtureId: manifest.fixtureId,
    checkpointId: "KICKOFF" as const,
    observedAtUtc: "2026-07-13T12:00:00.000Z",
    sourceEventId: "private-provider-event-91",
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

function m15Snapshot() {
  const kickoff = kickoffSnapshot();
  const { snapshotHash: _snapshotHash, ...base } = kickoff;
  const hashInput = {
    ...base,
    providerSequence: 92,
    snapshotId: "snapshot-m15",
    checkpointId: "M15" as const,
    sourceEventId: "private-provider-event-92",
    match: { ...base.match, minute: 15 },
  };
  return { ...hashInput, snapshotHash: calculateSnapshotHash(hashInput) };
}

function initialPortfolios() {
  return {
    alpha: initializePortfolio("alpha", manifest.startingBankrollMicros),
    beta: initializePortfolio("beta", manifest.startingBankrollMicros),
  };
}

function terminalResultInput(completedEventSequence: number) {
  const terminalEvidenceInput = {
    schemaVersion: 1 as const,
    providerSequence: 99,
    arenaId: manifest.arenaId,
    fixtureId: manifest.fixtureId,
    observedAtUtc: "2026-07-13T13:52:00.000Z",
    sourceEventId: "private-provider-event-99",
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
  return {
    schemaVersion: 2 as const,
    arenaId: manifest.arenaId,
    winnerRule: "FINAL_NAV_ONLY_V1" as const,
    winningAssetId: "HOME" as const,
    winner: "DRAW" as const,
    alphaFinalNavMicros: "100000000",
    betaFinalNavMicros: "100000000",
    terminalEvidence: {
      ...terminalEvidenceInput,
      terminalEvidenceHash: calculateTerminalEvidenceHash(
        terminalEvidenceInput,
      ),
    },
    completedEventSequence,
    preSettlementEventLogHash: "a".repeat(64),
  };
}

function decision(agentId: "alpha" | "beta") {
  return {
    schemaVersion: 1 as const,
    arenaId: manifest.arenaId,
    snapshotId: "snapshot-kickoff",
    checkpointId: "KICKOFF" as const,
    agentId,
    action: "NO_TRADE" as const,
    publicExplanation: `${agentId} holds the current portfolio.`,
    rawModelOutput: `private-${agentId}-raw-output`,
    prompt: `private-${agentId}-prompt`,
  };
}

function revealedState(): ArenaRunStateV1 {
  const snapshot = kickoffSnapshot();
  const portfolios = initialPortfolios();
  return {
    schemaVersion: 1,
    revision: 2,
    manifest,
    runtimeMetadata,
    phase: "RUNNING",
    portfolios,
    checkpoints: [
      {
        checkpointId: "KICKOFF",
        outcome: "REVEALED",
        snapshot,
        revealedDecisions: {
          alpha: decision("alpha"),
          beta: decision("beta"),
        },
        failures: [],
        portfoliosBefore: portfolios,
        portfoliosAfter: portfolios,
        firstEventSequence: 2,
        lastEventSequence: 8,
      },
    ],
    lastEventSequence: 8,
  } as unknown as ArenaRunStateV1;
}

describe("Arena public projection", () => {
  it("preserves the honest Recovery Replay disclosure", () => {
    const disclosure = "RECOVERY REPLAY — recorded data, not live execution";
    const state = revealedState();
    const projected = projectArenaState({
      ...state,
      manifest: { ...state.manifest, replayDisclosure: disclosure },
    });

    expect(projected.manifest.replayDisclosure).toBe(disclosure);
    expect(publicArenaStateV1Schema.parse(projected)).toEqual(projected);
  });

  it("projects pending lifecycle state without private decisions or internals", () => {
    const snapshot = kickoffSnapshot();
    const state = {
      schemaVersion: 1,
      revision: 4,
      manifest: { ...manifest, secretManifestValue: "manifest-secret" },
      runtimeMetadata: {
        ...runtimeMetadata,
        providerToken: "provider-secret",
      },
      phase: "RUNNING",
      portfolios: initialPortfolios(),
      checkpoints: [],
      pendingCheckpoint: {
        checkpointId: "KICKOFF",
        snapshot: {
          ...snapshot,
          rawProviderPayload: "raw-provider-payload",
        },
        privateDecisions: {
          alpha: "private-alpha-decision",
          beta: "private-beta-decision",
        },
        prompt: "private-model-prompt",
        repairErrors: ["private-repair-detail"],
      },
      lastEventSequence: 3,
      lease: { fencingToken: "private-fencing-token" },
    } as unknown as ArenaRunStateV1;

    const projected = projectArenaState(state);
    const serialized = JSON.stringify(projected);

    expect(projected).toEqual({
      schemaVersion: 1,
      manifest,
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
      currentSnapshot: {
        schemaVersion: 1,
        snapshotId: snapshot.snapshotId,
        snapshotHash: snapshot.snapshotHash,
        arenaId: snapshot.arenaId,
        fixtureId: snapshot.fixtureId,
        checkpointId: snapshot.checkpointId,
        observedAtUtc: snapshot.observedAtUtc,
        source: snapshot.source,
        match: snapshot.match,
        priceMicros: snapshot.priceMicros,
        freshness: snapshot.freshness,
      },
      portfolios: initialPortfolios(),
      checkpoints: [],
      nextCheckpointId: "KICKOFF",
      leader: { result: "DRAW", provisional: true },
      lastEventSequence: 3,
    });
    expect(publicArenaStateV1Schema.parse(projected)).toEqual(projected);
    for (const forbidden of [
      "private-alpha-decision",
      "private-beta-decision",
      "private-model-prompt",
      "private-repair-detail",
      "raw-provider-payload",
      "private-provider-event-91",
      "provider-secret",
      "/private/zeroclaw-alpha",
      "secret-adapter-version",
      "private-fencing-token",
      "manifest-secret",
      "agentTimeoutMs",
      "providerSequence",
      "sourceEventId",
      "revision",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("projects only revealed fields from a committed checkpoint", () => {
    const snapshot = kickoffSnapshot();
    const portfolios = initialPortfolios();
    const state = {
      schemaVersion: 1,
      revision: 2,
      manifest,
      runtimeMetadata,
      phase: "RUNNING",
      portfolios,
      checkpoints: [
        {
          checkpointId: "KICKOFF",
          outcome: "REVEALED",
          snapshot,
          revealedDecisions: {
            alpha: decision("alpha"),
            beta: decision("beta"),
          },
          failures: [],
          portfoliosBefore: portfolios,
          portfoliosAfter: portfolios,
          firstEventSequence: 2,
          lastEventSequence: 8,
          privateValidation: "private-validation-detail",
        },
      ],
      lastEventSequence: 8,
    } as unknown as ArenaRunStateV1;

    const projected = projectArenaState(state);
    const checkpoint = projected.checkpoints[0];
    const serialized = JSON.stringify(projected);

    expect(checkpoint).toEqual({
      checkpointId: "KICKOFF",
      outcome: "REVEALED",
      snapshot: expect.objectContaining({ snapshotId: "snapshot-kickoff" }),
      revealedDecisions: {
        alpha: {
          schemaVersion: 1,
          arenaId: manifest.arenaId,
          snapshotId: "snapshot-kickoff",
          checkpointId: "KICKOFF",
          agentId: "alpha",
          action: "NO_TRADE",
          publicExplanation: "alpha holds the current portfolio.",
        },
        beta: {
          schemaVersion: 1,
          arenaId: manifest.arenaId,
          snapshotId: "snapshot-kickoff",
          checkpointId: "KICKOFF",
          agentId: "beta",
          action: "NO_TRADE",
          publicExplanation: "beta holds the current portfolio.",
        },
      },
      failures: [],
      portfoliosBefore: portfolios,
      portfoliosAfter: portfolios,
      firstEventSequence: 2,
      lastEventSequence: 8,
    });
    expect(projected.nextCheckpointId).toBe("M15");
    expect(publicArenaStateV1Schema.parse(projected)).toEqual(projected);
    expect(serialized).not.toContain("private-alpha-raw-output");
    expect(serialized).not.toContain("private-beta-prompt");
    expect(serialized).not.toContain("private-validation-detail");
  });

  it("hides decision content until one simultaneous ROUND_REVEALED event", () => {
    const state = revealedState();
    const received = {
      eventId: `${manifest.arenaId}:4`,
      arenaId: manifest.arenaId,
      sequence: 4,
      type: "DECISION_RECEIVED",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "KICKOFF",
      agentId: "alpha",
      publicPayload: {
        status: "RECEIVED",
        decision: "private-decision-in-hostile-payload",
        rawModelOutput: "private-model-output",
      },
    } as unknown as PersistedArenaEventV1;
    const rechecking = {
      ...received,
      eventId: `${manifest.arenaId}:5`,
      sequence: 5,
      type: "RECHECKING_DECISION",
      publicPayload: {
        attempt: 1,
        repairErrors: ["private-repair-error"],
        prompt: "private-repair-prompt",
      },
    } as unknown as PersistedArenaEventV1;
    const reveal = {
      ...received,
      eventId: `${manifest.arenaId}:7`,
      sequence: 7,
      type: "ROUND_REVEALED",
      agentId: undefined,
      publicPayload: {
        decisions: { alpha: "hostile-one-sided-payload" },
        rawProviderPayload: "private-provider-payload",
      },
    } as unknown as PersistedArenaEventV1;

    const projectedReceived = projectArenaEvent(state, received);
    const projectedRechecking = projectArenaEvent(state, rechecking);
    const projectedReveal = projectArenaEvent(state, reveal);
    const beforeReveal = JSON.stringify([
      projectedReceived,
      projectedRechecking,
    ]);

    expect(projectedReceived).toEqual({
      schemaVersion: 1,
      eventId: `${manifest.arenaId}:4`,
      arenaId: manifest.arenaId,
      sequence: 4,
      type: "DECISION_RECEIVED",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "KICKOFF",
      agentId: "alpha",
      payload: { status: "RECEIVED" },
    });
    expect(projectedRechecking).toEqual({
      schemaVersion: 1,
      eventId: `${manifest.arenaId}:5`,
      arenaId: manifest.arenaId,
      sequence: 5,
      type: "RECHECKING_DECISION",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "KICKOFF",
      agentId: "alpha",
      payload: { attempt: 1 },
    });
    expect(projectedReveal.type).toBe("ROUND_REVEALED");
    if (projectedReveal.type !== "ROUND_REVEALED") {
      throw new Error("Expected projected reveal");
    }
    expect(Object.keys(projectedReveal.payload.decisions)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(beforeReveal).not.toContain("publicExplanation");
    expect(beforeReveal).not.toContain("private-decision-in-hostile-payload");
    expect(beforeReveal).not.toContain("private-repair-error");
    expect(JSON.stringify(projectedReveal)).not.toContain(
      "hostile-one-sided-payload",
    );
    expect(JSON.stringify(projectedReveal)).not.toContain(
      "private-provider-payload",
    );
    expect(publicArenaEventV1Schema.parse(projectedReveal)).toEqual(
      projectedReveal,
    );
  });

  it("explicitly maps every persisted lifecycle event type", () => {
    const ready = {
      schemaVersion: 1,
      revision: 0,
      manifest,
      runtimeMetadata,
      phase: "READY",
      portfolios: initialPortfolios(),
      checkpoints: [],
      lastEventSequence: 1,
    } as unknown as ArenaRunStateV1;
    const pending = {
      ...ready,
      revision: 1,
      phase: "RUNNING",
      pendingCheckpoint: {
        checkpointId: "KICKOFF",
        snapshot: kickoffSnapshot(),
      },
      lastEventSequence: 3,
    } as unknown as ArenaRunStateV1;
    const revealed = revealedState();
    const agentMissed = {
      ...revealed,
      checkpoints: [
        {
          ...revealed.checkpoints[0],
          revealedDecisions: { alpha: decision("alpha") },
          failures: [
            { scope: "AGENT", agentId: "beta", reason: "TIMEOUT" },
          ],
        },
      ],
    } as unknown as ArenaRunStateV1;
    const globalMissed = {
      ...revealed,
      checkpoints: [
        {
          ...revealed.checkpoints[0],
          outcome: "GLOBAL_MISSED",
          revealedDecisions: {},
          failures: [{ scope: "GLOBAL", reason: "DATA_FAILURE" }],
          snapshot: undefined,
          firstEventSequence: 2,
          lastEventSequence: 3,
        },
      ],
      lastEventSequence: 3,
    } as unknown as ArenaRunStateV1;
    const finalResultInput = terminalResultInput(10);
    const terminalPortfolios = {
      alpha: {
        ...initialPortfolios().alpha,
        updatedAtCheckpoint: "FINAL" as const,
      },
      beta: {
        ...initialPortfolios().beta,
        updatedAtCheckpoint: "FINAL" as const,
      },
    };
    const completed = {
      ...revealed,
      phase: "COMPLETED",
      portfolios: terminalPortfolios,
      finalResult: {
        ...finalResultInput,
        finalResultHash: calculateFinalResultHash(finalResultInput),
      },
      lastEventSequence: 10,
    } as unknown as ArenaRunStateV1;
    const event = (
      state: ArenaRunStateV1,
      sequence: number,
      type: string,
      fields: Record<string, unknown> = {},
    ) => ({
      state,
      event: {
        eventId: `${manifest.arenaId}:${sequence}`,
        arenaId: manifest.arenaId,
        sequence,
        type,
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        publicPayload: {},
        ...fields,
      } as unknown as PersistedArenaEventV1,
    });
    const cases = [
      event(ready, 1, "ARENA_READY"),
      event(pending, 2, "CHECKPOINT_OPENED", {
        checkpointId: "KICKOFF",
        publicPayload: { snapshotId: "snapshot-kickoff" },
      }),
      event(pending, 3, "AGENTS_ANALYZING", { checkpointId: "KICKOFF" }),
      event(revealed, 4, "DECISION_RECEIVED", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        publicPayload: { status: "RECEIVED" },
      }),
      event(revealed, 5, "RECHECKING_DECISION", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        publicPayload: { attempt: 1 },
      }),
      event(agentMissed, 6, "MISSED_DECISION_ROUND", {
        checkpointId: "KICKOFF",
        agentId: "beta",
        publicPayload: { reason: "TIMEOUT" },
      }),
      event(globalMissed, 2, "GLOBAL_MISSED_DECISION_ROUND", {
        checkpointId: "KICKOFF",
        publicPayload: { reason: "DATA_FAILURE" },
      }),
      event(revealed, 7, "ROUND_REVEALED", { checkpointId: "KICKOFF" }),
      event(revealed, 8, "ROUND_COMPLETE", { checkpointId: "KICKOFF" }),
      event(completed, 9, "FINALIZING", { checkpointId: "FINAL" }),
      event(completed, 10, "COMPLETED", {
        checkpointId: "FINAL",
        publicPayload: { infrastructureLog: "private-terminal-log" },
      }),
    ];

    const projected = cases.map(({ state, event: persisted }) =>
      projectArenaEvent(state, persisted),
    );

    expect(projected.map(({ type }) => type)).toEqual([
      ...MINIMUM_ARENA_EVENT_TYPES,
    ]);
    for (const item of projected) {
      expect(publicArenaEventV1Schema.parse(item)).toEqual(item);
    }
    expect(JSON.stringify(projected)).not.toContain("private-terminal-log");
  });

  it("projects a snapshotless checkpoint missed by a late LIVE start", () => {
    const base = revealedState();
    const committed = base.checkpoints[0];
    if (committed === undefined) throw new Error("Missing test checkpoint");
    const state = {
      ...base,
      checkpoints: [
        {
          ...committed,
          outcome: "GLOBAL_MISSED",
          snapshot: undefined,
          revealedDecisions: {},
          failures: [
            { scope: "GLOBAL", reason: "CHECKPOINT_WINDOW_MISSED" },
          ],
        },
      ],
    } as unknown as ArenaRunStateV1;

    const projected = projectArenaState(state);

    expect(projected.checkpoints[0]?.failures).toEqual([
      { scope: "GLOBAL", reason: "CHECKPOINT_WINDOW_MISSED" },
    ]);
  });

  it("projects historical events from their matching historical checkpoint", () => {
    const first = revealedState();
    const firstCheckpoint = first.checkpoints[0];
    if (firstCheckpoint === undefined) throw new Error("Missing test checkpoint");
    const secondSnapshot = m15Snapshot();
    const secondPortfolios = {
      alpha: { ...first.portfolios.alpha, navMicros: "90000000" },
      beta: { ...first.portfolios.beta, navMicros: "80000000" },
    };
    const secondDecision = (agentId: "alpha" | "beta") => ({
      schemaVersion: 1 as const,
      arenaId: manifest.arenaId,
      snapshotId: secondSnapshot.snapshotId,
      checkpointId: "M15" as const,
      agentId,
      action: "NO_TRADE" as const,
      publicExplanation: `${agentId} later decision.`,
    });
    const state = {
      ...first,
      portfolios: secondPortfolios,
      checkpoints: [
        firstCheckpoint,
        {
          checkpointId: "M15",
          outcome: "REVEALED",
          snapshot: secondSnapshot,
          revealedDecisions: {
            alpha: secondDecision("alpha"),
            beta: secondDecision("beta"),
          },
          failures: [],
          portfoliosBefore: first.portfolios,
          portfoliosAfter: secondPortfolios,
          firstEventSequence: 9,
          lastEventSequence: 15,
        },
      ],
      lastEventSequence: 15,
    } as unknown as ArenaRunStateV1;
    const persisted = [
      {
        eventId: `${manifest.arenaId}:7`,
        arenaId: manifest.arenaId,
        sequence: 7,
        type: "ROUND_REVEALED",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: { decisions: "must-not-be-copied" },
      },
      {
        eventId: `${manifest.arenaId}:8`,
        arenaId: manifest.arenaId,
        sequence: 8,
        type: "ROUND_COMPLETE",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: {},
      },
    ] as unknown as PersistedArenaEventV1[];

    const history = projectArenaEventHistory(state, persisted, 6);
    const reveal = history.events[0];
    const complete = history.events[1];

    expect(reveal?.type).toBe("ROUND_REVEALED");
    if (reveal?.type !== "ROUND_REVEALED") {
      throw new Error("Expected projected reveal");
    }
    expect(reveal.payload.decisions.alpha?.publicExplanation).toBe(
      "alpha holds the current portfolio.",
    );
    expect(complete?.type).toBe("ROUND_COMPLETE");
    if (complete?.type !== "ROUND_COMPLETE") {
      throw new Error("Expected projected completion");
    }
    expect(complete.payload.portfolios.alpha.navMicros).toBe("100000000");
    expect(complete.payload.nextCheckpointId).toBe("M15");
    expect(JSON.stringify(history)).not.toContain("later decision");
    expect(JSON.stringify(history)).not.toContain("must-not-be-copied");
    expect(publicEventHistoryV1Schema.parse(history)).toEqual(history);
  });

  it("exposes only final result and terminal portfolios when completed", () => {
    const state = revealedState();
    const finalResultInput = terminalResultInput(9);
    const completed = {
      ...state,
      phase: "COMPLETED",
      portfolios: {
        alpha: {
          ...state.portfolios.alpha,
          updatedAtCheckpoint: "FINAL",
          privateSettlementTrace: "private-alpha-settlement",
        },
        beta: {
          ...state.portfolios.beta,
          updatedAtCheckpoint: "FINAL",
          privateSettlementTrace: "private-beta-settlement",
        },
      },
      finalResult: {
        ...finalResultInput,
        finalResultHash: calculateFinalResultHash(finalResultInput),
        resolverPayload: "private-resolver-payload",
      },
      lastEventSequence: 9,
    } as unknown as ArenaRunStateV1;

    const projected = projectArenaState(completed);
    const serialized = JSON.stringify(projected);

    expect(projected.finalResult).toEqual({
      ...finalResultInput,
      finalResultHash: calculateFinalResultHash(finalResultInput),
    });
    expect(projected.portfolios.alpha.updatedAtCheckpoint).toBe("FINAL");
    expect(projected.portfolios.beta.updatedAtCheckpoint).toBe("FINAL");
    expect(projected.leader).toEqual({ result: "DRAW", provisional: false });
    expect(projected).not.toHaveProperty("nextCheckpointId");
    expect(serialized).not.toContain("private-alpha-settlement");
    expect(serialized).not.toContain("private-resolver-payload");
    expect(publicArenaStateV1Schema.parse(projected)).toEqual(projected);
  });

  it("fails closed with sanitized errors for unknown or inconsistent events", () => {
    const state = revealedState();
    const unknown = {
      eventId: `${manifest.arenaId}:4`,
      arenaId: manifest.arenaId,
      sequence: 4,
      type: "PRIVATE_MODEL_TRACE",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "KICKOFF",
      publicPayload: { secret: "private-unknown-event-secret" },
    } as unknown as PersistedArenaEventV1;
    const inconsistent = {
      eventId: `${manifest.arenaId}:9`,
      arenaId: manifest.arenaId,
      sequence: 9,
      type: "ROUND_REVEALED",
      occurredAtUtc: "2026-07-13T12:00:00.000Z",
      checkpointId: "M15",
      publicPayload: { secret: "private-inconsistent-event-secret" },
    } as unknown as PersistedArenaEventV1;

    expect(() => projectArenaEvent(state, unknown)).toThrow(
      expect.objectContaining<Partial<PublicProjectionError>>({
        code: "UNKNOWN_EVENT_TYPE",
        message: "Arena public projection failed",
      }),
    );
    expect(() => projectArenaEvent(state, inconsistent)).toThrow(
      expect.objectContaining<Partial<PublicProjectionError>>({
        code: "INCONSISTENT_EVENT",
        message: "Arena public projection failed",
      }),
    );
    for (const secret of [
      "private-unknown-event-secret",
      "private-inconsistent-event-secret",
    ]) {
      try {
        projectArenaEvent(state, secret.includes("unknown") ? unknown : inconsistent);
      } catch (error) {
        expect(String(error)).not.toContain(secret);
      }
    }
  });
});
