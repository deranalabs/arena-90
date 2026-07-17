import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Keypair } from "@solana/web3.js";

import { loadResolverConfig } from "../src/config.js";

async function fixture(mode = 0o600) {
  const directory = await mkdtemp(join(tmpdir(), "arena90-resolver-config-"));
  const keypairPath = join(directory, "resolver.json");
  const credentialPath = join(directory, "txline.json");
  const resolver = Keypair.generate();
  await writeFile(keypairPath, JSON.stringify([...resolver.secretKey]), { mode });
  await writeFile(
    credentialPath,
    JSON.stringify({
      apiOrigin: "https://txline.example",
      jwt: "jwt-secret",
      apiToken: "api-secret",
    }),
    { mode },
  );
  await chmod(keypairPath, mode);
  await chmod(credentialPath, mode);
  return { keypairPath, credentialPath, resolver };
}

function env(input: Awaited<ReturnType<typeof fixture>>): NodeJS.ProcessEnv {
  return {
    ARENA90_ARENA_ID: "world-cup-2026-spain-argentina-final",
    ARENA90_PERSISTENCE_DIR: "/tmp/arena90-persistence",
    ARENA90_IDL_PATH: "/tmp/arena_escrow.json",
    ARENA90_PROGRAM_ID: "3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ",
    ARENA90_TREASURY: input.resolver.publicKey.toBase58(),
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
    SOLANA_KEYPAIR: input.keypairPath,
    TXLINE_CREDENTIALS_FILE: input.credentialPath,
    TXLINE_PROGRAM_ID: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    RESOLVER_POLL_MS: "5000",
  };
}

test("loads resolver secrets only from owner-only files", async () => {
  const input = await fixture();
  const config = await loadResolverConfig(env(input));
  assert.equal(config.resolver.publicKey.toBase58(), input.resolver.publicKey.toBase58());
  assert.equal(config.txlineCredentials.apiOrigin, "https://txline.example");
  assert.equal(config.pollMs, 5000);
});

test("rejects secret files readable by group or other users", async () => {
  const input = await fixture(0o644);
  await assert.rejects(loadResolverConfig(env(input)), /owner-only file/);
});

test("rejects insecure endpoints and unsafe polling intervals", async () => {
  const input = await fixture();
  await assert.rejects(
    loadResolverConfig({ ...env(input), SOLANA_RPC_URL: "http://rpc.example" }),
    /must use HTTPS/,
  );
  await assert.rejects(
    loadResolverConfig({ ...env(input), RESOLVER_POLL_MS: "100" }),
    /1000 to 60000/,
  );
});
