import { createHash } from "node:crypto";

import {
  CHECKPOINT_IDS,
  type ArenaAssetId,
  type CheckpointId,
} from "../../../contracts/index.js";
import type {
  NormalizedTxlineFixture,
  TxlineScoreState,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { createHistoricalMarketReducer } from "./historical-market.js";
import {
  fixtureBindingSchema,
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
  readonly marketAvailable: boolean;
  readonly observedAtUtc: string;
  readonly match: Readonly<{
    status: TxlineScoreState["status"];
    minute: number;
    addedTime: number;
    homeScore: number;
    awayScore: number;
  }>;
  readonly providerPrices?: Readonly<{ HOME: number; DRAW: number; AWAY: number }>;
  readonly priceMicros?: Readonly<{ HOME: number; DRAW: number; AWAY: number }>;
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
  try {
    scoreEvents = input.scoreEvents
      .map((raw) => ({ raw, normalized: parseRawScoreEvent(raw) }));
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
  for (const [index, scoreEvent] of scoreEvents.entries()) {
    if (scoreEvent.normalized.seq !== index) {
      throw new TxlineDataError(
        "INVALID_PROVIDER_INPUT",
        `Invalid historical score sequence at capture index ${index}`,
      );
    }
  }

  const historicalMarkets = createHistoricalMarketReducer(
    input.fixture,
    input.oddsUpdates,
  );

  const reducer = createTxlineScoreStateReducer({
    fixture: input.fixture,
    bootstrapEvents: [first.raw],
    semantics: "HISTORICAL_REPLAY",
  });
  const records: RecordedCheckpoint[] = [];
  let checkpointIndex = 0;

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

    const market = historicalMarkets.advanceThrough(state.timestampMs);
    if (market === undefined || (!market.available && checkpointId !== "FINAL")) {
      continue;
    }

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
      marketAvailable: market.available,
      observedAtUtc,
      match: {
        status: state.status,
        minute: state.minute,
        addedTime: state.addedTime,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
      },
      ...(market.providerPrices === undefined
        ? {}
        : { providerPrices: market.providerPrices }),
      ...(market.priceMicros === undefined ? {} : { priceMicros: market.priceMicros }),
      freshness: {
        marketUpdatedAtUtc: new Date(market.timestampMs).toISOString(),
        delayed: true,
        suspended: state.suspended || !market.available,
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
      oddsUpdateCount: historicalMarkets.count,
      inputHash: hash({
        fixture: input.fixture,
        scoreEvents: scoreEvents.map(({ normalized }) => normalized),
        oddsUpdates: input.oddsUpdates,
      }),
    },
    records,
  };
}
