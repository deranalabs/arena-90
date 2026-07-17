import { z } from "zod";

import { structurallyEqual } from "./structural.js";

const providerIdSchema = z.number().int().positive().safe();
const timestampSchema = z.number().int().nonnegative().safe();

function rejectUnknownCasing(
  record: Record<string, unknown>,
  approvedAliases: readonly (readonly string[])[],
): void {
  for (const aliases of approvedAliases) {
    const firstAlias = aliases[0];
    if (firstAlias === undefined) continue;
    const normalizedName = firstAlias.toLowerCase();

    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === normalizedName && !aliases.includes(key)) {
        throw new TypeError("Unapproved TxLINE provider field casing");
      }
    }
  }
}

function resolvePrimitiveAlias<T>(pascalValue: T | undefined, camelValue: T | undefined): T | undefined {
  if (
    pascalValue !== undefined &&
    camelValue !== undefined &&
    !Object.is(pascalValue, camelValue)
  ) {
    throw new TypeError("Conflicting TxLINE provider aliases");
  }

  return pascalValue ?? camelValue;
}

export const fixtureBindingSchema = z
  .object({
    fixtureId: providerIdSchema,
    participant1Id: providerIdSchema,
    participant2Id: providerIdSchema,
    participant1IsHome: z.boolean(),
    startTime: timestampSchema,
  })
  .strict();

const rawFixtureProviderSchema = z
  .object({
    FixtureId: providerIdSchema.optional(),
    fixtureId: providerIdSchema.optional(),
    Participant1Id: providerIdSchema.optional(),
    participant1Id: providerIdSchema.optional(),
    Participant2Id: providerIdSchema.optional(),
    participant2Id: providerIdSchema.optional(),
    Participant1IsHome: z.boolean().optional(),
    participant1IsHome: z.boolean().optional(),
    StartTime: timestampSchema.optional(),
    startTime: timestampSchema.optional(),
  })
  .passthrough();

export function parseRawFixture(input: unknown): z.infer<typeof fixtureBindingSchema> {
  const providerFixture = rawFixtureProviderSchema.parse(input);
  rejectUnknownCasing(providerFixture, [
    ["FixtureId", "fixtureId"],
    ["Participant1Id", "participant1Id"],
    ["Participant2Id", "participant2Id"],
    ["Participant1IsHome", "participant1IsHome"],
    ["StartTime", "startTime"],
  ]);

  return fixtureBindingSchema.parse({
    fixtureId: resolvePrimitiveAlias(
      providerFixture.FixtureId,
      providerFixture.fixtureId,
    ),
    participant1Id: resolvePrimitiveAlias(
      providerFixture.Participant1Id,
      providerFixture.participant1Id,
    ),
    participant2Id: resolvePrimitiveAlias(
      providerFixture.Participant2Id,
      providerFixture.participant2Id,
    ),
    participant1IsHome: resolvePrimitiveAlias(
      providerFixture.Participant1IsHome,
      providerFixture.participant1IsHome,
    ),
    startTime: resolvePrimitiveAlias(
      providerFixture.StartTime,
      providerFixture.startTime,
    ),
  });
}

const rawOddsEnvelopeSchema = z
  .object({
    FixtureId: providerIdSchema,
    MessageId: z.string().trim().min(1),
    Ts: timestampSchema,
    Bookmaker: z.string(),
    BookmakerId: z.number().int().safe(),
    SuperOddsType: z.string(),
    GameState: z.string().nullable().optional(),
    InRunning: z.boolean().optional(),
    MarketPeriod: z.string().nullable().optional(),
    MarketParameters: z.string().nullable().optional(),
    PriceNames: z.unknown().optional(),
    Prices: z.unknown().optional(),
    Pct: z.unknown().optional(),
  })
  .passthrough();

const rawSelectedOddsSchema = rawOddsEnvelopeSchema.extend({
  PriceNames: z.array(z.string()).length(3),
  Pct: z.array(z.string()).length(3),
});

export type RawOddsEnvelope = z.infer<typeof rawOddsEnvelopeSchema>;
export type RawSelectedOdds = z.infer<typeof rawSelectedOddsSchema>;

export function parseRawOddsEndpoint(input: unknown): RawOddsEnvelope[] {
  const rows = z.array(rawOddsEnvelopeSchema).parse(input);
  for (const row of rows) {
    rejectUnknownCasing(row, [
      ["FixtureId"],
      ["MessageId"],
      ["Ts"],
      ["Bookmaker"],
      ["BookmakerId"],
      ["SuperOddsType"],
      ["GameState"],
      ["InRunning"],
      ["MarketPeriod"],
      ["MarketParameters"],
      ["PriceNames"],
      ["Prices"],
      ["Pct"],
    ]);
  }
  return rows;
}

