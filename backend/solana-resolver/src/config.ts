import { readFile, stat } from "node:fs/promises";

import { Keypair, PublicKey } from "@solana/web3.js";

export interface TxlineCredentials {
  readonly apiOrigin: string;
  readonly jwt: string;
  readonly apiToken: string;
}

export interface ResolverConfig {
  readonly arenaId: string;
  readonly persistenceDirectory: string;
  readonly idlPath: string;
  readonly programId: PublicKey;
  readonly treasury: PublicKey;
  readonly rpcUrl: string;
  readonly resolver: Keypair;
  readonly txlineCredentials: TxlineCredentials;
  readonly txlineProgramId: PublicKey;
  readonly pollMs: number;
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value === "" || value.trim() !== value) {
    throw new Error(`${name} is required and must not contain surrounding whitespace`);
  }
  return value;
}

function httpsUrl(name: string, value: string | undefined): string {
  const parsed = new URL(required(name, value));
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return parsed.origin;
}

async function readOwnerOnlyJson(path: string, label: string): Promise<unknown> {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    throw new Error(`${label} must be a regular owner-only file (mode 0600)`);
  }
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object`);
  }
  return value as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, name: string): string {
  const value = input[name];
  if (typeof value !== "string" || value === "" || value.trim() !== value) {
    throw new Error(`Credential field ${name} is invalid`);
  }
  return value;
}

export async function loadResolverConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolverConfig> {
  const keypairPath = required("SOLANA_KEYPAIR", env["SOLANA_KEYPAIR"]);
  const credentialPath = required(
    "TXLINE_CREDENTIALS_FILE",
    env["TXLINE_CREDENTIALS_FILE"],
  );
  const secretInput = await readOwnerOnlyJson(keypairPath, "SOLANA_KEYPAIR");
  if (
    !Array.isArray(secretInput) ||
    secretInput.length !== 64 ||
    !secretInput.every(
      (value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255,
    )
  ) {
    throw new Error("SOLANA_KEYPAIR must contain a 64-byte JSON secret array");
  }
  const resolver = Keypair.fromSecretKey(Uint8Array.from(secretInput as number[]));

  const credentialInput = record(
    await readOwnerOnlyJson(credentialPath, "TXLINE_CREDENTIALS_FILE"),
    "TXLINE_CREDENTIALS_FILE",
  );
  const apiOrigin = httpsUrl(
    "TxLINE apiOrigin",
    stringField(credentialInput, "apiOrigin"),
  );
  const pollMs = Number(env["RESOLVER_POLL_MS"] ?? "5000");
  if (!Number.isSafeInteger(pollMs) || pollMs < 1_000 || pollMs > 60_000) {
    throw new Error("RESOLVER_POLL_MS must be an integer from 1000 to 60000");
  }

  return Object.freeze({
    arenaId: required("ARENA90_ARENA_ID", env["ARENA90_ARENA_ID"]),
    persistenceDirectory: required(
      "ARENA90_PERSISTENCE_DIR",
      env["ARENA90_PERSISTENCE_DIR"],
    ),
    idlPath: required("ARENA90_IDL_PATH", env["ARENA90_IDL_PATH"]),
    programId: new PublicKey(
      required("ARENA90_PROGRAM_ID", env["ARENA90_PROGRAM_ID"]),
    ),
    treasury: new PublicKey(
      required("ARENA90_TREASURY", env["ARENA90_TREASURY"]),
    ),
    rpcUrl: httpsUrl("SOLANA_RPC_URL", env["SOLANA_RPC_URL"]),
    resolver,
    txlineCredentials: Object.freeze({
      apiOrigin,
      jwt: stringField(credentialInput, "jwt"),
      apiToken: stringField(credentialInput, "apiToken"),
    }),
    txlineProgramId: new PublicKey(
      required("TXLINE_PROGRAM_ID", env["TXLINE_PROGRAM_ID"]),
    ),
    pollMs,
  });
}
