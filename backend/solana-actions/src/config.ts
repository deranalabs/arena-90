import { PublicKey } from "@solana/web3.js";

export interface ActionsConfig {
  port: number;
  rpcUrl: string;
  programId: PublicKey;
  publicBaseUrl: string;
  frontendOrigin: string;
  arenaPageUrl: string;
  arenaAddress: PublicKey;
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

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() !== value) {
    throw new Error(`${name} is required and must not contain surrounding whitespace`);
  }
  return value;
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
  const arenaPageUrl = new URL(
    required("ARENA_PAGE_URL", env.ARENA_PAGE_URL),
  );
  if (
    (arenaPageUrl.protocol !== "https:" && arenaPageUrl.hostname !== "localhost") ||
    arenaPageUrl.origin !== frontendOrigin ||
    arenaPageUrl.username ||
    arenaPageUrl.password ||
    arenaPageUrl.search ||
    arenaPageUrl.hash ||
    !arenaPageUrl.pathname.startsWith("/arena/")
  ) {
    throw new Error("ARENA_PAGE_URL must be a canonical arena path on the frontend origin");
  }
  const arenaAddress = new PublicKey(required("ARENA_ADDRESS", env.ARENA_ADDRESS));
  const allowedOrigins = new Set(
    required("ALLOWED_ORIGINS", env.ALLOWED_ORIGINS)
      .split(",")
      .map((value) => required("ALLOWED_ORIGINS entry", value))
      .map((value) => requiredUrl("ALLOWED_ORIGINS entry", value)),
  );
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

  return {
    port: Number(env.PORT ?? "8787"),
    rpcUrl,
    programId,
    publicBaseUrl,
    frontendOrigin,
    arenaPageUrl: arenaPageUrl.toString(),
    arenaAddress,
    allowedOrigins,
    minBackLamports,
    maxBackLamports,
    rateLimitPerMinute,
    trustProxy: env.TRUST_PROXY === "true",
  };
}
