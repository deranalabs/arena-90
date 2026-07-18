import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_IDS,
} from "../src/contracts/index.js";
import {
  formatReplayHttpAcceptanceSmokeResult,
  runReplayHttpAcceptanceSmoke,
} from "../src/runtime/http-replay-smoke.js";
import {
  createInMemoryArenaLifecycleStore,
  type ArenaLifecycleStore,
} from "../src/services/index.js";

const manifest = {
  schemaVersion: 1,
  arenaId: "arena-http-replay-001",
  mode: "REPLAY",
  competition: "Premier League",
  fixtureId: "fixture-http-recorded-001",
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

const checkpointMinutes = [0, 15, 30, 45, 60, 75, 90] as const;
const recording = {
  provider: "TXLINE_RECORDED",
  arenaId: manifest.arenaId,
  fixtureId: manifest.fixtureId,
  records: CHECKPOINT_IDS.map((checkpointId, index) => ({
    providerSequence: index + 1,
    checkpointId,
    snapshotId: `http-snapshot-${index + 1}`,
    sourceEventId: `http-event-${index + 1}`,
    observedAtUtc: new Date(
      Date.parse(manifest.kickoffUtc) + index * 900_000,
    ).toISOString(),
    match: {
      status:
        checkpointId === "FINAL"
          ? "FINISHED"
          : checkpointId === "HALFTIME"
            ? "HALFTIME"
            : "LIVE",
      minute: checkpointMinutes[index],
      addedTime: 0,
      homeScore: checkpointId === "FINAL" ? 2 : 0,
      awayScore: checkpointId === "FINAL" ? 1 : 0,
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

function fileReader(path: string): Promise<string> {
  if (path === "manifest.json") return Promise.resolve(JSON.stringify(manifest));
  if (path === "recording.json") return Promise.resolve(JSON.stringify(recording));
  return Promise.reject(new Error("unknown test file"));
}

type MutableJsonRecord = Record<string, unknown>;

function visitJson(
  value: unknown,
  visitor: (record: MutableJsonRecord) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => visitJson(entry, visitor));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as MutableJsonRecord;
  visitor(record);
  Object.values(record).forEach((entry) => visitJson(entry, visitor));
}

function surfaceTamperingFetch(
  visitor: (record: MutableJsonRecord) => void,
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await globalThis.fetch(input, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("text/event-stream")
    ) {
      return response;
    }
    let serialized = await response.text();
    if (contentType.includes("text/event-stream")) {
      serialized = serialized
        .split("\n")
        .map((line) => {
          if (!line.startsWith("data: ")) return line;
          const data = JSON.parse(line.slice("data: ".length)) as unknown;
          visitJson(data, visitor);
          return `data: ${JSON.stringify(data)}`;
        })
        .join("\n");
    } else {
      const data = JSON.parse(serialized) as unknown;
      visitJson(data, visitor);
      serialized = JSON.stringify(data);
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(serialized, { status: response.status, headers });
  };
}

function sseCardinalityTamperingFetch(
  change: "MISSING" | "EXTRA",
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await globalThis.fetch(input, init);
    if (
      !(response.headers.get("content-type") ?? "").includes(
        "text/event-stream",
      )
    ) {
      return response;
    }
    const frames = (await response.text()).split("\n\n");
    const eventIndexes = frames.flatMap((frame, index) =>
      frame.startsWith("id: ") ? [index] : [],
    );
    const firstEventIndex = eventIndexes[0];
    if (firstEventIndex !== undefined) {
      if (change === "MISSING") frames.splice(firstEventIndex, 1);
      else frames.splice(firstEventIndex, 0, frames[firstEventIndex] ?? "");
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(frames.join("\n\n"), {
      status: response.status,
      headers,
    });
  };
}

function sseReorderingFetch(): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await globalThis.fetch(input, init);
    if (
      !(response.headers.get("content-type") ?? "").includes(
        "text/event-stream",
      )
    ) {
      return response;
    }
    const frames = (await response.text()).split("\n\n");
    const eventIndexes = frames.flatMap((frame, index) =>
      frame.startsWith("id: ") ? [index] : [],
    );
    const firstEventIndex = eventIndexes[0];
    const secondEventIndex = eventIndexes[1];
    if (firstEventIndex !== undefined && secondEventIndex !== undefined) {
      const first = frames[firstEventIndex];
      frames[firstEventIndex] = frames[secondEventIndex] ?? "";
      frames[secondEventIndex] = first ?? "";
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(frames.join("\n\n"), {
      status: response.status,
      headers,
    });
  };
}

describe("Replay HTTP acceptance smoke", () => {
  it("completes create, run, state, history, and SSE using fresh fake decisions", async () => {
    const invocations: string[] = [];
    const decisionAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        invocations.push(`${agentId}:${request.snapshot.checkpointId}`);
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: {
          alpha: decisionAgent("alpha"),
          beta: decisionAgent("beta"),
        },
      },
      overallTimeoutMs: 5_000,
    });

    expect({
      result,
      output: formatReplayHttpAcceptanceSmokeResult(result),
      invocations,
    }).toEqual({
      result: { status: "PASSED" },
      output: "Arena Replay HTTP acceptance smoke passed.",
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
    });
  });

  it("passes an explicitly clean showcase and rejects an unknown mode", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const clean = await runReplayHttpAcceptanceSmoke({
      mode: "CLEAN_SHOWCASE",
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      overallTimeoutMs: 5_000,
    });
    const invalid = await runReplayHttpAcceptanceSmoke({
      mode: "UNKNOWN" as "PRODUCT_ACCEPTANCE",
    });

    expect({
      clean,
      cleanOutput: formatReplayHttpAcceptanceSmokeResult(
        clean,
        "CLEAN_SHOWCASE",
      ),
      invalid,
    }).toEqual({
      clean: { status: "PASSED" },
      cleanOutput: "Arena Replay HTTP clean showcase smoke passed.",
      invalid: { status: "CONFIG_FAILURE" },
    });
  });

  it("accepts one sanitized missed decision in default product acceptance", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
        attempt: 0 | 1;
      }) {
        if (agentId === "alpha" && request.snapshot.checkpointId === "M60") {
          return {};
        }
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });

    const productResult = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      overallTimeoutMs: 5_000,
    });
    const cleanResult = await runReplayHttpAcceptanceSmoke({
      mode: "CLEAN_SHOWCASE",
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      overallTimeoutMs: 5_000,
    });

    expect({
      productResult,
      cleanResult,
      cleanOutput: formatReplayHttpAcceptanceSmokeResult(
        cleanResult,
        "CLEAN_SHOWCASE",
      ),
    }).toEqual({
      productResult: { status: "PASSED" },
      cleanResult: { status: "VERIFICATION_FAILURE" },
      cleanOutput:
        "Arena Replay HTTP clean showcase smoke failed: VERIFICATION_FAILURE.",
    });
  });

  it("accepts one successful repair only in product acceptance", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
        attempt: 0 | 1;
      }) {
        if (
          agentId === "alpha" &&
          request.snapshot.checkpointId === "M60" &&
          request.attempt === 0
        ) {
          return {};
        }
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const run = (mode: "PRODUCT_ACCEPTANCE" | "CLEAN_SHOWCASE") =>
      runReplayHttpAcceptanceSmoke({
        mode,
        composition: {
          env: {
            ARENA90_RUNTIME_MODE: "REPLAY",
            ARENA90_MANIFEST_FILE: "manifest.json",
            ARENA90_REPLAY_RECORDING_FILE: "recording.json",
            ARENA90_AGENT_TIMEOUT_MS: "1000",
          },
          readFile: fileReader,
          agents: { alpha: agent("alpha"), beta: agent("beta") },
        },
        overallTimeoutMs: 5_000,
      });

    const productResult = await run("PRODUCT_ACCEPTANCE");
    const cleanResult = await run("CLEAN_SHOWCASE");

    expect({ productResult, cleanResult }).toEqual({
      productResult: { status: "PASSED" },
      cleanResult: { status: "VERIFICATION_FAILURE" },
    });
  });

  it("rejects overlapping checkpoint event accounting in both modes", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const corruptStateFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (
        response.status !== 200 ||
        !url.pathname.endsWith(`/${manifest.arenaId}`)
      ) {
        return response;
      }
      const body = (await response.json()) as {
        checkpoints?: Array<{
          firstEventSequence: number;
          lastEventSequence: number;
        }>;
      };
      if ((body.checkpoints?.length ?? 0) >= 2) {
        const first = body.checkpoints?.[0];
        const second = body.checkpoints?.[1];
        if (first !== undefined && second !== undefined) {
          second.firstEventSequence = first.firstEventSequence;
        }
      }
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      });
    };
    const run = (mode: "PRODUCT_ACCEPTANCE" | "CLEAN_SHOWCASE") =>
      runReplayHttpAcceptanceSmoke({
        mode,
        composition: {
          env: {
            ARENA90_RUNTIME_MODE: "REPLAY",
            ARENA90_MANIFEST_FILE: "manifest.json",
            ARENA90_REPLAY_RECORDING_FILE: "recording.json",
            ARENA90_AGENT_TIMEOUT_MS: "1000",
          },
          readFile: fileReader,
          agents: { alpha: agent("alpha"), beta: agent("beta") },
        },
        fetch: corruptStateFetch,
        overallTimeoutMs: 5_000,
      });

    expect({
      product: await run("PRODUCT_ACCEPTANCE"),
      clean: await run("CLEAN_SHOWCASE"),
    }).toEqual({
      product: { status: "VERIFICATION_FAILURE" },
      clean: { status: "VERIFICATION_FAILURE" },
    });
  });

  it("rejects a final result whose hash is not canonical", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const corruptHashFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (
        response.status !== 200 ||
        !url.pathname.endsWith(`/${manifest.arenaId}`)
      ) {
        return response;
      }
      const body = (await response.json()) as {
        finalResult?: { finalResultHash: string };
      };
      if (body.finalResult !== undefined) {
        body.finalResult.finalResultHash = "0".repeat(64);
      }
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      });
    };

    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: corruptHashFetch,
      overallTimeoutMs: 5_000,
    });

    expect(result).toEqual({ status: "VERIFICATION_FAILURE" });
  });

  it("rejects an agent process failure without exposing its raw error", async () => {
    const privateFailure = "private-provider-payload";
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        if (agentId === "alpha" && request.snapshot.checkpointId === "M60") {
          throw new Error(privateFailure);
        }
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const productResult = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      overallTimeoutMs: 5_000,
    });
    const visible = JSON.stringify({
      productResult,
      output: formatReplayHttpAcceptanceSmokeResult(productResult),
    });

    expect(visible).toBe(
      '{"productResult":{"status":"VERIFICATION_FAILURE"},"output":"Arena Replay HTTP acceptance smoke failed: VERIFICATION_FAILURE."}',
    );
    expect(visible).not.toContain(privateFailure);
  });

  it("keeps hostile invalid output private while exposing a sanitized miss", async () => {
    const privateOutput = "private-decision-and-model-output";
    const visibleBodies: string[] = [];
    const observingFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      visibleBodies.push(await response.clone().text());
      return response;
    };
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        if (agentId === "alpha" && request.snapshot.checkpointId === "M60") {
          return {
            privateDecision: privateOutput,
            rawModelOutput: privateOutput,
            providerPayload: privateOutput,
          };
        }
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });

    const productResult = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: observingFetch,
      overallTimeoutMs: 5_000,
    });
    const visible = visibleBodies.join("\n");

    expect(productResult).toEqual({ status: "PASSED" });
    expect(visible).toContain("MISSED_DECISION_ROUND");
    expect(visible).toContain("INVALID_OUTPUT");
    expect(visible).not.toContain(privateOutput);
    expect(visible).not.toContain("privateDecision");
    expect(visible).not.toContain("rawModelOutput");
    expect(visible).not.toContain("providerPayload");
  });

  it("rejects a revealed decision forged consistently across all HTTP surfaces", async () => {
    const originalExplanation = "Hold the current public portfolio.";
    const forgedExplanation = "Forged spectator decision.";
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: originalExplanation,
        };
      },
    });
    const tamperingFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const contentType = response.headers.get("content-type") ?? "";
      if (
        !contentType.includes("application/json") &&
        !contentType.includes("text/event-stream")
      ) {
        return response;
      }
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      return new Response(
        (await response.text()).replaceAll(
          originalExplanation,
          forgedExplanation,
        ),
        { status: response.status, headers },
      );
    };

    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: tamperingFetch,
      overallTimeoutMs: 5_000,
    });

    expect(result).toEqual({ status: "VERIFICATION_FAILURE" });
  });

  it.each([
    [
      "portfolio",
      (record: MutableJsonRecord) => {
        if (
          (record["agentId"] === "alpha" || record["agentId"] === "beta") &&
          typeof record["cashMicros"] === "string" &&
          typeof record["navMicros"] === "string" &&
          typeof record["unitMicros"] === "object"
        ) {
          record["cashMicros"] = (BigInt(record["cashMicros"]) + 1n).toString();
        }
      },
    ],
    [
      "final result",
      (record: MutableJsonRecord) => {
        if (
          record["schemaVersion"] === 2 &&
          typeof record["arenaId"] === "string" &&
          typeof record["finalResultHash"] === "string" &&
          typeof record["alphaFinalNavMicros"] === "string" &&
          typeof record["betaFinalNavMicros"] === "string" &&
          (record["winner"] === "alpha" ||
            record["winner"] === "beta" ||
            record["winner"] === "DRAW")
        ) {
          record["winningAssetId"] = "AWAY";
        }
      },
    ],
  ])(
    "rejects a forged %s field repeated across all HTTP surfaces",
    async (_case, visitor) => {
      const agent = (agentId: "alpha" | "beta") => ({
        agentId,
        async invoke(request: {
          snapshot: {
            arenaId: string;
            snapshotId: string;
            checkpointId: (typeof CHECKPOINT_IDS)[number];
          };
        }) {
          return {
            schemaVersion: 1,
            arenaId: request.snapshot.arenaId,
            snapshotId: request.snapshot.snapshotId,
            checkpointId: request.snapshot.checkpointId,
            agentId,
            action: "NO_TRADE",
            publicExplanation: "Hold the current public portfolio.",
          };
        },
      });
      const result = await runReplayHttpAcceptanceSmoke({
        composition: {
          env: {
            ARENA90_RUNTIME_MODE: "REPLAY",
            ARENA90_MANIFEST_FILE: "manifest.json",
            ARENA90_REPLAY_RECORDING_FILE: "recording.json",
            ARENA90_AGENT_TIMEOUT_MS: "1000",
          },
          readFile: fileReader,
          agents: { alpha: agent("alpha"), beta: agent("beta") },
        },
        fetch: surfaceTamperingFetch(visitor),
        overallTimeoutMs: 5_000,
      });

      expect(result).toEqual({ status: "VERIFICATION_FAILURE" });
    },
  );

  it.each(["MISSING", "EXTRA"] as const)(
    "rejects an SSE stream with a %s projected event",
    async (change) => {
      const agent = (agentId: "alpha" | "beta") => ({
        agentId,
        async invoke(request: {
          snapshot: {
            arenaId: string;
            snapshotId: string;
            checkpointId: (typeof CHECKPOINT_IDS)[number];
          };
        }) {
          return {
            schemaVersion: 1,
            arenaId: request.snapshot.arenaId,
            snapshotId: request.snapshot.snapshotId,
            checkpointId: request.snapshot.checkpointId,
            agentId,
            action: "NO_TRADE",
            publicExplanation: "Hold the current public portfolio.",
          };
        },
      });
      const result = await runReplayHttpAcceptanceSmoke({
        composition: {
          env: {
            ARENA90_RUNTIME_MODE: "REPLAY",
            ARENA90_MANIFEST_FILE: "manifest.json",
            ARENA90_REPLAY_RECORDING_FILE: "recording.json",
            ARENA90_AGENT_TIMEOUT_MS: "1000",
          },
          readFile: fileReader,
          agents: { alpha: agent("alpha"), beta: agent("beta") },
        },
        fetch: sseCardinalityTamperingFetch(change),
        overallTimeoutMs: 5_000,
      });

      expect(result).toEqual({ status: "VERIFICATION_FAILURE" });
    },
  );

  it("rejects correctly formed SSE events returned out of sequence", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: sseReorderingFetch(),
      overallTimeoutMs: 5_000,
    });

    expect(result).toEqual({ status: "VERIFICATION_FAILURE" });
  });

  it("sanitizes an official projector failure from the final durable read", async () => {
    const hiddenCategory = "HOSTILE_INTERNAL_EVENT";
    const baseStore = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    let corruptVerifierRead = false;
    const store: ArenaLifecycleStore = {
      initialize: (state, events) => baseStore.initialize(state, events),
      acquire: (arenaId, ownerId, expiresAtMs) =>
        baseStore.acquire(arenaId, ownerId, expiresAtMs),
      async read(arenaId, afterEventSequence) {
        const persisted = await baseStore.read(arenaId, afterEventSequence);
        if (
          !corruptVerifierRead ||
          afterEventSequence !== 0 ||
          persisted === "NOT_FOUND"
        ) {
          return persisted;
        }
        const events = [...persisted.events];
        const terminal = events.at(-1);
        if (terminal !== undefined) {
          events[events.length - 1] = {
            ...terminal,
            type: hiddenCategory,
          } as (typeof events)[number];
        }
        return { state: persisted.state, events };
      },
    };
    let historyReads = 0;
    const triggeringFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.pathname.endsWith("/events")) {
        historyReads += 1;
        if (historyReads === 2) corruptVerifierRead = true;
      }
      return response;
    };
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        store,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: triggeringFetch,
      overallTimeoutMs: 5_000,
    });
    const visible = JSON.stringify({
      result,
      output: formatReplayHttpAcceptanceSmokeResult(result),
    });

    expect(visible).toBe(
      '{"result":{"status":"VERIFICATION_FAILURE"},"output":"Arena Replay HTTP acceptance smoke failed: VERIFICATION_FAILURE."}',
    );
    expect(visible).not.toContain(hiddenCategory);
  });

  it("classifies a rejected final durable read as verification failure", async () => {
    const baseStore = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    let rejectVerifierRead = false;
    const store: ArenaLifecycleStore = {
      initialize: (state, events) => baseStore.initialize(state, events),
      acquire: (arenaId, ownerId, expiresAtMs) =>
        baseStore.acquire(arenaId, ownerId, expiresAtMs),
      read(arenaId, afterEventSequence) {
        if (rejectVerifierRead && afterEventSequence === 0) {
          return Promise.reject(new Error("private durable read failure"));
        }
        return baseStore.read(arenaId, afterEventSequence);
      },
    };
    let historyReads = 0;
    const triggeringFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.pathname.endsWith("/events")) {
        historyReads += 1;
        if (historyReads === 2) rejectVerifierRead = true;
      }
      return response;
    };
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: "manifest.json",
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: fileReader,
        store,
        agents: { alpha: agent("alpha"), beta: agent("beta") },
      },
      fetch: triggeringFetch,
      overallTimeoutMs: 5_000,
    });
    const visible = JSON.stringify({
      result,
      output: formatReplayHttpAcceptanceSmokeResult(result),
    });

    expect(visible).toBe(
      '{"result":{"status":"VERIFICATION_FAILURE"},"output":"Arena Replay HTTP acceptance smoke failed: VERIFICATION_FAILURE."}',
    );
    expect(visible).not.toContain("private durable read failure");
  });

  it("rejects a fabricated state decision that contradicts missed history", async () => {
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId: (typeof CHECKPOINT_IDS)[number];
        };
      }) {
        if (agentId === "alpha" && request.snapshot.checkpointId === "M60") {
          return {};
        }
        return {
          schemaVersion: 1,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE",
          publicExplanation: "Hold the current public portfolio.",
        };
      },
    });
    const corruptStateFetch: typeof globalThis.fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init);
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (
        response.status !== 200 ||
        !url.pathname.endsWith(`/${manifest.arenaId}`)
      ) {
        return response;
      }
      const body = (await response.json()) as {
        checkpoints?: Array<{
          checkpointId: string;
          snapshot?: { arenaId: string; snapshotId: string };
          revealedDecisions: Record<string, unknown>;
          failures: unknown[];
        }>;
      };
      const checkpoint = body.checkpoints?.find(
        ({ checkpointId }) => checkpointId === "M60",
      );
      if (checkpoint?.snapshot !== undefined) {
        checkpoint.failures = [];
        checkpoint.revealedDecisions["alpha"] = {
          schemaVersion: 1,
          arenaId: checkpoint.snapshot.arenaId,
          snapshotId: checkpoint.snapshot.snapshotId,
          checkpointId: "M60",
          agentId: "alpha",
          action: "NO_TRADE",
          publicExplanation: "Fabricated fallback.",
        };
      }
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      });
    };
    const run = (mode: "PRODUCT_ACCEPTANCE" | "CLEAN_SHOWCASE") =>
      runReplayHttpAcceptanceSmoke({
        mode,
        composition: {
          env: {
            ARENA90_RUNTIME_MODE: "REPLAY",
            ARENA90_MANIFEST_FILE: "manifest.json",
            ARENA90_REPLAY_RECORDING_FILE: "recording.json",
            ARENA90_AGENT_TIMEOUT_MS: "1000",
          },
          readFile: fileReader,
          agents: { alpha: agent("alpha"), beta: agent("beta") },
        },
        fetch: corruptStateFetch,
        overallTimeoutMs: 5_000,
      });

    expect({
      product: await run("PRODUCT_ACCEPTANCE"),
      clean: await run("CLEAN_SHOWCASE"),
    }).toEqual({
      product: { status: "VERIFICATION_FAILURE" },
      clean: { status: "VERIFICATION_FAILURE" },
    });
  });

  it("returns only sanitized categories when configuration loading is hostile", async () => {
    const secret = "secret-provider-token";
    const privatePath = "/private/runtime/recording.json";
    const result = await runReplayHttpAcceptanceSmoke({
      composition: {
        env: {
          ARENA90_RUNTIME_MODE: "REPLAY",
          ARENA90_MANIFEST_FILE: privatePath,
          ARENA90_REPLAY_RECORDING_FILE: "recording.json",
          ARENA90_AGENT_TIMEOUT_MS: "1000",
        },
        readFile: async () => {
          throw new Error(`${secret} raw-model-output ${privatePath}`);
        },
        agents: {
          alpha: { agentId: "alpha", async invoke() {} },
          beta: { agentId: "beta", async invoke() {} },
        },
      },
    });
    const visible = JSON.stringify({
      result,
      output: formatReplayHttpAcceptanceSmokeResult(result),
    });

    expect(visible).toBe(
      '{"result":{"status":"CONFIG_FAILURE"},"output":"Arena Replay HTTP acceptance smoke failed: CONFIG_FAILURE."}',
    );
    expect(visible).not.toContain(secret);
    expect(visible).not.toContain(privatePath);
    expect(visible).not.toContain("raw-model-output");
  });
});
