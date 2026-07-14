import { createHash } from "node:crypto";

import {
  calculateSnapshotHash,
  canonicalSnapshotSchema,
  type ArenaAssetId,
  type CanonicalSnapshot,
  type CheckpointId,
  type DecisionCheckpointId,
} from "../../../contracts/index.js";
import type {
  NormalizedTxlineFixture,
  SelectedTxlineMarket,
  TxlineLiveDataAdapter,
  TxlineLiveDataAdapterConfig,
  TxlineScoreState,
  TxlineScoreStateReducer,
} from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { validateTxlineFixtureBinding } from "./fixture.js";
import { selectTxlineMarket } from "./market.js";
import { fixtureBindingSchema } from "./raw.js";
import { createTxlineScoreStateReducer } from "./score-state.js";

const MAX_MARKET_AGE_MS = 300_000;
const MAX_FUTURE_SKEW_MS = 30_000;

function invalidInput(message: string): TxlineDataError {
  return new TxlineDataError("INVALID_PROVIDER_INPUT", message);
}

function selectFixture(
  input: unknown,
  binding: TxlineLiveDataAdapterConfig["fixtureBinding"],
): NormalizedTxlineFixture {
  if (!Array.isArray(input)) {
    throw invalidInput("Invalid TxLINE fixture snapshot");
  }

  const matches: NormalizedTxlineFixture[] = [];
  for (const row of input) {
    try {
      matches.push(validateTxlineFixtureBinding(row, binding));
    } catch (error) {
      if (
        error instanceof TxlineDataError &&
        error.code === "FIXTURE_BINDING_MISMATCH"
      ) {
        continue;
      }
      throw invalidInput("Invalid TxLINE fixture snapshot");
    }
  }
  if (matches.length !== 1) {
    throw invalidInput("Invalid TxLINE fixture snapshot");
  }
  return matches[0] as NormalizedTxlineFixture;
}

function isCheckpointEligible(
  checkpointId: CheckpointId,
  state: TxlineScoreState,
): boolean {
  switch (checkpointId) {
    case "KICKOFF":
      return state.status === "LIVE" && state.minute >= 0 && state.minute <= 14;
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
      return (
        state.status === "FINISHED" && state.finalised && !state.suspended
      );
  }
}

function toUtc(timestampMs: number): string {
  try {
    return new Date(timestampMs).toISOString();
  } catch {
    throw invalidInput("Invalid TxLINE timestamp");
  }
}

function calculateSnapshotId(
  arenaId: string,
  checkpointId: DecisionCheckpointId,
  sourceEventId: string,
  oddsMessageId: string,
): string {
  const serialized =
    `{"arenaId":${JSON.stringify(arenaId)}` +
    `,"checkpointId":${JSON.stringify(checkpointId)}` +
    `,"sourceEventId":${JSON.stringify(sourceEventId)}` +
    `,"oddsMessageId":${JSON.stringify(oddsMessageId)}}`;
  return createHash("sha256").update(serialized).digest("hex");
}

function validateFreshness(market: SelectedTxlineMarket, nowMs: number): void {
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    nowMs - market.timestampMs > MAX_MARKET_AGE_MS ||
    market.timestampMs - nowMs > MAX_FUTURE_SKEW_MS
  ) {
    throw new TxlineDataError("INVALID_MARKET", "Invalid selected TxLINE market");
  }
}

