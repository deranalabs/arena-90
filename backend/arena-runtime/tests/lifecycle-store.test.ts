import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  arenaRunStateV1Schema,
  calculateSnapshotHash,
  type PersistedArenaEventV1,
} from "../src/contracts/index.js";
import { initializePortfolio } from "../src/engine/index.js";
import {
  ArenaLifecycleStoreError,
  createInMemoryArenaLifecycleStore,
} from "../src/services/index.js";

function initialState() {
  return arenaRunStateV1Schema.parse({
    schemaVersion: 1,
    revision: 0,
    manifest: {
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
    },
    runtimeMetadata: {
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
    },
    phase: "READY",
    portfolios: {
      alpha: initializePortfolio("alpha", "100000000"),
      beta: initializePortfolio("beta", "100000000"),
    },
    checkpoints: [],
    lastEventSequence: 1,
  });
}

function readyEvent(): PersistedArenaEventV1 {
  return {
    eventId: "arena-replay-001:1",
    arenaId: "arena-replay-001",
    sequence: 1,
    type: "ARENA_READY",
    occurredAtUtc: "2026-07-13T10:00:00.000Z",
    publicPayload: {},
  };
}

function progressEvent(publicPayload: unknown): PersistedArenaEventV1 {
  return {
    eventId: "arena-replay-001:2",
    arenaId: "arena-replay-001",
    sequence: 2,
    type: "LIFECYCLE_PROGRESS",
    occurredAtUtc: "2026-07-13T10:00:01.000Z",
    publicPayload,
  } as unknown as PersistedArenaEventV1;
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

describe("Arena lifecycle store", () => {
  it("grants one active lease and fences an owner after expiry", async () => {
    let nowMs = 1_000;
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => nowMs });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);

    const first = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    expect(first).not.toBe("BUSY");
    expect(first).not.toBe("NOT_FOUND");
    if (typeof first === "string") throw new Error("Expected acquired lease");
    await expect(store.read(state.manifest.arenaId, 0)).resolves.toEqual({
      state,
      events: [readyEvent()],
    });
    await expect(
      store.acquire(state.manifest.arenaId, "runner-b", 2_000),
    ).resolves.toBe("BUSY");

    nowMs = 2_001;
    const second = await store.acquire(state.manifest.arenaId, "runner-b", 3_000);
    if (typeof second === "string") throw new Error("Expected replacement lease");
    expect(second.fencingToken).not.toBe(first.fencingToken);

    await expect(
      first.commit({
        nextState: { ...state, revision: 1 },
        appendEvents: [],
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ArenaLifecycleStoreError>>({
        code: "LEASE_LOST",
        message: "Arena lifecycle lease is no longer active",
      }),
    );
  });

  it("initializes idempotently but rejects changed locked configuration", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();

    await expect(store.initialize(state, [readyEvent()])).resolves.toEqual(state);
    await expect(store.initialize(state, [readyEvent()])).resolves.toEqual(state);
    await expect(
      store.initialize(
        {
          ...state,
          manifest: { ...state.manifest, competition: "Changed competition" },
        },
        [readyEvent()],
      ),
    ).rejects.toMatchObject({
      code: "MANIFEST_CONFLICT",
      message: "Arena manifest conflicts with persisted state",
    });
    await expect(
      store.initialize(
        {
          ...state,
          runtimeMetadata: {
            ...state.runtimeMetadata,
            runtimeVersion: "changed",
          },
        },
        [readyEvent()],
      ),
    ).rejects.toMatchObject({
      code: "IMMUTABLE_STATE_CONFLICT",
      message: "Arena runtime metadata conflicts with persisted state",
    });
  });

  it("commits state and ordered events atomically under one revision", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");

    const revisionOne = { ...state, revision: 1, lastEventSequence: 2 };
    const progressEvent: PersistedArenaEventV1 = {
      eventId: "arena-replay-001:2",
      arenaId: "arena-replay-001",
      sequence: 2,
      type: "LIFECYCLE_PROGRESS",
      occurredAtUtc: "2026-07-13T10:00:01.000Z",
      publicPayload: {},
    };
    await expect(
      lease.commit({ nextState: revisionOne, appendEvents: [progressEvent] }),
    ).resolves.toEqual(revisionOne);

    await expect(
      lease.commit({
        nextState: { ...revisionOne, revision: 3, lastEventSequence: 3 },
        appendEvents: [{ ...progressEvent, eventId: "arena-replay-001:3", sequence: 3 }],
      }),
    ).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
      message: "Arena lifecycle revision must advance by one",
    });
    await expect(store.read(state.manifest.arenaId, 2)).resolves.toEqual({
      state: revisionOne,
      events: [],
    });
  });

  it("rejects an initial event history that does not match the persisted tail", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();

    await expect(
      store.initialize(state, [{ ...readyEvent(), sequence: 2 }]),
    ).rejects.toMatchObject({
      code: "EVENT_SEQUENCE_CONFLICT",
      message: "Arena lifecycle events must append contiguously",
    });
    await expect(
      store.acquire(state.manifest.arenaId, "runner-a", 2_000),
    ).resolves.toBe("NOT_FOUND");
  });

  it("renews and releases a lease without allowing the released owner to commit", async () => {
    let nowMs = 1_000;
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => nowMs });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");

    await lease.renew(3_000);
    nowMs = 2_001;
    await expect(
      store.acquire(state.manifest.arenaId, "runner-b", 4_000),
    ).resolves.toBe("BUSY");

    await lease.release();
    await expect(
      lease.commit({
        nextState: { ...state, revision: 1 },
        appendEvents: [],
      }),
    ).rejects.toMatchObject({ code: "LEASE_LOST" });
    const replacement = await store.acquire(
      state.manifest.arenaId,
      "runner-b",
      4_000,
    );
    expect(typeof replacement).not.toBe("string");
    await expect(store.read(state.manifest.arenaId, 0)).resolves.toEqual({
      state,
      events: [readyEvent()],
    });
  });

  it("keeps a prepared checkpoint durable across lease handoff", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const first = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof first === "string") throw new Error("Expected acquired lease");
    const pendingState = arenaRunStateV1Schema.parse({
      ...state,
      revision: 1,
      phase: "RUNNING",
      pendingCheckpoint: {
        checkpointId: "KICKOFF",
        snapshot: kickoffSnapshot(),
      },
      lastEventSequence: 3,
    });
    const events: PersistedArenaEventV1[] = [
      {
        eventId: "arena-replay-001:2",
        arenaId: "arena-replay-001",
        sequence: 2,
        type: "CHECKPOINT_OPENED",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: { snapshotId: "snapshot-kickoff" },
      },
      {
        eventId: "arena-replay-001:3",
        arenaId: "arena-replay-001",
        sequence: 3,
        type: "AGENTS_ANALYZING",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: {},
      },
    ];

    await first.commit({ nextState: pendingState, appendEvents: events });
    await first.release();
    const resumed = await store.acquire(
      state.manifest.arenaId,
      "runner-b",
      2_000,
    );
    if (typeof resumed === "string") throw new Error("Expected resumed lease");

    await expect(store.read(state.manifest.arenaId, 3)).resolves.toEqual({
      state: pendingState,
      events: [],
    });
  });

  it("rejects validation or clone failures without partially applying state", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");
    for (const publicPayload of [
      { unsafe: () => "not JSON" },
      new Proxy({ apparentlySafe: "value" }, {}),
    ]) {
      const invalidEvent = {
        eventId: "arena-replay-001:2",
        arenaId: "arena-replay-001",
        sequence: 2,
        type: "LIFECYCLE_PROGRESS",
        occurredAtUtc: "2026-07-13T10:00:01.000Z",
        publicPayload,
      } as unknown as PersistedArenaEventV1;

      await expect(
        lease.commit({
          nextState: { ...state, revision: 1, lastEventSequence: 2 },
          appendEvents: [invalidEvent],
        }),
      ).rejects.toBeDefined();
    }
    await expect(store.read(state.manifest.arenaId, 0)).resolves.toEqual({
      state,
      events: [readyEvent()],
    });
  });

  it.each([
    ["a sparse array", () => new Array(1)],
    [
      "an array with an extra property",
      () => {
        const value = ["safe"];
        Object.defineProperty(value, "extra", {
          value: "unsafe",
          enumerable: true,
          configurable: true,
          writable: true,
        });
        return value;
      },
    ],
    [
      "an array with an invalid index key",
      () => {
        const value = ["safe"];
        Object.defineProperty(value, "01", {
          value: "unsafe",
          enumerable: true,
          configurable: true,
          writable: true,
        });
        return value;
      },
    ],
    [
      "an array with a symbol property",
      () => {
        const value = ["safe"];
        Object.defineProperty(value, Symbol("unsafe"), {
          value: "unsafe",
          enumerable: true,
          configurable: true,
          writable: true,
        });
        return value;
      },
    ],
    [
      "an array with an accessor property",
      () => {
        const value = ["safe"];
        Object.defineProperty(value, "0", {
          get: () => "unsafe",
          enumerable: true,
          configurable: true,
        });
        return value;
      },
    ],
  ])("rejects %s atomically", async (_label, createPayload) => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");

    await expect(
      lease.commit({
        nextState: { ...state, revision: 1, lastEventSequence: 2 },
        appendEvents: [progressEvent(createPayload())],
      }),
    ).rejects.toBeDefined();
    await expect(store.read(state.manifest.arenaId, 0)).resolves.toEqual({
      state,
      events: [readyEvent()],
    });
  });

  it("accepts a valid dense nested JSON array", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");
    const payload = [
      null,
      true,
      12.5,
      "safe",
      ["nested", { deep: [0, false] }],
    ];
    const nextState = { ...state, revision: 1, lastEventSequence: 2 };
    const event = progressEvent(payload);

    await expect(
      lease.commit({ nextState, appendEvents: [event] }),
    ).resolves.toEqual(nextState);
    await expect(store.read(state.manifest.arenaId, 1)).resolves.toEqual({
      state: nextState,
      events: [event],
    });
  });

  it("rejects checkpoint event ranges that do not bind to persisted history", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");
    const corruptRangeState = arenaRunStateV1Schema.parse({
      ...state,
      revision: 1,
      phase: "RUNNING",
      checkpoints: [
        {
          checkpointId: "KICKOFF",
          outcome: "GLOBAL_MISSED",
          revealedDecisions: {},
          failures: [{ scope: "GLOBAL", reason: "DATA_FAILURE" }],
          portfoliosBefore: state.portfolios,
          portfoliosAfter: state.portfolios,
          firstEventSequence: 3,
          lastEventSequence: 4,
        },
      ],
      lastEventSequence: 3,
    });
    const events: PersistedArenaEventV1[] = [
      {
        eventId: "arena-replay-001:2",
        arenaId: "arena-replay-001",
        sequence: 2,
        type: "GLOBAL_MISSED_DECISION_ROUND",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: { reason: "DATA_FAILURE" },
      },
      {
        eventId: "arena-replay-001:3",
        arenaId: "arena-replay-001",
        sequence: 3,
        type: "ROUND_COMPLETE",
        occurredAtUtc: "2026-07-13T12:00:00.000Z",
        checkpointId: "KICKOFF",
        publicPayload: {},
      },
    ];

    await expect(
      lease.commit({ nextState: corruptRangeState, appendEvents: events }),
    ).rejects.toMatchObject({ code: "EVENT_RANGE_CONFLICT" });
    const validRangeState = arenaRunStateV1Schema.parse({
      ...corruptRangeState,
      checkpoints: [
        {
          ...corruptRangeState.checkpoints[0]!,
          firstEventSequence: 2,
          lastEventSequence: 3,
        },
      ],
    });
    await expect(
      lease.commit({ nextState: validRangeState, appendEvents: events }),
    ).resolves.toEqual(validRangeState);
  });

  it("reloads validated state and the ordered tail after an ambiguous commit", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: () => 1_000 });
    const state = initialState();
    await store.initialize(state, [readyEvent()]);
    const lease = await store.acquire(state.manifest.arenaId, "runner-a", 2_000);
    if (typeof lease === "string") throw new Error("Expected acquired lease");
    const committedState = { ...state, revision: 1, lastEventSequence: 2 };
    const committedEvent: PersistedArenaEventV1 = {
      eventId: "arena-replay-001:2",
      arenaId: "arena-replay-001",
      sequence: 2,
      type: "LIFECYCLE_PROGRESS",
      occurredAtUtc: "2026-07-13T10:00:01.000Z",
      publicPayload: {},
    };

    await expect(
      lease
        .commit({ nextState: committedState, appendEvents: [committedEvent] })
        .then(() => Promise.reject(new Error("commit response lost"))),
    ).rejects.toThrow("commit response lost");
    await expect(store.read(state.manifest.arenaId, 1)).resolves.toEqual({
      state: committedState,
      events: [committedEvent],
    });
  });
});
