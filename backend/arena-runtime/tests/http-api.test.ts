import { isDeepStrictEqual } from "node:util";
import type { AddressInfo } from "node:net";
import { request as nodeHttpRequest, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  ArenaLifecycleStoreError,
  calculateSnapshotHash,
  createArenaHttpServer,
  createArenaLifecycleRunner,
  createInMemoryArenaHttpCapacityCoordinator,
  initializePortfolio,
  publicApiErrorEnvelopeV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
  type ArenaLifecycleRunner,
  type ArenaLifecycleStore,
  type ArenaHttpConfiguredSource,
  type ArenaHttpCapacityCoordinator,
  type ArenaManifest,
  type ArenaRunStateV1,
  type PersistedArenaEventV1,
} from "../src/index.js";

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
} as const satisfies ArenaManifest;

const runtimeMetadata = {
  runtimeId: "private-runtime-id",
  runtimeVersion: "7.2",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "p0-final-nav-v1",
  agentTimeoutMs: 30_000,
  agents: {
    alpha: {
      adapterId: "/private/alpha-adapter",
      adapterVersion: "private-adapter-version",
      strategyId: "alpha-public",
      strategyVersion: "1",
    },
    beta: {
      adapterId: "/private/beta-adapter",
      adapterVersion: "private-adapter-version",
      strategyId: "beta-public",
      strategyVersion: "1",
    },
  },
} as const;

class MutableLifecycleStore implements ArenaLifecycleStore {
  state: ArenaRunStateV1 | undefined;
  events: readonly PersistedArenaEventV1[] = [];
  readFailure: unknown;
  readFailureAtCall:
    | Readonly<{ call: number; error: unknown }>
    | undefined;
  readBarrier: Promise<void> | undefined;
  readCalls = 0;
  initializeCalls = 0;

  async initialize(
    state: ArenaRunStateV1,
    events: readonly PersistedArenaEventV1[],
  ): Promise<ArenaRunStateV1> {
    this.initializeCalls += 1;
    if (this.state !== undefined) {
      if (!isDeepStrictEqual(this.state.manifest, state.manifest)) {
        throw new ArenaLifecycleStoreError(
          "MANIFEST_CONFLICT",
          "private conflict detail",
        );
      }
      return structuredClone(this.state);
    }
    this.state = structuredClone(state);
    this.events = structuredClone(events);
    return structuredClone(state);
  }

  async read(arenaId: string, afterEventSequence: number) {
    this.readCalls += 1;
    if (this.readBarrier !== undefined) await this.readBarrier;
    if (this.readFailureAtCall?.call === this.readCalls) {
      throw this.readFailureAtCall.error;
    }
    if (this.readFailure !== undefined) throw this.readFailure;
    if (this.state?.manifest.arenaId !== arenaId) return "NOT_FOUND" as const;
    if (afterEventSequence > this.state.lastEventSequence) {
      throw new ArenaLifecycleStoreError(
        "INVALID_STORE_INPUT",
        "private cursor detail",
      );
    }
    return {
      state: structuredClone(this.state),
      events: structuredClone(
        this.events.filter((event) => event.sequence > afterEventSequence),
      ),
    };
  }

  async acquire(): Promise<never> {
    throw new Error("not used by HTTP tests");
  }

  replace(
    state: ArenaRunStateV1,
    events: readonly PersistedArenaEventV1[] = this.events,
  ): void {
    this.state = structuredClone(state);
    this.events = structuredClone(events);
  }
}

function createBaseRunner(store: ArenaLifecycleStore): ArenaLifecycleRunner {
  return createArenaLifecycleRunner({
    store,
    dataSourceFactory: () => ({
      async prepare() {},
      getSnapshot() {
        throw new Error("not used by HTTP tests");
      },
      getFinalResult() {
        throw new Error("not used by HTTP tests");
      },
    }),
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
    lease: { ownerId: "http-test", ttlMs: 10_000, renewEveryMs: 1_000 },
  });
}

interface Harness {
  server: Server;
  origin: string;
  store: MutableLifecycleStore;
  runSignals: AbortSignal[];
  resolveRun(): void;
}

const openServers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  openServers.clear();
});

