import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  arenaManifestSchema,
  nonBlankStringSchema,
  utcDateTimeSchema,
  type ArenaManifest,
} from "../contracts/index.js";
import type { ArenaLifecycleRunner } from "../services/arena-lifecycle.js";
import {
  ArenaLifecycleStoreError,
  type ArenaLifecycleStore,
} from "../services/lifecycle-store.js";
import {
  publicApiErrorEnvelopeV1Schema,
  type PublicApiErrorCodeV1,
} from "./contracts.js";
import {
  projectArenaEventHistory,
  projectArenaState,
} from "./public-projection.js";
import {
  createInMemoryArenaHttpCapacityCoordinator,
  type ArenaHttpCapacityClaim,
  type ArenaHttpCapacityCoordinator,
} from "./arena-capacity.js";

const DEFAULT_BODY_LIMIT_BYTES = 64 * 1024;
const DEFAULT_SSE_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SSE_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_SSE_DRAIN_TIMEOUT_MS = 5_000;
const DEFAULT_SSE_MAX_EVENTS_PER_POLL = 64;

const configuredTeamSchema = z
  .object({
    name: nonBlankStringSchema,
    code: nonBlankStringSchema,
  })
  .strict();

const configuredSourceIdentityShape = {
  fixtureId: nonBlankStringSchema,
  homeTeam: configuredTeamSchema,
  awayTeam: configuredTeamSchema,
  kickoffUtc: utcDateTimeSchema,
} as const;

const configuredSourceSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("REPLAY"),
      arenaId: nonBlankStringSchema,
      ...configuredSourceIdentityShape,
    })
    .strict(),
  z
    .object({
      mode: z.literal("LIVE"),
      ...configuredSourceIdentityShape,
    })
    .strict(),
]);

const createArenaRequestSchema = z
  .object({ manifest: arenaManifestSchema })
  .strict();

export type ArenaHttpConfiguredSource = z.infer<
  typeof configuredSourceSchema
>;

export interface CreateArenaHttpServerConfig {
  readonly runner: ArenaLifecycleRunner;
  readonly store: ArenaLifecycleStore;
  /**
   * Must be derived by composition from the exact selected Replay recording
   * or Live fixture binding. User request data must never construct it.
   */
  readonly configuredSource: ArenaHttpConfiguredSource;
  readonly isReady: () => boolean;
  readonly bodyLimitBytes?: number;
  /** Share this composition seam and seed persisted occupancy on restart. */
  readonly capacityCoordinator?: ArenaHttpCapacityCoordinator;
  readonly sse?: Readonly<{
    pollIntervalMs?: number;
    heartbeatIntervalMs?: number;
    drainTimeoutMs?: number;
    maxEventsPerPoll?: number;
  }>;
}

const defaultCapacityByStore = new WeakMap<
  ArenaLifecycleStore,
  ArenaHttpCapacityCoordinator
>();

function capacityForStore(
  store: ArenaLifecycleStore,
): ArenaHttpCapacityCoordinator {
  const existing = defaultCapacityByStore.get(store);
  if (existing !== undefined) return existing;
  const created = createInMemoryArenaHttpCapacityCoordinator();
  defaultCapacityByStore.set(store, created);
  return created;
}

class HttpBoundaryError extends Error {
  readonly status: number;
  readonly code: PublicApiErrorCodeV1;
  readonly publicMessage: string;
  readonly allow: string | undefined;

  constructor(
    status: number,
    code: PublicApiErrorCodeV1,
    publicMessage: string,
    allow?: string,
  ) {
    super("Arena HTTP request failed");
    this.name = "HttpBoundaryError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.allow = allow;
  }
}

function invalidRequest(message = "The request is invalid"): HttpBoundaryError {
  return new HttpBoundaryError(400, "INVALID_REQUEST", message);
}

function notReady(): HttpBoundaryError {
  return new HttpBoundaryError(
    503,
    "NOT_READY",
    "The arena runtime is not ready",
  );
}

function arenaNotFound(): HttpBoundaryError {
  return new HttpBoundaryError(404, "ARENA_NOT_FOUND", "Arena was not found");
}

function methodNotAllowed(allow: string): HttpBoundaryError {
  return new HttpBoundaryError(
    405,
    "INVALID_REQUEST",
    "Method is not allowed",
    allow,
  );
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers?: Readonly<Record<string, string>>,
): void {
  const serialized = JSON.stringify(body);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(serialized)),
    ...headers,
  });
  response.end(serialized);
}

