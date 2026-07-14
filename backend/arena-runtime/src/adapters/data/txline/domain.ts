export type TxlineDataErrorCode =
  | "INVALID_PROVIDER_INPUT"
  | "FIXTURE_BINDING_MISMATCH"
  | "NO_APPROVED_MARKET"
  | "INVALID_MARKET"
  | "DUPLICATE_MESSAGE_CONFLICT"
  | "INVALID_SCORE_STATE"
  | "SEQUENCE_CONFLICT"
  | "LOWER_UNSEEN_SEQUENCE"
  | "SEQUENCE_GAP"
  | "INVALID_PROVIDER_CONFIG"
  | "PROVIDER_ABORTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_NETWORK_FAILURE"
  | "PROVIDER_AUTHENTICATION_FAILURE"
  | "PROVIDER_AUTHORIZATION_FAILURE"
  | "PROVIDER_HTTP_FAILURE"
  | "PROVIDER_RESPONSE_LIMIT"
  | "PROVIDER_INVALID_RESPONSE";

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

export interface TxlineHttpRequest {
  readonly method: "GET";
  readonly url: string;
  readonly headers: Readonly<{
    Authorization: string;
    "X-Api-Token": string;
  }>;
  readonly signal: AbortSignal;
  readonly maxResponseBytes: number;
}

export interface TxlineHttpResponse {
  readonly status: number;
  readonly body: string;
  readonly bodyLimitExceeded: boolean;
}

export type TxlineHttpTransport = (
  request: TxlineHttpRequest,
) => Promise<TxlineHttpResponse>;

export type TxlineSseTransport = (
  request: TxlineHttpRequest,
) => AsyncIterable<Uint8Array>;

export type TxlineRetryDelay = (
  delayMs: number,
  signal: AbortSignal,
) => Promise<void>;

export interface TxlineProviderClientConfig {
  readonly baseUrl: string;
  readonly jwt: string;
  readonly apiToken: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxSseEvents: number;
  readonly transport: TxlineHttpTransport;
  readonly sseTransport: TxlineSseTransport;
  readonly retryDelay?: TxlineRetryDelay;
}

export interface TxlineSseEvent {
  readonly cursor?: string;
  readonly event?: string;
  readonly data: unknown;
}

export interface TxlineProviderClient {
  getFixtureSnapshot(signal: AbortSignal): Promise<unknown>;
  getOddsSnapshot(fixtureId: number, signal: AbortSignal): Promise<unknown>;
  getOddsUpdates(fixtureId: number, signal: AbortSignal): Promise<unknown>;
  getScoreSnapshot(fixtureId: number, signal: AbortSignal): Promise<unknown>;
  getScoreStream(
    fixtureId: number,
    signal: AbortSignal,
  ): AsyncIterable<TxlineSseEvent>;
  getHistoricalScoreReplay(
    fixtureId: number,
    signal: AbortSignal,
  ): Promise<readonly TxlineSseEvent[]>;
}

export class TxlineHttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("TxLINE streaming transport returned an HTTP failure");
    this.name = "TxlineHttpStatusError";
    this.status = status;
  }
}
