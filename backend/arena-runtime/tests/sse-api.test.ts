import { readFile } from "node:fs/promises";
import { getEventListeners } from "node:events";
import {
  request as nodeHttpRequest,
  ServerResponse,
  type ClientRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
  createArenaHttpServer,
  createNodeArenaLifecycleComposition,
  publicApiErrorEnvelopeV1Schema,
  publicArenaEventV1Schema,
  type ArenaLifecycleReadResult,
  type ArenaLifecycleRunner,
  type ArenaLifecycleStore,
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
} as const;

const runtimeMetadata = {
  runtimeId: "private-sse-runtime",
  runtimeVersion: "7.3",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "p0-final-nav-v1",
  agentTimeoutMs: 1_000,
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

class ControlledStore implements ArenaLifecycleStore {
  private persistence: ArenaLifecycleReadResult;
  readCalls = 0;

  constructor(persistence: ArenaLifecycleReadResult) {
    this.persistence = structuredClone(persistence);
  }

  replace(persistence: ArenaLifecycleReadResult): void {
    this.persistence = structuredClone(persistence);
  }

  async read(arenaId: string, afterEventSequence: number) {
    this.readCalls += 1;
    if (arenaId !== this.persistence.state.manifest.arenaId) {
      return "NOT_FOUND" as const;
    }
    return {
      state: structuredClone(this.persistence.state),
      events: structuredClone(
        this.persistence.events.filter(
          (event) => event.sequence > afterEventSequence,
        ),
      ),
    };
  }

  async initialize(): Promise<never> {
    throw new Error("not used by SSE tests");
  }

  async acquire(): Promise<never> {
    throw new Error("not used by SSE tests");
  }
}

class HangingStore implements ArenaLifecycleStore {
  readCalls = 0;

  constructor(
    private readonly persistence: ArenaLifecycleReadResult,
    private readonly successfulReads: number,
  ) {}

  async read(arenaId: string, afterEventSequence: number) {
    this.readCalls += 1;
    if (this.readCalls > this.successfulReads) {
      return new Promise<never>(() => undefined);
    }
    if (arenaId !== this.persistence.state.manifest.arenaId) {
      return "NOT_FOUND" as const;
    }
    return {
      state: structuredClone(this.persistence.state),
      events: structuredClone(
        this.persistence.events.filter(
          (event) => event.sequence > afterEventSequence,
        ),
      ),
    };
  }

  async initialize(): Promise<never> {
    throw new Error("not used by SSE tests");
  }

  async acquire(): Promise<never> {
    throw new Error("not used by SSE tests");
  }
}

interface RawResponse {
  status: number | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

interface ParsedFrame {
  id: string;
  event: string;
  data: unknown;
}

const openServers = new Set<Server>();
let readyPersistence: ArenaLifecycleReadResult;
let completedPersistence: ArenaLifecycleReadResult;

beforeAll(async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
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
        publicExplanation: `${agentId} holds the public portfolio.`,
      };
    },
  });
  const composition = createNodeArenaLifecycleComposition({
    recordedFixture: fixture,
    agents: { alpha: agent("alpha"), beta: agent("beta") },
    runtimeMetadata,
    timing: {
      nowMs: () => 1_000,
      wait: async (_delayMs, signal) => {
        if (!signal.aborted) {
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve(), { once: true });
          });
        }
      },
      waitForCheckpoint: async () => undefined,
    },
    lease: { ownerId: "sse-test", ttlMs: 10_000, renewEveryMs: 1_000 },
  });
  await composition.runner.create(manifest);
  const ready = await composition.store.read(manifest.arenaId, 0);
  if (ready === "NOT_FOUND") throw new Error("missing ready SSE fixture");
  readyPersistence = ready;
  await composition.runner.run(
    manifest.arenaId,
    new AbortController().signal,
  );
  const completed = await composition.store.read(manifest.arenaId, 0);
  if (completed === "NOT_FOUND") throw new Error("missing completed SSE fixture");
  completedPersistence = completed;
});

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