function writeError(response: ServerResponse, error: unknown): void {
  const boundary =
    error instanceof HttpBoundaryError
      ? error
      : error instanceof ArenaLifecycleStoreError &&
          error.code === "MANIFEST_CONFLICT"
        ? new HttpBoundaryError(
            409,
            "ARENA_CONFLICT",
            "Arena manifest conflicts with existing arena",
          )
        : new HttpBoundaryError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed",
          );
  const envelope = publicApiErrorEnvelopeV1Schema.parse({
    schemaVersion: 1,
    error: {
      code: boundary.code,
      message: boundary.publicMessage,
    },
  });
  writeJson(
    response,
    boundary.status,
    envelope,
    boundary.allow === undefined ? undefined : { allow: boundary.allow },
  );
}

class SseStreamAbortedError extends Error {
  constructor() {
    super("SSE stream aborted");
    this.name = "SseStreamAbortedError";
  }
}

function requireReady(isReady: () => boolean): void {
  let ready = false;
  try {
    ready = isReady();
  } catch {
    ready = false;
  }
  if (!ready) throw notReady();
}

function hasJsonContentType(request: IncomingMessage): boolean {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string") return false;
  return /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType);
}

async function readRequestBytes(
  request: IncomingMessage,
  bodyLimitBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  try {
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += bytes.byteLength;
      if (byteLength > bodyLimitBytes) {
        request.resume();
        throw new HttpBoundaryError(
          413,
          "REQUEST_TOO_LARGE",
          "Request body is too large",
        );
      }
      chunks.push(bytes);
    }
  } catch (error) {
    if (error instanceof HttpBoundaryError) throw error;
    throw invalidRequest();
  }
  return Buffer.concat(chunks, byteLength);
}

async function readJsonBody(
  request: IncomingMessage,
  bodyLimitBytes: number,
): Promise<unknown> {
  if (!hasJsonContentType(request)) {
    throw new HttpBoundaryError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
    );
  }
  const contentEncoding = request.headers["content-encoding"];
  if (contentEncoding !== undefined && contentEncoding !== "identity") {
    throw new HttpBoundaryError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content encoding is not supported",
    );
  }
  const bytes = await readRequestBytes(request, bodyLimitBytes);
  if (bytes.byteLength === 0) throw invalidRequest();
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw invalidRequest();
  }
}

async function requireEmptyBody(
  request: IncomingMessage,
  bodyLimitBytes: number,
): Promise<void> {
  const bytes = await readRequestBytes(request, bodyLimitBytes);
  if (bytes.byteLength !== 0) throw invalidRequest("Request body must be empty");
}

function sourceMatches(
  manifest: ArenaManifest,
  configuredSource: ArenaHttpConfiguredSource,
): boolean {
  return (
    manifest.mode === configuredSource.mode &&
    (configuredSource.mode !== "REPLAY" ||
      manifest.arenaId === configuredSource.arenaId) &&
    manifest.fixtureId === configuredSource.fixtureId &&
    manifest.kickoffUtc === configuredSource.kickoffUtc &&
    isDeepStrictEqual(manifest.homeTeam, configuredSource.homeTeam) &&
    isDeepStrictEqual(manifest.awayTeam, configuredSource.awayTeam)
  );
}

function parseArenaId(encodedArenaId: string): string {
  try {
    const arenaId = decodeURIComponent(encodedArenaId);
    if (arenaId === "" || arenaId.trim() !== arenaId) throw invalidRequest();
    return arenaId;
  } catch (error) {
    if (error instanceof HttpBoundaryError) throw error;
    throw invalidRequest();
  }
}

function parseEventCursor(url: URL): number {
  const keys = [...url.searchParams.keys()];
  if (
    keys.some((key) => key !== "after") ||
    url.searchParams.getAll("after").length > 1
  ) {
    throw new HttpBoundaryError(
      400,
      "INVALID_EVENT_CURSOR",
      "Event cursor is invalid",
    );
  }
  const raw = url.searchParams.get("after");
  if (raw === null) return 0;
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new HttpBoundaryError(
      400,
      "INVALID_EVENT_CURSOR",
      "Event cursor is invalid",
    );
  }
  const cursor = Number(raw);
  if (!Number.isSafeInteger(cursor)) {
    throw new HttpBoundaryError(
      400,
      "INVALID_EVENT_CURSOR",
      "Event cursor is invalid",
    );
  }
  return cursor;
}

