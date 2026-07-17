import type {
  CreateTxlineScoreStateReducerInput,
  TxlineMatchStatus,
  TxlineScoreApplyResult,
  TxlineScoreState,
  TxlineScoreStateReducer,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import {
  parseRawScoreEvent,
  type NormalizedTxlineClock,
  type NormalizedTxlineScoreEvent,
} from "./raw.js";
import { structurallyEqual } from "./structural.js";

interface MutableScoreState {
  rawSequence: number;
  timestampMs: number;
  participant1Score?: number;
  participant2Score?: number;
  status: TxlineMatchStatus;
  statusId?: number;
  clock?: NormalizedTxlineClock;
  minute: number;
  addedTime: number;
  suspended: boolean;
  halftimeFinalised: boolean;
  finalised: boolean;
}

function scoreError(): TxlineDataError {
  return new TxlineDataError("INVALID_SCORE_STATE", "Invalid TxLINE score state");
}

function incompleteScoreError(): TxlineDataError {
  return new TxlineDataError(
    "INCOMPLETE_SCORE_STATE",
    "Incomplete TxLINE score state",
  );
}

function validateFixture(
  event: NormalizedTxlineScoreEvent,
  fixture: CreateTxlineScoreStateReducerInput["fixture"],
): void {
  if (
    event.fixtureId !== fixture.fixtureId ||
    (event.participant1Id !== undefined &&
      event.participant1Id !== fixture.participant1Id) ||
    (event.participant2Id !== undefined &&
      event.participant2Id !== fixture.participant2Id) ||
    (event.participant1IsHome !== undefined &&
      event.participant1IsHome !== fixture.participant1IsHome) ||
    (event.startTime !== undefined && event.startTime !== fixture.startTime)
  ) {
    throw new TxlineDataError(
      "FIXTURE_BINDING_MISMATCH",
      "TxLINE score event does not match configured fixture",
    );
  }
}

function calculateMinute(
  statusId: number | undefined,
  clock: NormalizedTxlineClock | undefined,
): number {
  if (statusId === 2 || statusId === 4) {
    if (clock === undefined) throw scoreError();
    const periodMinute = Math.floor((2_700 - clock.seconds) / 60);
    const clamped = Math.min(45, Math.max(0, periodMinute));
    return statusId === 2 ? clamped : 45 + clamped;
  }
  if (statusId === 3) return 45;
  if (statusId === 5 || statusId === 100) return 90;
  return 0;
}

function applyMaterial(
  state: MutableScoreState,
  event: NormalizedTxlineScoreEvent,
): void {
  const previousStatusId = state.statusId;
  const dataStatusId = event.data?.statusId;
  if (
    event.statusId !== undefined &&
    dataStatusId !== undefined &&
    event.statusId !== dataStatusId
  ) {
    throw scoreError();
  }
  const effectiveStatusId = dataStatusId ?? event.statusId;
  const suppliedClock =
    event.action === "clock_adjustment" ? event.data?.clock : event.clock;
  if (
    (effectiveStatusId === 2 || effectiveStatusId === 4) &&
    effectiveStatusId !== previousStatusId &&
    suppliedClock === undefined
  ) {
    throw scoreError();
  }

  if (event.action === "clock_adjustment") {
    if (event.data?.clock === undefined) throw scoreError();
    state.clock = event.data.clock;
  } else if (event.clock !== undefined) {
    state.clock = event.clock;
  }

  if (event.stats?.["1"] !== undefined) {
    state.participant1Score = event.stats["1"];
  }
  if (event.stats?.["2"] !== undefined) {
    state.participant2Score = event.stats["2"];
  }

  if (effectiveStatusId === 5 || effectiveStatusId === 100) {
    if (event.action !== "game_finalised") throw scoreError();
  }
  if (
    event.action === "game_finalised" &&
    effectiveStatusId !== 5 &&
    effectiveStatusId !== 100
  ) {
    throw scoreError();
  }
  if (event.action === "halftime_finalised" && effectiveStatusId !== 3) {
    throw scoreError();
  }

  if (effectiveStatusId !== undefined) {
    if (![1, 2, 3, 4, 5, 18, 100].includes(effectiveStatusId)) {
      throw scoreError();
    }
    if (effectiveStatusId !== 18) state.statusId = effectiveStatusId;
  }

  if (state.statusId === 1 || state.statusId === undefined) {
    state.status = "SCHEDULED";
  } else if (state.statusId === 2 || state.statusId === 4) {
    state.status = "LIVE";
  } else if (state.statusId === 3) {
    state.status = "HALFTIME";
  } else if (state.statusId === 5 || state.statusId === 100) {
    state.status = "FINISHED";
  }

  if (
    (state.statusId === 2 && previousStatusId !== 2) ||
    (state.statusId === 4 && previousStatusId !== 4)
  ) {
    state.addedTime = 0;
  }
  if (event.action === "additional_time") {
    if (event.data?.minutes === undefined) throw scoreError();
    state.addedTime = event.data.minutes;
  }

  state.minute = calculateMinute(state.statusId, state.clock);
  if (event.action === "halftime_finalised") state.halftimeFinalised = true;
  if (event.action === "game_finalised") state.finalised = true;

  const midMatch =
    (state.status === "LIVE" || state.status === "HALFTIME") && !state.finalised;
  const marksSuspended =
    event.action === "suspend" ||
    effectiveStatusId === 18 ||
    ((event.gameState === "disconnected" || event.action === "disconnected") &&
      midMatch) ||
    event.data?.reliable === false ||
    event.data?.locked === true;
  const recovers =
    event.gameState === "connected" ||
    event.action === "connected" ||
    effectiveStatusId === 2 ||
    effectiveStatusId === 3 ||
    effectiveStatusId === 4 ||
    effectiveStatusId === 5;

  if (marksSuspended) {
    state.suspended = true;
  } else if (
    recovers &&
    state.participant1Score !== undefined &&
    state.participant2Score !== undefined &&
    (state.status !== "LIVE" || state.clock !== undefined)
  ) {
    state.suspended = false;
  }

  state.rawSequence = event.seq;
  state.timestampMs = event.timestampMs;
}

function parseEvent(input: unknown): NormalizedTxlineScoreEvent {
  try {
    return parseRawScoreEvent(input);
  } catch {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE score event",
    );
  }
}

