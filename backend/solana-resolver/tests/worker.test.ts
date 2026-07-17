import assert from "node:assert/strict";
import test from "node:test";

import type {
  ArenaLifecycleReadResult,
  SupporterChainResolver,
} from "@arena90/arena-runtime/services";
import type {
  ArenaManifest,
  ArenaFinalResultV2,
  ArenaRunStateV1,
} from "@arena90/arena-runtime/contracts";
import {
  CHECKPOINT_IDS,
  calculateFinalResultHash,
  calculateTerminalEvidenceHash,
} from "@arena90/arena-runtime/contracts";

import { createSupporterResolutionWorker } from "../src/worker.js";

function manifest(mode: "LIVE" | "REPLAY" = "LIVE"): ArenaManifest {
  return {
    schemaVersion: 1,
    arenaId: "world-cup-final-18257739",
    fixtureId: "18257739",
    competition: "World Cup Hackathon 2026",
    homeTeam: { name: "Spain", code: "ESP" },
    awayTeam: { name: "Argentina", code: "ARG" },
    mode,
    kickoffUtc: "2026-07-19T19:00:00.000Z",
    startingBankrollMicros: "100000000",
    currency: "VIRTUAL_USD_MICROS",
    assets: [
      { id: "HOME", market: "FULL_TIME_1X2", label: "Spain win" },
      { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
      { id: "AWAY", market: "FULL_TIME_1X2", label: "Argentina win" },
    ],
    checkpoints: [...CHECKPOINT_IDS],
    createdAtUtc: "2026-07-17T10:00:00.000Z",
  };
}

function finalResult(): ArenaFinalResultV2 {
  const evidenceInput = {
    schemaVersion: 1 as const,
    providerSequence: 880,
    arenaId: "world-cup-final-18257739",
    fixtureId: "18257739",
    observedAtUtc: "2026-07-19T21:00:00.000Z",
    sourceEventId: "txline-live:18257739:880",
    source: "TXLINE_LIVE" as const,
    match: {
      status: "FINISHED" as const,
      minute: 90,
      addedTime: 5,
      homeScore: 2,
      awayScore: 1,
    },
    winningAssetId: "HOME" as const,
  };
  const input = {
    schemaVersion: 2 as const,
    arenaId: "world-cup-final-18257739",
    winnerRule: "FINAL_NAV_ONLY_V1" as const,
    winningAssetId: "HOME" as const,
    winner: "alpha" as const,
    alphaFinalNavMicros: "110000000",
    betaFinalNavMicros: "90000000",
    terminalEvidence: {
      ...evidenceInput,
      terminalEvidenceHash: calculateTerminalEvidenceHash(evidenceInput),
    },
    completedEventSequence: 42,
    preSettlementEventLogHash: "a".repeat(64),
  };
  return { ...input, finalResultHash: calculateFinalResultHash(input) };
}

function persisted(mode: "LIVE" | "REPLAY" = "LIVE"): ArenaLifecycleReadResult {
  return {
    state: {
      manifest: manifest(mode),
      phase: "READY",
    } as ArenaRunStateV1,
    events: [],
  };
}

function completed(): ArenaLifecycleReadResult {
  return {
    state: {
      manifest: manifest(),
      phase: "COMPLETED",
      finalResult: finalResult(),
    } as ArenaRunStateV1,
    events: [],
  };
}

function chain(
  calls: string[],
  lockResult: "NOT_DUE" | "ALREADY_LOCKED" = "NOT_DUE",
): SupporterChainResolver {
  return {
    async prepare() {
      calls.push("prepare");
      return "ALREADY_PREPARED";
    },
    async lock() {
      calls.push("lock");
      return lockResult;
    },
    async settle() {
      calls.push("settle");
      return "ALREADY_SETTLED";
    },
  };
}

test("waits until the runtime has persisted the configured arena", async () => {
  const calls: string[] = [];
  const worker = createSupporterResolutionWorker({
    arenaId: "world-cup-final-18257739",
    store: { async read() { return "NOT_FOUND"; } },
    chain: chain(calls),
  });

  assert.deepEqual(await worker.tick(new AbortController().signal), {
    status: "WAITING_FOR_RUNTIME",
  });
  assert.deepEqual(calls, []);
});

test("prepares and checks the permissionless lock on every Live tick", async () => {
  const calls: string[] = [];
  const worker = createSupporterResolutionWorker({
    arenaId: "world-cup-final-18257739",
    store: { async read() { return persisted(); } },
    chain: chain(calls),
  });

  assert.deepEqual(await worker.tick(new AbortController().signal), {
    status: "ACTIVE",
    preparation: "ALREADY_PREPARED",
    lock: "NOT_DUE",
  });
  assert.deepEqual(calls, ["prepare", "lock"]);
});

test("never touches Solana for Replay", async () => {
  const calls: string[] = [];
  const worker = createSupporterResolutionWorker({
    arenaId: "world-cup-final-18257739",
    store: { async read() { return persisted("REPLAY"); } },
    chain: chain(calls),
  });

  assert.deepEqual(await worker.tick(new AbortController().signal), {
    status: "NOT_ELIGIBLE",
  });
  assert.deepEqual(calls, []);
});

test("settles a completed Live arena and tolerates idempotent chain results", async () => {
  const calls: string[] = [];
  const worker = createSupporterResolutionWorker({
    arenaId: "world-cup-final-18257739",
    store: { async read() { return completed(); } },
    chain: chain(calls, "ALREADY_LOCKED"),
  });

  assert.deepEqual(await worker.tick(new AbortController().signal), {
    status: "ACTIVE",
    preparation: "ALREADY_PREPARED",
    lock: "ALREADY_LOCKED",
    settlement: "ALREADY_SETTLED",
  });
  assert.deepEqual(calls, ["prepare", "lock", "settle"]);
});

test("does not settle until the chain clock allows locking", async () => {
  const calls: string[] = [];
  const worker = createSupporterResolutionWorker({
    arenaId: "world-cup-final-18257739",
    store: { async read() { return completed(); } },
    chain: chain(calls),
  });

  assert.deepEqual(await worker.tick(new AbortController().signal), {
    status: "ACTIVE",
    preparation: "ALREADY_PREPARED",
    lock: "NOT_DUE",
  });
  assert.deepEqual(calls, ["prepare", "lock"]);
});
