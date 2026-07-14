import type {
  AgentAdapter,
  AgentInvocationRequest,
} from "../adapters/agents/fake.js";
import {
  createZeroClawAgentAdapter,
  type ZeroClawAgentAdapterConfig,
} from "../adapters/agents/zeroclaw.js";
import {
  DECISION_CHECKPOINT_IDS,
  arenaFinalResultV1Schema,
  type ArenaAgentId,
} from "../contracts/index.js";
import type { ArenaLifecycleStore } from "../services/lifecycle-store.js";
import { createNodeArenaLifecycleComposition } from "./node-lifecycle.js";

export type LifecycleReplaySmokeStatus =
  | "PASSED"
  | "CONFIG_FAILURE"
  | "FIXTURE_FAILURE"
  | "TIMEOUT"
  | "LIFECYCLE_FAILURE"
  | "VERIFICATION_FAILURE";

export interface LifecycleReplaySmokeResult {
  readonly status: LifecycleReplaySmokeStatus;
}

export interface RunLifecycleReplaySmokeOptions {
  readonly readFixture: () => Promise<string>;
  readonly agents?: Readonly<Partial<Record<ArenaAgentId, AgentAdapter>>>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly agentTimeoutMs?: number;
  readonly overallTimeoutMs?: number;
  readonly store?: ArenaLifecycleStore;
  readonly zeroClawAgentFactory?: (
    config: ZeroClawAgentAdapterConfig,
  ) => AgentAdapter;
}

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
  checkpoints: [
    "KICKOFF",
    "M15",
    "M30",
    "HALFTIME",
    "M60",
    "M75",
    "FINAL",
  ],
  createdAtUtc: "2026-07-13T10:00:00.000Z",
} as const;

function result(status: LifecycleReplaySmokeStatus): LifecycleReplaySmokeResult {
  return Object.freeze({ status });
}

