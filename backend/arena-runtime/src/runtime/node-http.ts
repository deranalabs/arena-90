import { readFile as readNodeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import { z } from "zod";

import type {
  AgentAdapter,
  AgentInvocationRequest,
} from "../adapters/agents/fake.js";
import { createZeroClawAgentAdapter } from "../adapters/agents/zeroclaw.js";
import { createRecordedDataAdapter } from "../adapters/data/recorded.js";
import {
  TxlineDataError,
  createTxlineProviderClientFromEnv,
  resolveTxlineCredentialEnvironment,
  type TxlineProviderClient,
} from "../adapters/data/txline/index.js";
import {
  createInMemoryArenaHttpCapacityCoordinator,
  createArenaHttpServer,
  type ArenaHttpCapacityCoordinator,
} from "../api/index.js";
import {
  arenaManifestSchema,
  type ArenaAgentId,
  type ArenaManifest,
} from "../contracts/index.js";
import type { ArenaLifecycleRunner } from "../services/arena-lifecycle.js";
import { createJsonArenaLifecycleStore } from "../services/json-lifecycle-store.js";
import type { ArenaLifecycleStore } from "../services/lifecycle-store.js";
import {
  createSupporterResolverSupervisor,
  type SupporterChainResolver,
} from "../services/supporter-resolver.js";
import { createNodeArenaLifecycleComposition } from "./node-lifecycle.js";

export type NodeHttpRuntimeMode = "REPLAY" | "LIVE";

export type NodeHttpRuntimeFailureCategory =
  | "CONFIG_FAILURE"
  | "MANIFEST_FAILURE"
  | "RECORDING_FAILURE"
  | "FIXTURE_BINDING_FAILURE"
  | "LISTEN_FAILURE"
  | "SHUTDOWN_FAILURE"
  | "RUNTIME_FAILURE";

export class NodeHttpRuntimeError extends Error {
  readonly category: NodeHttpRuntimeFailureCategory;

  constructor(category: NodeHttpRuntimeFailureCategory) {
    super("Arena HTTP runtime failed");
    this.name = "NodeHttpRuntimeError";
    this.category = category;
  }
}

type Environment = Readonly<Record<string, string | undefined>>;
type TextFileReader = (path: string) => Promise<string>;

const MANAGED_RUN_RETRY_INTERVAL_MS = 5_000;

function isRetryableManagedRunFailure(error: unknown): boolean {
  return (
    error instanceof TxlineDataError &&
    (error.code === "PROVIDER_TIMEOUT" ||
      error.code === "PROVIDER_NETWORK_FAILURE")
  );
}

export interface CreateNodeHttpRuntimeCompositionOptions {
  readonly env?: Environment;
  readonly readFile?: TextFileReader;
  readonly agents?: Readonly<Record<ArenaAgentId, AgentAdapter>>;
  readonly store?: ArenaLifecycleStore;
  readonly txlineClientFactory?: (env: Environment) => TxlineProviderClient;
  readonly nowMs?: () => number;
  readonly observeAgentInvocation?: (
    observation: Readonly<{
      agentId: ArenaAgentId;
      checkpointId: AgentInvocationRequest["snapshot"]["checkpointId"];
      attempt: AgentInvocationRequest["attempt"];
    }>,
  ) => void;
  readonly supporterResolver?: SupporterChainResolver;
}

export interface NodeHttpRuntimeComposition {
  readonly mode: NodeHttpRuntimeMode;
  readonly manifest: ArenaManifest;
  readonly runner: ArenaLifecycleRunner;
  readonly store: ArenaLifecycleStore;
  readonly capacityCoordinator: ArenaHttpCapacityCoordinator;
  readonly server: ReturnType<typeof createArenaHttpServer>;
  readonly persistence: "ATOMIC_JSON_V1" | "INJECTED";
  isReady(): boolean;
  listen(options?: Readonly<{ host?: string; port?: number }>): Promise<{
    host: string;
    port: number;
  }>;
  shutdown(): Promise<void>;
}

const replayIdentitySchema = z
  .object({
    provider: z.literal("TXLINE_RECORDED"),
    arenaId: z.string().trim().min(1),
    fixtureId: z.string().trim().min(1),
    records: z
      .array(
        z
          .object({
            checkpointId: z.string(),
            observedAtUtc: z.iso.datetime({ offset: true }),
          })
          .passthrough(),
      )
      .nonempty(),
  })
  .passthrough();

const liveFixtureBindingSchema = z
  .object({
    fixtureId: z.number().int().positive().safe(),
    participant1Id: z.number().int().positive().safe(),
    participant2Id: z.number().int().positive().safe(),
    participant1IsHome: z.boolean(),
    startTime: z.number().int().nonnegative().safe(),
  })
  .strict();

function requiredEnvironmentValue(env: Environment, name: string): string {
  const value = env[name];
  if (value === undefined || value === "" || value.trim() !== value) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  return value;
}

function positiveEnvironmentInteger(
  env: Environment,
  name: string,
  fallback?: number,
): number {
  const value = env[name];
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  return parsed;
}

async function readJson(
  readFile: TextFileReader,
  path: string,
  category: NodeHttpRuntimeFailureCategory,
): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path)) as unknown;
  } catch {
    throw new NodeHttpRuntimeError(category);
  }
}

