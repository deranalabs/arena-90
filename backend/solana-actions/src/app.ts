import { ACTIONS_CORS_HEADERS, createPostResponse } from "@solana/actions";
import type { AccountInfo, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ActionsConfig } from "./config.js";
import { solToLamports } from "./config.js";
import {
  backAgentInstruction,
  claimInstruction,
  decodeArenaLifecycle,
  type AgentSide,
  type ArenaLifecycle,
} from "./program.js";

export interface ChainReader {
  getAccountInfo(address: PublicKey): Promise<AccountInfo<Buffer> | null>;
  getLatestBlockhash(): Promise<BlockhashWithExpiryBlockHeight>;
}

class PublicError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function publicKey(value: unknown, label: string): PublicKey {
  if (typeof value !== "string") throw new PublicError(`${label} is required`, 400);
  try {
    return new PublicKey(value);
  } catch {
    throw new PublicError(`${label} is not a valid Solana address`, 400);
  }
}

function rateLimiter(limit: number) {
  const buckets = new Map<string, { minute: number; count: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const minute = Math.floor(Date.now() / 60_000);
    const key = request.ip ?? "unknown";
    const current = buckets.get(key);
    const bucket = current?.minute === minute ? current : { minute, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      response.status(429).json({ message: "Too many requests" });
      return;
    }
    next();
  };
}

async function requireArena(
  chain: ChainReader,
  arena: PublicKey,
  config: Pick<ActionsConfig, "arenaAddress" | "programId">,
): Promise<ArenaLifecycle> {
  if (!arena.equals(config.arenaAddress)) {
    throw new PublicError("Arena is not the configured canonical Arena90 arena", 404);
  }
  const account = await chain.getAccountInfo(arena);
  if (!account || !account.owner.equals(config.programId)) {
    throw new PublicError("Arena is not an Arena90 V2 on-chain account", 404);
  }
  try {
    return decodeArenaLifecycle(account.data);
  } catch {
    throw new PublicError("Arena account data is invalid", 502);
  }
}