export function parseSelectedOdds(input: unknown): RawSelectedOdds {
  const row = rawSelectedOddsSchema.parse(input);
  rejectUnknownCasing(row, [
    ["FixtureId"],
    ["MessageId"],
    ["Ts"],
    ["Bookmaker"],
    ["BookmakerId"],
    ["SuperOddsType"],
    ["GameState"],
    ["InRunning"],
    ["MarketPeriod"],
    ["MarketParameters"],
    ["PriceNames"],
    ["Prices"],
    ["Pct"],
  ]);
  return row;
}

const normalizedClockSchema = z
  .object({
    running: z.boolean(),
    seconds: z.number().int().nonnegative().safe(),
  })
  .strict();

const rawClockProviderSchema = z
  .object({
    Running: z.boolean().optional(),
    running: z.boolean().optional(),
    Seconds: z.number().int().nonnegative().safe().optional(),
    seconds: z.number().int().nonnegative().safe().optional(),
  })
  .passthrough();

export type NormalizedTxlineClock = z.infer<typeof normalizedClockSchema>;

function parseClock(input: unknown): NormalizedTxlineClock {
  const clock = rawClockProviderSchema.parse(input);
  rejectUnknownCasing(clock, [
    ["Running", "running"],
    ["Seconds", "seconds"],
  ]);
  return normalizedClockSchema.parse({
    running: resolvePrimitiveAlias(clock.Running, clock.running),
    seconds: resolvePrimitiveAlias(clock.Seconds, clock.seconds),
  });
}

function resolveStructuredAliases<T>(
  values: readonly unknown[],
  parser: (input: unknown) => T,
): T | undefined {
  const parsed = values
    .filter((value) => value !== undefined)
    .map((value) => parser(value));
  const first = parsed[0];
  if (first === undefined) return undefined;

  if (parsed.some((value) => !structurallyEqual(value, first))) {
    throw new TypeError("Conflicting TxLINE provider aliases");
  }

  return first;
}

const normalizedScoreDataSchema = z
  .object({
    minutes: z.number().int().nonnegative().safe().optional(),
    statusId: z.number().int().nonnegative().safe().optional(),
    reliable: z.boolean().optional(),
    locked: z.boolean().optional(),
    clock: normalizedClockSchema.optional(),
  })
  .strict();

const rawScoreDataProviderSchema = z
  .object({
    Minutes: z.number().int().nonnegative().safe().optional(),
    minutes: z.number().int().nonnegative().safe().optional(),
    StatusId: z.number().int().nonnegative().safe().optional(),
    statusId: z.number().int().nonnegative().safe().optional(),
    Reliable: z.boolean().optional(),
    reliable: z.boolean().optional(),
    Locked: z.boolean().optional(),
    locked: z.boolean().optional(),
    Clock: z.unknown().optional(),
    clock: z.unknown().optional(),
  })
  .passthrough();

type NormalizedScoreData = z.infer<typeof normalizedScoreDataSchema>;

function parseScoreData(input: unknown): NormalizedScoreData {
  const data = rawScoreDataProviderSchema.parse(input);
  rejectUnknownCasing(data, [
    ["Minutes", "minutes"],
    ["StatusId", "statusId"],
    ["Reliable", "reliable"],
    ["Locked", "locked"],
    ["Clock", "clock"],
  ]);
  return normalizedScoreDataSchema.parse({
    minutes: resolvePrimitiveAlias(data.Minutes, data.minutes),
    statusId: resolvePrimitiveAlias(data.StatusId, data.statusId),
    reliable: resolvePrimitiveAlias(data.Reliable, data.reliable),
    locked: resolvePrimitiveAlias(data.Locked, data.locked),
    clock: resolveStructuredAliases([data.Clock, data.clock], parseClock),
  });
}

const scoreStatsSchema = z.record(
  z.string(),
  z.number().int().nonnegative().safe(),
);