async function startServer(
  store: ArenaLifecycleStore,
  sseOverrides: Readonly<{
    pollIntervalMs?: number;
    heartbeatIntervalMs?: number;
    drainTimeoutMs?: number;
    maxEventsPerPoll?: number;
  }> = {},
): Promise<{
  server: Server;
  origin: string;
}> {
  const runner: ArenaLifecycleRunner = {
    async create() {
      throw new Error("not used by SSE tests");
    },
    async run(arenaId) {
      const found = await store.read(arenaId, 0);
      if (found === "NOT_FOUND") throw new Error("missing SSE arena");
      return found.state;
    },
  };
  const server = createArenaHttpServer({
    runner,
    store,
    configuredSource: {
      mode: "REPLAY",
      arenaId: manifest.arenaId,
      fixtureId: manifest.fixtureId,
      homeTeam: manifest.homeTeam,
      awayTeam: manifest.awayTeam,
      kickoffUtc: manifest.kickoffUtc,
    },
    isReady: () => true,
    sse: {
      pollIntervalMs: 5,
      heartbeatIntervalMs: 20,
      drainTimeoutMs: 50,
      maxEventsPerPoll: 64,
      ...sseOverrides,
    },
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  openServers.add(server);
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function openStream(
  url: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<{
  request: ClientRequest;
  response: IncomingMessage;
  body(): string;
  ended: Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest(url, { method: "GET", headers }, (response) => {
      response.setEncoding("utf8");
      let body = "";
      let resolveEnded: () => void = () => undefined;
      const ended = new Promise<void>((resolveEnd) => {
        resolveEnded = resolveEnd;
      });
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.once("end", resolveEnded);
      response.once("close", resolveEnded);
      resolve({ request, response, body: () => body, ended });
    });
    request.once("error", reject);
    request.end();
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("SSE test wait timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function requestToEnd(
  url: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest(url, { method: "GET", headers }, (response) => {
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.once("end", () => {
        resolve({ status: response.statusCode, headers: response.headers, body });
      });
    });
    request.once("error", reject);
    request.end();
  });
}

function parseFrames(body: string): ParsedFrame[] {
  return body
    .split("\n\n")
    .filter((frame) => frame.startsWith("id: "))
    .map((frame) => {
      const lines = frame.split("\n");
      return {
        id: lines[0]!.slice("id: ".length),
        event: lines[1]!.slice("event: ".length),
        data: JSON.parse(lines[2]!.slice("data: ".length)) as unknown,
      };
    });
}

describe("Arena SSE API", () => {
  it("replays all persisted public events and closes after COMPLETED", async () => {
    const store = new ControlledStore(completedPersistence);
    const { origin } = await startServer(store);

    const response = await requestToEnd(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    const frames = parseFrames(response.body);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(frames.map(({ id }) => Number(id))).toEqual(
      completedPersistence.events.map(({ sequence }) => sequence),
    );
    expect(frames.every(({ event }) => event === "arena-event")).toBe(true);
    expect(frames.map(({ data }) => publicArenaEventV1Schema.parse(data).type).at(-1)).toBe(
      "COMPLETED",
    );
    expect(response.body).not.toMatch(
      /prompt|rawModelOutput|provider|secret|lease|fencing/i,
    );
  });

  it("replays an initial backlog larger than the configured batch", async () => {
    const store = new ControlledStore(completedPersistence);
    const { origin } = await startServer(store, { maxEventsPerPoll: 5 });

    const response = await requestToEnd(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );

    expect(response.status).toBe(200);
    expect(parseFrames(response.body).map(({ id }) => Number(id))).toEqual(
      completedPersistence.events.map(({ sequence }) => sequence),
    );
    expect(store.readCalls).toBeGreaterThanOrEqual(8);
  });

  it("resumes exclusively from a valid Last-Event-ID", async () => {
    const store = new ControlledStore(completedPersistence);
    const { origin } = await startServer(store);
    const cursor = 5;

    const response = await requestToEnd(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
      { "last-event-id": String(cursor) },
    );

    expect(response.status).toBe(200);
    expect(parseFrames(response.body).map(({ id }) => Number(id))).toEqual(
      completedPersistence.events
        .filter(({ sequence }) => sequence > cursor)
        .map(({ sequence }) => sequence),
    );
  });

  it("rejects invalid or ahead cursors before opening SSE", async () => {
    const store = new ControlledStore(completedPersistence);
    const { origin } = await startServer(store);
    const url = `${origin}/api/arenas/${manifest.arenaId}/events/stream`;

    for (const cursor of ["-1", "01", "1.5", "abc", "1, 2", "999999999999999999999"]) {
      const invalid = await requestToEnd(url, { "last-event-id": cursor });
      expect(invalid.status).toBe(400);
      expect(invalid.headers["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      expect(
        publicApiErrorEnvelopeV1Schema.parse(JSON.parse(invalid.body)).error.code,
      ).toBe("INVALID_EVENT_CURSOR");
    }

    const ahead = await requestToEnd(url, {
      "last-event-id": String(
        completedPersistence.state.lastEventSequence + 1,
      ),
    });
    expect(ahead.status).toBe(409);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(JSON.parse(ahead.body)).error.code,
    ).toBe("EVENT_CURSOR_AHEAD");
  });

  it("fails closed when persisted event projection is unknown", async () => {
    const corrupt = {
      state: structuredClone(completedPersistence.state),
      events: [...completedPersistence.events],
    };
    corrupt.events[1] = {
      ...corrupt.events[1]!,
      type: "PRIVATE_UNKNOWN_EVENT",
    } as never;
    const store = new ControlledStore(corrupt);
    const { origin } = await startServer(store);

    const response = await requestToEnd(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    expect(response.status).toBe(500);
    expect(
      publicApiErrorEnvelopeV1Schema.parse(JSON.parse(response.body)),
    ).toEqual({
      schemaVersion: 1,
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed",
      },
    });
    expect(response.body).not.toMatch(/PRIVATE_UNKNOWN_EVENT|stack|provider/i);
  });

  it("returns 204 when reconnecting at the completed tail", async () => {
    const store = new ControlledStore(completedPersistence);
    const { origin } = await startServer(store);

    const response = await requestToEnd(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
      {
        "last-event-id": String(
          completedPersistence.state.lastEventSequence,
        ),
      },
    );

    expect(response).toMatchObject({ status: 204, body: "" });
    expect(response.headers["content-type"]).toBeUndefined();
  });

  it("follows newly persisted events exactly once and in order", async () => {
    const store = new ControlledStore(readyPersistence);
    const { origin } = await startServer(store);
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );

    await waitUntil(() => parseFrames(stream.body()).length === 1);
    store.replace(completedPersistence);
    await stream.ended;

    const sequences = parseFrames(stream.body()).map(({ id }) => Number(id));
    expect(sequences).toEqual(
      completedPersistence.events.map(({ sequence }) => sequence),
    );
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("follows a backlog larger than one batch without drops or duplicates", async () => {
    const store = new ControlledStore(readyPersistence);
    const { origin } = await startServer(store, { maxEventsPerPoll: 4 });
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );

    await waitUntil(() => parseFrames(stream.body()).length === 1);
    store.replace(completedPersistence);
    await stream.ended;

    const sequences = parseFrames(stream.body()).map(({ id }) => Number(id));
    expect(sequences).toEqual(
      completedPersistence.events.map(({ sequence }) => sequence),
    );
    expect(new Set(sequences).size).toBe(sequences.length);
    expect(store.readCalls).toBeGreaterThanOrEqual(10);
  });

  it("sends heartbeat comments without advancing the cursor", async () => {
    const store = new ControlledStore(readyPersistence);
    const { origin } = await startServer(store);
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
      { "last-event-id": "1" },
    );

    try {
      await waitUntil(() => stream.body().includes(": heartbeat\n\n"), 250);
      const heartbeat = stream
        .body()
        .split("\n\n")
        .find((frame) => frame.startsWith(": heartbeat"));
      expect(heartbeat).toBe(": heartbeat");
      expect(parseFrames(stream.body())).toEqual([]);
    } finally {
      stream.response.destroy();
      await stream.ended;
    }
  });

  it("waits for drain before advancing cursor to the next frame", async () => {
    const store = new ControlledStore(readyPersistence);
    const originalWrite = ServerResponse.prototype.write;
    let blockedResponse: ServerResponse | undefined;
    let blocked = false;
    ServerResponse.prototype.write = function patchedWrite(
      this: ServerResponse,
      chunk: Uint8Array | string,
      ...args: unknown[]
    ): boolean {
      if (
        !blocked &&
        typeof chunk === "string" &&
        chunk.startsWith("id: 1\n")
      ) {
        blocked = true;
        blockedResponse = this;
        Reflect.apply(originalWrite, this, [chunk, ...args]);
        return false;
      }
      return Reflect.apply(originalWrite, this, [chunk, ...args]) as boolean;
    } as typeof ServerResponse.prototype.write;
    const { origin } = await startServer(store);
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    try {
      await waitUntil(() => blocked);
      store.replace(completedPersistence);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(stream.body()).not.toContain("id: 2\n");
      blockedResponse!.emit("drain");
      await stream.ended;
      expect(parseFrames(stream.body()).map(({ id }) => Number(id))).toEqual(
        completedPersistence.events.map(({ sequence }) => sequence),
      );
    } finally {
      ServerResponse.prototype.write = originalWrite;
      stream.response.destroy();
      await stream.ended;
    }
  });

  it("closes a stream when drain exceeds the bounded timeout", async () => {
    const store = new ControlledStore(readyPersistence);
    const originalWrite = ServerResponse.prototype.write;
    let blocked = false;
    ServerResponse.prototype.write = function patchedWrite(
      this: ServerResponse,
      chunk: Uint8Array | string,
      ...args: unknown[]
    ): boolean {
      if (!blocked && typeof chunk === "string" && chunk.startsWith("id: 1\n")) {
        blocked = true;
        Reflect.apply(originalWrite, this, [chunk, ...args]);
        return false;
      }
      return Reflect.apply(originalWrite, this, [chunk, ...args]) as boolean;
    } as typeof ServerResponse.prototype.write;
    const { origin } = await startServer(store, { drainTimeoutMs: 20 });
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    try {
      await stream.ended;
      expect(parseFrames(stream.body()).map(({ id }) => Number(id))).toEqual([1]);
    } finally {
      ServerResponse.prototype.write = originalWrite;
      stream.response.destroy();
      await stream.ended;
    }
  });

  it("closes active streams during server shutdown", async () => {
    const store = new ControlledStore(readyPersistence);
    const { server, origin } = await startServer(store);
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    await waitUntil(() => parseFrames(stream.body()).length === 1);

    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.race([
      closed,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("server shutdown timed out")), 250),
      ),
    ]);
    await stream.ended;
    expect(stream.response.destroyed || stream.response.complete).toBe(true);
  });

  it("shutdown exits while the initial store read is still hanging", async () => {
    const store = new HangingStore(readyPersistence, 0);
    const { server, origin } = await startServer(store);
    const request = nodeHttpRequest(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    request.on("error", () => undefined);
    request.end();
    await waitUntil(() => store.readCalls === 1);

    try {
      await Promise.race([
        new Promise<void>((resolve) => server.close(() => resolve())),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("initial read shutdown timed out")),
            250,
          ),
        ),
      ]);
    } finally {
      request.destroy();
      server.closeAllConnections();
    }
  });

  it("disconnect and shutdown exit while follow reads are hanging", async () => {
    const disconnectStore = new HangingStore(readyPersistence, 1);
    const first = await startServer(disconnectStore);
    const disconnected = await openStream(
      `${first.origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    await waitUntil(() => disconnectStore.readCalls === 2);
    disconnected.response.destroy();
    await disconnected.ended;
    await Promise.race([
      new Promise<void>((resolve) => first.server.close(() => resolve())),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("follow disconnect timed out")), 250),
      ),
    ]);

    const shutdownStore = new HangingStore(readyPersistence, 1);
    const second = await startServer(shutdownStore);
    const active = await openStream(
      `${second.origin}/api/arenas/${manifest.arenaId}/events/stream`,
    );
    await waitUntil(() => shutdownStore.readCalls === 2);
    await Promise.race([
      new Promise<void>((resolve) => second.server.close(() => resolve())),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("follow shutdown timed out")), 250),
      ),
    ]);
    await active.ended;
  });

  it("does not accumulate abort listeners during long-lived polling", async () => {
    const OriginalAbortController = globalThis.AbortController;
    const captured: AbortController[] = [];
    class CapturingAbortController extends OriginalAbortController {
      constructor() {
        super();
        captured.push(this);
      }
    }
    globalThis.AbortController = CapturingAbortController;
    const store = new ControlledStore(readyPersistence);
    const { origin } = await startServer(store, { pollIntervalMs: 1 });
    const stream = await openStream(
      `${origin}/api/arenas/${manifest.arenaId}/events/stream`,
      { "last-event-id": "1" },
    );
    try {
      await waitUntil(() => store.readCalls >= 25);
      expect(captured).toHaveLength(1);
      expect(getEventListeners(captured[0]!.signal, "abort").length).toBeLessThanOrEqual(1);
    } finally {
      globalThis.AbortController = OriginalAbortController;
      stream.response.destroy();
      await stream.ended;
    }
  });

  it("stops one disconnected stream and resumes without duplicates", async () => {
    const store = new ControlledStore(readyPersistence);
    const { origin } = await startServer(store);
    const url = `${origin}/api/arenas/${manifest.arenaId}/events/stream`;
    const first = await openStream(url);

    await waitUntil(() => parseFrames(first.body()).length === 1);
    first.response.destroy();
    await first.ended;
    const readsAfterDisconnect = store.readCalls;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(store.readCalls).toBe(readsAfterDisconnect);

    store.replace(completedPersistence);
    const resumed = await requestToEnd(url, { "last-event-id": "1" });
    expect(parseFrames(resumed.body).map(({ id }) => Number(id))).toEqual(
      completedPersistence.events
        .slice(1)
        .map(({ sequence }) => sequence),
    );
  });
});
