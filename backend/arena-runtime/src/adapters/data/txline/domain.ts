export type TxlineDataErrorCode =
  | "INVALID_PROVIDER_INPUT"
  | "FIXTURE_BINDING_MISMATCH"
  | "NO_APPROVED_MARKET"
  | "INVALID_MARKET"
  | "DUPLICATE_MESSAGE_CONFLICT"
  | "INVALID_SCORE_STATE"
  | "SEQUENCE_CONFLICT"
  | "LOWER_UNSEEN_SEQUENCE"
  | "SEQUENCE_GAP";

export class TxlineDataError extends Error {
  readonly code: TxlineDataErrorCode;

  constructor(code: TxlineDataErrorCode, message: string) {
    super(message);
    this.name = "TxlineDataError";
    this.code = code;
  }
}

export interface TxlineFixtureBinding {
  readonly fixtureId: number;
  readonly participant1Id: number;
  readonly participant2Id: number;
  readonly participant1IsHome: boolean;
  readonly startTime: number;
}

export type NormalizedTxlineFixture = Readonly<TxlineFixtureBinding>;

export interface SelectTxlineMarketInput {
  readonly fixture: NormalizedTxlineFixture;
  readonly snapshot: unknown;
  readonly updates: unknown;
}

export interface SelectedTxlineMarket {
  readonly fixtureId: number;
  readonly messageId: string;
  readonly timestampMs: number;
  readonly priceMicros: Readonly<{
    HOME: number;
    DRAW: number;
    AWAY: number;
  }>;
}

export type TxlineScoreApplyResult = "APPLIED" | "DUPLICATE";
export type TxlineMatchStatus = "SCHEDULED" | "LIVE" | "HALFTIME" | "FINISHED";

export interface TxlineScoreState {
  readonly fixtureId: number;
  readonly rawSequence: number;
  readonly providerSequence: number;
  readonly sourceEventId: string;
  readonly timestampMs: number;
  readonly status: TxlineMatchStatus;
  readonly minute: number;
  readonly addedTime: number;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly suspended: boolean;
  readonly halftimeFinalised: boolean;
  readonly finalised: boolean;
}

export interface CreateTxlineScoreStateReducerInput {
  readonly fixture: NormalizedTxlineFixture;
  readonly bootstrapEvents: unknown;
}

export interface TxlineScoreStateReducer {
  getState(): TxlineScoreState;
  apply(event: unknown): TxlineScoreApplyResult;
}