function resolveMode(env: Environment): NodeHttpRuntimeMode {
  const mode = env["ARENA90_RUNTIME_MODE"];
  if (mode !== "REPLAY" && mode !== "LIVE") {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  return mode;
}

function resolveAgents(
  options: CreateNodeHttpRuntimeCompositionOptions,
  env: Environment,
): Readonly<Record<ArenaAgentId, AgentAdapter>> {
  if (options.agents !== undefined) {
    if (
      options.agents.alpha.agentId !== "alpha" ||
      options.agents.beta.agentId !== "beta" ||
      typeof options.agents.alpha.invoke !== "function" ||
      typeof options.agents.beta.invoke !== "function"
    ) {
      throw new NodeHttpRuntimeError("CONFIG_FAILURE");
    }
    return options.agents;
  }
  const configDir = requiredEnvironmentValue(env, "ZEROCLAW_CONFIG_DIR");
  const binaryPath = env["ZEROCLAW_BIN"] ?? "zeroclaw";
  if (binaryPath === "" || binaryPath.trim() !== binaryPath) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  return Object.freeze({
    alpha: createZeroClawAgentAdapter({
      agentId: "alpha",
      binaryPath,
      configDir,
    }),
    beta: createZeroClawAgentAdapter({
      agentId: "beta",
      binaryPath,
      configDir,
    }),
  });
}

function abortableWait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const finish = () => {
      signal.removeEventListener("abort", finish);
      if (timer !== undefined) clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", finish, { once: true });
    timer = setTimeout(finish, delayMs);
  });
}

function parseListenPort(env: Environment): number {
  const port = positiveEnvironmentInteger(env, "ARENA90_HTTP_PORT", 3000);
  if (port > 65_535) throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  return port;
}

