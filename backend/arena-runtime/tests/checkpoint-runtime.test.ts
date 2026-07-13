import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createFakeAgentAdapter } from "../src/adapters/agents/index.js";
import { createRecordedDataAdapter } from "../src/adapters/data/index.js";
import { initializePortfolio, settlePortfolio } from "../src/engine/index.js";
import { createCheckpointOrchestrator } from "../src/services/index.js";

async function loadRecordedFixture(): Promise<unknown> {
  const contents = await readFile(
    new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
    "utf8",
  );

  return JSON.parse(contents) as unknown;
}

interface MutableRecordedFixture {
  arenaId: string;
  records: Array<{
    providerSequence: number;
    snapshotId: string;
    sourceEventId: string;
    checkpointId: string;
    freshness: { suspended: boolean };
    finalResult?: string;
  }>;
}

describe("recorded data adapter", () => {
  it("builds ordered canonical decision snapshots and exposes FINAL result separately", async () => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());
    const checkpoints = ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75"] as const;
    const snapshots = checkpoints.map((checkpointId) => adapter.getSnapshot(checkpointId));

    expect({
      snapshotOrder: snapshots.map(
        ({ providerSequence, checkpointId, snapshotId, sourceEventId, source }) => ({
          providerSequence,
          checkpointId,
          snapshotId,
          sourceEventId,
          source,
        }),
      ),
      kickoff: snapshots[0],
      finalResult: adapter.getFinalResult(),
    }).toEqual({
      snapshotOrder: [
        {
          providerSequence: 1,
          checkpointId: "KICKOFF",
          snapshotId: "snapshot-kickoff",
          sourceEventId: "txline-event-001",
          source: "TXLINE_RECORDED",
        },
        {
          providerSequence: 2,
          checkpointId: "M15",
          snapshotId: "snapshot-m15",
          sourceEventId: "txline-event-002",
          source: "TXLINE_RECORDED",
        },
        {
          providerSequence: 3,
          checkpointId: "M30",
          snapshotId: "snapshot-m30",
          sourceEventId: "txline-event-003",
          source: "TXLINE_RECORDED",
        },
        {
          providerSequence: 4,
          checkpointId: "HALFTIME",
          snapshotId: "snapshot-halftime",
          sourceEventId: "txline-event-004",
          source: "TXLINE_RECORDED",
        },
        {
          providerSequence: 5,
          checkpointId: "M60",
          snapshotId: "snapshot-m60",
          sourceEventId: "txline-event-005",
          source: "TXLINE_RECORDED",
        },
        {
          providerSequence: 6,
          checkpointId: "M75",
          snapshotId: "snapshot-m75",
          sourceEventId: "txline-event-006",
          source: "TXLINE_RECORDED",
        },
      ],
      kickoff: {
        schemaVersion: 1,
        providerSequence: 1,
        snapshotId: "snapshot-kickoff",
        snapshotHash: "2018938175bbaf1f70e6d4b80befb74815e3b52fad192a9f960e15b7e7d3a37b",
        arenaId: "arena-replay-001",
        fixtureId: "fixture-recorded-001",
        checkpointId: "KICKOFF",
        observedAtUtc: "2026-07-13T12:00:00.000Z",
        sourceEventId: "txline-event-001",
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
      },
      finalResult: "HOME",
    });
  });

  it("feeds FINAL result directly into deterministic settlement without an agent call", async () => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());

    expect(
      settlePortfolio(
        {
          agentId: "alpha",
          cashMicros: "10000000",
          unitMicros: { HOME: "30000000", DRAW: "40000000", AWAY: "50000000" },
          navMicros: "0",
          returnBps: 0,
          updatedAtCheckpoint: "M75",
        },
        adapter.getFinalResult(),
        "100000000",
      ),
    ).toEqual({
      agentId: "alpha",
      cashMicros: "10000000",
      unitMicros: { HOME: "30000000", DRAW: "40000000", AWAY: "50000000" },
      navMicros: "40000000",
      returnBps: -6000,
      updatedAtCheckpoint: "FINAL",
    });
  });

  it("rejects a recorded FINAL result that contradicts the finished score", async () => {
    const fixture = (await loadRecordedFixture()) as {
      records: Array<{ checkpointId: string; finalResult?: string }>;
    };
    const finalRecord = fixture.records.find((record) => record.checkpointId === "FINAL");
    if (finalRecord === undefined) throw new Error("FINAL fixture record missing");
    finalRecord.finalResult = "AWAY";

    expect(() => createRecordedDataAdapter(fixture)).toThrow();
  });

  it.each([
    ["non-positive", (fixture: MutableRecordedFixture) => { fixture.records[0]!.providerSequence = 0; }],
    ["duplicate", (fixture: MutableRecordedFixture) => { fixture.records[1]!.providerSequence = 1; }],
    ["decreasing", (fixture: MutableRecordedFixture) => {
      fixture.records[0]!.providerSequence = 2;
      fixture.records[1]!.providerSequence = 1;
    }],
  ])("rejects %s provider sequences", async (_case, mutate) => {
    const fixture = (await loadRecordedFixture()) as MutableRecordedFixture;
    mutate(fixture);

    expect(() => createRecordedDataAdapter(fixture)).toThrow();
  });

  it.each([
    ["snapshot IDs", (fixture: MutableRecordedFixture) => {
      fixture.records[1]!.snapshotId = fixture.records[0]!.snapshotId;
    }],
    ["source event IDs", (fixture: MutableRecordedFixture) => {
      fixture.records[1]!.sourceEventId = fixture.records[0]!.sourceEventId;
    }],
  ])("rejects duplicate %s", async (_case, mutate) => {
    const fixture = (await loadRecordedFixture()) as MutableRecordedFixture;
    mutate(fixture);

    expect(() => createRecordedDataAdapter(fixture)).toThrow();
  });
});

