import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  TxlineDataError,
  type TxlineProviderClient,
} from "../src/adapters/data/index.js";
import {
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
} from "../src/api/contracts.js";
import { CHECKPOINT_IDS } from "../src/contracts/index.js";
import {
  classifyNodeHttpRuntimeFailure,
  createNodeHttpRuntimeComposition,
  formatNodeHttpRuntimeFailure,
} from "../src/runtime/node-http.js";
import { createInMemoryArenaLifecycleStore } from "../src/services/index.js";

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

const recording = {
  provider: "TXLINE_RECORDED",
  arenaId: manifest.arenaId,
  fixtureId: manifest.fixtureId,
  records: CHECKPOINT_IDS.map((checkpointId, index) => ({
    providerSequence: index + 1,
    checkpointId,
    snapshotId: `snapshot-${index + 1}`,
    sourceEventId: `event-${index + 1}`,
    observedAtUtc:
      index === 0
        ? manifest.kickoffUtc
        : new Date(Date.parse(manifest.kickoffUtc) + index * 900_000).toISOString(),
    match: {
      status:
        checkpointId === "FINAL"
          ? "FINISHED"
          : checkpointId === "HALFTIME"
            ? "HALFTIME"
            : "LIVE",
      minute: checkpointId === "FINAL" ? 90 : index * 15,
      addedTime: 0,
      homeScore: checkpointId === "FINAL" ? 1 : 0,
      awayScore: 0,
    },
    priceMicros: { HOME: 500000, DRAW: 300000, AWAY: 200000 },
    freshness: {
      marketUpdatedAtUtc: manifest.kickoffUtc,
      delayed: false,
      suspended: false,
    },
    ...(checkpointId === "FINAL" ? { finalResult: "HOME" } : {}),
  })),
};

function agent(agentId: "alpha" | "beta") {
  return {
    agentId,
    async invoke() {
      throw new Error("not invoked while composing");
    },
  };
}

function noTradeAgent(agentId: "alpha" | "beta") {
  return {
    agentId,
    async invoke(request: {
      snapshot: { arenaId: string; snapshotId: string; checkpointId: string };
    }) {
      return {
        schemaVersion: 1,
        arenaId: request.snapshot.arenaId,
        snapshotId: request.snapshot.snapshotId,
        checkpointId: request.snapshot.checkpointId,
        agentId,
        action: "NO_TRADE",
        publicExplanation: "No supported edge in the supplied evidence.",
      };
    },
  };
}

function testStore() {
  return createInMemoryArenaLifecycleStore({ nowMs: Date.now });
}

const replayEnv = {
  ARENA90_RUNTIME_MODE: "REPLAY",
  ARENA90_MANIFEST_FILE: "manifest.json",
  ARENA90_REPLAY_RECORDING_FILE: "recording.json",
  ARENA90_AGENT_TIMEOUT_MS: "1000",
};

function fileReader(files: Readonly<Record<string, unknown>>) {
  return async (path: string) => {
    if (!(path in files)) throw new Error("missing test file");
    return JSON.stringify(files[path]);
  };
}

function replayFiles(
  manifestOverride: unknown = manifest,
  recordingOverride: unknown = recording,
) {
  return fileReader({
    "manifest.json": manifestOverride,
    "recording.json": recordingOverride,
  });
}

const liveBinding = {
  fixtureId: 18_185_036,
  participant1Id: 101,
  participant2Id: 202,
  participant1IsHome: true,
  startTime: Date.parse(manifest.kickoffUtc),
} as const;

const liveEnv = {
  ARENA90_RUNTIME_MODE: "LIVE",
  ARENA90_AUTOSTART: "true",
  ARENA90_MANIFEST_FILE: "manifest.json",
  ARENA90_LIVE_FIXTURE_BINDING_FILE: "binding.json",
  ARENA90_LIVE_DELAYED: "false",
  ARENA90_AGENT_TIMEOUT_MS: "1000",
  TXLINE_CREDENTIALS_FILE: "txline-credentials.json",
  TXLINE_TIMEOUT_MS: "1000",
  TXLINE_MAX_RESPONSE_BYTES: "65536",
  TXLINE_MAX_SSE_EVENTS: "100",
} as const;

function lockedLiveManifest(arenaId: string) {
  return {
    ...manifest,
    arenaId,
    mode: "LIVE" as const,
    fixtureId: String(liveBinding.fixtureId),
  };
}

