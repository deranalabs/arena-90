import assert from "node:assert/strict";
import test from "node:test";
import type { AccountInfo, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import request from "supertest";
import { createApp, type ChainReader } from "../src/app.js";
import { solToLamports, type ActionsConfig } from "../src/config.js";
import { backAgentInstruction, claimInstruction, derivePosition, deriveVault } from "../src/program.js";

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const arena = new PublicKey("7eFCWjKnPVs5ovXhgnEkckby93oEPzbYXM9e6raSoi7b");
const supporter = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const config: ActionsConfig = {
  port: 8787,
  rpcUrl: "https://api.devnet.solana.com",
  programId,
  publicBaseUrl: "https://api.example.com",
  frontendOrigin: "https://arena-90.vercel.app",
  allowedOrigins: new Set(["https://arena-90.vercel.app"]),
  minBackLamports: 1_000_000n,
  maxBackLamports: 1_000_000_000n,
  rateLimitPerMinute: 60,
  trustProxy: false,
};

const arenaAccount: AccountInfo<Buffer> = {
  data: Buffer.alloc(8),
  executable: false,
  lamports: 1,
  owner: programId,
  rentEpoch: 0,
};

class FakeChain implements ChainReader {
  constructor(private readonly account: AccountInfo<Buffer> | null = arenaAccount) {}

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

test("GET exposes Back Alpha, Back Beta, and Claim only for owned arenas", async () => {
  const app = createApp(config, new FakeChain());
  const response = await request(app).get(`/actions/arena/${arena.toBase58()}`).expect(200);
  assert.equal(response.body.type, "action");
  assert.deepEqual(
    response.body.links.actions.map((action: { label: string }) => action.label),
    ["Back Alpha", "Back Beta", "Claim or refund"],
  );

  await request(createApp(config, new FakeChain(null)))
    .get(`/actions/arena/${arena.toBase58()}`)
    .expect(404);
});

test("rejects hostile origins and amount/account abuse", async () => {
  const app = createApp(config, new FakeChain());
  await request(app)
    .get(`/actions/arena/${arena.toBase58()}`)
    .set("origin", "https://evil.example")
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

test("POST returns unsigned wallet transactions", async () => {
  const app = createApp(config, new FakeChain());
  const back = await request(app)
    .post(`/actions/arena/${arena.toBase58()}/back/beta?amount=0.01`)
    .send({ account: supporter.toBase58() })
    .expect(200);
  const backTransaction = Transaction.from(Buffer.from(back.body.transaction, "base64"));
  assert.equal(backTransaction.feePayer?.toBase58(), supporter.toBase58());
  assert.equal(backTransaction.signatures[0]?.signature, null);
  assert.equal(backTransaction.instructions[0]?.data[8], 1);

  const claim = await request(app)
    .post(`/actions/arena/${arena.toBase58()}/claim`)
    .send({ account: supporter.toBase58() })
    .expect(200);
  const claimTransaction = Transaction.from(Buffer.from(claim.body.transaction, "base64"));
  assert.equal(claimTransaction.signatures[0]?.signature, null);
  assert.equal(claimTransaction.instructions.length, 1);
});
