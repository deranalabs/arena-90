import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import {
  formatLifecycleReplaySmokeResult,
  runLifecycleReplaySmoke,
} from "../src/runtime/lifecycle-replay-smoke.js";
import { createInMemoryArenaLifecycleStore } from "../src/services/index.js";

async function recordedFixtureText(): Promise<string> {
  return readFile(
    new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
    "utf8",
  );
}

function decisionAgent(
  agentId: "alpha" | "beta",
  onInvoke: (checkpointId: string) => void,
) {
  return {
    agentId,
    async invoke(request: {
      snapshot: {
        arenaId: string;
        snapshotId: string;
        checkpointId:
          | "KICKOFF"
          | "M15"
          | "M30"
          | "HALFTIME"
          | "M60"
          | "M75";
      };
    }) {
      onInvoke(request.snapshot.checkpointId);
      return {
        schemaVersion: 1 as const,
        arenaId: request.snapshot.arenaId,
        snapshotId: request.snapshot.snapshotId,
        checkpointId: request.snapshot.checkpointId,
        agentId,
        action: "NO_TRADE" as const,
        publicExplanation: "Hold the current portfolio.",
      };
    },
  };
}

describe("full lifecycle Replay smoke", () => {
  it("reopens atomic JSON and proves completed recovery is idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arena90-smoke-restart-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const invocations: string[] = [];
    const result = await runLifecycleReplaySmoke({
      env: {
        ZEROCLAW_BIN: "zeroclaw",
        ZEROCLAW_CONFIG_DIR: "configured-outside-git",
        ARENA90_PERSISTENCE_DIR: directory,
      },
      readFixture: recordedFixtureText,
      zeroClawAgentFactory({ agentId }) {
        return decisionAgent(agentId, (checkpointId) =>
          invocations.push(`${agentId}:${checkpointId}`),
        );
      },
      // This path exercises twelve decisions plus two durable-store opens.
      // Keep the budget above normal CI scheduling jitter; timeout behavior is
      // covered independently with a deliberately blocking agent below.
      overallTimeoutMs: 5_000,
    });

    expect({ result, invocationCount: invocations.length }).toEqual({
      result: { status: "PASSED" },
      invocationCount: 12,
    });
  });

  it("verifies six fresh Alpha/Beta decisions and FINAL without another agent call", async () => {
    const invocations: string[] = [];
    const result = await runLifecycleReplaySmoke({
      readFixture: recordedFixtureText,
      agents: {
        alpha: decisionAgent("alpha", (checkpoint) =>
          invocations.push(`alpha:${checkpoint}`),
        ),
        beta: decisionAgent("beta", (checkpoint) =>
          invocations.push(`beta:${checkpoint}`),
        ),
      },
      overallTimeoutMs: 1_000,
    });

    expect({
      result,
      invocations,
      output: formatLifecycleReplaySmokeResult(result),
    }).toEqual({
      result: { status: "PASSED" },
      invocations: [
        "alpha:KICKOFF",
        "beta:KICKOFF",
        "alpha:M15",
        "beta:M15",
        "alpha:M30",
        "beta:M30",
        "alpha:HALFTIME",
        "beta:HALFTIME",
        "alpha:M60",
        "beta:M60",
        "alpha:M75",
        "beta:M75",
      ],
      output: "Arena lifecycle Replay smoke passed.",
    });
  });

  it("persists injected provenance when both adapters are supplied", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    const smokeResult = await runLifecycleReplaySmoke({
      env: {
        ZEROCLAW_BIN: "zeroclaw",
        ZEROCLAW_CONFIG_DIR: "configured-outside-git",
      },
      readFixture: recordedFixtureText,
      agents: {
        alpha: decisionAgent("alpha", () => undefined),
        beta: decisionAgent("beta", () => undefined),
      },
      zeroClawAgentFactory() {
        throw new Error("default factory must not run for injected adapters");
      },
      store,
      overallTimeoutMs: 1_000,
    });
    const persisted = await store.read("arena-replay-001", 0);

    expect({
      smokeResult,
      adapterMetadata:
        persisted === "NOT_FOUND"
          ? persisted
          : persisted.state.runtimeMetadata.agents,
    }).toEqual({
      smokeResult: { status: "PASSED" },
      adapterMetadata: {
        alpha: expect.objectContaining({ adapterId: "injected" }),
        beta: expect.objectContaining({ adapterId: "injected" }),
      },
    });
  });

  it("persists ZeroClaw provenance for both default smoke adapters", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    const defaultFactoryCalls: string[] = [];
    const smokeResult = await runLifecycleReplaySmoke({
      env: {
        ZEROCLAW_BIN: "zeroclaw",
        ZEROCLAW_CONFIG_DIR: "configured-outside-git",
      },
      readFixture: recordedFixtureText,
      zeroClawAgentFactory(config) {
        defaultFactoryCalls.push(config.agentId);
        return decisionAgent(config.agentId, () => undefined);
      },
      store,
      overallTimeoutMs: 1_000,
    });
    const persisted = await store.read("arena-replay-001", 0);

    expect({
      smokeResult,
      defaultFactoryCalls,
      adapterMetadata:
        persisted === "NOT_FOUND"
          ? persisted
          : persisted.state.runtimeMetadata.agents,
    }).toEqual({
      smokeResult: { status: "PASSED" },
      defaultFactoryCalls: ["alpha", "beta"],
      adapterMetadata: {
        alpha: expect.objectContaining({ adapterId: "zeroclaw" }),
        beta: expect.objectContaining({ adapterId: "zeroclaw" }),
      },
    });
  });

  it("persists independent provenance for one injected and one default adapter", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    const defaultFactoryCalls: string[] = [];
    const smokeResult = await runLifecycleReplaySmoke({
      env: {
        ZEROCLAW_BIN: "zeroclaw",
        ZEROCLAW_CONFIG_DIR: "configured-outside-git",
      },
      readFixture: recordedFixtureText,
      agents: {
        alpha: decisionAgent("alpha", () => undefined),
      },
      zeroClawAgentFactory(config) {
        defaultFactoryCalls.push(config.agentId);
        return decisionAgent(config.agentId, () => undefined);
      },
      store,
      overallTimeoutMs: 1_000,
    });
    const persisted = await store.read("arena-replay-001", 0);

    expect({
      smokeResult,
      defaultFactoryCalls,
      adapterMetadata:
        persisted === "NOT_FOUND"
          ? persisted
          : persisted.state.runtimeMetadata.agents,
    }).toEqual({
      smokeResult: { status: "PASSED" },
      defaultFactoryCalls: ["beta"],
      adapterMetadata: {
        alpha: expect.objectContaining({ adapterId: "injected" }),
        beta: expect.objectContaining({ adapterId: "zeroclaw" }),
      },
    });
  });

  it("returns sanitized categories without leaking hostile failures", async () => {
    const secret = "jwt-secret-value";
    const rawOutput = "raw-model-output";
    const configPath = "/private/secret/zeroclaw-config";
    const hostileAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke() {
        throw new Error(`${secret} ${rawOutput} ${configPath}`);
      },
    });
    const invocationFailure = await runLifecycleReplaySmoke({
      readFixture: recordedFixtureText,
      agents: {
        alpha: hostileAgent("alpha"),
        beta: hostileAgent("beta"),
      },
      overallTimeoutMs: 1_000,
    });
    const fixtureFailure = await runLifecycleReplaySmoke({
      readFixture: async () => {
        throw new Error(`${secret} ${configPath}`);
      },
      agents: {
        alpha: hostileAgent("alpha"),
        beta: hostileAgent("beta"),
      },
      overallTimeoutMs: 1_000,
    });
    const visible = JSON.stringify({
      invocationFailure,
      invocationOutput: formatLifecycleReplaySmokeResult(invocationFailure),
      fixtureFailure,
      fixtureOutput: formatLifecycleReplaySmokeResult(fixtureFailure),
    });

    expect({ invocationFailure, fixtureFailure }).toEqual({
      invocationFailure: { status: "VERIFICATION_FAILURE" },
      fixtureFailure: { status: "FIXTURE_FAILURE" },
    });
    expect(visible).not.toContain(secret);
    expect(visible).not.toContain(rawOutput);
    expect(visible).not.toContain(configPath);
  });

  it("aborts the complete run when the overall timeout expires", async () => {
    let abortedInvocations = 0;
    const blockingAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke({ signal }: { signal: AbortSignal }) {
        return new Promise<never>(() => {
          signal.addEventListener(
            "abort",
            () => {
              abortedInvocations += 1;
            },
            { once: true },
          );
        });
      },
    });
    const smokeResult = await runLifecycleReplaySmoke({
      readFixture: recordedFixtureText,
      agents: {
        alpha: blockingAgent("alpha"),
        beta: blockingAgent("beta"),
      },
      overallTimeoutMs: 10,
    });

    expect({ smokeResult, abortedInvocations }).toEqual({
      smokeResult: { status: "TIMEOUT" },
      abortedInvocations: 2,
    });
  });

  it("fails safely before fixture access when manual ZeroClaw config is missing", async () => {
    let fixtureReads = 0;
    const smokeResult = await runLifecycleReplaySmoke({
      env: {},
      readFixture: async () => {
        fixtureReads += 1;
        return recordedFixtureText();
      },
      overallTimeoutMs: 1_000,
    });

    expect({ smokeResult, fixtureReads }).toEqual({
      smokeResult: { status: "CONFIG_FAILURE" },
      fixtureReads: 0,
    });
  });
});