describe("checkpoint orchestrator", () => {
  it("calls independent agents with one identical snapshot and reveals both decisions together", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    const receivedSnapshots: string[] = [];
    const receivedPortfolioAgents: string[] = [];
    const alphaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "alpha" as const,
      action: "TARGET_ALLOCATION" as const,
      targetAllocationBps: { cash: 0, HOME: 10_000, DRAW: 0, AWAY: 0 },
      publicExplanation: "Allocate to HOME from the supplied kickoff snapshot.",
    };
    const betaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "beta" as const,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep the initial cash portfolio.",
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async (request) => {
          receivedSnapshots.push(JSON.stringify(request.snapshot));
          receivedPortfolioAgents.push(request.portfolio.agentId);
          return alphaDecision;
        }),
        beta: createFakeAgentAdapter("beta", async (request) => {
          receivedSnapshots.push(JSON.stringify(request.snapshot));
          receivedPortfolioAgents.push(request.portfolio.agentId);
          return betaDecision;
        }),
      },
      timeoutMs: 100,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });

    expect({
      snapshotPayloadsMatch:
        receivedSnapshots.length === 2 && receivedSnapshots[0] === receivedSnapshots[1],
      snapshotIds: receivedSnapshots.map(
        (snapshot) => (JSON.parse(snapshot) as { snapshotId: string }).snapshotId,
      ),
      portfolioAgents: receivedPortfolioAgents.sort(),
      portfolios: result.portfolios,
      events: result.events.map(({ sequence, type, agentId, publicPayload }) => ({
        sequence,
        type,
        agentId,
        publicPayload,
      })),
    }).toEqual({
      snapshotPayloadsMatch: true,
      snapshotIds: ["snapshot-kickoff", "snapshot-kickoff"],
      portfolioAgents: ["alpha", "beta"],
      portfolios: {
        alpha: {
          agentId: "alpha",
          cashMicros: "0",
          unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
          navMicros: "100000000",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
        beta: initializePortfolio("beta", "100000000"),
      },
      events: [
        {
          sequence: 1,
          type: "CHECKPOINT_OPENED",
          agentId: undefined,
          publicPayload: { snapshotId: "snapshot-kickoff" },
        },
        {
          sequence: 2,
          type: "AGENTS_ANALYZING",
          agentId: undefined,
          publicPayload: {},
        },
        {
          sequence: 3,
          type: "DECISION_RECEIVED",
          agentId: "alpha",
          publicPayload: { status: "RECEIVED" },
        },
        {
          sequence: 4,
          type: "DECISION_RECEIVED",
          agentId: "beta",
          publicPayload: { status: "RECEIVED" },
        },
        {
          sequence: 5,
          type: "ROUND_REVEALED",
          agentId: undefined,
          publicPayload: { decisions: { alpha: alphaDecision, beta: betaDecision } },
        },
        {
          sequence: 6,
          type: "ROUND_COMPLETE",
          agentId: undefined,
          publicPayload: {},
        },
      ],
    });
  });

  it("converts a synchronous adapter throw into PROCESS_FAILURE", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    const betaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "beta" as const,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep cash.",
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", () => {
          throw new Error("synchronous fake failure");
        }),
        beta: createFakeAgentAdapter("beta", async () => betaDecision),
      },
      timeoutMs: 100,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });

    expect(
      result.events.find(
        (event) => event.type === "MISSED_DECISION_ROUND" && event.agentId === "alpha",
      )?.publicPayload,
    ).toEqual({ reason: "PROCESS_FAILURE" });
  });

  it("repairs one invalid output with the same snapshot and portfolio before reveal", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    const alphaRequests: Array<{
      attempt: number;
      snapshot: string;
      portfolio: string;
      validationErrors: readonly string[];
    }> = [];
    const alphaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "alpha" as const,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep cash after reviewing the supplied snapshot.",
    };
    const betaDecision = { ...alphaDecision, agentId: "beta" as const };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async (request) => {
          alphaRequests.push({
            attempt: request.attempt,
            snapshot: JSON.stringify(request.snapshot),
            portfolio: JSON.stringify(request.portfolio),
            validationErrors: request.validationErrors,
          });
          return request.attempt === 0 ? {} : alphaDecision;
        }),
        beta: createFakeAgentAdapter("beta", async () => betaDecision),
      },
      timeoutMs: 100,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });
    const revealIndex = result.events.findIndex((event) => event.type === "ROUND_REVEALED");

    expect({
      attempts: alphaRequests.map(({ attempt }) => attempt),
      repairHasErrors: (alphaRequests[1]?.validationErrors.length ?? 0) > 0,
      sameSnapshot: alphaRequests[0]?.snapshot === alphaRequests[1]?.snapshot,
      samePortfolio: alphaRequests[0]?.portfolio === alphaRequests[1]?.portfolio,
      eventOrder: result.events.map(({ type, agentId }) => [type, agentId]),
      decisionsPrivateBeforeReveal: !JSON.stringify(result.events.slice(0, revealIndex)).includes(
        "targetAllocationBps",
      ),
    }).toEqual({
      attempts: [0, 1],
      repairHasErrors: true,
      sameSnapshot: true,
      samePortfolio: true,
      eventOrder: [
        ["CHECKPOINT_OPENED", undefined],
        ["AGENTS_ANALYZING", undefined],
        ["DECISION_RECEIVED", "alpha"],
        ["RECHECKING_DECISION", "alpha"],
        ["DECISION_RECEIVED", "beta"],
        ["DECISION_RECEIVED", "alpha"],
        ["ROUND_REVEALED", undefined],
        ["ROUND_COMPLETE", undefined],
      ],
      decisionsPrivateBeforeReveal: true,
    });
  });

  it("runs Alpha and Beta repair attempts concurrently", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let repairCount = 0;
    let notifyBothRepairs!: () => void;
    let releaseRepairs!: () => void;
    const bothRepairsStarted = new Promise<void>((resolve) => {
      notifyBothRepairs = resolve;
    });
    const repairRelease = new Promise<void>((resolve) => {
      releaseRepairs = resolve;
    });
    const handler = async (request: {
      attempt: 0 | 1;
      snapshot: { arenaId: string; snapshotId: string; checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75" };
      portfolio: { agentId: "alpha" | "beta" };
    }) => {
      if (request.attempt === 0) return {};
      repairCount += 1;
      if (repairCount === 2) notifyBothRepairs();
      await repairRelease;
      return {
        schemaVersion: 1 as const,
        arenaId: request.snapshot.arenaId,
        snapshotId: request.snapshot.snapshotId,
        checkpointId: request.snapshot.checkpointId,
        agentId: request.portfolio.agentId,
        action: "NO_TRADE" as const,
        publicExplanation: "Repaired decision.",
      };
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", handler),
        beta: createFakeAgentAdapter("beta", handler),
      },
      timeoutMs: 1_000,
    });

    const run = orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });
    await bothRepairsStarted;
    const repairsStartedBeforeRelease = repairCount;
    releaseRepairs();
    const result = await run;

    expect({
      repairsStartedBeforeRelease,
      missed: result.events.some((event) => event.type === "MISSED_DECISION_ROUND"),
    }).toEqual({ repairsStartedBeforeRelease: 2, missed: false });
  });

  it("marks a repeatedly invalid agent as missed while executing the valid opponent", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    const alphaAttempts: number[] = [];
    const betaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "beta" as const,
      action: "TARGET_ALLOCATION" as const,
      targetAllocationBps: { cash: 0, HOME: 10_000, DRAW: 0, AWAY: 0 },
      publicExplanation: "Allocate to HOME using the supplied M15 snapshot.",
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async (request) => {
          alphaAttempts.push(request.attempt);
          return {};
        }),
        beta: createFakeAgentAdapter("beta", async () => betaDecision),
      },
      timeoutMs: 100,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: {
        agentId: "alpha",
        cashMicros: "0",
        unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
        navMicros: "100000000",
        returnBps: 0,
        updatedAtCheckpoint: "KICKOFF",
      },
      beta: initializePortfolio("beta", "100000000"),
    });

    expect({
      alphaAttempts,
      portfolios: result.portfolios,
      eventOrder: result.events.map(({ type, agentId, publicPayload }) => ({
        type,
        agentId,
        publicPayload,
      })),
    }).toEqual({
      alphaAttempts: [0, 1],
      portfolios: {
        alpha: {
          agentId: "alpha",
          cashMicros: "0",
          unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
          navMicros: "100000000",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
        beta: {
          agentId: "beta",
          cashMicros: "0",
          unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
          navMicros: "100000000",
          returnBps: 0,
          updatedAtCheckpoint: "KICKOFF",
        },
      },
      eventOrder: [
        { type: "CHECKPOINT_OPENED", agentId: undefined, publicPayload: { snapshotId: "snapshot-kickoff" } },
        { type: "AGENTS_ANALYZING", agentId: undefined, publicPayload: {} },
        { type: "DECISION_RECEIVED", agentId: "alpha", publicPayload: { status: "RECEIVED" } },
        { type: "RECHECKING_DECISION", agentId: "alpha", publicPayload: { attempt: 1 } },
        { type: "DECISION_RECEIVED", agentId: "beta", publicPayload: { status: "RECEIVED" } },
        { type: "DECISION_RECEIVED", agentId: "alpha", publicPayload: { status: "RECEIVED" } },
        { type: "MISSED_DECISION_ROUND", agentId: "alpha", publicPayload: { reason: "INVALID_OUTPUT" } },
        { type: "ROUND_REVEALED", agentId: undefined, publicPayload: { decisions: { beta: betaDecision } } },
        { type: "ROUND_COMPLETE", agentId: undefined, publicPayload: {} },
      ],
    });
  });

  it("times out one agent without blocking or fabricating its decision", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let alphaSignalAborted = false;
    const betaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "beta" as const,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep cash.",
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async (request) => {
          await new Promise<void>((resolve) => {
            request.signal.addEventListener("abort", () => {
              alphaSignalAborted = request.signal.aborted;
              resolve();
            });
          });
          return { ...betaDecision, agentId: "alpha" as const };
        }),
        beta: createFakeAgentAdapter("beta", async () => betaDecision),
      },
      timeoutMs: 1,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: {
        agentId: "alpha",
        cashMicros: "0",
        unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
        navMicros: "100000000",
        returnBps: 0,
        updatedAtCheckpoint: "KICKOFF",
      },
      beta: initializePortfolio("beta", "100000000"),
    });

    expect({
      alphaSignalAborted,
      alpha: result.portfolios.alpha,
      events: result.events.map(({ type, agentId, publicPayload }) => ({
        type,
        agentId,
        publicPayload,
      })),
    }).toEqual({
      alphaSignalAborted: true,
      alpha: {
        agentId: "alpha",
        cashMicros: "0",
        unitMicros: { HOME: "200000000", DRAW: "0", AWAY: "0" },
        navMicros: "100000000",
        returnBps: 0,
        updatedAtCheckpoint: "KICKOFF",
      },
      events: [
        { type: "CHECKPOINT_OPENED", agentId: undefined, publicPayload: { snapshotId: "snapshot-kickoff" } },
        { type: "AGENTS_ANALYZING", agentId: undefined, publicPayload: {} },
        { type: "MISSED_DECISION_ROUND", agentId: "alpha", publicPayload: { reason: "TIMEOUT" } },
        { type: "DECISION_RECEIVED", agentId: "beta", publicPayload: { status: "RECEIVED" } },
        { type: "ROUND_REVEALED", agentId: undefined, publicPayload: { decisions: { beta: betaDecision } } },
        { type: "ROUND_COMPLETE", agentId: undefined, publicPayload: {} },
      ],
    });
  });

  it("preserves both portfolios on a suspended shared snapshot without calling agents", async () => {
    const fixture = (await loadRecordedFixture()) as {
      records: Array<{ checkpointId: string; freshness: { suspended: boolean } }>;
    };
    const kickoffRecord = fixture.records.find((record) => record.checkpointId === "KICKOFF");
    if (kickoffRecord === undefined) throw new Error("KICKOFF fixture record missing");
    kickoffRecord.freshness.suspended = true;
    let agentCalls = 0;
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter: createRecordedDataAdapter(fixture),
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => {
          agentCalls += 1;
          return {};
        }),
        beta: createFakeAgentAdapter("beta", async () => {
          agentCalls += 1;
          return {};
        }),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const result = await orchestrator.runCheckpoint("KICKOFF", portfolios);

    expect({
      agentCalls,
      portfolios: result.portfolios,
      events: result.events.map(({ sequence, type, publicPayload }) => ({
        sequence,
        type,
        publicPayload,
      })),
    }).toEqual({
      agentCalls: 0,
      portfolios,
      events: [
        {
          sequence: 1,
          type: "GLOBAL_MISSED_DECISION_ROUND",
          publicPayload: { reason: "SUSPENDED_SNAPSHOT" },
        },
        { sequence: 2, type: "ROUND_COMPLETE", publicPayload: {} },
      ],
    });
  });

  it.each([
    ["DATA_FAILURE", (adapter: ReturnType<typeof createRecordedDataAdapter>) => ({
      ...adapter,
      getSnapshot() {
        throw new Error("recorded data unavailable");
      },
    })],
    ["INVALID_SNAPSHOT", (adapter: ReturnType<typeof createRecordedDataAdapter>) => ({
      ...adapter,
      getSnapshot(checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75") {
        return { ...adapter.getSnapshot(checkpointId), snapshotHash: "0".repeat(64) };
      },
    })],
  ])("turns %s into a global missed round", async (reason, createFaultyAdapter) => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());
    let agentCalls = 0;
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter: createFaultyAdapter(adapter),
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => { agentCalls += 1; return {}; }),
        beta: createFakeAgentAdapter("beta", async () => { agentCalls += 1; return {}; }),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const result = await orchestrator.runCheckpoint("KICKOFF", portfolios);

    expect({
      agentCalls,
      portfolios: result.portfolios,
      events: result.events.map(({ type, publicPayload }) => ({ type, publicPayload })),
    }).toEqual({
      agentCalls: 0,
      portfolios,
      events: [
        { type: "GLOBAL_MISSED_DECISION_ROUND", publicPayload: { reason } },
        { type: "ROUND_COMPLETE", publicPayload: {} },
      ],
    });
  });

  it("rejects a valid snapshot belonging to another arena", async () => {
    const fixture = (await loadRecordedFixture()) as MutableRecordedFixture;
    fixture.arenaId = "other-arena";
    let agentCalls = 0;
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter: createRecordedDataAdapter(fixture),
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => { agentCalls += 1; return {}; }),
        beta: createFakeAgentAdapter("beta", async () => { agentCalls += 1; return {}; }),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const result = await orchestrator.runCheckpoint("KICKOFF", portfolios);

    expect({
      agentCalls,
      portfolios: result.portfolios,
      failure: result.events[0]?.publicPayload,
    }).toEqual({
      agentCalls: 0,
      portfolios,
      failure: { reason: "SNAPSHOT_ARENA_MISMATCH" },
    });
  });

  it.each([
    ["PROCESS_FAILURE", async () => Promise.reject(new Error("fake process failed"))],
    ["MISSING_OUTPUT", async () => undefined],
  ])("records %s as a missed round without repair", async (reason, alphaHandler) => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let alphaCalls = 0;
    const betaDecision = {
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId: "beta" as const,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep cash.",
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => {
          alphaCalls += 1;
          return alphaHandler();
        }),
        beta: createFakeAgentAdapter("beta", async () => betaDecision),
      },
      timeoutMs: 100,
    });

    const result = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });
    const missed = result.events.find(
      (event) => event.type === "MISSED_DECISION_ROUND" && event.agentId === "alpha",
    );
    const reveal = result.events.find((event) => event.type === "ROUND_REVEALED");

    expect({ alphaCalls, missed: missed?.publicPayload, reveal: reveal?.publicPayload }).toEqual({
      alphaCalls: 1,
      missed: { reason },
      reveal: { decisions: { beta: betaDecision } },
    });
  });

  it("rejects FINAL before calling either agent", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let agentCalls = 0;
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => {
          agentCalls += 1;
          return {};
        }),
        beta: createFakeAgentAdapter("beta", async () => {
          agentCalls += 1;
          return {};
        }),
      },
      timeoutMs: 100,
    });
    let error: unknown;

    try {
      await orchestrator.runCheckpoint("FINAL", {
        alpha: initializePortfolio("alpha", "100000000"),
        beta: initializePortfolio("beta", "100000000"),
      });
    } catch (caught) {
      error = caught;
    }

    expect({ agentCalls, message: error instanceof Error ? error.message : undefined }).toEqual({
      agentCalls: 0,
      message: "FINAL is not a decision checkpoint",
    });
  });

  it("keeps event sequence monotonic across checkpoints in one instance", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    const decisionHandler = async (request: {
      snapshot: { arenaId: string; snapshotId: string; checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75" };
      portfolio: { agentId: "alpha" | "beta" };
    }) => ({
      schemaVersion: 1 as const,
      arenaId: request.snapshot.arenaId,
      snapshotId: request.snapshot.snapshotId,
      checkpointId: request.snapshot.checkpointId,
      agentId: request.portfolio.agentId,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep current positions.",
    });
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", decisionHandler),
        beta: createFakeAgentAdapter("beta", decisionHandler),
      },
      timeoutMs: 100,
    });
    const kickoff = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    });
    if (kickoff.events[0] !== undefined) kickoff.events[0].type = "TAMPERED";
    const m15 = await orchestrator.runCheckpoint("M15", kickoff.portfolios);

    expect({
      firstType: m15.events[0]?.type,
      sequence: m15.events.map(({ sequence, checkpointId }) => [sequence, checkpointId]),
    }).toEqual({
      firstType: "CHECKPOINT_OPENED",
      sequence: [
        [1, "KICKOFF"],
        [2, "KICKOFF"],
        [3, "KICKOFF"],
        [4, "KICKOFF"],
        [5, "KICKOFF"],
        [6, "KICKOFF"],
        [7, "M15"],
        [8, "M15"],
        [9, "M15"],
        [10, "M15"],
        [11, "M15"],
        [12, "M15"],
      ],
    });
  });

  it("rejects an out-of-order checkpoint without advancing or calling agents", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let agentCalls = 0;
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async () => { agentCalls += 1; return {}; }),
        beta: createFakeAgentAdapter("beta", async () => { agentCalls += 1; return {}; }),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const result = await orchestrator.runCheckpoint("M15", portfolios);

    expect({ agentCalls, portfolios: result.portfolios, failure: result.events[0] }).toMatchObject({
      agentCalls: 0,
      portfolios,
      failure: {
        type: "GLOBAL_MISSED_DECISION_ROUND",
        publicPayload: { reason: "OUT_OF_ORDER_CHECKPOINT" },
      },
    });
  });

  it("returns the cached result for duplicate checkpoint execution", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let agentCalls = 0;
    const handler = async (request: {
      snapshot: { arenaId: string; snapshotId: string; checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75" };
      portfolio: { agentId: "alpha" | "beta" };
    }) => {
      agentCalls += 1;
      return {
        schemaVersion: 1 as const,
        arenaId: request.snapshot.arenaId,
        snapshotId: request.snapshot.snapshotId,
        checkpointId: request.snapshot.checkpointId,
        agentId: request.portfolio.agentId,
        action: "NO_TRADE" as const,
        publicExplanation: "Keep current positions.",
      };
    };
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", handler),
        beta: createFakeAgentAdapter("beta", handler),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const first = await orchestrator.runCheckpoint("KICKOFF", portfolios);
    const duplicate = await orchestrator.runCheckpoint("KICKOFF", {
      alpha: { ...portfolios.alpha, cashMicros: "1" },
      beta: { ...portfolios.beta, cashMicros: "1" },
    });

    expect({ agentCalls, duplicate }).toEqual({ agentCalls: 2, duplicate: first });
  });

  it("isolates each agent request from mutations by the other adapter", async () => {
    const dataAdapter = createRecordedDataAdapter(await loadRecordedFixture());
    let betaHomeScore = -1;
    const decisionFor = (agentId: "alpha" | "beta") => ({
      schemaVersion: 1 as const,
      arenaId: "arena-replay-001",
      snapshotId: "snapshot-kickoff",
      checkpointId: "KICKOFF" as const,
      agentId,
      action: "NO_TRADE" as const,
      publicExplanation: "Keep cash.",
    });
    const orchestrator = createCheckpointOrchestrator({
      arenaId: "arena-replay-001",
      startingBankrollMicros: "100000000",
      dataAdapter,
      agents: {
        alpha: createFakeAgentAdapter("alpha", async (request) => {
          request.snapshot.match.homeScore = 99;
          request.portfolio.cashMicros = "1";
          return decisionFor("alpha");
        }),
        beta: createFakeAgentAdapter("beta", async (request) => {
          betaHomeScore = request.snapshot.match.homeScore;
          return decisionFor("beta");
        }),
      },
      timeoutMs: 100,
    });
    const portfolios = {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    };

    const result = await orchestrator.runCheckpoint("KICKOFF", portfolios);

    expect({
      betaHomeScore,
      originalAlphaCash: portfolios.alpha.cashMicros,
      resultAlphaCash: result.portfolios.alpha.cashMicros,
    }).toEqual({
      betaHomeScore: 0,
      originalAlphaCash: "100000000",
      resultAlphaCash: "100000000",
    });
  });
});
