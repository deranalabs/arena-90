import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import {
  ACTIONS_CORS_HEADERS,
  BLOCKCHAIN_IDS,
  createPostResponse,
  type ActionGetResponse,
  type ActionPostRequest,
  type ActionsJson,
} from "@solana/actions";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ArenaAgentId,
  BlinkPayload,
  ClashAgentDecision,
  ClashState,
} from "./types/arena";

dotenv.config();

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY_PUBLIC_KEY =
  process.env.ARENA_TREASURY_PUBLIC_KEY ??
  "2tH1P25kVNPyTSjWbSwnzm7aw2DcdDbQD1M2g29aZuTr";
const MOCK_USDC_STAKE = 10;
const MOCK_TRANSFER_LAMPORTS = 10_000_000;
const CLASH_STATE_PATH = join(
  __dirname,
  "..",
  "mock",
  "clash-state.json",
);

const app = express();
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const treasury = new PublicKey(TREASURY_PUBLIC_KEY);

app.set("trust proxy", true);
app.use(express.json());

function applyActionsHeaders(response: Response): void {
  for (const [header, value] of Object.entries(ACTIONS_CORS_HEADERS)) {
    response.setHeader(header, value);
  }
  response.setHeader("X-Action-Version", "2.0");
  response.setHeader("X-Blockchain-Ids", BLOCKCHAIN_IDS.devnet);
}

function actionBaseUrl(request: Request): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const host = request.get("host") ?? `localhost:${PORT}`;
  return `${request.protocol}://${host}`;
}

function readClashState(): ClashState {
  return JSON.parse(readFileSync(CLASH_STATE_PATH, "utf-8")) as ClashState;
}

function agentFromQuery(request: { query: Request["query"] }): ArenaAgentId {
  const value = request.query.agent;
  const agent = Array.isArray(value) ? value[0] : value;

  if (agent === "isagi" || agent === "aiku") {
    return agent;
  }

  throw new Error("agent query must be either 'isagi' or 'aiku'");
}

function findAgent(
  state: ClashState,
  agentId: ArenaAgentId,
): ClashAgentDecision {
  const agent = state.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) {
    throw new Error(`clash-state.json is missing agent '${agentId}'`);
  }
  return agent;
}

function buildLinkedActions(
  baseUrl: string,
  state: ClashState,
): NonNullable<ActionGetResponse["links"]> {
  return {
    actions: state.agents.map((agent) => ({
      type: "transaction",
      href: `${baseUrl}/api/actions/arena?agent=${agent.agentId}`,
      label: `Stake ${MOCK_USDC_STAKE} USDC on ${agent.displayName}`,
    })),
  };
}

function buildActionResponse(request: Request, state: ClashState): ActionGetResponse {
  const baseUrl = actionBaseUrl(request);
  const [isagi, aiku] = state.agents;
  const matchup = `${state.match.homeTeam.name} vs ${state.match.awayTeam.name}`;

  return {
    type: "action",
    icon: `${baseUrl}/api/actions/arena/icon.svg`,
    title: `Arena90: ${state.clash.headline}`,
    description:
      `${matchup} | ${state.market.label}. ` +
      `${isagi?.displayName ?? "ISAGI"} backs ${isagi?.prediction ?? "Over 2.5"}; ` +
      `${aiku?.displayName ?? "AIKU"} backs ${aiku?.prediction ?? "Under 2.5"}.`,
    label: "Choose an agent",
    links: buildLinkedActions(baseUrl, state),
  };
}

function buildBlinkPayload(
  request: Request,
  state: ClashState,
  decision: ClashAgentDecision,
): BlinkPayload {
  const action = buildActionResponse(request, state);
  return {
    match: state.match,
    market: state.market,
    decision,
    action,
    linkedActions: action.links?.actions ?? [],
  };
}

app.options(["/actions.json", "/api/actions/arena"], (_request, response) => {
  applyActionsHeaders(response);
  response.status(204).send();
});

app.get("/actions.json", (_request, response) => {
  applyActionsHeaders(response);

  const payload: ActionsJson = {
    rules: [
      {
        pathPattern: "/arena",
        apiPath: "/api/actions/arena",
      },
      {
        pathPattern: "/api/actions/arena",
        apiPath: "/api/actions/arena",
      },
    ],
  };

  response.json(payload);
});

app.get("/api/actions/arena", (request, response) => {
  applyActionsHeaders(response);
  const state = readClashState();
  response.json(buildActionResponse(request, state));
});

app.post(
  "/api/actions/arena",
  async (
    request: Request<unknown, unknown, ActionPostRequest>,
    response: Response,
  ) => {
    applyActionsHeaders(response);

    try {
      const agentId = agentFromQuery(request);
      const account = new PublicKey(request.body.account);
      const state = readClashState();
      const decision = findAgent(state, agentId);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");

      const transaction = new Transaction({
        feePayer: account,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: account,
          toPubkey: treasury,
          lamports: MOCK_TRANSFER_LAMPORTS,
        }),
      );

      const postResponse = await createPostResponse({
        fields: {
          type: "transaction",
          transaction,
          message:
            `Stake ${MOCK_USDC_STAKE} mock USDC on ${decision.displayName} ` +
            `(${decision.prediction}) for ${state.match.homeTeam.name} vs ` +
            `${state.match.awayTeam.name}. Devnet mock transfer: ` +
            `${MOCK_TRANSFER_LAMPORTS / LAMPORTS_PER_SOL} SOL.`,
        },
      });

      response.json(postResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to build action";
      response.status(400).json({ message });
    }
  },
);

app.get("/api/actions/arena/payload", (request, response) => {
  applyActionsHeaders(response);

  try {
    const state = readClashState();
    const decision = findAgent(state, agentFromQuery(request));
    response.json(buildBlinkPayload(request, state, decision));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to build payload";
    response.status(400).json({ message });
  }
});

app.get("/api/actions/arena/icon.svg", (_request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "image/svg+xml");
  response.send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Arena90">
  <rect width="1200" height="630" fill="#080a0f"/>
  <path d="M0 0h600v630H0z" fill="#152bff" opacity=".42"/>
  <path d="M600 0h600v630H600z" fill="#ff243e" opacity=".46"/>
  <path d="M600 48v534" stroke="#f8fafc" stroke-width="4" stroke-dasharray="18 18" opacity=".75"/>
  <circle cx="600" cy="315" r="92" fill="none" stroke="#f8fafc" stroke-width="5" opacity=".8"/>
  <text x="600" y="284" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#f8fafc">ARENA90</text>
  <text x="600" y="362" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#f8fafc">ISAGI VS AIKU</text>
  <text x="300" y="538" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#ffffff">OVER 2.5</text>
  <text x="900" y="538" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#ffffff">UNDER 2.5</text>
</svg>`);
});

const server = app.listen(PORT, () => {
  console.log(`Arena90 Solana Actions API listening on port ${PORT}`);
});
server.ref();

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