const rawScoreProviderSchema = z
  .object({
    FixtureId: providerIdSchema.optional(),
    fixtureId: providerIdSchema.optional(),
    Participant1Id: providerIdSchema.optional(),
    participant1Id: providerIdSchema.optional(),
    Participant2Id: providerIdSchema.optional(),
    participant2Id: providerIdSchema.optional(),
    Participant1IsHome: z.boolean().optional(),
    participant1IsHome: z.boolean().optional(),
    StartTime: timestampSchema.optional(),
    startTime: timestampSchema.optional(),
    Seq: z.number().int().nonnegative().safe().optional(),
    seq: z.number().int().nonnegative().safe().optional(),
    Id: z.number().int().nonnegative().safe().optional(),
    id: z.number().int().nonnegative().safe().optional(),
    Ts: timestampSchema.optional(),
    ts: timestampSchema.optional(),
    Action: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    GameState: z.string().optional(),
    gameState: z.string().optional(),
    StatusId: z.number().int().nonnegative().safe().optional(),
    statusId: z.number().int().nonnegative().safe().optional(),
    StatusSoccerId: z.number().int().nonnegative().safe().optional(),
    statusSoccerId: z.number().int().nonnegative().safe().optional(),
    Clock: z.unknown().optional(),
    clock: z.unknown().optional(),
    Stats: scoreStatsSchema.optional(),
    stats: scoreStatsSchema.optional(),
    Data: z.unknown().optional(),
    data: z.unknown().optional(),
    DataSoccer: z.unknown().optional(),
    dataSoccer: z.unknown().optional(),
  })
  .passthrough();

const normalizedScoreEventSchema = z
  .object({
    fixtureId: providerIdSchema,
    participant1Id: providerIdSchema.optional(),
    participant2Id: providerIdSchema.optional(),
    participant1IsHome: z.boolean().optional(),
    startTime: timestampSchema.optional(),
    seq: z.number().int().nonnegative().safe(),
    id: z.number().int().nonnegative().safe(),
    timestampMs: timestampSchema,
    action: z.string().trim().min(1),
    gameState: z.string().optional(),
    statusId: z.number().int().nonnegative().safe().optional(),
    clock: normalizedClockSchema.optional(),
    stats: scoreStatsSchema.optional(),
    data: normalizedScoreDataSchema.optional(),
  })
  .strict();

export type NormalizedTxlineScoreEvent = z.infer<
  typeof normalizedScoreEventSchema
>;

function resolveStatusAlias(score: z.infer<typeof rawScoreProviderSchema>): number | undefined {
  const values = [
    score.StatusId,
    score.statusId,
    score.StatusSoccerId,
    score.statusSoccerId,
  ].filter((value): value is number => value !== undefined);
  const first = values[0];
  if (values.some((value) => value !== first)) {
    throw new TypeError("Conflicting TxLINE provider aliases");
  }
  return first;
}

export function parseRawScoreEvent(input: unknown): NormalizedTxlineScoreEvent {
  const score = rawScoreProviderSchema.parse(input);
  rejectUnknownCasing(score, [
    ["FixtureId", "fixtureId"],
    ["Participant1Id", "participant1Id"],
    ["Participant2Id", "participant2Id"],
    ["Participant1IsHome", "participant1IsHome"],
    ["StartTime", "startTime"],
    ["Seq", "seq"],
    ["Id", "id"],
    ["Ts", "ts"],
    ["Action", "action"],
    ["GameState", "gameState"],
    ["StatusId", "statusId"],
    ["StatusSoccerId", "statusSoccerId"],
    ["Clock", "clock"],
    ["Stats", "stats"],
    ["Data", "data"],
    ["DataSoccer", "dataSoccer"],
  ]);
  const stats = resolveStructuredAliases(
    [score.Stats, score.stats],
    (value) => scoreStatsSchema.parse(value),
  );
  const data = resolveStructuredAliases(
    [score.Data, score.data, score.DataSoccer, score.dataSoccer],
    parseScoreData,
  );

  return normalizedScoreEventSchema.parse({
    fixtureId: resolvePrimitiveAlias(score.FixtureId, score.fixtureId),
    participant1Id: resolvePrimitiveAlias(
      score.Participant1Id,
      score.participant1Id,
    ),
    participant2Id: resolvePrimitiveAlias(
      score.Participant2Id,
      score.participant2Id,
    ),
    participant1IsHome: resolvePrimitiveAlias(
      score.Participant1IsHome,
      score.participant1IsHome,
    ),
    startTime: resolvePrimitiveAlias(score.StartTime, score.startTime),
    seq: resolvePrimitiveAlias(score.Seq, score.seq),
    id: resolvePrimitiveAlias(score.Id, score.id),
    timestampMs: resolvePrimitiveAlias(score.Ts, score.ts),
    action: resolvePrimitiveAlias(score.Action, score.action),
    gameState: resolvePrimitiveAlias(score.GameState, score.gameState),
    statusId: resolveStatusAlias(score),
    clock: resolveStructuredAliases([score.Clock, score.clock], parseClock),
    stats,
    data,
  });
}