function parseLastEventId(request: IncomingMessage): number {
  const raw = request.headers["last-event-id"];
  if (raw === undefined) return 0;
  if (typeof raw !== "string" || !/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new HttpBoundaryError(
      400,
      "INVALID_EVENT_CURSOR",
      "Event cursor is invalid",
    );
  }
  const cursor = Number(raw);
  if (!Number.isSafeInteger(cursor)) {
    throw new HttpBoundaryError(
      400,
      "INVALID_EVENT_CURSOR",
      "Event cursor is invalid",
    );
  }
  return cursor;
}

function requireNoQuery(url: URL): void {
  if (url.search !== "") throw invalidRequest();
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function waitForPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      if (timer !== undefined) clearTimeout(timer);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onAbort = () => finish();
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      finish();
      return;
    }
    try {
      timer = setTimeout(finish, delayMs);
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

function runAbortably<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) return Promise.reject(new SseStreamAbortedError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const settle = (
      outcome: "RESOLVE" | "REJECT",
      value: T | unknown,
    ) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome === "RESOLVE") resolve(value as T);
      else reject(value);
    };
    const onAbort = () => settle("REJECT", new SseStreamAbortedError());
    signal.addEventListener("abort", onAbort, { once: true });
    let pending: Promise<T>;
    try {
      pending = operation();
    } catch (error) {
      settle("REJECT", error);
      return;
    }
    void pending.then(
      (value) => settle("RESOLVE", value),
      (error: unknown) => settle("REJECT", error),
    );
  });
}

function waitForDrain(
  response: ServerResponse,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = () => {
      response.off("drain", onDrain);
      signal.removeEventListener("abort", onAbort);
      if (timer !== undefined) clearTimeout(timer);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("SSE stream aborted"));
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("SSE drain timed out"));
    };
    response.once("drain", onDrain);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      timer = setTimeout(onTimeout, timeoutMs);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function writeSseChunk(
  response: ServerResponse,
  chunk: string,
  signal: AbortSignal,
  drainTimeoutMs: number,
): Promise<void> {
  if (signal.aborted || response.destroyed || response.writableEnded) {
    throw new Error("SSE stream is closed");
  }
  if (!response.write(chunk)) {
    await waitForDrain(response, signal, drainTimeoutMs);
  }
}