function liveFiles(liveManifest: unknown) {
  return fileReader({
    "manifest.json": liveManifest,
    "binding.json": liveBinding,
    "txline-credentials.json": {
      apiOrigin: "https://provider.example.test",
      jwt: "configured-secret",
      apiToken: "configured-secret",
      network: "test",
    },
  });
}

function failingBootstrapClient(
  error: TxlineDataError,
  onFixtureCall: () => void,
): TxlineProviderClient {
  return {
    async getFixtureSnapshot() {
      onFixtureCall();
      throw error;
    },
    async getOddsSnapshot() {
      return [];
    },
    async getOddsUpdates() {
      return [];
    },
    async getScoreSnapshot() {
      return [];
    },
    async *getScoreStream() {},
    async getHistoricalScoreReplay() {
      return [];
    },
  };
}

function liveFixtureRow() {
  return {
    FixtureId: liveBinding.fixtureId,
    Participant1Id: liveBinding.participant1Id,
    Participant2Id: liveBinding.participant2Id,
    Participant1IsHome: liveBinding.participant1IsHome,
    StartTime: liveBinding.startTime,
  };
}

function liveScoreEvent(
  sequence: number,
  statusId: number,
  seconds: number | undefined,
  action = "coverage_update",
) {
  return {
    FixtureId: liveBinding.fixtureId,
    Seq: sequence,
    Id: sequence + 1,
    Ts: liveBinding.startTime + sequence * 60_000,
    Action: action,
    StatusId: statusId,
    ...(seconds === undefined
      ? { Clock: undefined }
      : { Clock: { Running: true, Seconds: seconds } }),
    Stats: sequence === 6 ? { "1": 2, "2": 1 } : { "1": 0, "2": 0 },
  };
}

function liveMarketRow(messageId: string) {
  return {
    FixtureId: liveBinding.fixtureId,
    MessageId: messageId,
    Ts: liveBinding.startTime + 5_000,
    Bookmaker: "TXLineStablePriceDemargined",
    BookmakerId: 10_021,
    SuperOddsType: "1X2_PARTICIPANT_RESULT",
    InRunning: true,
    MarketPeriod: null,
    MarketParameters: null,
    PriceNames: ["part1", "draw", "part2"],
    Pct: ["50.000", "30.000", "20.000"],
  };
}

function completingLiveClient(
  onCall: (operation: string) => void,
  bootstrapSequence = 0,
): TxlineProviderClient {
  const allEvents = [
    liveScoreEvent(0, 2, 2_700),
    liveScoreEvent(1, 2, 1_800),
    liveScoreEvent(2, 2, 900),
    liveScoreEvent(3, 3, undefined, "halftime_finalised"),
    liveScoreEvent(4, 4, 1_800),
    liveScoreEvent(5, 4, 900),
    liveScoreEvent(6, 5, undefined, "game_finalised"),
  ];
  const streamEvents = allEvents.filter(
    (event) => event.Seq > bootstrapSequence,
  );
  let marketSequence = 0;
  return {
    async getFixtureSnapshot() {
      onCall("provider:fixture");
      return [liveFixtureRow()];
    },
    async getOddsSnapshot() {
      onCall("provider:odds-snapshot");
      return [];
    },
    async getOddsUpdates() {
      onCall("provider:odds-updates");
      marketSequence += 1;
      return [liveMarketRow(`odds-${marketSequence}`)];
    },
    async getScoreSnapshot() {
      onCall("provider:score-snapshot");
      return [allEvents[bootstrapSequence]];
    },
    async *getScoreStream() {
      onCall("provider:score-stream");
      const event = streamEvents.shift();
      if (event !== undefined) yield { data: event };
    },
    async getHistoricalScoreReplay() {
      onCall("provider:historical");
      return [];
    },
  };
}

