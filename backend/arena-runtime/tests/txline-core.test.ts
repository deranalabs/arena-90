import { describe, expect, it } from "vitest";

import {
  TxlineDataError,
  createTxlineScoreStateReducer,
  selectTxlineMarket,
  validateTxlineFixtureBinding,
} from "../src/adapters/data/index.js";

const fixtureBinding = {
  fixtureId: 18_185_036,
  participant1Id: 101,
  participant2Id: 202,
  participant1IsHome: true,
  startTime: 1_783_164_000_000,
} as const;

function approvedMarket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    FixtureId: 18_185_036,
    MessageId: "odds-001",
    Ts: 1_783_164_900_000,
    Bookmaker: "TXLineStablePriceDemargined",
    BookmakerId: 10_021,
    SuperOddsType: "1X2_PARTICIPANT_RESULT",
    InRunning: true,
    MarketPeriod: null,
    MarketParameters: null,
    PriceNames: ["part1", "draw", "part2"],
    Pct: ["50.000", "30.000", "20.000"],
    ...overrides,
  };
}

function scoreEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    FixtureId: 18_185_036,
    Seq: 0,
    Id: 1,
    Ts: 1_783_164_000_000,
    Action: "coverage_update",
    Stats: { "1": 0, "2": 0 },
    ...overrides,
  };
}

function normalizedFixture(
  overrides: Record<string, unknown> = {},
) {
  return validateTxlineFixtureBinding(
    {
      FixtureId: 18_185_036,
      Participant1Id: 101,
      Participant2Id: 202,
      Participant1IsHome: true,
      StartTime: 1_783_164_000_000,
      ...overrides,
    },
    {
      ...fixtureBinding,
      ...(overrides["Participant1IsHome"] === false
        ? { participant1IsHome: false }
        : {}),
    },
  );
}