async function startHarness(options?: {
  ready?: () => boolean;
  bodyLimitBytes?: number;
  store?: MutableLifecycleStore;
  configuredSource?: ArenaHttpConfiguredSource;
  capacityCoordinator?: ArenaHttpCapacityCoordinator;
  createBehavior?: (
    input: unknown,
    baseRunner: ArenaLifecycleRunner,
  ) => Promise<ArenaRunStateV1>;
}): Promise<Harness> {
  const store = options?.store ?? new MutableLifecycleStore();
  const baseRunner = createBaseRunner(store);
  const runSignals: AbortSignal[] = [];
  let resolveRun: () => void = () => undefined;
  let runGate = new Promise<void>((resolve) => {
    resolveRun = resolve;
  });
  const runner: ArenaLifecycleRunner = {
    create: baseRunner.create,
    async run(arenaId, signal) {
      runSignals.push(signal);
      await runGate;
      const found = await store.read(arenaId, 0);
      if (found === "NOT_FOUND") throw new Error("missing arena");
      return found.state;
    },
  };
  if (options?.createBehavior !== undefined) {
    runner.create = (input) => options.createBehavior!(input, baseRunner);
  }
  const server = createArenaHttpServer({
    runner,
    store,
    configuredSource: options?.configuredSource ?? {
        mode: "REPLAY",
        arenaId: manifest.arenaId,
        fixtureId: manifest.fixtureId,
        homeTeam: manifest.homeTeam,
        awayTeam: manifest.awayTeam,
        kickoffUtc: manifest.kickoffUtc,
      },
    isReady: options?.ready ?? (() => true),
    ...(options?.capacityCoordinator === undefined
      ? {}
      : { capacityCoordinator: options.capacityCoordinator }),
    ...(options?.bodyLimitBytes === undefined
      ? {}
      : { bodyLimitBytes: options.bodyLimitBytes }),
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  openServers.add(server);
  const address = server.address() as AddressInfo;
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
    store,
    runSignals,
    resolveRun() {
      resolveRun();
      runGate = Promise.resolve();
      resolveRun = () => undefined;
    },
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function createArena(origin: string, input: unknown = manifest) {
  return fetch(`${origin}/api/arenas`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ manifest: input }),
  });
}

async function postThenDisconnect(url: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest(
      url,
      { method: "POST", agent: false },
      (response) => {
        const status = response.statusCode;
        response.destroy();
        request.destroy();
        resolve(status);
      },
    );
    request.once("error", reject);
    request.end();
  });
}