describe("Node HTTP runtime composition", () => {
  it("waits until locked kickoff before autonomously polling LIVE evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(liveBinding.startTime - 1_000);
    const liveManifest = lockedLiveManifest("arena-live-kickoff-wait-001");
    const providerCalls: string[] = [];
    const client = completingLiveClient((operation) => {
      providerCalls.push(operation);
    });
    const composition = await createNodeHttpRuntimeComposition({
      env: liveEnv,
      readFile: liveFiles(liveManifest),
      agents: {
        alpha: noTradeAgent("alpha"),
        beta: noTradeAgent("beta"),
      },
      store: testStore(),
      txlineClientFactory: () => client,
    });

    try {
      const address = await composition.listen({ port: 0 });
      await Promise.resolve();

      expect(providerCalls).toEqual([]);
      expect(
        await fetch(`http://${address.host}:${address.port}/ready`).then(
          (response) => response.status,
        ),
      ).toBe(200);

      await vi.advanceTimersByTimeAsync(999);
      expect(providerCalls).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      await vi.waitFor(() =>
        expect(providerCalls).toContain("provider:fixture"),
      );

      const state = publicArenaStateV1Schema.parse(
        await fetch(
          `http://${address.host}:${address.port}/api/arenas/${liveManifest.arenaId}`,
        ).then((response) => response.json()),
      );
      const kickoff = state.checkpoints[0];
      expect(kickoff).toBeDefined();
      if (kickoff === undefined) throw new Error("Missing KICKOFF checkpoint");
      expect(kickoff).toMatchObject({
        checkpointId: "KICKOFF",
        snapshot: { source: "TXLINE_LIVE" },
        portfoliosBefore: {
          alpha: { navMicros: "100000000" },
          beta: { navMicros: "100000000" },
        },
      });
      const { snapshot } = kickoff;
      const { alpha, beta } = kickoff.revealedDecisions;
      expect({ snapshot, alpha, beta }).toMatchObject({
        snapshot: { checkpointId: "KICKOFF" },
        alpha: { checkpointId: "KICKOFF" },
        beta: { checkpointId: "KICKOFF" },
      });
      if (snapshot === undefined || alpha === undefined || beta === undefined) {
        throw new Error("Missing revealed KICKOFF evidence");
      }
      expect(alpha.snapshotId).toBe(snapshot.snapshotId);
      expect(beta.snapshotId).toBe(snapshot.snapshotId);
    } finally {
      await composition.shutdown();
      vi.useRealTimers();
    }
  });

  it("keeps LIVE supervised while retrying one transient provider timeout", async () => {
    vi.useFakeTimers();
    const liveManifest = lockedLiveManifest(
      "arena-live-supervisor-retry-001",
    );
    let fixtureCalls = 0;
    const client = {
      async getFixtureSnapshot() {
        fixtureCalls += 1;
        if (fixtureCalls === 1) {
          throw new TxlineDataError(
            "PROVIDER_TIMEOUT",
            "TxLINE provider request timed out",
          );
        }
        return [liveFixtureRow()];
      },
      async getOddsSnapshot() {
        return [];
      },
      async getOddsUpdates() {
        return [];
      },
      async getScoreSnapshot() {
        return [
          {
            FixtureId: liveBinding.fixtureId,
            Seq: 0,
            Id: 1,
            Ts: liveBinding.startTime,
            Action: "coverage_update",
            StatusId: 1,
            Stats: { "1": 0, "2": 0 },
          },
        ];
      },
      async *getScoreStream() {},
      async getHistoricalScoreReplay() {
        return [];
      },
    } satisfies TxlineProviderClient;
    const store = testStore();
    const composition = await createNodeHttpRuntimeComposition({
      env: liveEnv,
      readFile: liveFiles(liveManifest),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store,
      txlineClientFactory: () => client,
    });

    try {
      const address = await composition.listen({ port: 0 });
      await vi.waitFor(() => expect(fixtureCalls).toBe(1));
      const supervisedReadiness = await fetch(
        `http://${address.host}:${address.port}/ready`,
      );
      expect(supervisedReadiness.status).toBe(200);
      await vi.advanceTimersByTimeAsync(5_000);

      expect({ fixtureCalls, ready: composition.isReady() }).toEqual({
        fixtureCalls: 2,
        ready: true,
      });
      await expect(store.read(liveManifest.arenaId, 0)).resolves.toMatchObject({
        state: { phase: "READY", checkpoints: [], lastEventSequence: 1 },
      });
    } finally {
      await composition.shutdown();
      vi.useRealTimers();
    }
  });

  it("fails LIVE readiness without retrying provider authentication failure", async () => {
    const liveManifest = lockedLiveManifest(
      "arena-live-supervisor-auth-failure-001",
    );
    let fixtureCalls = 0;
    const client = failingBootstrapClient(
      new TxlineDataError(
        "PROVIDER_AUTHENTICATION_FAILURE",
        "TxLINE provider authentication failed",
      ),
      () => {
        fixtureCalls += 1;
      },
    );
    const composition = await createNodeHttpRuntimeComposition({
      env: liveEnv,
      readFile: liveFiles(liveManifest),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
      txlineClientFactory: () => client,
    });

    try {
      const address = await composition.listen({ port: 0 });
      await vi.waitFor(() => expect(composition.isReady()).toBe(false));
      const readiness = await fetch(
        `http://${address.host}:${address.port}/ready`,
      );

      expect({
        fixtureCalls,
        ready: composition.isReady(),
        readiness: {
          status: readiness.status,
          body: await readiness.json(),
        },
      }).toEqual({
        fixtureCalls: 1,
        ready: false,
        readiness: {
          status: 503,
          body: {
            schemaVersion: 1,
            error: {
              code: "NOT_READY",
              message: "The arena runtime is not ready",
            },
          },
        },
      });
    } finally {
      await composition.shutdown();
    }
  });

  it("composes one locked Replay lifecycle and HTTP runtime without external calls", async () => {
    const composition = await createNodeHttpRuntimeComposition({
      env: replayEnv,
      readFile: fileReader({
        "manifest.json": manifest,
        "recording.json": recording,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
    });

    expect({
      mode: composition.mode,
      manifest: composition.manifest,
      ready: composition.isReady(),
      hasServer: typeof composition.server.listen,
      hasRunner: typeof composition.runner.run,
      hasStore: typeof composition.store.read,
      hasCapacity: typeof composition.capacityCoordinator.claim,
      persistence: composition.persistence,
    }).toEqual({
      mode: "REPLAY",
      manifest,
      ready: true,
      hasServer: "function",
      hasRunner: "function",
      hasStore: "function",
      hasCapacity: "function",
      persistence: "INJECTED",
    });

    await composition.shutdown();
  });

  it("composes LIVE only from strict fixture binding and configured TxLINE", async () => {
    const binding = {
      fixtureId: 18_185_036,
      participant1Id: 101,
      participant2Id: 202,
      participant1IsHome: true,
      startTime: Date.parse(manifest.kickoffUtc),
    };
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-001",
      mode: "LIVE" as const,
      fixtureId: String(binding.fixtureId),
    };
    const providerCalls: string[] = [];
    const client = {
      async getFixtureSnapshot() {
        providerCalls.push("fixture");
        return [];
      },
      async getOddsSnapshot() {
        providerCalls.push("odds-snapshot");
        return [];
      },
      async getOddsUpdates() {
        providerCalls.push("odds-updates");
        return [];
      },
      async getScoreSnapshot() {
        providerCalls.push("score-snapshot");
        return [];
      },
      async *getScoreStream() {
        providerCalls.push("score-stream");
      },
      async getHistoricalScoreReplay() {
        providerCalls.push("history");
        return [];
      },
    } satisfies TxlineProviderClient;
    let factoryCalls = 0;
    const composition = await createNodeHttpRuntimeComposition({
      env: {
        ARENA90_RUNTIME_MODE: "LIVE",
        ARENA90_MANIFEST_FILE: "manifest.json",
        ARENA90_LIVE_FIXTURE_BINDING_FILE: "binding.json",
        ARENA90_LIVE_DELAYED: "false",
        ARENA90_AGENT_TIMEOUT_MS: "1000",
        TXLINE_CREDENTIALS_FILE: "txline-credentials.json",
        TXLINE_TIMEOUT_MS: "1000",
        TXLINE_MAX_RESPONSE_BYTES: "65536",
        TXLINE_MAX_SSE_EVENTS: "100",
      },
      readFile: fileReader({
        "manifest.json": liveManifest,
        "binding.json": binding,
        "txline-credentials.json": {
          apiOrigin: "https://provider.example.test",
          jwt: "configured-secret",
          apiToken: "configured-secret",
          network: "test",
        },
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
      txlineClientFactory(env) {
        factoryCalls += 1;
        expect(Boolean(env["TXLINE_JWT"] && env["TXLINE_API_TOKEN"])).toBe(
          true,
        );
        return client;
      },
    });

    expect({
      mode: composition.mode,
      factoryCalls,
      providerCalls,
      ready: composition.isReady(),
    }).toEqual({
      mode: "LIVE",
      factoryCalls: 1,
      providerCalls: [],
      ready: true,
    });

    await composition.shutdown();
  });

  it("listens on loopback, reports composition readiness, and shuts down idempotently", async () => {
    const composition = await createNodeHttpRuntimeComposition({
      env: replayEnv,
      readFile: replayFiles(),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
    });
    const address = await composition.listen({ port: 0 });
    const origin = `http://${address.host}:${address.port}`;

    const [health, ready] = await Promise.all([
      fetch(`${origin}/health`),
      fetch(`${origin}/ready`),
    ]);
    const firstShutdown = composition.shutdown();
    const secondShutdown = composition.shutdown();

    expect({
      address,
      health: {
        status: health.status,
        body: await health.json(),
        cors: health.headers.get("access-control-allow-origin"),
      },
      ready: { status: ready.status, body: await ready.json() },
      sameShutdown: firstShutdown === secondShutdown,
    }).toEqual({
      address: { host: "127.0.0.1", port: expect.any(Number) },
      health: {
        status: 200,
        body: { schemaVersion: 1, status: "UP" },
        cors: null,
      },
      ready: {
        status: 200,
        body: {
          schemaVersion: 1,
          status: "READY",
          configuredMode: "REPLAY",
        },
      },
      sameShutdown: true,
    });

    await firstShutdown;
    expect(composition.isReady()).toBe(false);
  });

  it("does not report autostart readiness before canonical state is persisted", async () => {
    const baseStore = testStore();
    let markInitializeStarted!: () => void;
    const initializeStarted = new Promise<void>((resolve) => {
      markInitializeStarted = resolve;
    });
    let releaseInitialize!: () => void;
    const initializeGate = new Promise<void>((resolve) => {
      releaseInitialize = resolve;
    });
    const store = {
      ...baseStore,
      async initialize(
        ...args: Parameters<typeof baseStore.initialize>
      ): ReturnType<typeof baseStore.initialize> {
        markInitializeStarted();
        await initializeGate;
        return baseStore.initialize(...args);
      },
    };
    const composition = await createNodeHttpRuntimeComposition({
      env: { ...replayEnv, ARENA90_AUTOSTART: "true" },
      readFile: replayFiles(),
      agents: {
        alpha: noTradeAgent("alpha"),
        beta: noTradeAgent("beta"),
      },
      store,
    });

    const listening = composition.listen({ port: 0 });
    await initializeStarted;
    const pendingAddress = composition.server.address();
    if (typeof pendingAddress !== "object" || pendingAddress === null) {
      throw new Error("Server was not listening during autostart initialization");
    }
    const pendingReadiness = await fetch(
      `http://127.0.0.1:${pendingAddress.port}/ready`,
    );
    releaseInitialize();
    const address = await listening;
    const persistedReadiness = await fetch(
      `http://${address.host}:${address.port}/ready`,
    );

    expect({
      beforePersistence: pendingReadiness.status,
      afterPersistence: persistedReadiness.status,
    }).toEqual({ beforePersistence: 503, afterPersistence: 200 });

    await composition.shutdown();
  });

  it("autostarts a locked manifest without an HTTP create or run trigger", async () => {
    const store = testStore();
    const composition = await createNodeHttpRuntimeComposition({
      env: { ...replayEnv, ARENA90_AUTOSTART: "true" },
      readFile: replayFiles(),
      agents: {
        alpha: noTradeAgent("alpha"),
        beta: noTradeAgent("beta"),
      },
      store,
    });

    const address = await composition.listen({ port: 0 });
    const mutationResponse = await fetch(
      `http://${address.host}:${address.port}/api/arenas/${manifest.arenaId}/run`,
      { method: "POST" },
    );
    let persisted = await store.read(manifest.arenaId, 0);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (persisted !== "NOT_FOUND" && persisted.state.phase === "COMPLETED") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
      persisted = await store.read(manifest.arenaId, 0);
    }

    expect({
      mutationStatus: mutationResponse.status,
      state:
        persisted === "NOT_FOUND"
          ? persisted
          : {
              phase: persisted.state.phase,
              checkpoints: persisted.state.checkpoints.length,
              finalResult: persisted.state.finalResult?.winningAssetId,
              strategies: {
                alpha: persisted.state.runtimeMetadata.agents.alpha.strategyId,
                beta: persisted.state.runtimeMetadata.agents.beta.strategyId,
                version:
                  persisted.state.runtimeMetadata.agents.alpha.strategyVersion,
              },
            },
    }).toEqual({
      mutationStatus: 404,
      state: {
        phase: "COMPLETED",
        checkpoints: 6,
        finalResult: "HOME",
        strategies: {
          alpha: "alpha-overreaction-hunter",
          beta: "beta-underreaction-hunter",
          version: "4",
        },
      },
    });

    await composition.shutdown();
  });

  it("resumes a persisted LIVE checkpoint after runtime reconstruction without duplicate events", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arena90-http-restart-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const liveManifest = lockedLiveManifest("arena-live-http-restart-001");
    const env = {
      ...liveEnv,
      ARENA90_PERSISTENCE_DIR: directory,
    };
    const firstProviderCalls: string[] = [];
    let startedInvocations = 0;
    let markBothStarted!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      markBothStarted = resolve;
    });
    const blockingAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      invoke({ signal }: { signal: AbortSignal }) {
        startedInvocations += 1;
        if (startedInvocations === 2) markBothStarted();
        return new Promise<never>((_resolve, reject) => {
          const abort = () => reject(new Error("test invocation aborted"));
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        });
      },
    });
    const first = await createNodeHttpRuntimeComposition({
      env,
      readFile: liveFiles(liveManifest),
      agents: {
        alpha: blockingAgent("alpha"),
        beta: blockingAgent("beta"),
      },
      nowMs: () => liveBinding.startTime + 10_000,
      txlineClientFactory: () =>
        completingLiveClient((operation) => firstProviderCalls.push(operation)),
    });

    await first.listen({ port: 0 });
    await bothStarted;
    await first.shutdown();
    const interrupted = await first.store.read(liveManifest.arenaId, 0);

    const resumeTrace: string[] = [];
    const resumed = await createNodeHttpRuntimeComposition({
      env,
      readFile: liveFiles(liveManifest),
      agents: {
        alpha: noTradeAgent("alpha"),
        beta: noTradeAgent("beta"),
      },
      nowMs: () => liveBinding.startTime + 10_000,
      observeAgentInvocation({ agentId, checkpointId }) {
        resumeTrace.push(`agent:${agentId}:${checkpointId}`);
      },
      txlineClientFactory: () =>
        completingLiveClient(
          (operation) => resumeTrace.push(operation),
          1,
        ),
    });

    try {
      const address = await resumed.listen({ port: 0 });
      let persisted = await resumed.store.read(liveManifest.arenaId, 0);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (persisted !== "NOT_FOUND" && persisted.state.phase === "COMPLETED") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        persisted = await resumed.store.read(liveManifest.arenaId, 0);
      }
      if (persisted === "NOT_FOUND") throw new Error("Arena was not persisted");
      const publicHistory = publicEventHistoryV1Schema.parse(
        await fetch(
          `http://${address.host}:${address.port}/api/arenas/${liveManifest.arenaId}/events`,
        ).then((response) => response.json()),
      );
      const publicKickoffEvents = publicHistory.events.filter(
        (event) => "checkpointId" in event && event.checkpointId === "KICKOFF",
      );
      const publicKickoffOpened = publicKickoffEvents.find(
        (event) => event.type === "CHECKPOINT_OPENED",
      );
      const publicKickoffReveal = publicKickoffEvents.find(
        (event) => event.type === "ROUND_REVEALED",
      );

      expect({
        interruptedPhase:
          interrupted === "NOT_FOUND" ? interrupted : interrupted.state.phase,
        resumedPhase: persisted.state.phase,
        checkpoints: persisted.state.checkpoints.length,
        checkpointSources: persisted.state.checkpoints.map(
          ({ snapshot }) => snapshot?.source,
        ),
        firstProviderCalls,
        firstResumedProviderIndex: resumeTrace.findIndex((item) =>
          item.startsWith("provider:"),
        ),
        resumedKickoffCalls: resumeTrace.slice(0, 2).sort(),
        eventSequences: persisted.events.map(({ sequence }) => sequence),
        uniqueEventIds: new Set(
          persisted.events.map(({ eventId }) => eventId),
        ).size,
        kickoffOpened: persisted.events.filter(
          ({ checkpointId, type }) =>
            checkpointId === "KICKOFF" && type === "CHECKPOINT_OPENED",
        ).length,
        completedEvents: persisted.events.filter(
          ({ type }) => type === "COMPLETED",
        ).length,
        publicEventSequences: publicHistory.events.map(({ sequence }) => sequence),
        publicKickoffTypes: publicKickoffEvents.map(({ type }) => type),
        publicKickoffAgents: publicKickoffEvents
          .flatMap((event) =>
            event.type === "DECISION_RECEIVED" ? [event.agentId] : [],
          )
          .sort(),
        publicKickoffOpened,
        publicKickoffReveal,
      }).toEqual({
        interruptedPhase: "RUNNING",
        resumedPhase: "COMPLETED",
        checkpoints: 6,
        checkpointSources: Array.from({ length: 6 }, () => "TXLINE_LIVE"),
        firstProviderCalls: [
          "provider:fixture",
          "provider:score-snapshot",
          "provider:odds-snapshot",
          "provider:odds-updates",
        ],
        firstResumedProviderIndex: 2,
        resumedKickoffCalls: ["agent:alpha:KICKOFF", "agent:beta:KICKOFF"],
        eventSequences: persisted.events.map((_event, index) => index + 1),
        uniqueEventIds: persisted.events.length,
        kickoffOpened: 1,
        completedEvents: 1,
        publicEventSequences: persisted.events.map((_event, index) => index + 1),
        publicKickoffTypes: [
          "CHECKPOINT_OPENED",
          "AGENTS_ANALYZING",
          "DECISION_RECEIVED",
          "DECISION_RECEIVED",
          "ROUND_REVEALED",
          "ROUND_COMPLETE",
        ],
        publicKickoffAgents: ["alpha", "beta"],
        publicKickoffOpened: expect.objectContaining({
          payload: {
            snapshot: expect.objectContaining({
              fixtureId: liveManifest.fixtureId,
              checkpointId: "KICKOFF",
              source: "TXLINE_LIVE",
              freshness: {
                marketUpdatedAtUtc: expect.any(String),
                delayed: false,
                suspended: false,
              },
            }),
          },
        }),
        publicKickoffReveal: expect.objectContaining({
          payload: expect.objectContaining({
            decisions: {
              alpha: expect.objectContaining({ checkpointId: "KICKOFF" }),
              beta: expect.objectContaining({ checkpointId: "KICKOFF" }),
            },
            failures: [],
          }),
        }),
      });
    } finally {
      await resumed.shutdown();
    }
  });

  it("fails closed when LIVE autostart is explicitly disabled", async () => {
    await expect(
      createNodeHttpRuntimeComposition({
        env: {
          ARENA90_RUNTIME_MODE: "LIVE",
          ARENA90_AUTOSTART: "false",
        },
      }),
    ).rejects.toMatchObject({ category: "CONFIG_FAILURE" });
  });

  it("fails closed for ambiguous mode and incompatible locked Replay inputs", async () => {
    await expect(
      createNodeHttpRuntimeComposition({
        env: {
          ...replayEnv,
          ARENA90_RUNTIME_MODE: undefined,
        },
        readFile: replayFiles(),
        agents: { alpha: agent("alpha"), beta: agent("beta") },
        store: testStore(),
      }),
    ).rejects.toMatchObject({ category: "CONFIG_FAILURE" });

    const sourceKickoffUtc = "2026-07-13T11:55:00.000Z";
    const historicalRecording = {
      ...recording,
      provenance: {
        source: "TXLINE_HISTORICAL_API",
        sourceFixtureId: 123,
        sourceKickoffUtc,
        capturedAtUtc: "2026-07-14T00:00:00.000Z",
        scoreEventCount: 7,
        oddsUpdateCount: 21,
        inputHash: "a".repeat(64),
      },
    };
    const historicalComposition = await createNodeHttpRuntimeComposition({
      env: replayEnv,
      readFile: replayFiles(
        { ...manifest, kickoffUtc: sourceKickoffUtc },
        historicalRecording,
      ),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
    });
    await historicalComposition.shutdown();

    await expect(
      createNodeHttpRuntimeComposition({
        env: replayEnv,
        readFile: replayFiles(manifest, historicalRecording),
        agents: { alpha: agent("alpha"), beta: agent("beta") },
        store: testStore(),
      }),
    ).rejects.toMatchObject({ category: "RECORDING_FAILURE" });

    await expect(
      createNodeHttpRuntimeComposition({
        env: replayEnv,
        readFile: replayFiles(manifest, {
          ...recording,
          fixtureId: "different-fixture",
        }),
        agents: { alpha: agent("alpha"), beta: agent("beta") },
        store: testStore(),
      }),
    ).rejects.toMatchObject({ category: "RECORDING_FAILURE" });
  });

  it("rejects hostile LIVE binding fields and missing TxLINE configuration without fallback", async () => {
    const binding = {
      fixtureId: 18_185_036,
      participant1Id: 101,
      participant2Id: 202,
      participant1IsHome: true,
      startTime: Date.parse(manifest.kickoffUtc),
    };
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-locked-001",
      mode: "LIVE" as const,
      fixtureId: String(binding.fixtureId),
    };
    const completeLiveEnv = {
      ARENA90_RUNTIME_MODE: "LIVE",
      ARENA90_MANIFEST_FILE: "manifest.json",
      ARENA90_LIVE_FIXTURE_BINDING_FILE: "binding.json",
      ARENA90_LIVE_DELAYED: "false",
      ARENA90_AGENT_TIMEOUT_MS: "1000",
      TXLINE_BASE_URL: "https://provider.example.test",
      TXLINE_JWT: "configured-secret",
      TXLINE_API_TOKEN: "configured-secret",
      TXLINE_TIMEOUT_MS: "1000",
      TXLINE_MAX_RESPONSE_BYTES: "65536",
      TXLINE_MAX_SSE_EVENTS: "100",
    };
    const hostileBinding = createNodeHttpRuntimeComposition({
      env: completeLiveEnv,
      readFile: fileReader({
        "manifest.json": liveManifest,
        "binding.json": { ...binding, providerPayload: "must-not-pass" },
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
      txlineClientFactory() {
        throw new Error("factory must not run");
      },
    });
    const missingTxline = createNodeHttpRuntimeComposition({
      env: { ...completeLiveEnv, TXLINE_JWT: undefined },
      readFile: fileReader({
        "manifest.json": liveManifest,
        "binding.json": binding,
        "recording.json": recording,
      }),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      store: testStore(),
      txlineClientFactory() {
        throw new Error("factory must not run");
      },
    });

    await expect(hostileBinding).rejects.toMatchObject({
      category: "FIXTURE_BINDING_FAILURE",
    });
    await expect(missingTxline).rejects.toMatchObject({
      category: "CONFIG_FAILURE",
    });
  });

  it("formats only sanitized startup failure categories", async () => {
    const secret = "provider-token-value";
    const privatePath = "/private/config/fixture-binding.json";
    let caught: unknown;
    try {
      await createNodeHttpRuntimeComposition({
        env: {
          ...replayEnv,
          ARENA90_MANIFEST_FILE: privatePath,
        },
        readFile: async () => {
          throw new Error(`${secret} raw-provider-payload`);
        },
        agents: { alpha: agent("alpha"), beta: agent("beta") },
        store: testStore(),
      });
    } catch (error) {
      caught = error;
    }
    const category = classifyNodeHttpRuntimeFailure(caught);
    const visible = JSON.stringify({
      category,
      output: formatNodeHttpRuntimeFailure(category),
    });

    expect(category).toBe("MANIFEST_FAILURE");
    expect(visible).toBe(
      '{"category":"MANIFEST_FAILURE","output":"Arena HTTP server failed: MANIFEST_FAILURE."}',
    );
    expect(visible).not.toContain(secret);
    expect(visible).not.toContain(privatePath);
    expect(visible).not.toContain("raw-provider-payload");
  });

  it("aborts a background lifecycle and closes SSE during graceful shutdown", async () => {
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let abortedInvocations = 0;
    const hangingAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      invoke(request: { signal: AbortSignal }) {
        markStarted();
        return new Promise<never>((_resolve, reject) => {
          const abort = () => {
            abortedInvocations += 1;
            reject(new Error("test invocation aborted"));
          };
          request.signal.addEventListener("abort", abort, { once: true });
          if (request.signal.aborted) abort();
        });
      },
    });
    const composition = await createNodeHttpRuntimeComposition({
      env: replayEnv,
      readFile: replayFiles(),
      agents: {
        alpha: hangingAgent("alpha"),
        beta: hangingAgent("beta"),
      },
      store: testStore(),
    });
    const address = await composition.listen({ port: 0 });
    const origin = `http://${address.host}:${address.port}`;
    const created = await fetch(`${origin}/api/arenas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest }),
    });
    expect(created.status).toBe(201);
    const streamResponsePromise = fetch(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    const run = await fetch(`${origin}/api/arenas/${manifest.arenaId}/run`, {
      method: "POST",
    });
    expect(run.status).toBe(202);
    await started;
    const streamResponse = await streamResponsePromise;
    expect(streamResponse.status).toBe(200);

    await composition.shutdown();
    const streamTail = await streamResponse.text();

    expect({
      ready: composition.isReady(),
      abortedInvocations,
      streamClosedAfterPublicEvent: streamTail.includes("event: arena-event"),
      listening: composition.server.listening,
    }).toEqual({
      ready: false,
      abortedInvocations: 2,
      streamClosedAfterPublicEvent: true,
      listening: false,
    });
  });
});
