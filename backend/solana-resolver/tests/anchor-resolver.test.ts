import assert from "node:assert/strict";
import test from "node:test";

import anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import type {
  SolanaArenaPreparationIntentV1,
  SolanaSettlementIntentV1,
} from "@arena90/arena-runtime/contracts";

import {
  assertArenaMatchesPreparation,
  assertSettlementMatches,
  parseArenaAccount,
} from "../src/anchor-resolver.js";
import type { ResolverConfig } from "../src/config.js";

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const identityHash = "11".repeat(32);
const manifestHash = "22".repeat(32);
const finalResultHash = "33".repeat(32);
const resolver = Keypair.generate();
const treasury = Keypair.generate().publicKey;
const [arena] = PublicKey.findProgramAddressSync(
  [Buffer.from("arena"), Buffer.from(identityHash, "hex")],
  programId,
);
const [vault] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), arena.toBuffer()],
  programId,
);

const config: ResolverConfig = {
  arenaId: "world-cup-final-18257739",
  persistenceDirectory: "/tmp/persistence",
  idlPath: "/tmp/arena_escrow.json",
  programId,
  treasury,
  rpcUrl: "https://api.devnet.solana.com",
  resolver,
  txlineCredentials: {
    apiOrigin: "https://txline.example",
    jwt: "jwt",
    apiToken: "token",
  },
  txlineProgramId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
  pollMs: 5000,
};

const preparation: SolanaArenaPreparationIntentV1 = {
  schemaVersion: 1,
  arenaId: config.arenaId,
  identityHash,
  manifestHash,
  fixtureId: "18257739",
  backingDeadlineUtc: "2026-07-19T19:00:00.000Z",
  feeBps: 0,
  idempotencyKey: identityHash,
};

const settlement: SolanaSettlementIntentV1 = {
  schemaVersion: 1,
  arenaId: config.arenaId,
  identityHash,
  manifestHash,
  fixtureId: "18257739",
  providerSequence: 880,
  terminalSourceEventId: "txline-live:18257739:880",
  terminalObservedAtUtc: "2026-07-19T21:00:00.000Z",
  terminalEvidenceHash: "44".repeat(32),
  homeScore: 2,
  awayScore: 1,
  proofStatKeys: [1, 2],
  finalResultHash,
  alphaFinalNavMicros: "110000000",
  betaFinalNavMicros: "90000000",
  result: "alpha",
  idempotencyKey: finalResultHash,
};

function decodedArena(state: "open" | "locked" | "settled" = "open") {
  return {
    identityHash: [...Buffer.from(identityHash, "hex")],
    manifestHash: [...Buffer.from(manifestHash, "hex")],
    fixtureId: new anchor.BN(preparation.fixtureId),
    operator: resolver.publicKey,
    resolver: resolver.publicKey,
    treasury,
    vault,
    backingDeadline: new anchor.BN(Date.parse(preparation.backingDeadlineUtc) / 1000),
    state: { [state]: {} },
    feeBps: 0,
    terminalProof: PublicKey.default,
    finalResultHash: [...Buffer.from(finalResultHash, "hex")],
    alphaNav: new anchor.BN(settlement.alphaFinalNavMicros),
    betaNav: new anchor.BN(settlement.betaFinalNavMicros),
    result: state === "settled" ? { alpha: {} } : null,
  };
}

test("accepts only an existing arena matching every canonical immutable field", () => {
  const account = parseArenaAccount(decodedArena());
  assert.doesNotThrow(() =>
    assertArenaMatchesPreparation(account, preparation, config, vault),
  );
  assert.throws(
    () =>
      assertArenaMatchesPreparation(
        account,
        { ...preparation, manifestHash: "55".repeat(32) },
        config,
        vault,
      ),
    /conflicts with canonical runtime intent/,
  );
});

test("accepts idempotent settlement only when hash, NAV, and winner match", () => {
  const account = parseArenaAccount(decodedArena("settled"));
  assert.doesNotThrow(() => assertSettlementMatches(account, settlement));
  assert.throws(
    () =>
      assertSettlementMatches(account, {
        ...settlement,
        betaFinalNavMicros: "90000001",
      }),
    /conflicts with canonical runtime result/,
  );
});

test("rejects malformed Anchor account variants", () => {
  assert.throws(
    () => parseArenaAccount({ ...decodedArena(), state: { unknown: {} } }),
    /Arena state is invalid/,
  );
});