export function createApp(
  config: ActionsConfig,
  chain: ChainReader,
  now: () => number = Date.now,
) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(express.json({ limit: "8kb", strict: true }));
  app.use((request, response, next) => {
    for (const [name, value] of Object.entries(ACTIONS_CORS_HEADERS)) {
      response.setHeader(name, value);
    }
    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }
    next();
  });
  app.use(rateLimiter(config.rateLimitPerMinute));
  app.use((request, response, next) => {
    if (request.method !== "POST") {
      next();
      return;
    }
    const origin = request.headers.origin;
    // Browser-origin defense only: server-side Blink clients may omit Origin.
    // Canonical arena binding, schema checks, unsigned transactions, and rate
    // limits remain the authorization boundary for those requests.
    if (origin !== undefined && !config.allowedOrigins.has(origin)) {
      response.status(403).json({ message: "Origin is not allowed" });
      return;
    }
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", network: "solana-devnet" });
  });

  app.get("/actions.json", (_request, response) => {
    response.json({
      rules: [
        {
          pathPattern: "/actions/arena/**",
          apiPath: "/actions/arena/**",
        },
      ],
    });
  });

  app.get("/actions/arena/:arena", async (request, response, next) => {
    try {
      const arena = publicKey(request.params.arena, "arena");
      const lifecycle = await requireArena(chain, arena, config);
      const base = `${config.publicBaseUrl}/actions/arena/${arena.toBase58()}`;
      const backingOpen =
        lifecycle.state === "OPEN" &&
        BigInt(Math.floor(now() / 1_000)) < lifecycle.backingDeadlineUnix;
      const claimOpen =
        lifecycle.state === "SETTLED" || lifecycle.state === "VOID";
      const lifecycleActions = backingOpen
        ? [
            {
              type: "transaction",
              href: `${base}/back/alpha?amount={amount}`,
              label: "Back Alpha",
              parameters: [
                {
                  name: "amount",
                  label: "Devnet SOL",
                  type: "number",
                  required: true,
                  min: Number(config.minBackLamports) / 1e9,
                  max: Number(config.maxBackLamports) / 1e9,
                },
              ],
            },
            {
              type: "transaction",
              href: `${base}/back/beta?amount={amount}`,
              label: "Back Beta",
              parameters: [
                {
                  name: "amount",
                  label: "Devnet SOL",
                  type: "number",
                  required: true,
                  min: Number(config.minBackLamports) / 1e9,
                  max: Number(config.maxBackLamports) / 1e9,
                },
              ],
            },
          ]
        : claimOpen
          ? [
              {
                type: "transaction",
                href: `${base}/claim`,
                label: "Claim or refund",
              },
            ]
          : [];
      const actions = [
        ...lifecycleActions,
        {
          type: "external-link",
          href: config.arenaPageUrl,
          label: "View Arena",
        },
      ];
      response.json({
        type: "action",
        icon: `${config.frontendOrigin}/media/brand/arena90-mark.png`,
        title: "Back an Arena90 agent",
        description:
          "Support Alpha or Beta with devnet SOL. Supporter funds never affect agent strategy or virtual performance.",
        label: backingOpen
          ? "Choose an agent"
          : claimOpen
            ? "Claim supporter funds"
            : "Backing closed",
        disabled: false,
        links: { actions },
        ...(lifecycleActions.length === 0
          ? { error: { message: "Backing is closed; settlement is pending." } }
          : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/actions/arena/:arena/back/:side", async (request, response, next) => {
    try {
      const arena = publicKey(request.params.arena, "arena");
      const supporter = publicKey(request.body?.account, "account");
      const side = request.params.side;
      if (side !== "alpha" && side !== "beta") {
        throw new PublicError("side must be alpha or beta", 400);
      }
      if (typeof request.query.amount !== "string") {
        throw new PublicError("amount is required", 400);
      }
      let lamports: bigint;
      try {
        lamports = solToLamports(request.query.amount);
      } catch {
        throw new PublicError("amount is not a valid SOL value", 400);
      }
      if (lamports < config.minBackLamports || lamports > config.maxBackLamports) {
        throw new PublicError("amount is outside allowed bounds", 400);
      }
      const lifecycle = await requireArena(chain, arena, config);
      if (
        lifecycle.state !== "OPEN" ||
        BigInt(Math.floor(now() / 1_000)) >= lifecycle.backingDeadlineUnix
      ) {
        throw new PublicError("Backing is closed", 409);
      }
      const { blockhash } = await chain.getLatestBlockhash();
      const transaction = new Transaction({ feePayer: supporter, recentBlockhash: blockhash }).add(
        backAgentInstruction({
          programId: config.programId,
          arena,
          supporter,
          side: side as AgentSide,
          lamports,
        }),
      );
      response.json(
        await createPostResponse({
          fields: {
            type: "transaction",
            transaction,
            message: `Back ${side === "alpha" ? "Alpha" : "Beta"} with ${request.query.amount} devnet SOL`,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/actions/arena/:arena/claim", async (request, response, next) => {
    try {
      const arena = publicKey(request.params.arena, "arena");
      const supporter = publicKey(request.body?.account, "account");
      const lifecycle = await requireArena(chain, arena, config);
      if (lifecycle.state !== "SETTLED" && lifecycle.state !== "VOID") {
        throw new PublicError("Claim is not available yet", 409);
      }
      const { blockhash } = await chain.getLatestBlockhash();
      const transaction = new Transaction({ feePayer: supporter, recentBlockhash: blockhash }).add(
        claimInstruction({ programId: config.programId, arena, supporter }),
      );
      response.json(
        await createPostResponse({
          fields: {
            type: "transaction",
            transaction,
            message: "Claim Arena90 supporter payout or refund",
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof PublicError) {
      response.status(error.status).json({ message: error.message });
      return;
    }
    response.status(500).json({ message: "Action could not be created" });
  });
  return app;
}
