import { ACTIONS_CORS_HEADERS, createPostResponse } from "@solana/actions";
import type { AccountInfo, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { ActionsConfig } from "./config.js";
import { solToLamports } from "./config.js";
import { backAgentInstruction, claimInstruction, type AgentSide } from "./program.js";

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
  programId: PublicKey,
): Promise<void> {
  const account = await chain.getAccountInfo(arena);
  if (!account || !account.owner.equals(programId)) {
    throw new PublicError("Arena is not an Arena90 V2 on-chain account", 404);
  }
}

export function createApp(config: ActionsConfig, chain: ChainReader) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(express.json({ limit: "8kb", strict: true }));
  app.use((request, response, next) => {
    for (const [name, value] of Object.entries(ACTIONS_CORS_HEADERS)) {
      response.setHeader(name, value);
    }
    const origin = request.get("origin");
    if (origin && !config.allowedOrigins.has(origin)) {
      response.status(403).json({ message: "Origin not allowed" });
      return;
    }
    next();
  });
  app.use(cors({ origin: [...config.allowedOrigins], methods: ["GET", "POST", "OPTIONS"] }));
  app.use(rateLimiter(config.rateLimitPerMinute));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", network: "solana-devnet" });
  });

  app.get("/actions/arena/:arena", async (request, response, next) => {
    try {
      const arena = publicKey(request.params.arena, "arena");
      await requireArena(chain, arena, config.programId);
      const base = `${config.publicBaseUrl}/actions/arena/${arena.toBase58()}`;
      response.json({
        type: "action",
        icon: `${config.frontendOrigin}/media/brand/arena90-mark.png`,
        title: "Back an Arena90 agent",
        description:
          "Support Alpha or Beta with devnet SOL. Supporter funds never affect agent strategy or virtual performance.",
        label: "Choose an agent",
        links: {
          actions: [
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
            {
              type: "transaction",
              href: `${base}/claim`,
              label: "Claim or refund",
            },
          ],
        },
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
      await requireArena(chain, arena, config.programId);
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
      await requireArena(chain, arena, config.programId);
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