export function createTxlineScoreStateReducer(
  input: CreateTxlineScoreStateReducerInput,
): TxlineScoreStateReducer {
  if (!Array.isArray(input.bootstrapEvents) || input.bootstrapEvents.length === 0) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE score bootstrap",
    );
  }

  const parsedEvents = input.bootstrapEvents.map(parseEvent);
  const seen = new Map<number, NormalizedTxlineScoreEvent>();
  const uniqueEvents: NormalizedTxlineScoreEvent[] = [];
  for (const event of parsedEvents) {
    validateFixture(event, input.fixture);
    const existing = seen.get(event.seq);
    if (existing !== undefined && !structurallyEqual(existing, event)) {
      throw new TxlineDataError(
        "SEQUENCE_CONFLICT",
        "Conflicting TxLINE score sequence",
      );
    }
    if (existing === undefined) {
      seen.set(event.seq, event);
      uniqueEvents.push(event);
    }
  }
  uniqueEvents.sort((left, right) => left.seq - right.seq);

  const state: MutableScoreState = {
    rawSequence: -1,
    timestampMs: 0,
    status: "SCHEDULED",
    minute: 0,
    addedTime: 0,
    suspended: false,
    halftimeFinalised: false,
    finalised: false,
  };
  for (const event of uniqueEvents) applyMaterial(state, event);

  function getState(): TxlineScoreState {
    if (
      state.rawSequence < 0 ||
      state.statusId === undefined ||
      state.participant1Score === undefined ||
      state.participant2Score === undefined
    ) {
      throw incompleteScoreError();
    }
    const homeScore = input.fixture.participant1IsHome
      ? state.participant1Score
      : state.participant2Score;
    const awayScore = input.fixture.participant1IsHome
      ? state.participant2Score
      : state.participant1Score;

    return Object.freeze({
      fixtureId: input.fixture.fixtureId,
      rawSequence: state.rawSequence,
      providerSequence: state.rawSequence + 1,
      sourceEventId: `txline-score:${input.fixture.fixtureId}:${state.rawSequence}`,
      timestampMs: state.timestampMs,
      status: state.status,
      minute: state.minute,
      addedTime: state.addedTime,
      homeScore,
      awayScore,
      suspended: state.suspended,
      halftimeFinalised: state.halftimeFinalised,
      finalised: state.finalised,
    });
  }

  return {
    getState,
    apply(eventInput): TxlineScoreApplyResult {
      const event = parseEvent(eventInput);
      validateFixture(event, input.fixture);
      const existing = seen.get(event.seq);
      if (existing !== undefined) {
        if (structurallyEqual(existing, event)) return "DUPLICATE";
        throw new TxlineDataError(
          "SEQUENCE_CONFLICT",
          "Conflicting TxLINE score sequence",
        );
      }
      if (event.seq < state.rawSequence) {
        throw new TxlineDataError(
          "LOWER_UNSEEN_SEQUENCE",
          "Lower unseen TxLINE score sequence",
        );
      }
      if (event.seq !== state.rawSequence + 1) {
        throw new TxlineDataError("SEQUENCE_GAP", "Gap in TxLINE score sequence");
      }

      const candidateState = { ...state };
      applyMaterial(candidateState, event);
      Object.assign(state, candidateState);
      seen.set(event.seq, event);
      return "APPLIED";
    },
  };
}
