import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createRecordedDataAdapter } from "../src/adapters/data/index.js";
import {
  CHECKPOINT_IDS,
  calculateSnapshotHash,
  calculateTerminalEvidenceHash,
  type ArenaRunStateV1,
} from "../src/contracts/index.js";
import {
  ArenaLifecycleStoreError,
  createArenaLifecycleRunner,
  createInMemoryArenaLifecycleStore,
  type ArenaLifecycleStore,
  type ArenaRunLease,
} from "../src/services/index.js";

const manifest = {
  schemaVersion: 1,
  arenaId: "arena-lease-001",
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
  winnerRuleVersion: "FINAL_NAV_ONLY_V1",
  agentTimeoutMs: 1_000,
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

function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function wrapStore(
  durable: ArenaLifecycleStore,
  wrapLease: (lease: ArenaRunLease) => ArenaRunLease,
  read: ArenaLifecycleStore["read"] = durable.read.bind(durable),
): ArenaLifecycleStore {
  return {
    initialize: durable.initialize.bind(durable),
    read,
    async acquire(arenaId, ownerId, expiresAtMs) {
      const lease = await durable.acquire(arenaId, ownerId, expiresAtMs);
      return typeof lease === "string" ? lease : wrapLease(lease);
    },
  };
}

function createKickoffRunner(input: {
  store: ArenaLifecycleStore;
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  prepare?: (signal: AbortSignal) => Promise<void>;
  onAgentsStarted?: () => void;
}) {
  let agentCalls = 0;
  const agent = (agentId: "alpha" | "beta") => ({
    agentId,
    async invoke({ signal }: { signal: AbortSignal }) {
      agentCalls += 1;
      if (agentCalls === 2) input.onAgentsStarted?.();
      await waitForAbort(signal);
      return undefined;
    },
  });
  return createArenaLifecycleRunner({
    store: input.store,
    dataSourceFactory: () => ({
      async prepare(checkpointId, signal) {
        if (checkpointId === "KICKOFF") {
          await input.prepare?.(signal);
          return;
        }
        throw new Error("stop after KICKOFF");
      },
      getSnapshot: () => kickoffSnapshot(),
      getTerminalEvidence() {
        throw new Error("FINAL unavailable");
      },
    }),
    agents: { alpha: agent("alpha"), beta: agent("beta") },
    runtimeMetadata,
    timing: {
      nowMs: () => 1_000,
      wait: input.wait ?? ((_delayMs, signal) => waitForAbort(signal)),
      waitForCheckpoint: async () => undefined,
    },
    lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
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

describe("Arena lifecycle runner lease and commit recovery", () => {
  it("rethrows an ambiguous commit error when durable state proves it was not applied", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const transportError = new Error("commit transport failed");
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async commit() {
        throw transportError;
      },
    }));
    const runner = createKickoffRunner({ store });
    const ready = await runner.create(manifest);

    await expect(
      runner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toBe(transportError);
    await expect(store.read(manifest.arenaId, 0)).resolves.toEqual({
      state: ready,
      events: [expect.objectContaining({ type: "ARENA_READY" })],
    });
  });

  it("fails closed deterministically when ambiguous reload conflicts", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const transportError = new Error("commit transport failed");
    let intendedState: ArenaRunStateV1 | undefined;
    const store = wrapStore(
      durable,
      (lease) => ({
        ...lease,
        async commit(input) {
          intendedState = structuredClone(input.nextState);
          throw transportError;
        },
      }),
      async (arenaId, afterEventSequence) => {
        if (intendedState !== undefined && afterEventSequence === 1) {
          return { state: intendedState, events: [] };
        }
        return durable.read(arenaId, afterEventSequence);
      },
    );
    const runner = createKickoffRunner({ store });
    await runner.create(manifest);

    await expect(
      runner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
      message: "Ambiguous arena lifecycle commit conflicts with durable state",
    });
  });

  it("propagates LEASE_LOST even when reload matches the intended commit", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const leaseLost = new ArenaLifecycleStoreError(
      "LEASE_LOST",
      "Arena lifecycle lease is no longer active",
    );
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async commit(input) {
        await lease.commit(input);
        throw leaseLost;
      },
    }));
    const runner = createKickoffRunner({ store });
    await runner.create(manifest);

    await expect(
      runner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toBe(leaseLost);
    await expect(store.read(manifest.arenaId, 0)).resolves.toMatchObject({
      state: { revision: 1, pendingCheckpoint: { checkpointId: "KICKOFF" } },
    });
  });

  it("propagates REVISION_CONFLICT even when reload matches the intended commit", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const revisionConflict = new ArenaLifecycleStoreError(
      "REVISION_CONFLICT",
      "Arena lifecycle revision must advance by one",
    );
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async commit(input) {
        await lease.commit(input);
        throw revisionConflict;
      },
    }));
    const runner = createKickoffRunner({ store });
    await runner.create(manifest);

    await expect(
      runner.run(manifest.arenaId, new AbortController().signal),
    ).rejects.toBe(revisionConflict);
  });

  it("serializes renewal and commit through one exclusive lease operation queue", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let activeOperations = 0;
    let maxConcurrentOperations = 0;
    let notifyRenewStarted!: () => void;
    const renewStarted = new Promise<void>((resolve) => {
      notifyRenewStarted = resolve;
    });
    let releaseRenew!: () => void;
    const renewRelease = new Promise<void>((resolve) => {
      releaseRenew = resolve;
    });
    const exclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
      activeOperations += 1;
      maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations);
      try {
        return await operation();
      } finally {
        activeOperations -= 1;
      }
    };
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      renew: (expiresAtMs) =>
        exclusive(async () => {
          notifyRenewStarted();
          await renewRelease;
          await lease.renew(expiresAtMs);
        }),
      commit: (input) => exclusive(() => lease.commit(input)),
      release: () => exclusive(() => lease.release()),
    }));
    let waitCount = 0;
    let notifyAgentsStarted!: () => void;
    const agentsStarted = new Promise<void>((resolve) => {
      notifyAgentsStarted = resolve;
    });
    const runner = createKickoffRunner({
      store,
      wait: (_delayMs, signal) => {
        waitCount += 1;
        return waitCount === 1 ? Promise.resolve() : waitForAbort(signal);
      },
      prepare: async () => renewStarted,
      onAgentsStarted: notifyAgentsStarted,
    });
    await runner.create(manifest);
    const controller = new AbortController();
    const run = runner.run(manifest.arenaId, controller.signal);
    await renewStarted;
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRenew();
    await agentsStarted;
    controller.abort();
    await expect(run).rejects.toMatchObject({ code: "ABORTED" });

    expect(maxConcurrentOperations).toBe(1);
  });

  it("makes renewal failure sticky and rejects a queued commit before store access", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const leaseLost = new ArenaLifecycleStoreError(
      "LEASE_LOST",
      "Arena lifecycle lease is no longer active",
    );
    let notifyRenewStarted!: () => void;
    const renewStarted = new Promise<void>((resolve) => {
      notifyRenewStarted = resolve;
    });
    let releaseRenew!: () => void;
    const renewRelease = new Promise<void>((resolve) => {
      releaseRenew = resolve;
    });
    let underlyingCommitCalls = 0;
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async renew() {
        notifyRenewStarted();
        await renewRelease;
        throw leaseLost;
      },
      async commit(input) {
        underlyingCommitCalls += 1;
        return lease.commit(input);
      },
    }));
    let waitCount = 0;
    const runner = createKickoffRunner({
      store,
      wait: (_delayMs, signal) => {
        waitCount += 1;
        return waitCount === 1 ? Promise.resolve() : waitForAbort(signal);
      },
      prepare: async () => renewStarted,
    });
    const ready = await runner.create(manifest);
    const run = runner.run(manifest.arenaId, new AbortController().signal);
    await renewStarted;
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRenew();

    await expect(run).rejects.toBe(leaseLost);
    expect(underlyingCommitCalls).toBe(0);
    await expect(store.read(manifest.arenaId, 0)).resolves.toMatchObject({
      state: ready,
      events: [expect.objectContaining({ type: "ARENA_READY" })],
    });
  });

  it("rejects terminal success when renewal queued during final commit loses the lease", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const leaseLost = new ArenaLifecycleStoreError(
      "LEASE_LOST",
      "Arena lifecycle lease is no longer active",
    );
    let notifyFinalCommitStarted!: () => void;
    const finalCommitStarted = new Promise<void>((resolve) => {
      notifyFinalCommitStarted = resolve;
    });
    let releaseFinalCommit!: () => void;
    const finalCommitRelease = new Promise<void>((resolve) => {
      releaseFinalCommit = resolve;
    });
    let releaseHeartbeat!: () => void;
    const heartbeatRelease = new Promise<void>((resolve) => {
      releaseHeartbeat = resolve;
    });
    let notifyRenewFailed!: () => void;
    const renewFailed = new Promise<void>((resolve) => {
      notifyRenewFailed = resolve;
    });
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async renew() {
        notifyRenewFailed();
        throw leaseLost;
      },
      async commit(input) {
        if (input.nextState.phase === "COMPLETED") {
          notifyFinalCommitStarted();
          releaseHeartbeat();
          await finalCommitRelease;
        }
        return lease.commit(input);
      },
    }));
    const recorded = createRecordedDataAdapter(await loadRecordedFixture());
    const decision = (agentId: "alpha" | "beta") => ({
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
        async prepare() {},
        getSnapshot(checkpointId) {
          const snapshot = recorded.getSnapshot(checkpointId);
          const { snapshotHash: _snapshotHash, ...base } = snapshot;
          const rebound = { ...base, arenaId: manifest.arenaId };
          return { ...rebound, snapshotHash: calculateSnapshotHash(rebound) };
        },
        getTerminalEvidence() {
          const recordedEvidence = recorded.getTerminalEvidence();
          const { terminalEvidenceHash: _terminalEvidenceHash, ...base } =
            recordedEvidence;
          const rebound = { ...base, arenaId: manifest.arenaId };
          return {
            ...rebound,
            terminalEvidenceHash: calculateTerminalEvidenceHash(rebound),
          };
        },
      }),
      agents: { alpha: decision("alpha"), beta: decision("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: async (_delayMs, signal) => {
          await Promise.race([heartbeatRelease, waitForAbort(signal)]);
        },
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "runner-a", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await runner.create(manifest);

    const run = runner.run(manifest.arenaId, new AbortController().signal);
    await finalCommitStarted;
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseFinalCommit();
    await renewFailed;

    await expect(run).rejects.toBe(leaseLost);
    await expect(store.read(manifest.arenaId, 0)).resolves.toMatchObject({
      state: { phase: "COMPLETED" },
    });
  });

  it("serializes release and preserves the primary abort error", async () => {
    const durable = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    let activeOperations = 0;
    let maxConcurrentOperations = 0;
    const operationOrder: string[] = [];
    let notifyRenewStarted!: () => void;
    const renewStarted = new Promise<void>((resolve) => {
      notifyRenewStarted = resolve;
    });
    let releaseRenew!: () => void;
    const renewRelease = new Promise<void>((resolve) => {
      releaseRenew = resolve;
    });
    const store = wrapStore(durable, (lease) => ({
      ...lease,
      async renew(expiresAtMs) {
        notifyRenewStarted();
        activeOperations += 1;
        maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations);
        operationOrder.push("renew:start");
        await renewRelease;
        await lease.renew(expiresAtMs);
        operationOrder.push("renew:end");
        activeOperations -= 1;
      },
      async release() {
        activeOperations += 1;
        maxConcurrentOperations = Math.max(maxConcurrentOperations, activeOperations);
        operationOrder.push("release:start");
        await lease.release();
        activeOperations -= 1;
        throw new Error("release cleanup failed");
      },
    }));
    let waitCount = 0;
    let notifyPreparing!: () => void;
    const preparing = new Promise<void>((resolve) => {
      notifyPreparing = resolve;
    });
    const runner = createKickoffRunner({
      store,
      wait: (_delayMs, signal) => {
        waitCount += 1;
        return waitCount === 1 ? Promise.resolve() : waitForAbort(signal);
      },
      prepare: async (signal) => {
        notifyPreparing();
        await waitForAbort(signal);
      },
    });
    await runner.create(manifest);
    const controller = new AbortController();
    const run = runner.run(manifest.arenaId, controller.signal);
    await Promise.all([renewStarted, preparing]);
    controller.abort();
    releaseRenew();

    await expect(run).rejects.toMatchObject({ code: "ABORTED" });
    expect({ maxConcurrentOperations, operationOrder }).toEqual({
      maxConcurrentOperations: 1,
      operationOrder: ["renew:start", "renew:end", "release:start"],
    });
  });
});