function positiveInteger(
  explicit: number | undefined,
  environmentValue: string | undefined,
  fallback: number,
): number | undefined {
  if (explicit !== undefined) {
    return Number.isSafeInteger(explicit) && explicit > 0 ? explicit : undefined;
  }
  if (environmentValue === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(environmentValue)) return undefined;
  const parsed = Number(environmentValue);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

interface ResolvedAgents {
  readonly adapters: Readonly<Record<ArenaAgentId, AgentAdapter>>;
  readonly provenance: Readonly<Record<ArenaAgentId, "injected" | "zeroclaw">>;
}

function resolveAgents(
  options: RunLifecycleReplaySmokeOptions,
): ResolvedAgents | undefined {
  const env = options.env ?? process.env;
  const defaultFactory = options.zeroClawAgentFactory ?? createZeroClawAgentAdapter;
  const adapters = {} as Record<ArenaAgentId, AgentAdapter>;
  const provenance = {} as Record<ArenaAgentId, "injected" | "zeroclaw">;

  try {
    for (const agentId of ["alpha", "beta"] as const) {
      const injected = options.agents?.[agentId];
      if (injected !== undefined) {
        if (typeof injected.invoke !== "function") return undefined;
        adapters[agentId] = injected;
        provenance[agentId] = "injected";
        continue;
      }

      const configDir = env["ZEROCLAW_CONFIG_DIR"];
      const binaryPath = env["ZEROCLAW_BIN"] ?? "zeroclaw";
      if (
        configDir === undefined ||
        configDir.trim() === "" ||
        binaryPath.trim() === ""
      ) {
        return undefined;
      }
      adapters[agentId] = defaultFactory({ agentId, binaryPath, configDir });
      provenance[agentId] = "zeroclaw";
    }
  } catch {
    return undefined;
  }
  return { adapters, provenance };
}

function abortableWait(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timeout = setTimeout(finish, delayMs);
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function runLifecycleReplaySmoke(
  options: RunLifecycleReplaySmokeOptions,
): Promise<LifecycleReplaySmokeResult> {
  const env = options?.env ?? process.env;
  const agentTimeoutMs = positiveInteger(
    options?.agentTimeoutMs,
    env["ARENA90_AGENT_TIMEOUT_MS"],
    30_000,
  );
  const overallTimeoutMs = positiveInteger(
    options?.overallTimeoutMs,
    env["ARENA90_REPLAY_SMOKE_TIMEOUT_MS"],
    900_000,
  );
  const resolvedAgents =
    typeof options === "object" && options !== null
      ? resolveAgents(options)
      : undefined;
  if (
    typeof options !== "object" ||
    options === null ||
    typeof options.readFixture !== "function" ||
    agentTimeoutMs === undefined ||
    overallTimeoutMs === undefined ||
    resolvedAgents === undefined
  ) {
    return result("CONFIG_FAILURE");
  }

  let fixture: unknown;
  try {
    fixture = JSON.parse(await options.readFixture()) as unknown;
  } catch {
    return result("FIXTURE_FAILURE");
  }

  let invocationCount = 0;
  const countedAgents = Object.fromEntries(
    (["alpha", "beta"] as const).map((agentId) => {
      const adapter = resolvedAgents.adapters[agentId];
      const counted: AgentAdapter = {
        agentId,
        async invoke(request: AgentInvocationRequest) {
          invocationCount += 1;
          return adapter.invoke(request);
        },
      };
      return [agentId, counted];
    }),
  ) as Record<ArenaAgentId, AgentAdapter>;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, overallTimeoutMs);

  try {
    const nowMs = Date.now;
    const composition = createNodeArenaLifecycleComposition({
      recordedFixture: fixture,
      agents: countedAgents,
      ...(options.store === undefined ? {} : { store: options.store }),
      runtimeMetadata: {
        runtimeId: "arena90-node-runtime",
        runtimeVersion: "6-acceptance",
        executionRuleVersion: "p0-v1",
        winnerRuleVersion: "p0-final-nav-v1",
        agentTimeoutMs,
        agents: {
          alpha: {
            adapterId: resolvedAgents.provenance.alpha,
            adapterVersion: "1",
            strategyId: "alpha-momentum-repricing",
            strategyVersion: "1",
          },
          beta: {
            adapterId: resolvedAgents.provenance.beta,
            adapterVersion: "1",
            strategyId: "beta-structure-valuation",
            strategyVersion: "1",
          },
        },
      },
      timing: {
        nowMs,
        wait: abortableWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: {
        ownerId: "lifecycle-replay-smoke",
        ttlMs: 30_000,
        renewEveryMs: 10_000,
      },
    });
    await composition.runner.create(manifest);
    const completed = await composition.runner.run(
      manifest.arenaId,
      controller.signal,
    );
    const persisted = await composition.store.read(manifest.arenaId, 0);
    const checkpointsAreComplete =
      completed.checkpoints.length === DECISION_CHECKPOINT_IDS.length &&
      completed.checkpoints.every(
        (checkpoint, index) =>
          checkpoint.checkpointId === DECISION_CHECKPOINT_IDS[index] &&
          checkpoint.outcome === "REVEALED" &&
          checkpoint.failures.length === 0 &&
          checkpoint.revealedDecisions.alpha !== undefined &&
          checkpoint.revealedDecisions.beta !== undefined,
      );
    const eventsAreContiguous =
      persisted !== "NOT_FOUND" &&
      persisted.events.length === completed.lastEventSequence &&
      persisted.events.every((event, index) => event.sequence === index + 1);
    const finalResultIsValid =
      completed.finalResult !== undefined &&
      arenaFinalResultV1Schema.safeParse(completed.finalResult).success;

    return completed.phase === "COMPLETED" &&
      checkpointsAreComplete &&
      eventsAreContiguous &&
      finalResultIsValid &&
      invocationCount === 12
      ? result("PASSED")
      : result("VERIFICATION_FAILURE");
  } catch {
    return result(timedOut ? "TIMEOUT" : "LIFECYCLE_FAILURE");
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export function formatLifecycleReplaySmokeResult(
  smokeResult: LifecycleReplaySmokeResult,
): string {
  return smokeResult.status === "PASSED"
    ? "Arena lifecycle Replay smoke passed."
    : `Arena lifecycle Replay smoke failed: ${smokeResult.status}.`;
}
