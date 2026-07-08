import type {
  ActionGetResponse,
  ActionPostRequest,
  LinkedAction,
} from "@solana/actions";

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export type MatchOutcome = "home" | "draw" | "away";

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
  agentId: "isagi" | "aiku";
  matchId: MatchData["matchId"];
  selectedOutcome: MatchOutcome;
  confidenceBps: number;
  stakeLamports: string;
  rationale: string;
  decidedAtUtc: string;
}

export interface BlinkPayload {
  match: MatchData;
  decision: AgentDecision;
  action: ActionGetResponse;
  linkedActions: LinkedAction[];
  postRequest?: ActionPostRequest;
}