function kickoffSnapshot() {
  const hashInput = {
    schemaVersion: 1 as const,
    providerSequence: 91,
    snapshotId: "snapshot-kickoff",
    arenaId: manifest.arenaId,
    fixtureId: manifest.fixtureId,
    checkpointId: "KICKOFF" as const,
    observedAtUtc: manifest.kickoffUtc,
    sourceEventId: "private-provider-event",
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

function liveManifest(arenaId: string): ArenaManifest {
  return { ...manifest, arenaId, mode: "LIVE" };
}

describe("Arena HTTP API", () => {
  it("reports process health and honest readiness", async () => {
    let ready = false;
    const harness = await startHarness({ ready: () => ready });

    const health = await fetch(`${harness.origin}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await json(health)).toEqual({ schemaVersion: 1, status: "UP" });

    const unavailable = await fetch(`${harness.origin}/ready`);
    expect(unavailable.status).toBe(503);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await unavailable.json()).error.code,
    ).toBe("NOT_READY");

    ready = true;
    const available = await fetch(`${harness.origin}/ready`);
    expect(available.status).toBe(200);
    expect(await json(available)).toEqual({
      schemaVersion: 1,
      status: "READY",
      configuredMode: "REPLAY",
    });
  });

  it("creates one source-bound arena idempotently and rejects conflicts", async () => {
    const harness = await startHarness();

    const created = await createArena(harness.origin);
    expect(created.status).toBe(201);
    expect((await json(created))["status"]).toBe("CREATED");

    const existing = await createArena(harness.origin);
    expect(existing.status).toBe(200);
    expect((await json(existing))["status"]).toBe("EXISTING");

    const conflicting = await createArena(harness.origin, {
      ...manifest,
      competition: "Changed Competition",
    });
    expect(conflicting.status).toBe(409);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await conflicting.json()).error.code,
    ).toBe("ARENA_CONFLICT");

    const capacity = await createArena(harness.origin, {
      ...manifest,
      arenaId: "arena-replay-002",
    });
    expect(capacity.status).toBe(409);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await capacity.json()).error.code,
    ).toBe("ARENA_CAPACITY_REACHED");
  });

  it("coalesces simultaneous idempotent creates and reserves capacity", async () => {
    const harness = await startHarness();
    let releaseReads: () => void = () => undefined;
    harness.store.readBarrier = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });

    const first = createArena(harness.origin);
    const duplicate = createArena(harness.origin);
    while (harness.store.readCalls === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseReads();

    const responses = await Promise.all([first, duplicate]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 201,
    ]);
    expect(
      (
        await Promise.all(
          responses.map(async (response) => (await json(response))["status"]),
        )
      ).sort(),
    ).toEqual(["CREATED", "EXISTING"]);
  });

  it("returns EXISTING when create persists and then throws", async () => {
    let createCalls = 0;
    const harness = await startHarness({
      async createBehavior(input, baseRunner) {
        createCalls += 1;
        await baseRunner.create(input);
        throw new Error("private ambiguous create failure");
      },
    });

    const response = await createArena(harness.origin);

    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body["status"]).toBe("EXISTING");
    expect(JSON.stringify(body)).not.toContain("private ambiguous");
    expect(createCalls).toBe(1);
  });

  it("coalesces a concurrent retry while ambiguous applied create reloads", async () => {
    const store = new MutableLifecycleStore();
    let createCalls = 0;
    let markPersisted: () => void = () => undefined;
    const persisted = new Promise<void>((resolve) => {
      markPersisted = resolve;
    });
    let releaseFailure: () => void = () => undefined;
    const failureGate = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    const firstServer = await startHarness({
      store,
      async createBehavior(input, baseRunner) {
        createCalls += 1;
        await baseRunner.create(input);
        markPersisted();
        await failureGate;
        throw new Error("private ambiguous failure");
      },
    });
    const retryServer = await startHarness({ store });

    const first = createArena(firstServer.origin);
    await persisted;
    const retry = createArena(retryServer.origin);
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseFailure();
    const responses = await Promise.all([first, retry]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(createCalls).toBe(1);
    expect(store.initializeCalls).toBe(1);
  });

  it("releases a NOT_APPLIED claim so retry can create", async () => {
    const store = new MutableLifecycleStore();
    let createCalls = 0;
    const failingServer = await startHarness({
      store,
      async createBehavior(input, baseRunner) {
        createCalls += 1;
        throw new Error("private not-applied failure");
      },
    });
    const retryServer = await startHarness({ store });

    const failed = await createArena(failingServer.origin);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      schemaVersion: 1,
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed",
      },
    });

    const retried = await createArena(retryServer.origin);
    expect(retried.status).toBe(201);
    expect((await json(retried))["status"]).toBe("CREATED");
    expect(createCalls).toBe(1);
    expect(store.initializeCalls).toBe(1);
  });

  it("fails closed when ambiguous create reload cannot be classified", async () => {
    const harness = await startHarness({
      async createBehavior() {
        throw new Error("private ambiguous original failure");
      },
    });
    harness.store.readFailureAtCall = {
      call: 2,
      error: new ArenaLifecycleStoreError(
        "MANIFEST_CONFLICT",
        "private reload/store detail",
      ),
    };

    const response = await createArena(harness.origin);
    expect(response.status).toBe(500);
    const body = publicApiErrorEnvelopeV1Schema.parse(await response.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/private|reload|store/i);

    const retry = await createArena(harness.origin);
    expect(retry.status).toBe(500);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await retry.json()).error.code,
    ).toBe("INTERNAL_ERROR");
  });

  it("keeps occupancy and returns conflict after ambiguous different manifest", async () => {
    let createCalls = 0;
    const harness = await startHarness({
      async createBehavior(_input, baseRunner) {
        createCalls += 1;
        await baseRunner.create({
          ...manifest,
          competition: "Persisted Other Competition",
        });
        throw new Error("private ambiguous conflict");
      },
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await createArena(harness.origin);
      expect(response.status).toBe(409);
      expect(
        publicApiErrorEnvelopeV1Schema.parse(await response.json()).error.code,
      ).toBe("ARENA_CONFLICT");
    }
    expect(createCalls).toBe(1);
  });

  it("allows only one arena across two servers sharing one store", async () => {
    const store = new MutableLifecycleStore();
    const configuredSource: ArenaHttpConfiguredSource = {
      mode: "LIVE",
      fixtureId: manifest.fixtureId,
      homeTeam: manifest.homeTeam,
      awayTeam: manifest.awayTeam,
      kickoffUtc: manifest.kickoffUtc,
    };
    const firstServer = await startHarness({ store, configuredSource });
    const secondServer = await startHarness({ store, configuredSource });

    const responses = await Promise.all([
      createArena(firstServer.origin, liveManifest("arena-live-a")),
      createArena(secondServer.origin, liveManifest("arena-live-b")),
    ]);
    const winner = responses.find((response) => response.status === 201);
    const loser = responses.find((response) => response.status === 409);

    expect(winner).toBeDefined();
    expect(loser).toBeDefined();
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await loser!.json()).error.code,
    ).toBe("ARENA_CAPACITY_REACHED");
    expect(store.initializeCalls).toBe(1);
  });

  it("honors preloaded LIVE store and capacity occupancy", async () => {
    const store = new MutableLifecycleStore();
    const existingManifest = liveManifest("arena-live-existing");
    await createBaseRunner(store).create(existingManifest);
    const capacityCoordinator = createInMemoryArenaHttpCapacityCoordinator({
      occupiedArenaId: existingManifest.arenaId,
    });
    const configuredSource: ArenaHttpConfiguredSource = {
      mode: "LIVE",
      fixtureId: manifest.fixtureId,
      homeTeam: manifest.homeTeam,
      awayTeam: manifest.awayTeam,
      kickoffUtc: manifest.kickoffUtc,
    };
    const harness = await startHarness({
      store,
      configuredSource,
      capacityCoordinator,
    });

    const existing = await createArena(harness.origin, existingManifest);
    expect(existing.status).toBe(200);
    expect((await json(existing))["status"]).toBe("EXISTING");

    const occupied = await createArena(
      harness.origin,
      liveManifest("arena-live-other"),
    );
    expect(occupied.status).toBe(409);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await occupied.json()).error.code,
    ).toBe("ARENA_CAPACITY_REACHED");
  });

  it("requires exact configured mode and fixture identity before creation", async () => {
    const harness = await startHarness();

    for (const mismatched of [
      { ...manifest, mode: "LIVE" },
      { ...manifest, arenaId: "different-recording-arena" },
      { ...manifest, fixtureId: "different-recording" },
      { ...manifest, kickoffUtc: "2026-07-13T13:00:00.000Z" },
      { ...manifest, homeTeam: { name: "Other FC", code: "OTH" } },
    ]) {
      const response = await createArena(harness.origin, mismatched);
      expect(response.status).toBe(422);
      expect(
        publicApiErrorEnvelopeV1Schema.parse(await response.json()).error.code,
      ).toBe("MODE_NOT_CONFIGURED");
    }
    expect(harness.store.state).toBeUndefined();
  });

  it("coordinates background runs independently from client lifetime", async () => {
    const harness = await startHarness();

    const missing = await fetch(`${harness.origin}/api/arenas/missing/run`, {
      method: "POST",
    });
    expect(missing.status).toBe(404);

    await createArena(harness.origin);
    const startedStatus = await postThenDisconnect(
      `${harness.origin}/api/arenas/${manifest.arenaId}/run`,
    );
    expect(startedStatus).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.runSignals[0]?.aborted).toBe(false);

    const repeated = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}/run`,
      { method: "POST" },
    );
    expect(repeated.status).toBe(202);
    expect((await json(repeated))["status"]).toBe("ALREADY_RUNNING");
    expect(harness.runSignals).toHaveLength(1);
    expect(harness.runSignals[0]?.aborted).toBe(false);

    harness.resolveRun();
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.store.replace({
      ...harness.store.state!,
      phase: "COMPLETED",
    } as ArenaRunStateV1);
    const completed = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}/run`,
      { method: "POST" },
    );
    expect(completed.status).toBe(200);
    expect((await json(completed))["status"]).toBe("ALREADY_COMPLETED");
    expect(harness.runSignals).toHaveLength(1);
  });

  it("reads READY, RUNNING, FINALIZING, and COMPLETED through public projection", async () => {
    const harness = await startHarness();
    await createArena(harness.origin);

    for (const phase of [
      "READY",
      "RUNNING",
      "FINALIZING",
      "COMPLETED",
    ] as const) {
      harness.store.replace({
        ...harness.store.state!,
        phase,
        privateProviderPayload: "provider-secret",
        revision: 999,
      } as unknown as ArenaRunStateV1);
      const response = await fetch(
        `${harness.origin}/api/arenas/${manifest.arenaId}`,
      );
      expect(response.status).toBe(200);
      const state = publicArenaStateV1Schema.parse(await response.json());
      expect(state.phase).toBe(phase);
      const serialized = JSON.stringify(state);
      expect(serialized).not.toContain("provider-secret");
      expect(serialized).not.toContain("private-runtime-id");
      expect(serialized).not.toContain("private-adapter");
      expect(serialized).not.toContain("revision");
    }

    const missing = await fetch(`${harness.origin}/api/arenas/missing`);
    expect(missing.status).toBe(404);
  });

  it("returns ordered public history after an exclusive validated cursor", async () => {
    const harness = await startHarness();
    await createArena(harness.origin);
    const snapshot = kickoffSnapshot();
    const state = {
      ...harness.store.state!,
      phase: "RUNNING",
      pendingCheckpoint: {
        checkpointId: "KICKOFF",
        snapshot,
        privateDecisions: { alpha: "secret-alpha", beta: "secret-beta" },
      },
      lastEventSequence: 3,
    } as unknown as ArenaRunStateV1;
    const events = [
      harness.store.events[0]!,
      {
        schemaVersion: 1,
        eventId: `${manifest.arenaId}:2`,
        arenaId: manifest.arenaId,
        sequence: 2,
        type: "CHECKPOINT_OPENED",
        checkpointId: "KICKOFF",
        occurredAtUtc: manifest.kickoffUtc,
        publicPayload: {
          snapshotId: snapshot.snapshotId,
          rawProviderPayload: "private-provider-payload",
        },
      },
      {
        schemaVersion: 1,
        eventId: `${manifest.arenaId}:3`,
        arenaId: manifest.arenaId,
        sequence: 3,
        type: "AGENTS_ANALYZING",
        checkpointId: "KICKOFF",
        occurredAtUtc: manifest.kickoffUtc,
        publicPayload: { prompt: "private-prompt" },
      },
    ] as PersistedArenaEventV1[];
    harness.store.replace(state, events);

    const response = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}/events?after=1`,
    );
    expect(response.status).toBe(200);
    const history = publicEventHistoryV1Schema.parse(await response.json());
    expect(history.events.map((event) => event.sequence)).toEqual([2, 3]);
    expect(history.afterSequence).toBe(1);
    expect(JSON.stringify(history)).not.toMatch(
      /private-prompt|private-provider-payload|secret-alpha|secret-beta/,
    );

    for (const query of [
      "after=-1",
      "after=1.5",
      "after=01",
      "after=abc",
      "after=1&extra=x",
      "after=1&after=2",
    ]) {
      const invalid = await fetch(
        `${harness.origin}/api/arenas/${manifest.arenaId}/events?${query}`,
      );
      expect(invalid.status).toBe(400);
      expect(
        publicApiErrorEnvelopeV1Schema.parse(await invalid.json()).error.code,
      ).toBe("INVALID_EVENT_CURSOR");
    }

    const ahead = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}/events?after=4`,
    );
    expect(ahead.status).toBe(409);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await ahead.json()).error.code,
    ).toBe("EVENT_CURSOR_AHEAD");
  });

  it("enforces JSON media type, strict body shape, limits, and route methods", async () => {
    const harness = await startHarness();

    const mediaType = await fetch(`${harness.origin}/api/arenas`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ manifest }),
    });
    expect(mediaType.status).toBe(415);

    const malformed = await fetch(`${harness.origin}/api/arenas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const extra = await fetch(`${harness.origin}/api/arenas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest, unexpected: true }),
    });
    expect(extra.status).toBe(400);

    const wrongMethod = await fetch(
      `${harness.origin}/api/arenas?unexpected=query`,
    );
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
    expect(wrongMethod.headers.get("cache-control")).toBe("no-store");

    await createArena(harness.origin);
    const runBody = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}/run`,
      { method: "POST", body: "{}" },
    );
    expect(runBody.status).toBe(400);

    const limited = await startHarness({ bodyLimitBytes: 32 });
    const tooLarge = await createArena(limited.origin);
    expect(tooLarge.status).toBe(413);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(await tooLarge.json()).error.code,
    ).toBe("REQUEST_TOO_LARGE");
  });

  it("sanitizes internal failures and never returns raw errors", async () => {
    const harness = await startHarness();
    await createArena(harness.origin);
    harness.store.readFailure = new Error(
      "provider token=secret stack lease fencing raw payload prompt decision",
    );

    const response = await fetch(
      `${harness.origin}/api/arenas/${manifest.arenaId}`,
    );
    expect(response.status).toBe(500);
    const body = publicApiErrorEnvelopeV1Schema.parse(await response.json());
    expect(body).toEqual({
      schemaVersion: 1,
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /secret|stack|lease|fencing|payload|prompt|decision/i,
    );
  });
});
