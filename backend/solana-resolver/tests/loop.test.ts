import assert from "node:assert/strict";
import test from "node:test";

import { runResolverLoop, type ResolverLoopObservation } from "../src/loop.js";
import type { SupporterResolutionWorker } from "../src/worker.js";

test("retries transient failures and exits cleanly on abort", async () => {
  const controller = new AbortController();
  const observations: ResolverLoopObservation[] = [];
  let ticks = 0;
  const worker: SupporterResolutionWorker = {
    async tick() {
      ticks += 1;
      if (ticks === 1) throw Object.assign(new Error("private RPC detail"), { code: "RPC_DOWN" });
      return { status: "WAITING_FOR_RUNTIME" };
    },
  };

  await runResolverLoop({
    worker,
    pollMs: 1000,
    signal: controller.signal,
    observe(observation) {
      observations.push(observation);
      if (observations.length === 2) controller.abort();
    },
    async sleep() {},
  });

  assert.deepEqual(observations, [
    {
      consecutiveFailures: 1,
      errorName: "Error",
      errorCode: "RPC_DOWN",
    },
    {
      consecutiveFailures: 0,
      result: { status: "WAITING_FOR_RUNTIME" },
    },
  ]);
  assert.equal(JSON.stringify(observations).includes("private RPC detail"), false);
});

test("rejects a hot polling loop", async () => {
  await assert.rejects(
    runResolverLoop({
      worker: { async tick() { return { status: "WAITING_FOR_RUNTIME" }; } },
      pollMs: 100,
      signal: new AbortController().signal,
      observe() {},
    }),
    /at least 1000ms/,
  );
});