export function createTxlineLiveDataAdapter(
  config: TxlineLiveDataAdapterConfig,
): TxlineLiveDataAdapter {
  if (
    typeof config !== "object" ||
    config === null ||
    typeof config.arenaId !== "string" ||
    config.arenaId.trim() !== config.arenaId ||
    config.arenaId === "" ||
    !fixtureBindingSchema.safeParse(config.fixtureBinding).success ||
    typeof config.delayed !== "boolean" ||
    typeof config.client !== "object" ||
    config.client === null ||
    typeof config.nowMs !== "function"
  ) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_CONFIG",
      "Invalid TxLINE live adapter configuration",
    );
  }

  const arenaId = config.arenaId;
  const fixtureBinding = Object.freeze(
    fixtureBindingSchema.parse(config.fixtureBinding),
  );
  const delayed = config.delayed;
  const client = config.client;
  const nowMs = config.nowMs;

  let fixture: NormalizedTxlineFixture | undefined;
  let scoreReducer: TxlineScoreStateReducer | undefined;
  let scoreEvents: unknown[] | undefined;
  let finalResult: ArenaAssetId | undefined;
  let refreshInFlight = false;
  const snapshots = new Map<DecisionCheckpointId, CanonicalSnapshot>();

  async function bootstrap(signal: AbortSignal): Promise<void> {
    if (
      fixture !== undefined &&
      scoreReducer !== undefined &&
      scoreEvents !== undefined
    ) {
      return;
    }
    const [fixtureSnapshot, scoreSnapshot] = await Promise.all([
      client.getFixtureSnapshot(signal),
      client.getScoreSnapshot(fixtureBinding.fixtureId, signal),
    ]);
    const candidateFixture = selectFixture(fixtureSnapshot, fixtureBinding);
    const candidateReducer = createTxlineScoreStateReducer({
      fixture: candidateFixture,
      bootstrapEvents: scoreSnapshot,
    });
    candidateReducer.getState();
    fixture = candidateFixture;
    scoreReducer = candidateReducer;
    scoreEvents = [...(scoreSnapshot as unknown[])];
  }

  async function eligibleState(
    checkpointId: CheckpointId,
    signal: AbortSignal,
  ): Promise<TxlineScoreState> {
    await bootstrap(signal);
    if (
      fixture === undefined ||
      scoreReducer === undefined ||
      scoreEvents === undefined
    ) {
      throw invalidInput("TxLINE score state unavailable");
    }
    let activeReducer = scoreReducer;
    let activeEvents = scoreEvents;
    let state = activeReducer.getState();
    if (isCheckpointEligible(checkpointId, state)) return state;
    let resyncUsed = false;

    for await (const event of client.getScoreStream(
      fixtureBinding.fixtureId,
      signal,
    )) {
      if (signal.aborted) {
        throw new TxlineDataError("PROVIDER_ABORTED", "TxLINE provider request aborted");
      }
      const streamedEventData = event.data;
      try {
        if (activeReducer.apply(streamedEventData) === "APPLIED") {
          activeEvents.push(streamedEventData);
        }
      } catch (error) {
        if (
          !(error instanceof TxlineDataError) ||
          error.code !== "SEQUENCE_GAP" ||
          resyncUsed
        ) {
          throw error;
        }
        resyncUsed = true;
        const replay = await client.getHistoricalScoreReplay(
          fixtureBinding.fixtureId,
          signal,
        );
        if (replay.length === 0) {
          throw invalidInput("Invalid TxLINE historical score replay");
        }
        const candidateEvents: unknown[] = [...activeEvents];
        const candidateReducer = createTxlineScoreStateReducer({
          fixture,
          bootstrapEvents: candidateEvents,
        });
        for (const replayEvent of replay) {
          if (signal.aborted) {
            throw new TxlineDataError(
              "PROVIDER_ABORTED",
              "TxLINE provider request aborted",
            );
          }
          const replayEventData = replayEvent.data;
          const replayResult = candidateReducer.apply(replayEventData);
          if (signal.aborted) {
            throw new TxlineDataError(
              "PROVIDER_ABORTED",
              "TxLINE provider request aborted",
            );
          }
          if (replayResult === "APPLIED") {
            candidateEvents.push(replayEventData);
          }
        }
        const triggeringResult = candidateReducer.apply(streamedEventData);
        if (signal.aborted) {
          throw new TxlineDataError(
            "PROVIDER_ABORTED",
            "TxLINE provider request aborted",
          );
        }
        if (triggeringResult === "APPLIED") {
          candidateEvents.push(streamedEventData);
        }
        candidateReducer.getState();
        activeReducer = candidateReducer;
        activeEvents = candidateEvents;
        scoreReducer = candidateReducer;
        scoreEvents = candidateEvents;
      }
      state = activeReducer.getState();
      if (isCheckpointEligible(checkpointId, state)) return state;
    }
    throw invalidInput("TxLINE checkpoint state unavailable");
  }

  return Object.freeze({
    async refreshCheckpoint(checkpointId: CheckpointId, signal: AbortSignal) {
      if (checkpointId !== "FINAL") {
        const cached = snapshots.get(checkpointId);
        if (cached !== undefined) return;
      }
      if (checkpointId === "FINAL") {
        if (finalResult !== undefined) return;
      }
      if (refreshInFlight) {
        throw invalidInput("TxLINE refresh already in progress");
      }
      refreshInFlight = true;

      try {
        if (checkpointId === "FINAL") {
          const state = await eligibleState(checkpointId, signal);
          if (signal.aborted) {
            throw new TxlineDataError(
              "PROVIDER_ABORTED",
              "TxLINE provider request aborted",
            );
          }
          if (state.suspended) {
            throw new TxlineDataError(
              "INVALID_SCORE_STATE",
              "Invalid TxLINE score state",
            );
          }
          finalResult =
            state.homeScore > state.awayScore
              ? "HOME"
              : state.awayScore > state.homeScore
                ? "AWAY"
                : "DRAW";
          return;
        }

        const state = await eligibleState(checkpointId, signal);
        if (fixture === undefined) throw invalidInput("TxLINE fixture unavailable");
        const [oddsSnapshot, oddsUpdates] = await Promise.all([
          client.getOddsSnapshot(fixture.fixtureId, signal),
          client.getOddsUpdates(fixture.fixtureId, signal),
        ]);
        const market = selectTxlineMarket({
          fixture,
          snapshot: oddsSnapshot,
          updates: oddsUpdates,
        });
        const observedAtMs = nowMs();
        validateFreshness(market, observedAtMs);
        if (signal.aborted) {
          throw new TxlineDataError("PROVIDER_ABORTED", "TxLINE provider request aborted");
        }

        const snapshotId = calculateSnapshotId(
          arenaId,
          checkpointId,
          state.sourceEventId,
          market.messageId,
        );
        const hashInput = {
          schemaVersion: 1,
          providerSequence: state.providerSequence,
          snapshotId,
          arenaId,
          fixtureId: String(fixture.fixtureId),
          checkpointId,
          observedAtUtc: toUtc(observedAtMs),
          sourceEventId: state.sourceEventId,
          source: "TXLINE_LIVE",
          match: {
            status: state.status,
            minute: state.minute,
            addedTime: state.addedTime,
            homeScore: state.homeScore,
            awayScore: state.awayScore,
          },
          priceMicros: market.priceMicros,
          freshness: {
            marketUpdatedAtUtc: toUtc(market.timestampMs),
            delayed,
            suspended: state.suspended,
          },
        } as const;
        const snapshot = canonicalSnapshotSchema.parse({
          ...hashInput,
          snapshotHash: calculateSnapshotHash(hashInput),
        });
        snapshots.set(checkpointId, snapshot);
      } finally {
        refreshInFlight = false;
      }
    },

    getSnapshot(checkpointId: DecisionCheckpointId) {
      const snapshot = snapshots.get(checkpointId);
      if (snapshot === undefined) {
        throw new RangeError(`Missing live decision checkpoint: ${checkpointId}`);
      }
      return structuredClone(snapshot);
    },

    getFinalResult() {
      if (finalResult === undefined) {
        throw new RangeError("Live fixture has no prepared FINAL result");
      }
      return finalResult;
    },
  });
}
