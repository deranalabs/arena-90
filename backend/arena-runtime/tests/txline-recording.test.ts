import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileRecordedTxlineFixture,
  createRecordedDataAdapter,
} from "../src/adapters/data/index.js";

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
    Stats: { "1": statusId === 100 ? 2 : 0, "2": statusId === 100 ? 1 : 0 },
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
    Prices: [2_000, 3_333, 5_000],
    Pct: pct,
  };
}

const scoreEvents = [
  scoreEvent(0, fixture.startTime, 2, "coverage_update", 0),
  scoreEvent(1, fixture.startTime + 900_000, 2, "coverage_update", 900),
  scoreEvent(2, fixture.startTime + 1_800_000, 2, "coverage_update", 1_800),
  scoreEvent(3, fixture.startTime + 2_700_000, 3, "halftime_finalised"),
  scoreEvent(4, fixture.startTime + 3_600_000, 4, "coverage_update", 3_600),
  scoreEvent(5, fixture.startTime + 4_500_000, 4, "coverage_update", 4_500),
  scoreEvent(6, fixture.startTime + 5_400_000, 100, "game_finalised"),
];

describe("compileRecordedTxlineFixture", () => {
  it("loads the committed Recovery Replay recording without requiring FINAL odds", async () => {
    const recording = JSON.parse(
      await readFile(
        join(
          process.cwd(),
          "fixtures/replay/world-cup-2026-france-england-third-place-recovery-replay-01-checkpoints.json",
        ),
        "utf8",
      ),
    );
    const adapter = createRecordedDataAdapter(recording);

    expect(
      ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75"].map(
        (checkpointId) => adapter.getSnapshot(checkpointId as never).priceMicros,
      ),
    ).toHaveLength(6);
    expect(adapter.getTerminalEvidence()).toMatchObject({
      providerSequence: 1_196,
      winningAssetId: "AWAY",
      match: { minute: 98, homeScore: 4, awayScore: 6 },
    });
  });

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

  it("preserves equal-Ts capture order, repeated MessageId transitions, and NA Pct", () => {
    const repeatedMessageId = "same-message-transition";
    const oddsUpdates = scoreEvents.flatMap((event, index) => {
      const active = {
        ...market(repeatedMessageId, event.Ts - 1, ["NA", "NA", "NA"]),
        Prices: [4_000, 3_000, 2_000],
      };
      return index === 0
        ? [
            { ...active, Prices: [2_000, 3_333, 5_000] },
            { ...active, Prices: [], Pct: [] },
            active,
          ]
        : [active];
    });

    const recorded = compileRecordedTxlineFixture({
      arenaId: "equal-ts-repeated-message-replay",
      fixture,
      scoreEvents,
      oddsUpdates,
      capturedAtUtc: "2026-07-18T00:00:00.000Z",
    });

    expect(recorded.records[0]).toMatchObject({
      marketMessageId: repeatedMessageId,
      marketAvailable: true,
      providerPrices: { HOME: 4_000, DRAW: 3_000, AWAY: 2_000 },
      priceMicros: { HOME: 230_769, DRAW: 307_692, AWAY: 461_539 },
    });
  });

  it("rejects decreasing historical odds timestamps instead of sorting", () => {
    const oddsUpdates = scoreEvents.map((event, index) =>
      market(`market-${index}`, event.Ts - 1, ["50.000", "30.000", "20.000"]),
    );
    [oddsUpdates[0], oddsUpdates[1]] = [oddsUpdates[1]!, oddsUpdates[0]!];

    expect(() =>
      compileRecordedTxlineFixture({
        arenaId: "out-of-order-odds-replay",
        fixture,
        scoreEvents,
        oddsUpdates,
        capturedAtUtc: "2026-07-18T00:00:00.000Z",
      }),
    ).toThrowError(/historical odds are out of capture order/u);
  });

  const evidenceDirectory = process.env["ARENA90_TXLINE_EVIDENCE_DIR"];
  const fullCaptureIt = evidenceDirectory === undefined ? it.skip : it;

  fullCaptureIt(
    "compiles the complete third-place capture in provider order without stale FINAL odds",
    async () => {
      const scoreCapture = JSON.parse(
        gunzipSync(
          await readFile(
            join(
              evidenceDirectory ?? "",
              "captures/fixture-18257865-score-raw.json.gz",
            ),
          ),
        ).toString("utf8"),
      ) as { entries: Array<{ data: unknown }> };
      const oddsCapture = JSON.parse(
        gunzipSync(
          await readFile(
            join(
              evidenceDirectory ?? "",
              "captures/fixture-18257865-odds-raw.json.gz",
            ),
          ),
        ).toString("utf8"),
      ) as { capturedAtUtc: string; updates: unknown[] };

      const recorded = compileRecordedTxlineFixture({
        arenaId:
          "world-cup-2026-france-england-third-place-recovery-replay-01",
        fixture: {
          fixtureId: 18_257_865,
          participant1Id: 1_999,
          participant2Id: 1_888,
          participant1IsHome: true,
          startTime: 1_784_408_400_000,
        },
        scoreEvents: scoreCapture.entries.map(({ data }) => data),
        oddsUpdates: oddsCapture.updates,
        capturedAtUtc: oddsCapture.capturedAtUtc,
      });

      expect(recorded.provenance).toMatchObject({
        sourceFixtureId: 18_257_865,
        scoreEventCount: 1_197,
        oddsUpdateCount: 75_650,
      });
      expect(
        recorded.records.map((record) => ({
          checkpointId: record.checkpointId,
          providerSequence: record.providerSequence,
          observedAtUtc: record.observedAtUtc,
          marketMessageId: record.marketMessageId,
          marketAvailable: record.marketAvailable,
          providerPrices: record.providerPrices,
          priceMicros: record.priceMicros,
        })),
      ).toEqual([
        {
          checkpointId: "KICKOFF",
          providerSequence: 17,
          observedAtUtc: "2026-07-18T21:00:13.751Z",
          marketMessageId: "1838383284:00003:001816-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 1_770, DRAW: 4_514, AWAY: 4_686 },
          priceMicros: { HOME: 565_027, DRAW: 221_552, AWAY: 213_421 },
        },
        {
          checkpointId: "M15",
          providerSequence: 218,
          observedAtUtc: "2026-07-18T21:15:14.316Z",
          marketMessageId: "1838384875:00003:000501-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 2_850, DRAW: 3_941, AWAY: 2_529 },
          priceMicros: { HOME: 350_870, DRAW: 253_732, AWAY: 395_398 },
        },
        {
          checkpointId: "M30",
          providerSequence: 368,
          observedAtUtc: "2026-07-18T21:30:14.672Z",
          marketMessageId: "1838386432:00003:001868-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 6_516, DRAW: 5_293, AWAY: 1_521 },
          priceMicros: { HOME: 153_492, DRAW: 188_956, AWAY: 657_552 },
        },
        {
          checkpointId: "HALFTIME",
          providerSequence: 605,
          observedAtUtc: "2026-07-18T21:53:59.724Z",
          marketMessageId: "1838388990:00003:000033-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 75_000, DRAW: 33_900, AWAY: 1_045 },
          priceMicros: { HOME: 13_333, DRAW: 29_507, AWAY: 957_160 },
        },
        {
          checkpointId: "M60",
          providerSequence: 804,
          observedAtUtc: "2026-07-18T22:23:03.950Z",
          marketMessageId: "1838392039:00003:000115-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 8_401, DRAW: 5_352, AWAY: 1_441 },
          priceMicros: { HOME: 119_049, DRAW: 186_880, AWAY: 694_071 },
        },
        {
          checkpointId: "M75",
          providerSequence: 955,
          observedAtUtc: "2026-07-18T22:38:09.270Z",
          marketMessageId: "1838393617:00003:000144-10021-stab",
          marketAvailable: true,
          providerPrices: { HOME: 3_959, DRAW: 3_008, AWAY: 2_410 },
          priceMicros: { HOME: 252_595, DRAW: 332_457, AWAY: 414_948 },
        },
        {
          checkpointId: "FINAL",
          providerSequence: 1_196,
          observedAtUtc: "2026-07-18T23:06:54.839Z",
          marketMessageId: "1838395930:00003:000029-1-10021-stab",
          marketAvailable: false,
          providerPrices: undefined,
          priceMicros: undefined,
        },
      ]);
      expect(recorded.records.at(-1)).toMatchObject({
        match: {
          status: "FINISHED",
          minute: 98,
          homeScore: 4,
          awayScore: 6,
        },
        finalResult: "AWAY",
        freshness: { suspended: true },
      });
    },
  );

  fullCaptureIt("rejects historical score capture that is out of order", async () => {
    const scoreCapture = JSON.parse(
      gunzipSync(
        await readFile(
          join(
            evidenceDirectory ?? "",
            "captures/fixture-18257865-score-raw.json.gz",
          ),
        ),
      ).toString("utf8"),
    ) as { entries: Array<{ data: unknown }> };
    const oddsCapture = JSON.parse(
      gunzipSync(
        await readFile(
          join(
            evidenceDirectory ?? "",
            "captures/fixture-18257865-odds-raw.json.gz",
          ),
        ),
      ).toString("utf8"),
    ) as { capturedAtUtc: string; updates: unknown[] };
    const events = scoreCapture.entries.map(({ data }) => data);
    [events[10], events[11]] = [events[11], events[10]];

    expect(() =>
      compileRecordedTxlineFixture({
        arenaId: "out-of-order-recovery-replay",
        fixture: {
          fixtureId: 18_257_865,
          participant1Id: 1_999,
          participant2Id: 1_888,
          participant1IsHome: true,
          startTime: 1_784_408_400_000,
        },
        scoreEvents: events,
        oddsUpdates: oddsCapture.updates,
        capturedAtUtc: oddsCapture.capturedAtUtc,
      }),
    ).toThrowError(/historical score sequence/u);
  });
});