describe("validateTxlineFixtureBinding", () => {
  it("returns an immutable normalized fixture when provider identity matches", () => {
    const fixture = validateTxlineFixtureBinding(
      {
        FixtureId: 18_185_036,
        Participant1Id: 101,
        Participant2Id: 202,
        Participant1IsHome: true,
        StartTime: 1_783_164_000_000,
        UnrelatedProviderField: "preserved only at the raw boundary",
      },
      fixtureBinding,
    );

    expect(fixture).toEqual(fixtureBinding);
    expect(Object.isFrozen(fixture)).toBe(true);
  });

  it("accepts the approved camelCase fixture aliases", () => {
    expect(
      validateTxlineFixtureBinding(
        {
          fixtureId: 18_185_036,
          participant1Id: 101,
          participant2Id: 202,
          participant1IsHome: true,
          startTime: 1_783_164_000_000,
        },
        fixtureBinding,
      ),
    ).toEqual(fixtureBinding);
  });

  it("rejects conflicting fixture aliases with a deterministic error", () => {
    expect(() =>
      validateTxlineFixtureBinding(
        {
          FixtureId: 18_185_036,
          fixtureId: 99_999_999,
          Participant1Id: 101,
          Participant2Id: 202,
          Participant1IsHome: true,
          StartTime: 1_783_164_000_000,
        },
        fixtureBinding,
      ),
    ).toThrow(
      expect.objectContaining<Partial<TxlineDataError>>({
        code: "INVALID_PROVIDER_INPUT",
        message: "Invalid TxLINE fixture input",
      }),
    );
  });

  it("rejects an unapproved fixture casing variant", () => {
    expect(() =>
      validateTxlineFixtureBinding(
        {
          FixtureId: 18_185_036,
          FixtureID: 18_185_036,
          Participant1Id: 101,
          Participant2Id: 202,
          Participant1IsHome: true,
          StartTime: 1_783_164_000_000,
        },
        fixtureBinding,
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_INPUT" }));
  });

  it("rejects a provider fixture that does not match configured identity", () => {
    expect(() =>
      validateTxlineFixtureBinding(
        {
          FixtureId: 18_185_036,
          Participant1Id: 999,
          Participant2Id: 202,
          Participant1IsHome: true,
          StartTime: 1_783_164_000_000,
        },
        fixtureBinding,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "FIXTURE_BINDING_MISMATCH",
        message: "TxLINE fixture does not match configured binding",
      }),
    );
  });
});

describe("selectTxlineMarket", () => {
  it("selects the approved full-match market and maps participant 1 to HOME", () => {
    const fixture = validateTxlineFixtureBinding(
      {
        FixtureId: 18_185_036,
        Participant1Id: 101,
        Participant2Id: 202,
        Participant1IsHome: true,
        StartTime: 1_783_164_000_000,
      },
      fixtureBinding,
    );

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket()],
        updates: [],
      }),
    ).toEqual({
      fixtureId: 18_185_036,
      messageId: "odds-001",
      timestampMs: 1_783_164_900_000,
      priceMicros: { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
    });
  });

  it("selects the greatest provider timestamp across snapshot and updates", () => {
    const fixture = validateTxlineFixtureBinding(
      {
        FixtureId: 18_185_036,
        Participant1Id: 101,
        Participant2Id: 202,
        Participant1IsHome: true,
        StartTime: 1_783_164_000_000,
      },
      fixtureBinding,
    );

    const selected = selectTxlineMarket({
      fixture,
      snapshot: [approvedMarket({ MessageId: "older", Ts: 1_783_164_100_000 })],
      updates: [approvedMarket({ MessageId: "newer", Ts: 1_783_164_200_000 })],
    });

    expect(selected.messageId).toBe("newer");
    expect(selected.timestampMs).toBe(1_783_164_200_000);
  });

  it("rejects one MessageId carrying conflicting material content", () => {
    const fixture = validateTxlineFixtureBinding(
      {
        FixtureId: 18_185_036,
        Participant1Id: 101,
        Participant2Id: 202,
        Participant1IsHome: true,
        StartTime: 1_783_164_000_000,
      },
      fixtureBinding,
    );

    expect(() =>
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket()],
        updates: [
          approvedMarket({ Pct: ["40.000", "30.000", "30.000"] }),
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "DUPLICATE_MESSAGE_CONFLICT",
        message: "Conflicting TxLINE odds MessageId",
      }),
    );
  });

  it("maps participant 1 to AWAY when the fixture says it is not home", () => {
    const fixture = normalizedFixture({ Participant1IsHome: false });

    expect(
      selectTxlineMarket({ fixture, snapshot: [approvedMarket()], updates: [] })
        .priceMicros,
    ).toEqual({ HOME: 200_000, DRAW: 300_000, AWAY: 500_000 });
  });

  it("uses valid updates when the snapshot is a valid empty array", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [],
        updates: [approvedMarket({ MessageId: "from-updates" })],
      }).messageId,
    ).toBe("from-updates");
  });

  it("accepts provider odds rows with a null GameState", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [],
        updates: [
          approvedMarket({ MessageId: "null-game-state", GameState: null }),
        ],
      }).messageId,
    ).toBe("null-game-state");
  });

  it("does not require fields outside the approved market contract", () => {
    const fixture = normalizedFixture();
    const { InRunning: _ignored, ...row } = approvedMarket();

    expect(
      selectTxlineMarket({ fixture, snapshot: [row], updates: [] }).messageId,
    ).toBe("odds-001");
  });

  it("rejects an unapproved odds casing variant", () => {
    const fixture = normalizedFixture();

    expect(() =>
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ messageId: "odds-001" })],
        updates: [],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_INPUT" }));
  });

  it("uses lexicographically greatest MessageId when timestamps tie", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ MessageId: "market-a" })],
        updates: [approvedMarket({ MessageId: "market-z" })],
      }).messageId,
    ).toBe("market-z");
  });

  it("treats an identical duplicate MessageId as idempotent", () => {
    const fixture = normalizedFixture();
    const row = approvedMarket();

    expect(
      selectTxlineMarket({ fixture, snapshot: [row], updates: [row] }).messageId,
    ).toBe("odds-001");
  });

  it("treats reordered structurally equal odds rows as idempotent", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ Prices: { part1: 2, draw: 3 } })],
        updates: [approvedMarket({ Prices: { draw: 3, part1: 2 } })],
      }).messageId,
    ).toBe("odds-001");
  });

  it.each([
    ["fixture", { FixtureId: 99 }],
    ["bookmaker id", { BookmakerId: 99 }],
    ["bookmaker", { Bookmaker: "Other" }],
    ["market type", { SuperOddsType: "TOTALS" }],
    ["period", { MarketPeriod: "H1" }],
    ["parameters", { MarketParameters: "line=0" }],
  ])("rejects a non-approved %s market", (_case, override) => {
    const fixture = normalizedFixture();

    expect(() =>
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket(override)],
        updates: [],
      }),
    ).toThrow(expect.objectContaining({ code: "NO_APPROVED_MARKET" }));
  });

  it("rejects the malformed newest approved row without older fallback", () => {
    const fixture = normalizedFixture();

    expect(() =>
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ MessageId: "old", Ts: 10 })],
        updates: [
          approvedMarket({
            MessageId: "new",
            Ts: 20,
            PriceNames: ["part1", "part1", "draw"],
          }),
        ],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_MARKET" }));
  });

  it("normalizes exact Pct values with bigint largest remainder", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [
          approvedMarket({ Pct: ["71.942", "18.954", "9.091"] }),
        ],
        updates: [],
      }).priceMicros,
    ).toEqual({ HOME: 719_513, DRAW: 189_565, AWAY: 90_922 });
  });

  it("breaks equal remainders in HOME, DRAW, AWAY order", () => {
    const fixture = normalizedFixture();

    expect(
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ Pct: ["33.000", "33.000", "33.000"] })],
        updates: [],
      }).priceMicros,
    ).toEqual({ HOME: 333_334, DRAW: 333_333, AWAY: 333_333 });
  });

  it.each([
    ["below total band", ["33.000", "33.000", "32.999"]],
    ["above total band", ["34.000", "34.000", "33.001"]],
    ["NA", ["NA", "50.000", "50.000"]],
    ["wrong decimals", ["50.00", "30.000", "20.000"]],
    ["zero", ["0.000", "50.000", "50.000"]],
    ["over 100", ["100.001", "0.001", "0.001"]],
  ])("rejects invalid Pct: %s", (_case, pct) => {
    const fixture = normalizedFixture();

    expect(() =>
      selectTxlineMarket({
        fixture,
        snapshot: [approvedMarket({ Pct: pct })],
        updates: [],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_MARKET" }));
  });
});

describe("createTxlineScoreStateReducer", () => {
  it("does not expose score state until an explicit valid phase is known", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [scoreEvent()],
    });

    expect(() => reducer.getState()).toThrow(
      expect.objectContaining({
        code: "INVALID_SCORE_STATE",
        message: "Invalid TxLINE score state",
      }),
    );
  });

  it("bootstraps sparse events at the highest accepted sequence", () => {
    const fixture = validateTxlineFixtureBinding(
      {
        FixtureId: 18_185_036,
        Participant1Id: 101,
        Participant2Id: 202,
        Participant1IsHome: true,
        StartTime: 1_783_164_000_000,
      },
      fixtureBinding,
    );
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          Seq: 4,
          Id: 5,
          Ts: 1_783_164_900_000,
          Action: "safe_possession",
          StatusId: 2,
          Clock: { Running: true, Seconds: 1_800 },
          Stats: { "1": 1, "2": 0 },
        }),
        scoreEvent({ Seq: 1, Id: 2, Ts: 1_783_164_100_000 }),
      ],
    });

    expect(reducer.getState()).toEqual({
      fixtureId: 18_185_036,
      rawSequence: 4,
      providerSequence: 5,
      sourceEventId: "txline-score:18185036:4",
      timestampMs: 1_783_164_900_000,
      status: "LIVE",
      minute: 15,
      addedTime: 0,
      homeScore: 1,
      awayScore: 0,
      suspended: false,
      halftimeFinalised: false,
      finalised: false,
    });
  });

  it("accepts approved camelCase score aliases and rejects conflicts", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        {
          fixtureId: 18_185_036,
          seq: 0,
          id: 1,
          ts: 1_783_164_000_000,
          action: "coverage_update",
          statusId: 2,
          clock: { running: true, seconds: 2_700 },
          stats: { "1": 0, "2": 0 },
          data: { reliable: true, locked: false },
        },
      ],
    });

    expect(reducer.getState().providerSequence).toBe(1);
    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          seq: 2,
          Id: 2,
          Ts: 1_783_164_100_000,
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_600 },
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_INPUT",
        message: "Invalid TxLINE score event",
      }),
    );
  });

  it("accepts structurally equal aliases regardless of object key order", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_700 },
          Stats: { "1": 0, "2": 0, attacks: 4, corners: 2 },
          stats: { corners: 2, attacks: 4, "2": 0, "1": 0 },
        }),
      ],
    });

    expect(reducer.getState()).toMatchObject({ homeScore: 0, awayScore: 0 });
  });

  it("accepts structurally equal nested Data aliases", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_700 },
          Data: {
            Reliable: true,
            Locked: false,
            Clock: { Running: true, Seconds: 2_700 },
          },
          dataSoccer: {
            clock: { seconds: 2_700, running: true },
            locked: false,
            reliable: true,
          },
        }),
      ],
    });

    expect(reducer.getState().suspended).toBe(false);
  });

  it("rejects truly conflicting nested Data aliases", () => {
    const fixture = normalizedFixture();

    expect(() =>
      createTxlineScoreStateReducer({
        fixture,
        bootstrapEvents: [
          scoreEvent({
            StatusId: 2,
            Clock: { Running: true, Seconds: 2_700 },
            Data: { Reliable: true, Locked: false },
            data: { reliable: false, locked: false },
          }),
        ],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_INPUT" }));
  });

  it("rejects an unapproved score casing variant", () => {
    const fixture = normalizedFixture();

    expect(() =>
      createTxlineScoreStateReducer({
        fixture,
        bootstrapEvents: [scoreEvent({ SEQ: 0 })],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_PROVIDER_INPUT" }));
  });

  it("returns APPLIED or DUPLICATE and rejects conflict, gap, and lower unseen sequence", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [scoreEvent()],
    });
    const next = scoreEvent({ Seq: 1, Id: 2, Ts: 1_783_164_100_000 });

    expect(reducer.apply(next)).toBe("APPLIED");
    expect(reducer.apply(next)).toBe("DUPLICATE");
    expect(() => reducer.apply({ ...next, Id: 999 })).toThrow(
      expect.objectContaining({ code: "SEQUENCE_CONFLICT" }),
    );
    expect(() =>
      reducer.apply(scoreEvent({ Seq: 3, Id: 4, Ts: 1_783_164_300_000 })),
    ).toThrow(expect.objectContaining({ code: "SEQUENCE_GAP" }));

    const sparse = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent(),
        scoreEvent({ Seq: 2, Id: 3, Ts: 1_783_164_200_000 }),
      ],
    });
    expect(() =>
      sparse.apply(scoreEvent({ Seq: 1, Id: 2, Ts: 1_783_164_100_000 })),
    ).toThrow(expect.objectContaining({ code: "LOWER_UNSEEN_SEQUENCE" }));
  });

  it("treats reordered structurally equal score events as exact duplicates", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_700 },
          Stats: { "1": 0, "2": 0, attacks: 4, corners: 2 },
        }),
      ],
    });

    expect(
      reducer.apply(
        scoreEvent({
          StatusId: 2,
          Clock: { Seconds: 2_700, Running: true },
          Stats: { corners: 2, attacks: 4, "2": 0, "1": 0 },
        }),
      ),
    ).toBe("DUPLICATE");
  });

  it("does not mutate state when a streamed event is invalid", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_700 },
        }),
      ],
    });
    const before = reducer.getState();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: 1_783_164_100_000,
          StatusId: 5,
          Stats: { "1": 9, "2": 0 },
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_SCORE_STATE" }));
    expect(reducer.getState()).toEqual(before);
    expect(
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: 1_783_164_100_000,
          Action: "game_finalised",
          StatusId: 5,
          Stats: { "1": 1, "2": 0 },
        }),
      ),
    ).toBe("APPLIED");
  });

  it("rejects a new live period without that period's required clock", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 1_200 },
        }),
      ],
    });
    const before = reducer.getState();

    expect(() =>
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: 1_783_164_100_000,
          StatusId: 4,
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_SCORE_STATE" }));
    expect(reducer.getState()).toEqual(before);
  });

  it("applies score corrections, H1/H2 clocks, added time, halftime, and final markers", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_700 },
        }),
      ],
    });

    expect(
      reducer.apply(
        scoreEvent({
          Seq: 1,
          Id: 2,
          Ts: 1_783_164_100_000,
          StatusId: 2,
          Clock: { Running: true, Seconds: 1_500 },
          Stats: { "1": 2, "2": 1 },
        }),
      ),
    ).toBe("APPLIED");
    expect(reducer.getState()).toMatchObject({
      minute: 20,
      homeScore: 2,
      awayScore: 1,
    });

    reducer.apply(
      scoreEvent({
        Seq: 2,
        Id: 3,
        Ts: 1_783_164_200_000,
        Action: "score_correction",
        StatusId: 2,
        Clock: { Running: true, Seconds: 0 },
        Stats: { "1": 1, "2": 1 },
        Data: { Minutes: 4 },
      }),
    );
    reducer.apply(
      scoreEvent({
        Seq: 3,
        Id: 4,
        Ts: 1_783_164_300_000,
        Action: "additional_time",
        StatusId: 2,
        Clock: { Running: true, Seconds: 0 },
        Data: { Minutes: 4 },
        Stats: { "1": 1, "2": 1 },
      }),
    );
    expect(reducer.getState()).toMatchObject({
      minute: 45,
      addedTime: 4,
      homeScore: 1,
      awayScore: 1,
    });

    reducer.apply(
      scoreEvent({
        Seq: 4,
        Id: 5,
        Ts: 1_783_164_400_000,
        Action: "halftime_finalised",
        StatusId: 3,
        Stats: { "1": 1, "2": 1 },
      }),
    );
    expect(reducer.getState()).toMatchObject({
      status: "HALFTIME",
      minute: 45,
      halftimeFinalised: true,
      finalised: false,
    });

    reducer.apply(
      scoreEvent({
        Seq: 5,
        Id: 6,
        Ts: 1_783_164_500_000,
        Action: "kickoff",
        StatusId: 4,
        Clock: { Running: true, Seconds: 2_700 },
        Stats: { "1": 1, "2": 1 },
      }),
    );
    reducer.apply(
      scoreEvent({
        Seq: 6,
        Id: 7,
        Ts: 1_783_164_600_000,
        Action: "clock_adjustment",
        StatusId: 4,
        Data: { Clock: { Running: true, Seconds: 1_200 } },
        Stats: { "1": 1, "2": 1 },
      }),
    );
    expect(reducer.getState()).toMatchObject({
      status: "LIVE",
      minute: 70,
      addedTime: 0,
      finalised: false,
    });

    reducer.apply(
      scoreEvent({
        Seq: 7,
        Id: 8,
        Ts: 1_783_164_700_000,
        Action: "coverage_update",
        GameState: "completed",
        StatusId: 4,
        Clock: { Running: false, Seconds: 0 },
        Stats: { "1": 1, "2": 1 },
      }),
    );
    expect(reducer.getState().finalised).toBe(false);

    reducer.apply(
      scoreEvent({
        Seq: 8,
        Id: 9,
        Ts: 1_783_164_800_000,
        Action: "game_finalised",
        StatusId: 5,
        Stats: { "1": 1, "2": 1 },
      }),
    );
    expect(reducer.getState()).toMatchObject({
      status: "FINISHED",
      minute: 90,
      finalised: true,
    });
  });

  it.each([5, 100])(
    "accepts final status %s only with game_finalised",
    (statusId) => {
      const fixture = normalizedFixture();
      expect(() =>
        createTxlineScoreStateReducer({
          fixture,
          bootstrapEvents: [scoreEvent({ StatusId: statusId })],
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_SCORE_STATE" }));

      expect(
        createTxlineScoreStateReducer({
          fixture,
          bootstrapEvents: [
            scoreEvent({ Action: "game_finalised", StatusId: statusId }),
          ],
        }).getState().finalised,
      ).toBe(true);
    },
  );

  it("marks suspension and clears it only after a later valid recovery event", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_000 },
        }),
      ],
    });

    reducer.apply(
      scoreEvent({
        Seq: 1,
        Id: 2,
        Ts: 1_783_164_100_000,
        Action: "disconnected",
      }),
    );
    expect(reducer.getState().suspended).toBe(true);

    reducer.apply(
      scoreEvent({
        Seq: 2,
        Id: 3,
        Ts: 1_783_164_200_000,
        Action: "coverage_update",
      }),
    );
    expect(reducer.getState().suspended).toBe(true);

    reducer.apply(
      scoreEvent({
        Seq: 3,
        Id: 4,
        Ts: 1_783_164_300_000,
        Action: "connected",
        StatusId: 2,
        Clock: { Running: true, Seconds: 1_800 },
        Data: { Reliable: true, Locked: false },
      }),
    );
    expect(reducer.getState().suspended).toBe(false);

    reducer.apply(
      scoreEvent({
        Seq: 4,
        Id: 5,
        Ts: 1_783_164_400_000,
        StatusId: 2,
        Clock: { Running: true, Seconds: 1_700 },
        Data: { Reliable: false },
      }),
    );
    expect(reducer.getState().suspended).toBe(true);
  });

  it("uses provider GameState for disconnected suspension and connected recovery", () => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_000 },
        }),
      ],
    });

    reducer.apply(
      scoreEvent({
        Seq: 1,
        Id: 2,
        Ts: 1_783_164_100_000,
        GameState: "disconnected",
      }),
    );
    expect(reducer.getState().suspended).toBe(true);

    reducer.apply(
      scoreEvent({
        Seq: 2,
        Id: 3,
        Ts: 1_783_164_200_000,
        GameState: "connected",
        Data: { Reliable: true, Locked: false },
      }),
    );
    expect(reducer.getState().suspended).toBe(false);
  });

  it.each([
    ["suspend action", { Action: "suspend" }],
    ["status 18", { StatusId: 18 }],
    [
      "unreliable data",
      {
        StatusId: 2,
        Clock: { Running: true, Seconds: 1_900 },
        Data: { Reliable: false },
      },
    ],
    [
      "locked data",
      {
        StatusId: 2,
        Clock: { Running: true, Seconds: 1_900 },
        Data: { Locked: true },
      },
    ],
    ["disconnected state", { GameState: "disconnected" }],
  ])("marks coverage suspended for %s", (_case, trigger) => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_000 },
        }),
      ],
    });

    reducer.apply(
      scoreEvent({
        Seq: 1,
        Id: 2,
        Ts: 1_783_164_100_000,
        ...trigger,
      }),
    );

    expect(reducer.getState().suspended).toBe(true);
  });

  it.each([
    [2, "coverage_update", { Clock: { Running: true, Seconds: 1_900 } }],
    [3, "coverage_update", {}],
    [4, "coverage_update", { Clock: { Running: true, Seconds: 2_700 } }],
    [5, "game_finalised", {}],
  ])("clears suspension after valid status %s", (statusId, action, fields) => {
    const fixture = normalizedFixture();
    const reducer = createTxlineScoreStateReducer({
      fixture,
      bootstrapEvents: [
        scoreEvent({
          StatusId: 2,
          Clock: { Running: true, Seconds: 2_000 },
        }),
      ],
    });
    reducer.apply(
      scoreEvent({
        Seq: 1,
        Id: 2,
        Ts: 1_783_164_100_000,
        Action: "suspend",
      }),
    );

    reducer.apply(
      scoreEvent({
        Seq: 2,
        Id: 3,
        Ts: 1_783_164_200_000,
        Action: action,
        StatusId: statusId,
        Data: { Reliable: true, Locked: false },
        ...fields,
      }),
    );

    expect(reducer.getState().suspended).toBe(false);
  });
});
