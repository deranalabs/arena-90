import assert from "node:assert/strict";
import test from "node:test";

import { fetchTerminalProofPayload } from "../src/txline-proof.js";

const root = [...new Uint8Array(32).fill(7)];

function proof(statKey: 1 | 2, value: number) {
  return {
    summary: {
      fixtureId: 18_257_739,
      updateStats: {
        updateCount: 1,
        minTimestamp: 1_768_843_200_000,
        maxTimestamp: 1_768_843_200_000,
      },
      eventStatsSubTreeRoot: root,
    },
    subTreeProof: [],
    mainTreeProof: [],
    eventStatRoot: root,
    statToProve: { key: statKey, value, period: 5 },
    statProof: [],
  };
}

function txlineFetch(homeScore = 2, awayScore = 1): typeof fetch {
  return async (request, init) => {
    const url = new URL(String(request));
    assert.equal(url.searchParams.get("fixtureId"), "18257739");
    assert.equal(url.searchParams.get("seq"), "880");
    assert.equal((init?.headers as Record<string, string>)["X-Api-Token"], "token");
    const key = Number(url.searchParams.get("statKey")) as 1 | 2;
    return new Response(
      JSON.stringify(proof(key, key === 1 ? homeScore : awayScore)),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}

const input = {
  credentials: {
    apiOrigin: "https://txline.example",
    jwt: "jwt",
    apiToken: "token",
  },
  fixtureId: "18257739",
  providerSequence: 880,
  homeScore: 2,
  awayScore: 1,
  signal: new AbortController().signal,
};

test("normalizes matching TxLINE HOME/AWAY terminal proofs", async () => {
  const result = await fetchTerminalProofPayload({
    ...input,
    fetchImpl: txlineFetch(),
  });
  assert.equal(result.payload.fixtureSummary.fixtureId.toString(), "18257739");
  assert.deepEqual(
    result.payload.stats.map((entry) => entry.stat),
    [
      { key: 1, value: 2, period: 5 },
      { key: 2, value: 1, period: 5 },
    ],
  );
});

test("rejects a proof that disagrees with canonical runtime score", async () => {
  await assert.rejects(
    fetchTerminalProofPayload({ ...input, fetchImpl: txlineFetch(3, 1) }),
    /do not match canonical final evidence/,
  );
});

test("rejects oversized or failed provider responses", async () => {
  await assert.rejects(
    fetchTerminalProofPayload({
      ...input,
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    }),
    /status 503/,
  );
  await assert.rejects(
    fetchTerminalProofPayload({
      ...input,
      fetchImpl: async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1)),
    }),
    /exceeds 5 MB/,
  );
});
