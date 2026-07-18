import { describe, expect, it } from "vitest";

import { compileRecordedTxlineFixture } from "../src/adapters/data/index.js";

const fixture = {
  fixtureId: 18_237_038,
  participant1Id: 101,
  participant2Id: 202,
  participant1IsHome: true,
  startTime: 1_784_000_000_000,
} as const;

function scoreEvent(
  seq: number,
  timestampMs: number,
  statusId: number,
  action: string,
  clockSeconds?: number,
) {
  return {
    FixtureId: fixture.fixtureId,
    Participant1Id: fixture.participant1Id,
    Participant2Id: fixture.participant2Id,
    Participant1IsHome: fixture.participant1IsHome,
    StartTime: fixture.startTime,
    Seq: seq,
    Id: seq + 1,
    Ts: timestampMs,
    Action: action,
    StatusId: statusId,
    Stats: { "1": statusId === 5 ? 2 : 0, "2": statusId === 5 ? 1 : 0 },
    ...(clockSeconds === undefined
      ? {}
      : { Clock: { Running: true, Seconds: clockSeconds } }),
  };
}

function market(messageId: string, timestampMs: number, pct: string[]) {
  return {
    FixtureId: fixture.fixtureId,
    MessageId: messageId,
    Ts: timestampMs,
    Bookmaker: "TXLineStablePriceDemargined",
    BookmakerId: 10_021,
    SuperOddsType: "1X2_PARTICIPANT_RESULT",
    InRunning: true,
    MarketPeriod: null,
    MarketParameters: null,
    PriceNames: ["part1", "draw", "part2"],
    Pct: pct,
  };
}

const scoreEvents = [
  scoreEvent(0, fixture.startTime, 2, "coverage_update", 2_700),
  scoreEvent(1, fixture.startTime + 900_000, 2, "coverage_update", 1_800),
  scoreEvent(2, fixture.startTime + 1_800_000, 2, "coverage_update", 900),
  scoreEvent(3, fixture.startTime + 2_700_000, 3, "halftime_finalised"),
  scoreEvent(4, fixture.startTime + 3_600_000, 4, "coverage_update", 1_800),
  scoreEvent(5, fixture.startTime + 4_500_000, 4, "coverage_update", 900),
  scoreEvent(6, fixture.startTime + 5_400_000, 5, "game_finalised"),
];

describe("compileRecordedTxlineFixture", () => {
  it("compiles ordered P0 checkpoints without using future odds", () => {
    const oddsUpdates = scoreEvents.flatMap((event, index) => [
      market(`before-${index}`, event.Ts - 1, ["50.000", "30.000", "20.000"]),
      market(`future-${index}`, event.Ts + 1, ["10.000", "20.000", "70.000"]),
    ]);

    const recorded = compileRecordedTxlineFixture({
      arenaId: "world-cup-2026-france-spain-semifinal-replay",
      fixture,
      scoreEvents,
      oddsUpdates,
      capturedAtUtc: "2026-07-18T00:00:00.000Z",
    });

    expect(recorded.records.map((record) => record.checkpointId)).toEqual([
      "KICKOFF",
      "M15",
      "M30",
      "HALFTIME",
      "M60",
      "M75",
      "FINAL",
    ]);
    expect(recorded.records.map((record) => record.marketMessageId)).toEqual(
      scoreEvents.map((_event, index) => `before-${index}`),
    );
    expect(recorded.records.every((record) =>
      Date.parse(record.freshness.marketUpdatedAtUtc) <= Date.parse(record.observedAtUtc)
    )).toBe(true);
    expect(recorded.records.at(-1)?.finalResult).toBe("HOME");
    expect(recorded.provenance).toMatchObject({
      scoreEventCount: 7,
      oddsUpdateCount: 14,
      sourceFixtureId: fixture.fixtureId,
    });
    expect(recorded.provenance.inputHash).toMatch(/^[0-9a-f]{64}$/u);
  });
});
