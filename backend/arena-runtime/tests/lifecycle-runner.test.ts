import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createRecordedDataAdapter } from "../src/adapters/data/index.js";
import {
  CHECKPOINT_IDS,
  calculateSnapshotHash,
} from "../src/contracts/index.js";
import {
  createArenaLifecycleRunner,
  createInMemoryArenaLifecycleStore,
  ArenaLifecycleStoreError,
  type ArenaLifecycleDataSource,
  type ArenaLifecycleStore,
} from "../src/services/index.js";

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
  runtimeVersion: "6b",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "p0-final-nav-v1",
  agentTimeoutMs: 30_000,
  agents: {
    alpha: {
      adapterId: "fake",
      adapterVersion: "1",
      strategyId: "alpha-test",
      strategyVersion: "1",
    },
    beta: {
      adapterId: "fake",
      adapterVersion: "1",
      strategyId: "beta-test",
      strategyVersion: "1",
    },
  },
} as const;

function unavailableDataSource(): ArenaLifecycleDataSource {
  return {
    async prepare() {
      throw new Error("not used");
    },
    getSnapshot() {
      throw new Error("not used");
    },
    getFinalResult() {
      throw new Error("not used");
    },
  };
}

function kickoffSnapshot() {
  const hashInput = {
    schemaVersion: 1 as const,
    providerSequence: 1,
    snapshotId: "snapshot-kickoff",
    arenaId: manifest.arenaId,
    fixtureId: manifest.fixtureId,
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

function waitUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const rejectAbort = () => reject(new Error("aborted"));
    if (signal.aborted) rejectAbort();
    else signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

async function loadRecordedFixture(): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

function heartbeatWait(_delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function rejectingHeartbeatWait(
  _delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((_, reject) => {
    const rejectAbort = () => reject(new Error("heartbeat wait aborted"));
    if (signal.aborted) rejectAbort();
    else signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

describe("Arena lifecycle runner", () => {
  it("creates an idempotent READY arena with equal manifest bankrolls", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => unavailableDataSource(),
      agents: {
        alpha: { agentId: "alpha", invoke: async () => undefined },
        beta: { agentId: "beta", invoke: async () => undefined },
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: async () => undefined,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });

    const created = await runner.create(manifest);
    const duplicate = await runner.create(manifest);

    expect({ created, duplicate }).toEqual({
      created: {
        schemaVersion: 1,
        revision: 0,
        manifest,
        runtimeMetadata,
        phase: "READY",
        portfolios: {
          alpha: {
            agentId: "alpha",
            cashMicros: "100000000",
            unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
            navMicros: "100000000",
            returnBps: 0,
            updatedAtCheckpoint: "KICKOFF",
          },
          beta: {
            agentId: "beta",
            cashMicros: "100000000",
            unitMicros: { HOME: "0", DRAW: "0", AWAY: "0" },
            navMicros: "100000000",
            returnBps: 0,
            updatedAtCheckpoint: "KICKOFF",
          },
        },
        checkpoints: [],
        lastEventSequence: 1,
      },
      duplicate: created,
    });
    await expect(store.read(manifest.arenaId, 0)).resolves.toMatchObject({
      events: [
        {
          eventId: "arena-replay-001:1",
          sequence: 1,
          type: "ARENA_READY",
          occurredAtUtc: "2026-07-13T10:00:00.000Z",
          publicPayload: {},
        },
      ],
    });
  });

  it("persists pending work and opening events before agents run, then preserves them on abort", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let agentCalls = 0;
    let notifyBothStarted!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      notifyBothStarted = resolve;
    });
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke({ signal }: { signal: AbortSignal }) {
        agentCalls += 1;
        if (agentCalls === 2) notifyBothStarted();
        return waitUntilAborted(signal);
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          expect(checkpointId).toBe("KICKOFF");
        },
        getSnapshot: () => kickoffSnapshot(),
        getFinalResult() {
          throw new Error("not used");
        },
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: rejectingHeartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);
    const controller = new AbortController();

    const run = runner.run(manifest.arenaId, controller.signal);
    await bothStarted;
    const durableBeforeAbort = await store.read(manifest.arenaId, 0);
    controller.abort();
    await expect(run).rejects.toMatchObject({ code: "ABORTED" });

    expect(durableBeforeAbort).toMatchObject({
      state: {
        revision: 1,
        phase: "RUNNING",
        pendingCheckpoint: {
          checkpointId: "KICKOFF",
          snapshot: { snapshotId: "snapshot-kickoff" },
        },
        lastEventSequence: 3,
      },
      events: [
        { sequence: 1, type: "ARENA_READY" },
        { sequence: 2, type: "CHECKPOINT_OPENED" },
        { sequence: 3, type: "AGENTS_ANALYZING" },
      ],
    });
    await expect(store.read(manifest.arenaId, 0)).resolves.toEqual(
      durableBeforeAbort,
    );
  });

  it("joins concurrent calls and completes all Replay checkpoints plus FINAL", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const prepared: string[] = [];
    let agentCalls = 0;
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        agentCalls += 1;
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          prepared.push(checkpointId);
        },
        getSnapshot: recorded.getSnapshot,
        getFinalResult: recorded.getFinalResult,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);
    const controller = new AbortController();

    const first = runner.run(manifest.arenaId, controller.signal);
    const joined = runner.run(manifest.arenaId, controller.signal);
    expect(joined).toBe(first);
    const completed = await first;
    const persisted = await store.read(manifest.arenaId, 0);

    expect({
      phase: completed.phase,
      checkpointIds: completed.checkpoints.map(({ checkpointId }) => checkpointId),
      prepared,
      agentCalls,
      finalResult: completed.finalResult,
      eventSequence:
        persisted === "NOT_FOUND"
          ? []
          : persisted.events.map(({ sequence }) => sequence),
      eventTypes:
        persisted === "NOT_FOUND"
          ? []
          : persisted.events.map(({ type }) => type),
    }).toEqual({
      phase: "COMPLETED",
      checkpointIds: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75"],
      prepared: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      agentCalls: 12,
      finalResult: {
        schemaVersion: 1,
        arenaId: "arena-replay-001",
        winningAssetId: "HOME",
        winner: "DRAW",
        alphaFinalNavMicros: "100000000",
        betaFinalNavMicros: "100000000",
        finalResultHash:
          "f95a489df074ec44b9556c0ac0a8b307c46810be3429b663a9df65183e615ccf",
      },
      eventSequence: Array.from({ length: 39 }, (_, index) => index + 1),
      eventTypes: [
        "ARENA_READY",
        ...Array.from({ length: 6 }, () => [
          "CHECKPOINT_OPENED",
          "AGENTS_ANALYZING",
          "DECISION_RECEIVED",
          "DECISION_RECEIVED",
          "ROUND_REVEALED",
          "ROUND_COMPLETE",
        ]).flat(),
        "FINALIZING",
        "COMPLETED",
      ],
    });
  });

  it("persists a suspended snapshot as global missed without calling agents", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const calledCheckpoints: string[] = [];
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        calledCheckpoints.push(request.snapshot.checkpointId);
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare() {},
        getSnapshot(checkpointId) {
          const snapshot = recorded.getSnapshot(checkpointId);
          if (checkpointId !== "KICKOFF") return snapshot;
          const { snapshotHash: _snapshotHash, ...base } = snapshot;
          const suspended = {
            ...base,
            freshness: { ...base.freshness, suspended: true },
          };
          return {
            ...suspended,
            snapshotHash: calculateSnapshotHash(suspended),
          };
        },
        getFinalResult: recorded.getFinalResult,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);

    const completed = await runner.run(
      manifest.arenaId,
      new AbortController().signal,
    );
    const kickoff = completed.checkpoints[0];
    const persisted = await store.read(manifest.arenaId, 0);

    expect({
      kickoff,
      calledCheckpoints,
      kickoffEvents:
        persisted === "NOT_FOUND"
          ? []
          : persisted.events
              .filter(({ checkpointId }) => checkpointId === "KICKOFF")
              .map(({ type }) => type),
    }).toMatchObject({
      kickoff: {
        outcome: "GLOBAL_MISSED",
        snapshot: { freshness: { suspended: true } },
        revealedDecisions: {},
        failures: [{ scope: "GLOBAL", reason: "SUSPENDED_SNAPSHOT" }],
        portfoliosBefore: kickoff?.portfoliosAfter,
      },
      calledCheckpoints: [
        "M15",
        "M15",
        "M30",
        "M30",
        "HALFTIME",
        "HALFTIME",
        "M60",
        "M60",
        "M75",
        "M75",
      ],
      kickoffEvents: ["GLOBAL_MISSED_DECISION_ROUND", "ROUND_COMPLETE"],
    });
  });

  it("commits a shared preparation failure as global missed and continues", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const calledCheckpoints: string[] = [];
    let kickoffFailed = false;
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        calledCheckpoints.push(request.snapshot.checkpointId);
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          if (checkpointId === "KICKOFF" && !kickoffFailed) {
            kickoffFailed = true;
            throw new Error("provider unavailable");
          }
        },
        getSnapshot: recorded.getSnapshot,
        getFinalResult: recorded.getFinalResult,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);

    const completed = await runner.run(
      manifest.arenaId,
      new AbortController().signal,
    );

    expect({ kickoff: completed.checkpoints[0], calledCheckpoints }).toMatchObject({
      kickoff: {
        outcome: "GLOBAL_MISSED",
        revealedDecisions: {},
        failures: [{ scope: "GLOBAL", reason: "DATA_FAILURE" }],
      },
      calledCheckpoints: [
        "M15",
        "M15",
        "M30",
        "M30",
        "HALFTIME",
        "HALFTIME",
        "M60",
        "M60",
        "M75",
        "M75",
      ],
    });
    expect(completed.checkpoints[0]?.snapshot).toBeUndefined();
    expect(completed.checkpoints[0]?.portfoliosAfter).toEqual(
      completed.checkpoints[0]?.portfoliosBefore,
    );
  });

  it("recovers an applied commit whose response was lost without duplicate work", async () => {
    const durableStore = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let loseResponse = true;
    const store: ArenaLifecycleStore = {
      initialize: durableStore.initialize.bind(durableStore),
      read: durableStore.read.bind(durableStore),
      async acquire(arenaId, ownerId, expiresAtMs) {
        const lease = await durableStore.acquire(arenaId, ownerId, expiresAtMs);
        if (typeof lease === "string") return lease;
        return {
          get storedState() {
            return lease.storedState;
          },
          fencingToken: lease.fencingToken,
          renew: lease.renew.bind(lease),
          release: lease.release.bind(lease),
          async commit(input) {
            const committed = await lease.commit(input);
            if (loseResponse) {
              loseResponse = false;
              throw new Error("commit response lost");
            }
            return committed;
          },
        };
      },
    };
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const prepared: string[] = [];
    let agentCalls = 0;
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        agentCalls += 1;
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          prepared.push(checkpointId);
        },
        getSnapshot: recorded.getSnapshot,
        getFinalResult: recorded.getFinalResult,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);

    const completed = await runner.run(
      manifest.arenaId,
      new AbortController().signal,
    );
    const persisted = await store.read(manifest.arenaId, 0);

    expect({
      phase: completed.phase,
      prepared,
      agentCalls,
      eventCount: persisted === "NOT_FOUND" ? 0 : persisted.events.length,
    }).toEqual({
      phase: "COMPLETED",
      prepared: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      agentCalls: 12,
      eventCount: 39,
    });
  });

  it("resumes pending work from its stored snapshot without provider refresh", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let blockingCalls = 0;
    let notifyBlockingStarted!: () => void;
    const blockingStarted = new Promise<void>((resolve) => {
      notifyBlockingStarted = resolve;
    });
    const firstRunner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          expect(checkpointId).toBe("KICKOFF");
        },
        getSnapshot: () => kickoffSnapshot(),
        getFinalResult() {
          throw new Error("not used");
        },
      }),
      agents: {
        alpha: {
          agentId: "alpha",
          async invoke({ signal }) {
            blockingCalls += 1;
            if (blockingCalls === 2) notifyBlockingStarted();
            return waitUntilAborted(signal);
          },
        },
        beta: {
          agentId: "beta",
          async invoke({ signal }) {
            blockingCalls += 1;
            if (blockingCalls === 2) notifyBlockingStarted();
            return waitUntilAborted(signal);
          },
        },
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await firstRunner.create(manifest);
    const firstController = new AbortController();
    const interrupted = firstRunner.run(manifest.arenaId, firstController.signal);
    await blockingStarted;
    firstController.abort();
    await expect(interrupted).rejects.toMatchObject({ code: "ABORTED" });

    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const prepared: string[] = [];
    const readSnapshots: string[] = [];
    const resumedAgentCalls: string[] = [];
    const resumedAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        resumedAgentCalls.push(`${agentId}:${request.snapshot.checkpointId}`);
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const resumedRunner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          prepared.push(checkpointId);
        },
        getSnapshot(checkpointId) {
          readSnapshots.push(checkpointId);
          if (checkpointId === "KICKOFF") {
            throw new Error("pending snapshot must come from persistence");
          }
          return recorded.getSnapshot(checkpointId);
        },
        getFinalResult: recorded.getFinalResult,
      }),
      agents: {
        alpha: resumedAgent("alpha"),
        beta: resumedAgent("beta"),
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-b", ttlMs: 10_000, renewEveryMs: 1_000 },
    });

    const completed = await resumedRunner.run(
      manifest.arenaId,
      new AbortController().signal,
    );

    expect({
      phase: completed.phase,
      prepared,
      readSnapshots,
      firstCheckpointSnapshot: completed.checkpoints[0]?.snapshot?.snapshotId,
      firstAgentCalls: resumedAgentCalls.slice(0, 2),
    }).toEqual({
      phase: "COMPLETED",
      prepared: ["M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      readSnapshots: ["M15", "M30", "HALFTIME", "M60", "M75"],
      firstCheckpointSnapshot: "snapshot-kickoff",
      firstAgentCalls: ["alpha:KICKOFF", "beta:KICKOFF"],
    });
  });

  it("returns BUSY to another runner and propagates lease loss without a global miss", async () => {
    const durableStore = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const store: ArenaLifecycleStore = {
      initialize: durableStore.initialize.bind(durableStore),
      read: durableStore.read.bind(durableStore),
      async acquire(arenaId, ownerId, expiresAtMs) {
        const lease = await durableStore.acquire(arenaId, ownerId, expiresAtMs);
        if (typeof lease === "string") return lease;
        return {
          get storedState() {
            return lease.storedState;
          },
          fencingToken: lease.fencingToken,
          commit: lease.commit.bind(lease),
          async release() {
            await lease.release();
            throw new Error("lease release cleanup failed");
          },
          async renew() {
            throw new ArenaLifecycleStoreError(
              "LEASE_LOST",
              "Arena lifecycle lease is no longer active",
            );
          },
        };
      },
    };
    let releaseHeartbeat!: () => void;
    const heartbeatGate = new Promise<void>((resolve) => {
      releaseHeartbeat = resolve;
    });
    let agentCalls = 0;
    let notifyBothStarted!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      notifyBothStarted = resolve;
    });
    const createRunner = (ownerId: string) =>
      createArenaLifecycleRunner({
        store,
        dataSourceFactory: () => ({
          async prepare() {},
          getSnapshot: () => kickoffSnapshot(),
          getFinalResult() {
            throw new Error("not used");
          },
        }),
        agents: {
          alpha: {
            agentId: "alpha",
            async invoke({ signal }) {
              agentCalls += 1;
              if (agentCalls === 2) notifyBothStarted();
              return waitUntilAborted(signal);
            },
          },
          beta: {
            agentId: "beta",
            async invoke({ signal }) {
              agentCalls += 1;
              if (agentCalls === 2) notifyBothStarted();
              return waitUntilAborted(signal);
            },
          },
        },
        runtimeMetadata,
        timing: {
          nowMs: () => 1_000,
          wait: (_delayMs, signal) =>
            new Promise((resolve) => {
              heartbeatGate.then(resolve);
              if (signal.aborted) resolve();
              else signal.addEventListener("abort", () => resolve(), { once: true });
            }),
          waitForCheckpoint: async () => undefined,
        },
        lease: { ownerId, ttlMs: 10_000, renewEveryMs: 1_000 },
      });
    const firstRunner = createRunner("runner-a");
    const secondRunner = createRunner("runner-b");
    await firstRunner.create(manifest);

    const firstRun = firstRunner.run(
      manifest.arenaId,
      new AbortController().signal,
    );
    await bothStarted;
    await expect(
      secondRunner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toMatchObject({ code: "BUSY" });
    releaseHeartbeat();
    await expect(firstRun).rejects.toMatchObject({ code: "LEASE_LOST" });

    const persisted = await store.read(manifest.arenaId, 0);
    expect(persisted).toMatchObject({
      state: {
        revision: 1,
        pendingCheckpoint: { checkpointId: "KICKOFF" },
        checkpoints: [],
      },
      events: [
        { type: "ARENA_READY" },
        { type: "CHECKPOINT_OPENED" },
        { type: "AGENTS_ANALYZING" },
      ],
    });
  });

  it("keeps failed FINAL preparation durable as FINALIZING and resumes without agent calls", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    let firstAgentCalls = 0;
    const decisionAgent = (agentId: "alpha" | "beta", count: () => void) => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        count();
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const firstRunner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          if (checkpointId === "FINAL") throw new Error("final unavailable");
        },
        getSnapshot: recorded.getSnapshot,
        getFinalResult: recorded.getFinalResult,
      }),
      agents: {
        alpha: decisionAgent("alpha", () => {
          firstAgentCalls += 1;
        }),
        beta: decisionAgent("beta", () => {
          firstAgentCalls += 1;
        }),
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await firstRunner.create(manifest);
    await expect(
      firstRunner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toThrow("final unavailable");
    const finalizing = await store.read(manifest.arenaId, 0);

    let resumedAgentCalls = 0;
    const resumedPrepared: string[] = [];
    const resumedRunner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          resumedPrepared.push(checkpointId);
        },
        getSnapshot() {
          throw new Error("decision snapshots must not be read after FINALIZING");
        },
        getFinalResult: recorded.getFinalResult,
      }),
      agents: {
        alpha: decisionAgent("alpha", () => {
          resumedAgentCalls += 1;
        }),
        beta: decisionAgent("beta", () => {
          resumedAgentCalls += 1;
        }),
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 2_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-b", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    const completed = await resumedRunner.run(
      manifest.arenaId,
      new AbortController().signal,
    );

    expect({
      finalizing:
        finalizing === "NOT_FOUND"
          ? finalizing
          : {
              phase: finalizing.state.phase,
              checkpoints: finalizing.state.checkpoints.length,
              finalResult: finalizing.state.finalResult,
              lastEvent: finalizing.events.at(-1)?.type,
            },
      firstAgentCalls,
      resumedPrepared,
      resumedAgentCalls,
      completedPhase: completed.phase,
    }).toEqual({
      finalizing: {
        phase: "FINALIZING",
        checkpoints: 6,
        finalResult: undefined,
        lastEvent: "FINALIZING",
      },
      firstAgentCalls: 12,
      resumedPrepared: ["FINAL"],
      resumedAgentCalls: 0,
      completedPhase: "COMPLETED",
    });
  });

  it("does not mutate lifecycle state when caller aborts during preparation", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let notifyPreparing!: () => void;
    const preparing = new Promise<void>((resolve) => {
      notifyPreparing = resolve;
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(_checkpointId, signal) {
          notifyPreparing();
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else signal.addEventListener("abort", () => resolve(), { once: true });
          });
        },
        getSnapshot: () => kickoffSnapshot(),
        getFinalResult() {
          throw new Error("not used");
        },
      }),
      agents: {
        alpha: { agentId: "alpha", invoke: async () => undefined },
        beta: { agentId: "beta", invoke: async () => undefined },
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    const ready = await runner.create(manifest);
    const controller = new AbortController();

    const run = runner.run(manifest.arenaId, controller.signal);
    await preparing;
    controller.abort();
    await expect(run).rejects.toMatchObject({ code: "ABORTED" });

    await expect(store.read(manifest.arenaId, 0)).resolves.toEqual({
      state: ready,
      events: [
        {
          eventId: "arena-replay-001:1",
          arenaId: "arena-replay-001",
          sequence: 1,
          type: "ARENA_READY",
          occurredAtUtc: "2026-07-13T10:00:00.000Z",
          publicPayload: {},
        },
      ],
    });
  });

  it("runs LIVE through the same checkpoint and settlement semantics", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-001",
      mode: "LIVE" as const,
    };
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const prepared: string[] = [];
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: "KICKOFF" | "M15" | "M30" | "HALFTIME" | "M60" | "M75";
        };
      }) {
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Keep the current portfolio.",
        };
      },
    });
    const runner = createArenaLifecycleRunner({
      store,
      dataSourceFactory: () => ({
        async prepare(checkpointId) {
          prepared.push(checkpointId);
        },
        getSnapshot(checkpointId) {
          const recordedSnapshot = recorded.getSnapshot(checkpointId);
          const { snapshotHash: _snapshotHash, ...base } = recordedSnapshot;
          const liveSnapshot = {
            ...base,
            arenaId: liveManifest.arenaId,
            source: "TXLINE_LIVE" as const,
          };
          return {
            ...liveSnapshot,
            snapshotHash: calculateSnapshotHash(liveSnapshot),
          };
        },
        getFinalResult: recorded.getFinalResult,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-live", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(liveManifest);

    const completed = await runner.run(
      liveManifest.arenaId,
      new AbortController().signal,
    );

    expect({
      phase: completed.phase,
      prepared,
      sources: completed.checkpoints.map(({ snapshot }) => snapshot?.source),
      winner: completed.finalResult?.winner,
    }).toEqual({
      phase: "COMPLETED",
      prepared: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      sources: Array.from({ length: 6 }, () => "TXLINE_LIVE"),
      winner: "DRAW",
    });
  });
});