function resolveAutostart(env: Environment, mode: NodeHttpRuntimeMode): boolean {
  const configured = env["ARENA90_AUTOSTART"];
  if (configured === undefined) return mode === "LIVE";
  if (configured !== "true" && configured !== "false") {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  if (mode === "LIVE" && configured !== "true") {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  return configured === "true";
}

export async function createNodeHttpRuntimeComposition(
  options: CreateNodeHttpRuntimeCompositionOptions = {},
): Promise<NodeHttpRuntimeComposition> {
  if (typeof options !== "object" || options === null) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  const env = options.env ?? process.env;
  const readFile =
    options.readFile ?? ((path: string) => readNodeFile(path, "utf8"));
  const mode = resolveMode(env);
  const autostart = resolveAutostart(env, mode);
  const manifestInput = await readJson(
    readFile,
    requiredEnvironmentValue(env, "ARENA90_MANIFEST_FILE"),
    "MANIFEST_FAILURE",
  );
  const manifestResult = arenaManifestSchema.safeParse(manifestInput);
  if (!manifestResult.success || manifestResult.data.mode !== mode) {
    throw new NodeHttpRuntimeError("MANIFEST_FAILURE");
  }
  const manifest = manifestResult.data;
  const agentTimeoutMs = positiveEnvironmentInteger(
    env,
    "ARENA90_AGENT_TIMEOUT_MS",
  );
  const resolvedAgents = resolveAgents(options, env);
  const agents = Object.fromEntries(
    (["alpha", "beta"] as const).map((agentId) => {
      const adapter = resolvedAgents[agentId];
      const observedAdapter: AgentAdapter = {
        agentId,
        invoke(request) {
          try {
            options.observeAgentInvocation?.(
              Object.freeze({
                agentId,
                checkpointId: request.snapshot.checkpointId,
                attempt: request.attempt,
              }),
            );
          } catch {
            // Smoke observability must never alter lifecycle execution.
          }
          return adapter.invoke(request);
        },
      };
      return [agentId, observedAdapter];
    }),
  ) as Record<ArenaAgentId, AgentAdapter>;
  const nowMs = options.nowMs ?? Date.now;
  const lifecycleStore =
    options.store ??
    createJsonArenaLifecycleStore({
      directory: requiredEnvironmentValue(env, "ARENA90_PERSISTENCE_DIR"),
      nowMs,
    });

  let recordedFixture: unknown;
  let live:
    | Readonly<{
        fixtureBinding: z.infer<typeof liveFixtureBindingSchema>;
        delayed: boolean;
        client: TxlineProviderClient;
      }>
    | undefined;
  if (mode === "REPLAY") {
    recordedFixture = await readJson(
      readFile,
      requiredEnvironmentValue(env, "ARENA90_REPLAY_RECORDING_FILE"),
      "RECORDING_FAILURE",
    );
    let identity: z.infer<typeof replayIdentitySchema>;
    try {
      createRecordedDataAdapter(recordedFixture);
      identity = replayIdentitySchema.parse(recordedFixture);
    } catch {
      throw new NodeHttpRuntimeError("RECORDING_FAILURE");
    }
    if (
      manifest.arenaId !== identity.arenaId ||
      manifest.fixtureId !== identity.fixtureId ||
      identity.records[0]?.checkpointId !== "KICKOFF" ||
      manifest.kickoffUtc !== identity.records[0].observedAtUtc
    ) {
      throw new NodeHttpRuntimeError("RECORDING_FAILURE");
    }
  } else {
    let providerEnv: Environment;
    try {
      providerEnv = await resolveTxlineCredentialEnvironment(env, readFile);
    } catch {
      throw new NodeHttpRuntimeError("CONFIG_FAILURE");
    }
    const bindingInput = await readJson(
      readFile,
      requiredEnvironmentValue(env, "ARENA90_LIVE_FIXTURE_BINDING_FILE"),
      "FIXTURE_BINDING_FAILURE",
    );
    const bindingResult = liveFixtureBindingSchema.safeParse(bindingInput);
    if (!bindingResult.success) {
      throw new NodeHttpRuntimeError("FIXTURE_BINDING_FAILURE");
    }
    const delayedValue = requiredEnvironmentValue(env, "ARENA90_LIVE_DELAYED");
    if (delayedValue !== "true" && delayedValue !== "false") {
      throw new NodeHttpRuntimeError("CONFIG_FAILURE");
    }
    for (const name of [
      "TXLINE_BASE_URL",
      "TXLINE_JWT",
      "TXLINE_API_TOKEN",
      "TXLINE_TIMEOUT_MS",
      "TXLINE_MAX_RESPONSE_BYTES",
      "TXLINE_MAX_SSE_EVENTS",
    ] as const) {
      requiredEnvironmentValue(providerEnv, name);
    }
    positiveEnvironmentInteger(providerEnv, "TXLINE_TIMEOUT_MS");
    positiveEnvironmentInteger(providerEnv, "TXLINE_MAX_RESPONSE_BYTES");
    positiveEnvironmentInteger(providerEnv, "TXLINE_MAX_SSE_EVENTS");
    let boundKickoffUtc: string;
    try {
      boundKickoffUtc = new Date(bindingResult.data.startTime).toISOString();
    } catch {
      throw new NodeHttpRuntimeError("FIXTURE_BINDING_FAILURE");
    }
    if (
      manifest.fixtureId !== String(bindingResult.data.fixtureId) ||
      manifest.kickoffUtc !== boundKickoffUtc
    ) {
      throw new NodeHttpRuntimeError("FIXTURE_BINDING_FAILURE");
    }
    let client: TxlineProviderClient;
    try {
      const configuredClient = createTxlineProviderClientFromEnv({ env: providerEnv });
      client = options.txlineClientFactory?.(providerEnv) ?? configuredClient;
    } catch {
      throw new NodeHttpRuntimeError("CONFIG_FAILURE");
    }
    live = Object.freeze({
      fixtureBinding: bindingResult.data,
      delayed: delayedValue === "true",
      client,
    });
  }

  const lifecycle = createNodeArenaLifecycleComposition({
    ...(recordedFixture === undefined ? {} : { recordedFixture }),
    ...(live === undefined ? {} : { live }),
    store: lifecycleStore,
    agents,
    runtimeMetadata: {
      runtimeId: "arena90-node-http-runtime",
      runtimeVersion: "7.5",
      executionRuleVersion: "p0-v1",
      winnerRuleVersion: "FINAL_NAV_ONLY_V1",
      agentTimeoutMs,
      agents: {
        alpha: {
          adapterId: options.agents === undefined ? "zeroclaw" : "injected",
          adapterVersion: "1",
          strategyId: "alpha-overreaction-hunter",
          strategyVersion: "3",
        },
        beta: {
          adapterId: options.agents === undefined ? "zeroclaw" : "injected",
          adapterVersion: "1",
          strategyId: "beta-underreaction-hunter",
          strategyVersion: "3",
        },
      },
    },
    timing: {
      nowMs,
      wait: abortableWait,
      waitForCheckpoint: async () => undefined,
    },
    lease: {
      ownerId: "arena90-node-http-runtime",
      ttlMs: 30_000,
      renewEveryMs: 10_000,
    },
  });
  const capacityCoordinator = createInMemoryArenaHttpCapacityCoordinator();
  const supporterSupervisor =
    options.supporterResolver === undefined
      ? undefined
      : createSupporterResolverSupervisor(options.supporterResolver);
  let ready = true;
  const configuredSource =
    mode === "REPLAY"
      ? {
          mode,
          arenaId: manifest.arenaId,
          fixtureId: manifest.fixtureId,
          homeTeam: manifest.homeTeam,
          awayTeam: manifest.awayTeam,
          kickoffUtc: manifest.kickoffUtc,
        }
      : {
          mode,
          fixtureId: manifest.fixtureId,
          homeTeam: manifest.homeTeam,
          awayTeam: manifest.awayTeam,
          kickoffUtc: manifest.kickoffUtc,
        };
  const server = createArenaHttpServer({
    runner: lifecycle.runner,
    store: lifecycle.store,
    capacityCoordinator,
    configuredSource,
    operatorMutationsEnabled: !autostart,
    isReady: () => ready,
  });
  const defaultHost = env["ARENA90_HTTP_HOST"] ?? "127.0.0.1";
  if (defaultHost === "" || defaultHost.trim() !== defaultHost) {
    throw new NodeHttpRuntimeError("CONFIG_FAILURE");
  }
  const defaultPort = parseListenPort(env);
  let shutdownPromise: Promise<void> | undefined;
  let managedRun:
    | Readonly<{ controller: AbortController; promise: Promise<void> }>
    | undefined;

  async function startManagedRun(): Promise<void> {
    const controller = new AbortController();
    await supporterSupervisor?.prepare(manifest, controller.signal);
    await lifecycle.runner.create(manifest);
    ready = true;
    const promise = (async () => {
      while (!controller.signal.aborted) {
        try {
          const state = await lifecycle.runner.run(
            manifest.arenaId,
            controller.signal,
          );
          if (state.phase === "COMPLETED" && state.finalResult !== undefined) {
            await supporterSupervisor?.settle(
              state.manifest,
              state.finalResult,
              controller.signal,
            );
          }
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!isRetryableManagedRunFailure(error)) {
            ready = false;
            return;
          }
          // Always-on supervision keeps retry count open, while each provider
          // operation and the delay between attempts remain bounded.
          await abortableWait(MANAGED_RUN_RETRY_INTERVAL_MS, controller.signal);
        }
      }
    })();
    managedRun = Object.freeze({ controller, promise });
  }

  const composition: NodeHttpRuntimeComposition = {
    mode,
    manifest,
    runner: lifecycle.runner,
    store: lifecycle.store,
    capacityCoordinator,
    server,
    persistence: options.store === undefined ? "ATOMIC_JSON_V1" : "INJECTED",
    isReady: () => ready,
    async listen(listenOptions = {}) {
      const host = listenOptions.host ?? defaultHost;
      const port = listenOptions.port ?? defaultPort;
      if (
        host === "" ||
        host.trim() !== host ||
        !Number.isSafeInteger(port) ||
        port < 0 ||
        port > 65_535 ||
        !ready ||
        server.listening
      ) {
        throw new NodeHttpRuntimeError("LISTEN_FAILURE");
      }
      if (autostart) ready = false;
      await new Promise<void>((resolve, reject) => {
        const onError = () => {
          server.off("listening", onListening);
          reject(new NodeHttpRuntimeError("LISTEN_FAILURE"));
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      const address = server.address() as AddressInfo | null;
      if (address === null) throw new NodeHttpRuntimeError("LISTEN_FAILURE");
      if (autostart) {
        try {
          await startManagedRun();
        } catch {
          ready = false;
          await new Promise<void>((resolve) => server.close(() => resolve()));
          throw new NodeHttpRuntimeError("RUNTIME_FAILURE");
        }
      }
      return Object.freeze({ host, port: address.port });
    },
    shutdown() {
      if (shutdownPromise !== undefined) return shutdownPromise;
      ready = false;
      managedRun?.controller.abort();
      const closeServer = server.listening
        ? new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error === undefined) resolve();
              else reject(new NodeHttpRuntimeError("SHUTDOWN_FAILURE"));
            });
          })
        : Promise.resolve();
      shutdownPromise = Promise.all([
        closeServer,
        managedRun?.promise ?? Promise.resolve(),
      ]).then(() => undefined);
      return shutdownPromise;
    },
  };
  return Object.freeze(composition);
}

export function classifyNodeHttpRuntimeFailure(
  error: unknown,
): NodeHttpRuntimeFailureCategory {
  return error instanceof NodeHttpRuntimeError
    ? error.category
    : "RUNTIME_FAILURE";
}

export function formatNodeHttpRuntimeFailure(
  category: NodeHttpRuntimeFailureCategory,
): string {
  return `Arena HTTP server failed: ${category}.`;
}
