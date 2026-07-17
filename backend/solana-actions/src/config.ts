import { PublicKey } from "@solana/web3.js";

export interface ActionsConfig {
  port: number;
  rpcUrl: string;
  programId: PublicKey;
  publicBaseUrl: string;
  frontendOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  minBackLamports: bigint;
  maxBackLamports: bigint;
  rateLimitPerMinute: number;
  trustProxy: boolean;
}

function requiredUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }
  return url.origin;
}

export function solToLamports(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,9})?$/.test(value)) {
    throw new Error("SOL amount must be a positive decimal with at most 9 decimals");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ActionsConfig {
  const publicBaseUrl = requiredUrl("PUBLIC_BASE_URL", env.PUBLIC_BASE_URL);
  const frontendOrigin = requiredUrl("FRONTEND_ORIGIN", env.FRONTEND_ORIGIN);
  const rpcUrl = requiredUrl("SOLANA_RPC_URL", env.SOLANA_RPC_URL);
  const programId = new PublicKey(env.ARENA90_PROGRAM_ID ?? "");
  const minBackLamports = solToLamports(env.MIN_BACK_SOL ?? "0.001");
  const maxBackLamports = solToLamports(env.MAX_BACK_SOL ?? "1");
  if (minBackLamports <= 0n || maxBackLamports < minBackLamports) {
    throw new Error("Invalid backing bounds");
  }

  const rateLimitPerMinute = Number(env.RATE_LIMIT_PER_MINUTE ?? "60");
  if (!Number.isSafeInteger(rateLimitPerMinute) || rateLimitPerMinute < 1) {
    throw new Error("RATE_LIMIT_PER_MINUTE must be a positive integer");
  }

  const configuredOrigins = (env.ALLOWED_ORIGINS ?? frontendOrigin)
    .split(",")
    .map((origin) => requiredUrl("ALLOWED_ORIGINS entry", origin.trim()));

  return {
    port: Number(env.PORT ?? "8787"),
    rpcUrl,
    programId,
    publicBaseUrl,
    frontendOrigin,
    allowedOrigins: new Set(configuredOrigins),
    minBackLamports,
    maxBackLamports,
    rateLimitPerMinute,
    trustProxy: env.TRUST_PROXY === "true",
  };
}
