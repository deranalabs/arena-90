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
          "2": 0,
        },
      }),
    ],
  });
}

describe("TxLINE top-level clock adjustment", () => {
  it("accepts the provider top-level Clock representation", () => {
    const reducer = createReducer();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: fixture.startTime + 1_000,
          Action: "clock_adjustment",
          StatusId: 2,
          Clock: {
            Running: true,
            Seconds: 1_200,
          },
          Data: {},
          Stats: {
            "1": 0,
            "2": 0,
          },
        }),
      ),
    ).not.toThrow();

    expect(reducer.getState()).toMatchObject({
      status: "LIVE",
      minute: 25,
      homeScore: 0,
      awayScore: 0,
    });
  });

  it("still rejects a clock adjustment with no clock representation", () => {
    const reducer = createReducer();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: fixture.startTime + 1_000,
          Action: "clock_adjustment",
          StatusId: 2,
          Data: {},
          Stats: {
            "1": 0,
            "2": 0,
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
