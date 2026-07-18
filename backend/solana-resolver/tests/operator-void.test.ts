import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Keypair, PublicKey } from "@solana/web3.js";

import {
  assertVoidCandidate,
  deriveArenaAddress,
  parseVoidArenaArguments,
} from "../src/operator-void.js";
import type {
  ArenaAccount,
  SupporterPositionAccount,
} from "../src/anchor-resolver.js";

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const arenaId = "world-cup-2026-france-england-third-place-rehearsal-v2";
const identityHash = createHash("sha256").update(arenaId).digest();
const arena = deriveArenaAddress(programId, identityHash);
const resolver = Keypair.generate().publicKey;

const validArguments = [
  "--arena",
  arena.toBase58(),
  "--identity-hash",
  identityHash.toString("hex"),
  "--fixture-id",
  "18257865",
  "--reason",
  "4",
  "--expected-alpha-pool",
  "50000000",
  "--expected-beta-pool",
  "0",
  "--expected-position-count",
  "1",
] as const;

test("parses a fully constrained void request", () => {
  const request = parseVoidArenaArguments(validArguments);
  assert.equal(request.arenaAddress.toBase58(), arena.toBase58());
  assert.equal(request.fixtureId, 18_257_865n);
  assert.equal(request.reason, 4);
  assert.equal(request.expectedAlphaPool, 50_000_000n);
  assert.equal(request.expectedBetaPool, 0n);
  assert.equal(request.expectedPositionCount, 1);
});

function arenaAccount(state: ArenaAccount["state"] = "OPEN"): ArenaAccount {
  return {
    identityHash,
    manifestHash: Uint8Array.from({ length: 32 }, () => 1),
    fixtureId: 18_257_865n,
    operator: resolver,
    resolver,
    treasury: resolver,
    vault: resolver,
    backingDeadline: 2_000n,
    state,
    alphaPool: 50_000_000n,
    betaPool: 0n,
    feeBps: 0,
    terminalProof: PublicKey.default,
    finalResultHash: new Uint8Array(32),
    alphaNav: 0n,
    betaNav: 0n,
  };
}

function position(): SupporterPositionAccount {
  return {
    arena,
    owner: Keypair.generate().publicKey,
    side: "alpha",
    amount: 50_000_000n,
    claimed: false,
  };
}

test("permits reason 4 only for reconciled OPEN pre-kickoff state", () => {
  const request = parseVoidArenaArguments(validArguments);
  assert.doesNotThrow(() => assertVoidCandidate(arenaAccount(), [position()], request, 1_000n));
  assert.throws(
    () => assertVoidCandidate(arenaAccount("LOCKED"), [position()], request, 1_000n),
    /requires an OPEN arena/,
  );
  assert.throws(
    () => assertVoidCandidate(arenaAccount(), [position()], request, 2_000n),
    /requires a pre-kickoff arena/,
  );
  assert.throws(
    () => assertVoidCandidate({ ...arenaAccount(), alphaPool: 1n }, [position()], request, 1_000n),
    /pools do not match/,
  );
  assert.throws(
    () => assertVoidCandidate(arenaAccount(), [], request, 1_000n),
    /position count/,
  );
});

test("rejects missing, duplicate, unknown, and unbounded constraints", () => {
  assert.throws(() => parseVoidArenaArguments([]), /--identity-hash is required/);
  assert.throws(
    () => parseVoidArenaArguments(["--reason", "1", "--reason", "2"]),
    /must occur once/,
  );
  assert.throws(
    () => parseVoidArenaArguments(["--unknown", "value"]),
    /Unknown operator argument/,
  );
  assert.throws(
    () => parseVoidArenaArguments([
      "--arena",
      arena.toBase58(),
      "--identity-hash",
      identityHash.toString("hex"),
      "--fixture-id",
      "18257865",
      "--reason",
      "65536",
    ]),
    /fit u16/,
  );
});