export function createArenaHttpServer(
  input: CreateArenaHttpServerConfig,
): Server {
  const configuredSourceResult = configuredSourceSchema.safeParse(
    input?.configuredSource,
  );
  const bodyLimitBytes = input?.bodyLimitBytes ?? DEFAULT_BODY_LIMIT_BYTES;
  const ssePollIntervalMs =
    input?.sse?.pollIntervalMs ?? DEFAULT_SSE_POLL_INTERVAL_MS;
  const sseHeartbeatIntervalMs =
    input?.sse?.heartbeatIntervalMs ?? DEFAULT_SSE_HEARTBEAT_INTERVAL_MS;
  const sseDrainTimeoutMs =
    input?.sse?.drainTimeoutMs ?? DEFAULT_SSE_DRAIN_TIMEOUT_MS;
  const sseMaxEventsPerPoll =
    input?.sse?.maxEventsPerPoll ?? DEFAULT_SSE_MAX_EVENTS_PER_POLL;
  if (
    configuredSourceResult.success === false ||
    typeof input?.runner?.create !== "function" ||
    typeof input.runner.run !== "function" ||
    typeof input?.store?.read !== "function" ||
    typeof input?.isReady !== "function" ||
    (input.capacityCoordinator !== undefined &&
      (typeof input.capacityCoordinator.claim !== "function" ||
        typeof input.capacityCoordinator.settle !== "function")) ||
    !Number.isSafeInteger(bodyLimitBytes) ||
    bodyLimitBytes < 1 ||
    !positiveSafeInteger(ssePollIntervalMs) ||
    !positiveSafeInteger(sseHeartbeatIntervalMs) ||
    !positiveSafeInteger(sseDrainTimeoutMs) ||
    !positiveSafeInteger(sseMaxEventsPerPoll)
  ) {
    throw new TypeError("Invalid Arena HTTP server configuration");
  }
  const configuredSource = configuredSourceResult.data;
  const capacity = input.capacityCoordinator ?? capacityForStore(input.store);
  const activeRuns = new Map<
    string,
    Readonly<{ controller: AbortController; promise: Promise<void> }>
  >();
  const activeStreams = new Map<AbortController, ServerResponse>();

  async function createArena(request: IncomingMessage, response: ServerResponse) {
    requireReady(input.isReady);
    const parsed = createArenaRequestSchema.safeParse(
      await readJsonBody(request, bodyLimitBytes),
    );
    if (!parsed.success) throw invalidRequest();
    const requestedManifest = parsed.data.manifest;

    for (;;) {
      const capacityResult = capacity.claim(requestedManifest.arenaId);
      if (capacityResult.status === "CAPACITY_REACHED") {
        throw new HttpBoundaryError(
          409,
          "ARENA_CAPACITY_REACHED",
          "This runtime already contains an arena",
        );
      }
      if (!sourceMatches(requestedManifest, configuredSource)) {
        if (capacityResult.status === "ACQUIRED") {
          capacity.settle(capacityResult.claim, "NOT_APPLIED");
        }
        throw new HttpBoundaryError(
          422,
          "MODE_NOT_CONFIGURED",
          "Arena mode or fixture binding is not configured",
        );
      }
      if (capacityResult.status === "CURRENT") {
        if (capacityResult.waitForChange !== undefined) {
          await capacityResult.waitForChange;
          continue;
        }
        let existing;
        try {
          existing = await input.store.read(requestedManifest.arenaId, 0);
        } catch {
          throw new HttpBoundaryError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed",
          );
        }
        if (existing === "NOT_FOUND") {
          throw new HttpBoundaryError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed",
          );
        }
        if (!isDeepStrictEqual(existing.state.manifest, requestedManifest)) {
          throw new HttpBoundaryError(
            409,
            "ARENA_CONFLICT",
            "Arena manifest conflicts with existing arena",
          );
        }
        writeJson(response, 200, {
          schemaVersion: 1,
          status: "EXISTING",
          arena: projectArenaState(existing.state),
        });
        return;
      }
      await createClaimedArena(
        response,
        requestedManifest,
        capacityResult.claim,
      );
      return;
    }
  }

  async function createClaimedArena(
    response: ServerResponse,
    requestedManifest: ArenaManifest,
    claim: ArenaHttpCapacityClaim,
  ): Promise<void> {
    let existing;
    try {
      existing = await input.store.read(requestedManifest.arenaId, 0);
    } catch {
      capacity.settle(claim, "APPLIED");
      throw new HttpBoundaryError(
        500,
        "INTERNAL_ERROR",
        "The request could not be completed",
      );
    }
    if (existing !== "NOT_FOUND") {
      capacity.settle(claim, "APPLIED");
      if (!isDeepStrictEqual(existing.state.manifest, requestedManifest)) {
        throw new HttpBoundaryError(
          409,
          "ARENA_CONFLICT",
          "Arena manifest conflicts with existing arena",
        );
      }
      writeJson(response, 200, {
        schemaVersion: 1,
        status: "EXISTING",
        arena: projectArenaState(existing.state),
      });
      return;
    }

    let state;
    try {
      state = await input.runner.create(requestedManifest);
    } catch (createError) {
      let reloaded;
      try {
        reloaded = await input.store.read(requestedManifest.arenaId, 0);
      } catch {
        capacity.settle(claim, "APPLIED");
        throw new HttpBoundaryError(
          500,
          "INTERNAL_ERROR",
          "The request could not be completed",
        );
      }
      if (reloaded === "NOT_FOUND") {
        capacity.settle(claim, "NOT_APPLIED");
        throw createError;
      }
      capacity.settle(claim, "APPLIED");
      if (!isDeepStrictEqual(reloaded.state.manifest, requestedManifest)) {
        throw new HttpBoundaryError(
          409,
          "ARENA_CONFLICT",
          "Arena manifest conflicts with existing arena",
        );
      }
      writeJson(response, 200, {
        schemaVersion: 1,
        status: "EXISTING",
        arena: projectArenaState(reloaded.state),
      });
      return;
    }

    capacity.settle(claim, "APPLIED");
    if (!isDeepStrictEqual(state.manifest, requestedManifest)) {
      throw new HttpBoundaryError(
        409,
        "ARENA_CONFLICT",
        "Arena manifest conflicts with existing arena",
      );
    }
    writeJson(response, 201, {
      schemaVersion: 1,
      status: "CREATED",
      arena: projectArenaState(state),
    });
  }

  async function runArena(
    request: IncomingMessage,
    response: ServerResponse,
    arenaId: string,
  ) {
    requireReady(input.isReady);
    await requireEmptyBody(request, bodyLimitBytes);
    const persisted = await input.store.read(arenaId, 0);
    if (persisted === "NOT_FOUND") throw arenaNotFound();
    if (persisted.state.phase === "COMPLETED") {
      writeJson(response, 200, {
        schemaVersion: 1,
        arenaId,
        status: "ALREADY_COMPLETED",
      });
      return;
    }
    if (activeRuns.has(arenaId)) {
      writeJson(response, 202, {
        schemaVersion: 1,
        arenaId,
        status: "ALREADY_RUNNING",
      });
      return;
    }

    const controller = new AbortController();
    const lifecyclePromise = Promise.resolve().then(() =>
      input.runner.run(arenaId, controller.signal),
    );
    const tracked = lifecyclePromise.then(
      () => undefined,
      () => undefined,
    );
    activeRuns.set(arenaId, { controller, promise: tracked });
    void tracked.finally(() => {
      if (activeRuns.get(arenaId)?.promise === tracked) {
        activeRuns.delete(arenaId);
      }
    });
    writeJson(response, 202, {
      schemaVersion: 1,
      arenaId,
      status: "STARTED",
    });
  }

  async function readArena(response: ServerResponse, arenaId: string) {
    const persisted = await input.store.read(arenaId, 0);
    if (persisted === "NOT_FOUND") throw arenaNotFound();
    writeJson(response, 200, projectArenaState(persisted.state));
  }

  async function readEvents(
    response: ServerResponse,
    arenaId: string,
    cursor: number,
  ) {
    const persisted = await input.store.read(arenaId, 0);
    if (persisted === "NOT_FOUND") throw arenaNotFound();
    if (cursor > persisted.state.lastEventSequence) {
      throw new HttpBoundaryError(
        409,
        "EVENT_CURSOR_AHEAD",
        "Event cursor is ahead of arena history",
      );
    }
    const events = persisted.events.filter((event) => event.sequence > cursor);
    writeJson(
      response,
      200,
      projectArenaEventHistory(persisted.state, events, cursor),
    );
  }

  async function streamEvents(
    request: IncomingMessage,
    response: ServerResponse,
    arenaId: string,
  ): Promise<void> {
    const cursor = parseLastEventId(request);
    const streamController = new AbortController();
    activeStreams.set(streamController, response);
    const abortStream = () => streamController.abort();
    request.once("aborted", abortStream);
    response.once("close", abortStream);
    let nextCursor = cursor;
    let lastWriteAtMs = Date.now();
    try {
      const persisted = await runAbortably(
        () => input.store.read(arenaId, 0),
        streamController.signal,
      );
      if (persisted === "NOT_FOUND") throw arenaNotFound();
      if (cursor > persisted.state.lastEventSequence) {
        throw new HttpBoundaryError(
          409,
          "EVENT_CURSOR_AHEAD",
          "Event cursor is ahead of arena history",
        );
      }
      if (
        persisted.state.phase === "COMPLETED" &&
        cursor === persisted.state.lastEventSequence
      ) {
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
        return;
      }
      const initialEvents = persisted.events.filter(
        (event) => event.sequence > cursor,
      );
      const projected = projectArenaEventHistory(
        persisted.state,
        initialEvents.slice(0, sseMaxEventsPerPoll),
        cursor,
      );
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/event-stream; charset=utf-8",
        connection: "keep-alive",
      });
      response.flushHeaders();
      let observedLastEventSequence = persisted.state.lastEventSequence;
      let observedPhase = persisted.state.phase;
      let nextEvents = projected.events;
      for (;;) {
        for (const event of nextEvents) {
          await writeSseChunk(
            response,
            `id: ${event.sequence}\nevent: arena-event\ndata: ${JSON.stringify(event)}\n\n`,
            streamController.signal,
            sseDrainTimeoutMs,
          );
          nextCursor = event.sequence;
          lastWriteAtMs = Date.now();
          if (event.type === "COMPLETED") return;
        }
        if (streamController.signal.aborted) return;
        if (nextCursor >= observedLastEventSequence) {
          if (Date.now() - lastWriteAtMs >= sseHeartbeatIntervalMs) {
            await writeSseChunk(
              response,
              ": heartbeat\n\n",
              streamController.signal,
              sseDrainTimeoutMs,
            );
            lastWriteAtMs = Date.now();
          }
          await waitForPoll(ssePollIntervalMs, streamController.signal);
          if (streamController.signal.aborted) return;
        }
        const next = await runAbortably(
          () => input.store.read(arenaId, nextCursor),
          streamController.signal,
        );
        if (next === "NOT_FOUND") throw arenaNotFound();
        observedLastEventSequence = next.state.lastEventSequence;
        observedPhase = next.state.phase;
        const nextBatch = next.events.slice(0, sseMaxEventsPerPoll);
        if (
          nextBatch.length === 0 &&
          nextCursor < observedLastEventSequence
        ) {
          throw new HttpBoundaryError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed",
          );
        }
        nextEvents = projectArenaEventHistory(
          next.state,
          nextBatch,
          nextCursor,
        ).events;
        if (
          nextEvents.length === 0 &&
          observedPhase === "COMPLETED" &&
          nextCursor === observedLastEventSequence
        ) {
          return;
        }
      }
    } catch (error) {
      if (
        streamController.signal.aborted ||
        error instanceof SseStreamAbortedError
      ) {
        return;
      }
      if (response.headersSent) response.destroy();
      else throw error;
    } finally {
      request.off("aborted", abortStream);
      response.off("close", abortStream);
      activeStreams.delete(streamController);
      if (
        response.headersSent &&
        !response.destroyed &&
        !response.writableEnded
      ) {
        response.end();
      }
    }
  }

  const server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? "/", "http://arena.local");
        const method = request.method ?? "";

        if (url.pathname === "/health") {
          if (method !== "GET") throw methodNotAllowed("GET");
          requireNoQuery(url);
          writeJson(response, 200, { schemaVersion: 1, status: "UP" });
          return;
        }
        if (url.pathname === "/ready") {
          if (method !== "GET") throw methodNotAllowed("GET");
          requireNoQuery(url);
          requireReady(input.isReady);
          writeJson(response, 200, {
            schemaVersion: 1,
            status: "READY",
            configuredMode: configuredSource.mode,
          });
          return;
        }
        if (url.pathname === "/api/arenas") {
          if (method !== "POST") throw methodNotAllowed("POST");
          requireNoQuery(url);
          await createArena(request, response);
          return;
        }

        const streamMatch =
          /^\/api\/arenas\/([^/]+)\/events\/stream$/u.exec(url.pathname);
        if (streamMatch !== null) {
          if (method !== "GET") throw methodNotAllowed("GET");
          requireNoQuery(url);
          const encodedStreamArenaId = streamMatch[1];
          if (encodedStreamArenaId === undefined) throw invalidRequest();
          await streamEvents(
            request,
            response,
            parseArenaId(encodedStreamArenaId),
          );
          return;
        }

        const match = /^\/api\/arenas\/([^/]+)(?:\/(run|events))?$/u.exec(
          url.pathname,
        );
        if (match === null) {
          throw new HttpBoundaryError(404, "INVALID_REQUEST", "Route was not found");
        }
        const encodedArenaId = match[1];
        if (encodedArenaId === undefined) throw invalidRequest();
        const arenaId = parseArenaId(encodedArenaId);
        const action = match[2];
        if (action === "run") {
          if (method !== "POST") throw methodNotAllowed("POST");
          requireNoQuery(url);
          await runArena(request, response, arenaId);
          return;
        }
        if (action === "events") {
          if (method !== "GET") throw methodNotAllowed("GET");
          await readEvents(response, arenaId, parseEventCursor(url));
          return;
        }
        if (method !== "GET") throw methodNotAllowed("GET");
        requireNoQuery(url);
        await readArena(response, arenaId);
      } catch (error) {
        if (!response.headersSent && !response.destroyed) {
          writeError(response, error);
        }
      }
    })();
  });

  server.on("close", () => {
    for (const active of activeRuns.values()) active.controller.abort();
    activeRuns.clear();
    activeStreams.clear();
  });

  const closeServer = server.close.bind(server);
  server.close = ((callback?: (error?: Error) => void) => {
    for (const [controller, response] of activeStreams) {
      controller.abort();
      if (!response.destroyed && !response.writableEnded) response.end();
    }
    return closeServer(callback);
  }) as Server["close"];

  return server;
}
