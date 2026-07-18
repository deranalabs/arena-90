import { createHash } from "node:crypto";

import {
  CHECKPOINT_IDS,
  type ArenaAssetId,
  type CheckpointId,
} from "../../../contracts/index.js";
import type {
  NormalizedTxlineFixture,
  SelectedTxlineMarket,
  TxlineScoreState,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { selectTxlineMarket } from "./market.js";
import {
  fixtureBindingSchema,
  parseRawOddsEndpoint,
  parseRawScoreEvent,
} from "./raw.js";
import { createTxlineScoreStateReducer } from "./score-state.js";

interface CompileRecordedTxlineFixtureInput {
  readonly arenaId: string;
  readonly fixture: NormalizedTxlineFixture;
  readonly scoreEvents: unknown;
  readonly oddsUpdates: unknown;
  readonly capturedAtUtc: string;
}

interface RecordedCheckpoint {
  readonly providerSequence: number;
  readonly checkpointId: CheckpointId;
  readonly snapshotId: string;
  readonly sourceEventId: string;
  readonly marketMessageId: string;
  readonly observedAtUtc: string;
  readonly match: Readonly<{
    status: TxlineScoreState["status"];
    minute: number;
    addedTime: number;
    homeScore: number;
    awayScore: number;
  }>;
  readonly priceMicros: Readonly<{ HOME: number; DRAW: number; AWAY: number }>;
  readonly freshness: Readonly<{
    marketUpdatedAtUtc: string;
    delayed: true;
    suspended: boolean;
  }>;
  readonly finalResult?: ArenaAssetId;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function eligible(checkpointId: CheckpointId, state: TxlineScoreState): boolean {
  switch (checkpointId) {
    case "KICKOFF":
      return state.status === "LIVE" && state.minute <= 14;
    case "M15":
      return state.status === "LIVE" && state.minute >= 15 && state.minute <= 29;
    case "M30":
      return state.status === "LIVE" && state.minute >= 30 && state.minute <= 44;
    case "HALFTIME":
      return state.status === "HALFTIME" && state.halftimeFinalised;
    case "M60":
      return state.status === "LIVE" && state.minute >= 60 && state.minute <= 74;
    case "M75":
      return state.status === "LIVE" && state.minute >= 75 && state.minute <= 90;
    case "FINAL":
      return state.status === "FINISHED" && state.finalised && !state.suspended;
  }
}

function resultFrom(state: TxlineScoreState): ArenaAssetId {
  if (state.homeScore > state.awayScore) return "HOME";
  if (state.awayScore > state.homeScore) return "AWAY";
  return "DRAW";
}

function snapshotId(
  arenaId: string,
  checkpointId: CheckpointId,
  sourceEventId: string,
  marketMessageId: string,
): string {
  return hash({ arenaId, checkpointId, sourceEventId, marketMessageId });
}

export function compileRecordedTxlineFixture(
  input: CompileRecordedTxlineFixtureInput,
) {
  if (
    typeof input.arenaId !== "string" ||
    input.arenaId.trim() !== input.arenaId ||
    input.arenaId === "" ||
    !fixtureBindingSchema.safeParse(input.fixture).success ||
    Number.isNaN(Date.parse(input.capturedAtUtc)) ||
    !Array.isArray(input.scoreEvents)
  ) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE recording compiler input",
    );
  }

  let scoreEvents;
  let oddsUpdates;
  try {
    scoreEvents = input.scoreEvents
      .map((raw) => ({ raw, normalized: parseRawScoreEvent(raw) }))
      .sort((left, right) => left.normalized.seq - right.normalized.seq);
    oddsUpdates = parseRawOddsEndpoint(input.oddsUpdates).sort((left, right) => {
      if (left.Ts !== right.Ts) return left.Ts - right.Ts;
      return left.MessageId.localeCompare(right.MessageId);
    });
  } catch {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE historical recording input",
    );
  }
  const first = scoreEvents[0];
  if (first === undefined) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "TxLINE historical recording has no score events",
    );
  }

  const reducer = createTxlineScoreStateReducer({
    fixture: input.fixture,
    bootstrapEvents: [first.raw],
  });
  const records: RecordedCheckpoint[] = [];
  let checkpointIndex = 0;
  let lastDecisionMarket: SelectedTxlineMarket | undefined;

  for (const [index, scoreEvent] of scoreEvents.entries()) {
    if (index > 0) {
      try {
        reducer.apply(scoreEvent.raw);
      } catch (error) {
        if (error instanceof TxlineDataError) {
          throw new TxlineDataError(
            error.code,
            `${error.message} at historical sequence ${scoreEvent.normalized.seq}`,
          );
        }
        throw error;
      }
    }
    const checkpointId = CHECKPOINT_IDS[checkpointIndex];
    if (checkpointId === undefined) break;

    let state: TxlineScoreState;
    try {
      state = reducer.getState();
    } catch (error) {
      if (
        error instanceof TxlineDataError &&
        error.code === "INCOMPLETE_SCORE_STATE"
      ) {
        continue;
      }
      throw error;
    }
    if (!eligible(checkpointId, state)) continue;

    const historicalMarket = oddsUpdates
      .filter(
        (row) =>
          row.Ts <= state.timestampMs &&
          row.FixtureId === input.fixture.fixtureId &&
          row.BookmakerId === 10_021 &&
          row.Bookmaker === "TXLineStablePriceDemargined" &&
          row.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
          (row.MarketPeriod === null || row.MarketPeriod === undefined) &&
          (row.MarketParameters === null || row.MarketParameters === undefined),
      )
      .sort((left, right) => {
        if (left.Ts !== right.Ts) return right.Ts - left.Ts;
        return right.MessageId.localeCompare(left.MessageId);
      })[0];
    let market: SelectedTxlineMarket;
    try {
      market = selectTxlineMarket({
        fixture: input.fixture,
        snapshot: [],
        updates: historicalMarket === undefined ? [] : [historicalMarket],
      });
    } catch (error) {
      if (
        error instanceof TxlineDataError &&
        (error.code === "NO_APPROVED_MARKET" || error.code === "INVALID_MARKET")
      ) {
        if (checkpointId === "FINAL" && lastDecisionMarket !== undefined) {
          market = lastDecisionMarket;
        } else {
          continue;
        }
      } else {
        throw error;
      }
    }
    if (checkpointId !== "FINAL") lastDecisionMarket = market;

    const observedAtUtc = new Date(state.timestampMs).toISOString();
    const record: RecordedCheckpoint = {
      providerSequence: state.providerSequence,
      checkpointId,
      snapshotId: snapshotId(
        input.arenaId,
        checkpointId,
        state.sourceEventId,
        market.messageId,
      ),
      sourceEventId: state.sourceEventId,
      marketMessageId: market.messageId,
      observedAtUtc,
      match: {
        status: state.status,
        minute: state.minute,
        addedTime: state.addedTime,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
      },
      priceMicros: market.priceMicros,
      freshness: {
        marketUpdatedAtUtc: new Date(market.timestampMs).toISOString(),
        delayed: true,
        suspended: state.suspended,
      },
      ...(checkpointId === "FINAL" ? { finalResult: resultFrom(state) } : {}),
    };
    records.push(record);
    checkpointIndex += 1;
  }

  if (records.length !== CHECKPOINT_IDS.length) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      `TxLINE historical recording lacks an approved checkpoint after ${records
        .map((record) => record.checkpointId)
        .join(",")}`,
    );
  }

  return {
    provider: "TXLINE_RECORDED" as const,
    arenaId: input.arenaId,
    fixtureId: String(input.fixture.fixtureId),
    provenance: {
      source: "TXLINE_HISTORICAL_API" as const,
      sourceFixtureId: input.fixture.fixtureId,
      sourceKickoffUtc: new Date(input.fixture.startTime).toISOString(),
      capturedAtUtc: new Date(input.capturedAtUtc).toISOString(),
      scoreEventCount: scoreEvents.length,
      oddsUpdateCount: oddsUpdates.length,
      inputHash: hash({
        fixture: input.fixture,
        scoreEvents: scoreEvents.map(({ normalized }) => normalized),
        oddsUpdates,
      }),
    },
    records,
  };
}
