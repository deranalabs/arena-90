import { describe, expect, it } from "vitest";

import { createTxlineScoreStateReducer } from "../src/adapters/data/txline/score-state.js";

const fixture = {
  fixtureId: 18_257_865,
  participant1Id: 1_999,
  participant2Id: 1_888,
  participant1IsHome: true,
  startTime: 1_784_408_400_000,
} as const;

function scoreEvent(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    FixtureId: fixture.fixtureId,
    Participant1Id: fixture.participant1Id,
    Participant2Id: fixture.participant2Id,
    Participant1IsHome: fixture.participant1IsHome,
    StartTime: fixture.startTime,
    ...input,
  };
}

function createReducer() {
  return createTxlineScoreStateReducer({
    fixture,
    bootstrapEvents: [
      scoreEvent({
        Seq: 0,
        Id: 1,
        Ts: fixture.startTime,
        Action: "kickoff",
        StatusId: 2,
        Clock: {
          Running: true,
          Seconds: 2_700,
        },
        Stats: {
          "1": 0,
          "2": 3,
        },
      }),
    ],
  });
}

describe("TxLINE provisional additional time", () => {
  it("accepts an explicitly unconfirmed event as a no-op", () => {
    const reducer = createReducer();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: fixture.startTime + 1_000,
          Action: "additional_time",
          Confirmed: false,
          StatusId: 2,
          Clock: {
            Running: true,
            Seconds: 2_710,
          },
          Data: {},
          Stats: {
            "1": 0,
            "2": 3,
          },
        }),
      ),
    ).not.toThrow();

    expect(reducer.getState()).toMatchObject({
      rawSequence: 1,
      addedTime: 0,
      homeScore: 0,
      awayScore: 3,
    });
  });

  it("applies minutes from the subsequent provider update", () => {
    const reducer = createReducer();

    reducer.apply(
      scoreEvent({
        Seq: 1,
        Id: 2,
        Ts: fixture.startTime + 1_000,
        Action: "additional_time",
        Confirmed: false,
        StatusId: 2,
        Clock: {
          Running: true,
          Seconds: 2_710,
        },
        Data: {},
        Stats: {
          "1": 0,
          "2": 3,
        },
      }),
    );

    reducer.apply(
      scoreEvent({
        Seq: 2,
        Id: 2,
        Ts: fixture.startTime + 3_000,
        Action: "additional_time",
        StatusId: 2,
        Clock: {
          Running: true,
          Seconds: 2_710,
        },
        Data: {
          Minutes: 4,
        },
        Stats: {
          "1": 0,
          "2": 3,
        },
      }),
    );

    expect(reducer.getState()).toMatchObject({
      rawSequence: 2,
      addedTime: 4,
      homeScore: 0,
      awayScore: 3,
    });
  });

  it("still rejects an empty event without explicit confirmation state", () => {
    const reducer = createReducer();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: fixture.startTime + 1_000,
          Action: "additional_time",
          StatusId: 2,
          Clock: {
            Running: true,
            Seconds: 2_710,
          },
          Data: {},
          Stats: {
            "1": 0,
            "2": 3,
          },
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_SCORE_STATE",
      }),
    );
  });
});
