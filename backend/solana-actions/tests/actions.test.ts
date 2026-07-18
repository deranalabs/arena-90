import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { AccountInfo, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import request from "supertest";
import { createApp, type ChainReader } from "../src/app.js";
import { loadConfig, solToLamports, type ActionsConfig } from "../src/config.js";
import { backAgentInstruction, claimInstruction, derivePosition, deriveVault } from "../src/program.js";

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const arena = new PublicKey("7eFCWjKnPVs5ovXhgnEkckby93oEPzbYXM9e6raSoi7b");
const refundArena = new PublicKey("4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2");
const supporter = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const config: ActionsConfig = {
  port: 8787,
  rpcUrl: "https://api.devnet.solana.com",
  programId,
  publicBaseUrl: "https://api.example.com",
  frontendOrigin: "https://arena-90.vercel.app",
  arenaPageUrl: "https://arena-90.vercel.app/arena/world-cup-final",
  arenaAddress: arena,
  refundArenaPageUrl: "https://arena-90.vercel.app/arena/retired-arena",
  refundArenaAddress: refundArena,
  allowedOrigins: new Set(["https://arena-90.vercel.app", "https://dial.to"]),
  minBackLamports: 1_000_000n,
  maxBackLamports: 1_000_000_000n,
  rateLimitPerMinute: 60,
  trustProxy: false,
};

function arenaAccount(
  state: 0 | 1 | 2 | 3 = 0,
  backingDeadlineUnix = 2_000n,
): AccountInfo<Buffer> {
  const data = Buffer.alloc(218);
  createHash("sha256")
    .update("account:Arena")
    .digest()
    .subarray(0, 8)
    .copy(data);
  data.writeBigInt64LE(backingDeadlineUnix, 209);
  data[217] = state;
  return {
    data,
    executable: false,
    lamports: 1,
    owner: programId,
    rentEpoch: 0,
  };
}

class FakeChain implements ChainReader {
  constructor(private readonly account: AccountInfo<Buffer> | null = arenaAccount()) {}

  async getAccountInfo(): Promise<AccountInfo<Buffer> | null> {
    return this.account;
  }

  async getLatestBlockhash(): Promise<BlockhashWithExpiryBlockHeight> {
    return {
      blockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 1,
    };
  }
}

test("parses SOL without floating-point rounding", () => {
  assert.equal(solToLamports("0.001"), 1_000_000n);
  assert.equal(solToLamports("1.000000001"), 1_000_000_001n);
  assert.throws(() => solToLamports("1.0000000001"));
  assert.throws(() => solToLamports("1e3"));
});

test("requires legacy refund address and page URL as one constrained pair", () => {
  const env = {
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
    ARENA90_PROGRAM_ID: programId.toBase58(),
    PUBLIC_BASE_URL: "https://arena90.xyz",
    FRONTEND_ORIGIN: "https://arena90.xyz",
    ARENA_PAGE_URL: "https://arena90.xyz/arena/current",
    ARENA_ADDRESS: arena.toBase58(),
    ALLOWED_ORIGINS: "https://arena90.xyz",
  };
  assert.throws(
    () => loadConfig({ ...env, REFUND_ARENA_ADDRESS: refundArena.toBase58() }),
    /must be configured together/,
  );
  const loaded = loadConfig({
    ...env,
    REFUND_ARENA_ADDRESS: refundArena.toBase58(),
    REFUND_ARENA_PAGE_URL: "https://arena90.xyz/arena/retired",
  });
  assert.equal(loaded.refundArenaAddress?.toBase58(), refundArena.toBase58());
});

test("encodes only supporter-signed Back and Claim instructions", () => {
  const back = backAgentInstruction({
    programId,
    arena,
    supporter,
    side: "alpha",
    lamports: 2_000_000n,
  });
  assert.equal(back.keys[1]?.isSigner, true);
  assert.equal(back.keys[2]?.pubkey.toBase58(), derivePosition(programId, arena, supporter).toBase58());
  assert.equal(back.keys[3]?.pubkey.toBase58(), deriveVault(programId, arena).toBase58());
  assert.equal(back.data.length, 17);
  assert.equal(back.data[8], 0);
  assert.equal(back.data.readBigUInt64LE(9), 2_000_000n);

  const claim = claimInstruction({ programId, arena, supporter });
  assert.equal(claim.keys[1]?.isSigner, true);
  assert.equal(claim.data.length, 8);
});

test("GET exposes only actions valid for the on-chain lifecycle", async () => {
  const app = createApp(config, new FakeChain(), () => 1_000_000);
  const response = await request(app).get(`/actions/arena/${arena.toBase58()}`).expect(200);
  assert.equal(response.body.type, "action");
  assert.deepEqual(
    response.body.links.actions.map((action: { label: string }) => action.label),
    ["Back Alpha", "Back Beta", "View Arena"],
  );

  const pending = await request(
    createApp(config, new FakeChain(arenaAccount(1)), () => 1_000_000),
  )
    .get(`/actions/arena/${arena.toBase58()}`)
    .expect(200);
  assert.equal(pending.body.disabled, false);
  assert.deepEqual(
    pending.body.links.actions.map((action: { label: string }) => action.label),
    ["View Arena"],
  );

  const settled = await request(
    createApp(config, new FakeChain(arenaAccount(2)), () => 1_000_000),
  )
    .get(`/actions/arena/${arena.toBase58()}`)
    .expect(200);
  assert.deepEqual(
    settled.body.links.actions.map((action: { label: string }) => action.label),
    ["Claim or refund", "View Arena"],
  );

  await request(createApp(config, new FakeChain(null)))
    .get(`/actions/arena/${arena.toBase58()}`)
    .expect(404);

  const refundable = await request(
    createApp(config, new FakeChain(arenaAccount(3)), () => 1_000_000),
  )
    .get(`/actions/arena/${refundArena.toBase58()}`)
    .expect(200);
  assert.deepEqual(
    refundable.body.links.actions.map((action: { label: string }) => action.label),
    ["Claim or refund", "View Arena"],
  );
  assert.equal(
    refundable.body.links.actions[1].href,
    "https://arena-90.vercel.app/arena/retired-arena",
  );

  const refundRouteStillOpenOnChain = await request(
    createApp(config, new FakeChain(arenaAccount(0)), () => 1_000_000),
  )
    .get(`/actions/arena/${refundArena.toBase58()}`)
    .expect(200);
  assert.deepEqual(
    refundRouteStillOpenOnChain.body.links.actions.map(
      (action: { label: string }) => action.label,
    ),
    ["View Arena"],
  );
  await request(createApp(config, new FakeChain(arenaAccount(0)), () => 1_000_000))
    .post(`/actions/arena/${refundArena.toBase58()}/back/alpha?amount=0.01`)
    .send({ account: supporter.toBase58() })
    .expect(409);
});

test("serves spec CORS and actions.json to every Blink client", async () => {
  const app = createApp(config, new FakeChain(), () => 1_000_000);
  const options = await request(app)
    .options(`/actions/arena/${arena.toBase58()}`)
    .set("origin", "https://wallet.example")
    .expect(204);
  assert.equal(options.headers["access-control-allow-origin"], "*");
  assert.equal(options.headers["access-control-allow-methods"], "GET,POST,PUT,OPTIONS");

  const manifest = await request(app).get("/actions.json").expect(200);
  assert.equal(manifest.headers["access-control-allow-origin"], "*");
  assert.deepEqual(manifest.body.rules, [
    {
      pathPattern: "/arena/world-cup-final",
      apiPath: `/actions/arena/${arena.toBase58()}`,
    },
    {
      pathPattern: "/arena/retired-arena",
      apiPath: `/actions/arena/${refundArena.toBase58()}`,
    },
    { pathPattern: "/actions/arena/**", apiPath: "/actions/arena/**" },
  ]);
});

test("rejects amount and account abuse", async () => {
  const app = createApp(config, new FakeChain(), () => 1_000_000);
  await request(app)
    .get(`/actions/arena/${arena.toBase58()}`)
    .set("origin", "https://evil.example")
    .expect(200);
  await request(app)
    .post(`/actions/arena/${arena.toBase58()}/back/alpha?amount=0.01`)
    .set("origin", "https://evil.example")
    .send({ account: supporter.toBase58() })
    .expect(403);
  await request(app)
    .post(`/actions/arena/${arena.toBase58()}/back/alpha?amount=100`)
    .send({ account: supporter.toBase58() })
    .expect(400);
  await request(app)
    .post(`/actions/arena/${arena.toBase58()}/back/alpha?amount=0.01`)
    .send({ account: "not-a-wallet" })
    .expect(400);
});

test("rejects a valid program account that is not the configured canonical arena", async () => {
  const otherArena = new PublicKey("11111111111111111111111111111111");
  await request(createApp(config, new FakeChain()))
    .get(`/actions/arena/${otherArena.toBase58()}`)
    .expect(404);
});

test("POST returns unsigned wallet transactions", async () => {
  const app = createApp(config, new FakeChain(), () => 1_000_000);
  const back = await request(app)
    .post(`/actions/arena/${arena.toBase58()}/back/beta?amount=0.01`)
    .send({ account: supporter.toBase58() })
    .expect(200);
  const backTransaction = Transaction.from(Buffer.from(back.body.transaction, "base64"));
  assert.equal(backTransaction.feePayer?.toBase58(), supporter.toBase58());
  assert.equal(backTransaction.signatures[0]?.signature, null);
  assert.equal(backTransaction.instructions[0]?.data[8], 1);

  const claim = await request(
    createApp(config, new FakeChain(arenaAccount(2)), () => 1_000_000),
  )
    .post(`/actions/arena/${arena.toBase58()}/claim`)
    .send({ account: supporter.toBase58() })
    .expect(200);
  const claimTransaction = Transaction.from(Buffer.from(claim.body.transaction, "base64"));
  assert.equal(claimTransaction.signatures[0]?.signature, null);
  assert.equal(claimTransaction.instructions.length, 1);
});

test("POST fails closed when backing or claim is not active", async () => {
  await request(createApp(config, new FakeChain(arenaAccount(0, 1_000n)), () => 1_000_000))
    .post(`/actions/arena/${arena.toBase58()}/back/alpha?amount=0.01`)
    .send({ account: supporter.toBase58() })
    .expect(409);

  await request(createApp(config, new FakeChain(arenaAccount(1)), () => 1_000_000))
    .post(`/actions/arena/${arena.toBase58()}/claim`)
    .send({ account: supporter.toBase58() })
    .expect(409);
});
