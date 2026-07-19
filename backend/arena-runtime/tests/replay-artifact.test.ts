import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vitest";

import type { AgentAdapter } from "../src/adapters/agents/fake.js";
import {
  createRecordedReplayArtifact,
  calculateReplaySemanticHash,
} from "../src/runtime/replay-artifact.js";
import { runLifecycleReplaySmoke } from "../src/runtime/lifecycle-replay-smoke.js";
import {
  createInMemoryArenaLifecycleStore,
  createJsonArenaLifecycleStore,
} from "../src/services/index.js";

const arenaId = "arena-replay-001";

function replayAgent(agentId: "alpha" | "beta"): AgentAdapter {
  return {
    agentId,
    async invoke(request) {
      const identity = {
        schemaVersion: 1 as const,
        arenaId: request.snapshot.arenaId,
        snapshotId: request.snapshot.snapshotId,
        checkpointId: request.snapshot.checkpointId,
        agentId,
      };
      if (agentId === "beta" && request.snapshot.checkpointId === "M15") {
        return {
          ...identity,
          action: "TARGET_ALLOCATION" as const,
          targetAllocationBps: {
            cash: 5_000,
            HOME: 5_000,
            DRAW: 0,
            AWAY: 0,
          },
          publicExplanation: "Use the accepted Beta allocation.",
        };
      }
      return {
        ...identity,
        action: "NO_TRADE" as const,
        publicExplanation: "Keep the accepted portfolio unchanged.",
      };
    },
  };
}

describe("recorded Replay artifact", () => {
  it("exports a completed Replay when Alpha has six accepted NO_TRADE decisions", async () => {
    const store = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    const result = await runLifecycleReplaySmoke({
      readFixture: () =>
        readFile(
          new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
          "utf8",
        ),
      agents: { alpha: replayAgent("alpha"), beta: replayAgent("beta") },
      store,
      overallTimeoutMs: 5_000,
    });
    const persisted = await store.read(arenaId, 0);
    if (persisted === "NOT_FOUND") throw new Error("Missing completed Replay");

    const artifact = createRecordedReplayArtifact({
      persistence: persisted,
      source: {
        label: "RECORDED TxLINE DATA",
        fixtureId: persisted.state.manifest.fixtureId,
        matchDateUtc: persisted.state.manifest.kickoffUtc,
        capturedAtUtc: "2026-07-19T00:00:00.000Z",
        scoreEventCount: 7,
        oddsUpdateCount: 21,
        inputHash: "a".repeat(64),
      },
    });

    expect({
      result,
      phase: artifact.state.phase,
      semanticHash: artifact.semanticHash,
      alphaActions: artifact.state.checkpoints.map(
        (checkpoint) => checkpoint.revealedDecisions.alpha?.action,
      ),
      betaTrades: artifact.state.checkpoints.filter(
        (checkpoint) =>
          checkpoint.revealedDecisions.beta?.action === "TARGET_ALLOCATION",
      ).length,
      missedRounds: artifact.history.events.filter(
        (event) => event.type === "MISSED_DECISION_ROUND",
      ).length,
    }).toEqual({
      result: { status: "PASSED" },
      phase: "COMPLETED",
      semanticHash: calculateReplaySemanticHash(persisted),
      alphaActions: Array.from({ length: 6 }, () => "NO_TRADE"),
      betaTrades: 1,
      missedRounds: 0,
    });
  });

  it("keeps the canonical semantic hash stable when reopen advances only fencing metadata", async () => {
    const sourceStore = createInMemoryArenaLifecycleStore({ nowMs: Date.now });
    await runLifecycleReplaySmoke({
      readFixture: () =>
        readFile(
          new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
          "utf8",
        ),
      agents: { alpha: replayAgent("alpha"), beta: replayAgent("beta") },
      store: sourceStore,
      overallTimeoutMs: 5_000,
    });
    const completed = await sourceStore.read(arenaId, 0);
    if (completed === "NOT_FOUND") throw new Error("Missing completed Replay");

    const directory = await mkdtemp(join(tmpdir(), "arena90-semantic-hash-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const store = createJsonArenaLifecycleStore({ directory, nowMs: () => 1_000 });
    await store.initialize(completed.state, completed.events);

    const firstLease = await store.acquire(arenaId, "reopen-one", 2_000);
    if (typeof firstLease === "string") throw new Error("Missing first lease");
    await firstLease.release();
    const [recordFile] = await readdir(directory);
    if (recordFile === undefined) throw new Error("Missing durable record");
    const firstRecord = JSON.parse(
      await readFile(join(directory, recordFile), "utf8"),
    ) as { fencingSequence: number; persistence: unknown };
    const firstRead = await store.read(arenaId, 0);
    if (firstRead === "NOT_FOUND") throw new Error("Missing first reopen");

    const secondLease = await store.acquire(arenaId, "reopen-two", 2_000);
    if (typeof secondLease === "string") throw new Error("Missing second lease");
    await secondLease.release();
    const secondRecord = JSON.parse(
      await readFile(join(directory, recordFile), "utf8"),
    ) as { fencingSequence: number; persistence: unknown };
    const secondRead = await store.read(arenaId, 0);
    if (secondRead === "NOT_FOUND") throw new Error("Missing second reopen");

    expect({
      fencingSequences: [
        firstRecord.fencingSequence,
        secondRecord.fencingSequence,
      ],
      persistenceEqual:
        JSON.stringify(firstRecord.persistence) ===
        JSON.stringify(secondRecord.persistence),
      semanticHashes: [
        calculateReplaySemanticHash(firstRead),
        calculateReplaySemanticHash(secondRead),
      ],
      eventCounts: [firstRead.events.length, secondRead.events.length],
    }).toEqual({
      fencingSequences: [1, 2],
      persistenceEqual: true,
      semanticHashes: [
        calculateReplaySemanticHash(completed),
        calculateReplaySemanticHash(completed),
      ],
      eventCounts: [39, 39],
    });
  });
});
