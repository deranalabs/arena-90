import type {
  ActionGetResponse,
  ActionPostRequest,
  LinkedAction,
} from "@solana/actions";

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export type MatchOutcome = "home" | "draw" | "away";

export type ArenaAgentId = "isagi" | "aiku";

export type ArenaMarketId = "total_goals_2_5";

export type ArenaMarketPosition = "over_2_5" | "under_2_5";

export type ArenaMarketPrediction = "Over 2.5" | "Under 2.5";

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchTeam {
  name: string;
  fifaCode: string;
}

export interface MatchData {
  matchId: string;
  competition: string;
  season: string;
  venue: string;
  kickoffUtc: string;
  status: MatchStatus;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  odds: MatchOdds;
  impliedProbability: MatchOdds;
  marketUpdatedAtUtc: string;
  source: "txodds-mock" | "txline";
}

export interface AgentDecision {
  agentId: ArenaAgentId;
  displayName: string;
  matchId: MatchData["matchId"];
  marketId: ArenaMarketId;
  prediction: ArenaMarketPrediction;
  position: ArenaMarketPosition;
  selectedOutcome: MatchOutcome;
  confidenceBps: number;
  stakeLamports: string;
  rationale: string;
  decidedAtUtc: string;
}

export interface ArenaMarket {
  id: ArenaMarketId;
  label: string;
  line: number;
  outcomes: ArenaMarketPrediction[];
}

export interface AgentScores {
  homeProbabilityBps: number;
  drawProbabilityBps: number;
  awayProbabilityBps: number;
  attackingPressureBps: number;
  marketBalanceBps: number;
  isagiConfidenceBps: number;
  aikuConfidenceBps: number;
}

export interface ClashAgentDecision extends AgentDecision {
  scores: AgentScores;
  zeroclaw?: {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    usedDeterministicToolDecision: boolean;
  };
}

export interface ClashState {
  schemaVersion: 1;
  source: "zeroclaw";
  generatedAtUtc: string;
  match: MatchData;
  market: ArenaMarket;
  agents: ClashAgentDecision[];
  clash: {
    id: string;
    status: "ready" | "pending" | "resolved";
    headline: string;
    isDeterministic: boolean;
    mockSource: "txodds-mock";
  };
}

export interface BlinkPayload {
  match: MatchData;
  market: ArenaMarket;
  decision: ClashAgentDecision;
  action: ActionGetResponse;
  linkedActions: LinkedAction[];
  postRequest?: ActionPostRequest;
}
