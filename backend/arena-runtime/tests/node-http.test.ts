import { describe, expect, it } from "vitest";

import type { TxlineProviderClient } from "../src/adapters/data/index.js";
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

describe("Node HTTP runtime composition", () => {
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
          version: "3",
        },
      },
    });

    await composition.shutdown();
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
