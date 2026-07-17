import { describe, expect, it } from "vitest";

import {
  TxlineDataError,
  createTxlineLiveDataAdapter,
  type TxlineProviderClient,
} from "../src/adapters/data/index.js";

const fixtureBinding = {
  fixtureId: 18_185_036,
  participant1Id: 101,
  participant2Id: 202,
  participant1IsHome: true,
  startTime: 1_783_164_000_000,
} as const;

function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    FixtureId: fixtureBinding.fixtureId,
    Participant1Id: fixtureBinding.participant1Id,
    Participant2Id: fixtureBinding.participant2Id,
    Participant1IsHome: fixtureBinding.participant1IsHome,
    StartTime: fixtureBinding.startTime,
    ...overrides,
  };
}

function scoreEvent(overrides: Record<string, unknown> = {}) {
  return {
    FixtureId: fixtureBinding.fixtureId,
    Seq: 0,
    Id: 1,
    Ts: fixtureBinding.startTime,
    Action: "coverage_update",
    StatusId: 2,
    Clock: { Running: true, Seconds: 2_700 },
    Stats: { "1": 0, "2": 0 },
    ...overrides,
  };
}

function marketRow(overrides: Record<string, unknown> = {}) {
  return {
    FixtureId: fixtureBinding.fixtureId,
    MessageId: "odds-kickoff",
    Ts: 1_783_164_005_000,
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

function createClient(overrides: Partial<TxlineProviderClient> = {}): TxlineProviderClient {
  return {
    getFixtureSnapshot: async () => [fixtureRow()],
    getOddsSnapshot: async () => [marketRow()],
    getOddsUpdates: async () => [],
    getScoreSnapshot: async () => [scoreEvent()],
    getScoreStream: async function* () {},
    getHistoricalScoreReplay: async () => [],
    ...overrides,
  };
}

describe("TxLINE live data adapter", () => {
  it("rejects an invalid fixture binding before provider access", () => {
    let providerCalls = 0;
    const client = createClient({
      getFixtureSnapshot: async () => {
        providerCalls += 1;
        return [];
      },
    });

    expect(() =>
      createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding: { ...fixtureBinding, fixtureId: 0 },
        delayed: false,
        client,
        nowMs: () => 1_783_164_010_000,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PROVIDER_CONFIG",
        message: "Invalid TxLINE live adapter configuration",
      }),
    );
    expect(providerCalls).toBe(0);
  });

  it("locks fixture binding values when the adapter is created", async () => {
    const mutableBinding = {
      ...fixtureBinding,
      participant1Id: fixtureBinding.participant1Id as number,
    };
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding: mutableBinding,
      delayed: false,
      client: createClient(),
      nowMs: () => 1_783_164_010_000,
    });
    mutableBinding.participant1Id = 999;

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF").fixtureId).toBe("18185036");
  });

  it("prepares a deterministic canonical KICKOFF snapshot", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient(),
      nowMs: () => 1_783_164_010_000,
    });

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF")).toEqual({
      schemaVersion: 1,
      providerSequence: 1,
      snapshotId:
        "d469bed403501c3f0e87002a34f6b6a0bfa9e35bc1ae108b3774f47d563ddc23",
      snapshotHash:
        "05944a6595c92f79f3ad809caf01bdca33baaacd93cf79e877e01f32b9b12b9f",
      arenaId: "arena-live-001",
      fixtureId: "18185036",
      checkpointId: "KICKOFF",
      observedAtUtc: "2026-07-04T11:20:10.000Z",
      sourceEventId: "txline-score:18185036:0",
      source: "TXLINE_LIVE",
      match: {
        status: "LIVE",
        minute: 0,
        addedTime: 0,
        homeScore: 0,
        awayScore: 0,
      },
      priceMicros: { HOME: 500_000, DRAW: 300_000, AWAY: 200_000 },
      freshness: {
        marketUpdatedAtUtc: "2026-07-04T11:20:05.000Z",
        delayed: false,
        suspended: false,
      },
    });
  });

  it("reports pre-kickoff idle state as pending instead of failed", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({ StatusId: 1, Clock: undefined }),
        ],
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await expect(
      adapter.refreshCheckpoint("KICKOFF", new AbortController().signal),
    ).rejects.toMatchObject({ code: "CHECKPOINT_PENDING" });
    expect(() => adapter.getSnapshot("KICKOFF")).toThrow(
      "Missing live decision checkpoint: KICKOFF",
    );
  });

  it("keeps pre-kickoff state pending when idle score stream times out", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({ StatusId: 1, Clock: undefined }),
        ],
        getScoreStream: async function* () {
          throw new TxlineDataError(
            "PROVIDER_TIMEOUT",
            "TxLINE provider request timed out",
          );
        },
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await expect(
      adapter.refreshCheckpoint("KICKOFF", new AbortController().signal),
    ).rejects.toMatchObject({ code: "CHECKPOINT_PENDING" });
  });

  it("rejects a concurrent refresh while the active refresh can complete", async () => {
    let releaseFixture: ((value: unknown) => void) | undefined;
    const fixtureSnapshot = new Promise<unknown>((resolve) => {
      releaseFixture = resolve;
    });
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getFixtureSnapshot: async () => fixtureSnapshot,
      }),
      nowMs: () => 1_783_164_010_000,
    });
    const firstRefresh = adapter.refreshCheckpoint(
      "KICKOFF",
      new AbortController().signal,
    );

    await expect(
      adapter.refreshCheckpoint("KICKOFF", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_INPUT",
      message: "TxLINE refresh already in progress",
    });

    releaseFixture?.([fixtureRow()]);
    await expect(firstRefresh).resolves.toBeUndefined();
    expect(adapter.getSnapshot("KICKOFF").checkpointId).toBe("KICKOFF");
  });

  it.each([
    ["KICKOFF", 2, 2_700, "coverage_update", 0],
    ["KICKOFF", 2, 1_860, "coverage_update", 14],
    ["M15", 2, 1_800, "coverage_update", 15],
    ["M15", 2, 960, "coverage_update", 29],
    ["M30", 2, 900, "coverage_update", 30],
    ["M30", 2, 60, "coverage_update", 44],
    ["HALFTIME", 3, undefined, "halftime_finalised", 45],
    ["M60", 4, 1_800, "coverage_update", 60],
    ["M60", 4, 960, "coverage_update", 74],
    ["M75", 4, 900, "coverage_update", 75],
    ["M75", 4, 0, "coverage_update", 90],
  ] as const)(
    "prepares %s from approved status %s",
    async (checkpointId, statusId, seconds, action, expectedMinute) => {
      const event = scoreEvent({
        Action: action,
        StatusId: statusId,
        ...(seconds === undefined
          ? { Clock: undefined }
          : { Clock: { Running: true, Seconds: seconds } }),
      });
      const adapter = createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding,
        delayed: false,
        client: createClient({ getScoreSnapshot: async () => [event] }),
        nowMs: () => 1_783_164_010_000,
      });

      await adapter.refreshCheckpoint(
        checkpointId,
        new AbortController().signal,
      );

      expect(adapter.getSnapshot(checkpointId)).toMatchObject({
        checkpointId,
        match: { minute: expectedMinute },
      });
    },
  );

  it("stops consuming the caller-scoped stream immediately after eligibility", async () => {
    let nextCalls = 0;
    let returnCalls = 0;
    const streamEvents = [
      {
        data: scoreEvent({
          Seq: 1,
          Id: 2,
          Clock: { Running: true, Seconds: 1_800 },
        }),
      },
      {
        data: scoreEvent({
          Seq: 2,
          Id: 3,
          Clock: { Running: true, Seconds: 1_740 },
        }),
      },
    ];
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({ Clock: { Running: true, Seconds: 1_860 } }),
        ],
        getScoreStream: () => ({
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const value = streamEvents[nextCalls];
                nextCalls += 1;
                return value === undefined
                  ? { done: true, value: undefined }
                  : { done: false, value };
              },
              return: async () => {
                returnCalls += 1;
                return { done: true, value: undefined };
              },
            };
          },
        }),
      }),
      nowMs: () => 1_783_164_030_000,
    });

    await adapter.refreshCheckpoint("M15", new AbortController().signal);

    expect(adapter.getSnapshot("M15")).toMatchObject({ providerSequence: 2 });
    expect({ nextCalls, returnCalls }).toEqual({ nextCalls: 1, returnCalls: 1 });
  });

  it("does not accept halftime status without halftime_finalised", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({
            Action: "coverage_update",
            StatusId: 3,
            Clock: undefined,
          }),
        ],
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await expect(
      adapter.refreshCheckpoint("HALFTIME", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_INPUT",
      message: "TxLINE checkpoint state unavailable",
    });
    expect(() => adapter.getSnapshot("HALFTIME")).toThrow();
  });

  it.each([
    ["KICKOFF", 2, 1_800],
    ["M15", 2, 900],
    ["M30", 3, undefined],
    ["M30", 4, 1_800],
    ["HALFTIME", 4, 2_640],
    ["M60", 4, 900],
    ["M75", 5, undefined],
  ] as const)(
    "reports %s as missed when verified score state has passed its window",
    async (checkpointId, statusId, seconds) => {
      const adapter = createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding,
        delayed: false,
        client: createClient({
          getScoreSnapshot: async () => [
            scoreEvent({
              Action:
                statusId === 3
                  ? "halftime_finalised"
                  : statusId === 5
                    ? "game_finalised"
                    : "coverage_update",
              StatusId: statusId,
              ...(seconds === undefined
                ? { Clock: undefined }
                : { Clock: { Running: true, Seconds: seconds } }),
            }),
          ],
        }),
        nowMs: () => 1_783_164_010_000,
      });

      await expect(
        adapter.refreshCheckpoint(checkpointId, new AbortController().signal),
      ).rejects.toMatchObject({ code: "CHECKPOINT_WINDOW_MISSED" });
    },
  );

  it.each([5, 100])(
    "does not accept status %s without game_finalised as FINAL",
    async (statusId) => {
      const adapter = createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding,
        delayed: false,
        client: createClient({
          getScoreSnapshot: async () => [
            scoreEvent({
              Action: "coverage_update",
              StatusId: statusId,
              Clock: undefined,
            }),
          ],
        }),
        nowMs: () => 1_783_164_010_000,
      });

      await expect(
        adapter.refreshCheckpoint("FINAL", new AbortController().signal),
      ).rejects.toMatchObject({ code: "INVALID_SCORE_STATE" });
      expect(() => adapter.getTerminalEvidence()).toThrow(
        "Live fixture has no prepared FINAL result",
      );
    },
  );

  it("publishes nothing on caller abort and releases the refresh lock", async () => {
    let fixtureCalls = 0;
    const controller = new AbortController();
    const client = createClient({
      getFixtureSnapshot: (signal) => {
        fixtureCalls += 1;
        if (fixtureCalls > 1) return Promise.resolve([fixtureRow()]);
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(
                new TxlineDataError(
                  "PROVIDER_ABORTED",
                  "TxLINE provider request aborted",
                ),
              ),
            { once: true },
          );
        });
      },
    });
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client,
      nowMs: () => 1_783_164_010_000,
    });
    const abortedRefresh = adapter.refreshCheckpoint("KICKOFF", controller.signal);
    controller.abort();

    await expect(abortedRefresh).rejects.toMatchObject({
      code: "PROVIDER_ABORTED",
    });
    expect(() => adapter.getSnapshot("KICKOFF")).toThrow();

    await expect(
      adapter.refreshCheckpoint("KICKOFF", new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(adapter.getSnapshot("KICKOFF").checkpointId).toBe("KICKOFF");
  });

  it("returns a cached FINAL result without provider access", async () => {
    let scoreCalls = 0;
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => {
          scoreCalls += 1;
          return [
            scoreEvent({
              Action: "game_finalised",
              StatusId: 5,
              Clock: undefined,
              Stats: { "1": 2, "2": 1 },
            }),
          ];
        },
      }),
      nowMs: () => {
        throw new Error("FINAL must not sample snapshot time");
      },
    });

    await adapter.refreshCheckpoint("FINAL", new AbortController().signal);
    await adapter.refreshCheckpoint("FINAL", new AbortController().signal);

    expect(adapter.getTerminalEvidence().winningAssetId).toBe("HOME");
    expect(scoreCalls).toBe(1);
  });

  it("retains validated provider state across successive checkpoints", async () => {
    let fixtureCalls = 0;
    let scoreSnapshotCalls = 0;
    let oddsCalls = 0;
    const client = createClient({
      getFixtureSnapshot: async () => {
        fixtureCalls += 1;
        return [fixtureRow()];
      },
      getScoreSnapshot: async () => {
        scoreSnapshotCalls += 1;
        return [scoreEvent()];
      },
      getScoreStream: async function* () {
        yield {
          data: scoreEvent({
            Seq: 1,
            Id: 2,
            Clock: { Running: true, Seconds: 1_800 },
          }),
        };
      },
      getOddsSnapshot: async () => {
        oddsCalls += 1;
        return [marketRow()];
      },
    });
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client,
      nowMs: () => 1_783_164_010_000,
    });

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);
    await adapter.refreshCheckpoint("M15", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF")).toMatchObject({ providerSequence: 1 });
    expect(adapter.getSnapshot("M15")).toMatchObject({
      providerSequence: 2,
      checkpointId: "M15",
      match: { minute: 15 },
    });
    expect({ fixtureCalls, scoreSnapshotCalls, oddsCalls }).toEqual({
      fixtureCalls: 1,
      scoreSnapshotCalls: 1,
      oddsCalls: 2,
    });
  });

  it("resynchronizes one stream gap through historical replay", async () => {
    let replayCalls = 0;
    const sequenceOne = scoreEvent({
      Seq: 1,
      Id: 2,
      Ts: 1_783_164_010_000,
      Clock: { Running: true, Seconds: 1_800 },
    });
    const sequenceTwo = scoreEvent({
      Seq: 2,
      Id: 3,
      Ts: 1_783_164_020_000,
      Clock: { Running: true, Seconds: 1_740 },
    });
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({ Clock: { Running: true, Seconds: 1_860 } }),
        ],
        getScoreStream: async function* () {
          yield { data: sequenceTwo };
        },
        getHistoricalScoreReplay: async () => {
          replayCalls += 1;
          return [
            { data: scoreEvent({ Clock: { Running: true, Seconds: 1_860 } }) },
            { data: sequenceOne },
            { data: sequenceTwo },
          ];
        },
      }),
      nowMs: () => 1_783_164_030_000,
    });

    await adapter.refreshCheckpoint("M15", new AbortController().signal);

    expect(adapter.getSnapshot("M15")).toMatchObject({
      providerSequence: 3,
      sourceEventId: "txline-score:18185036:2",
      match: { minute: 16 },
    });
    expect(replayCalls).toBe(1);
  });

  it("leaves score state unchanged when historical resync fails after partial replay", async () => {
    let streamCalls = 0;
    let replayCalls = 0;
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [scoreEvent()],
        getScoreStream: async function* () {
          streamCalls += 1;
          if (streamCalls === 1) {
            yield {
              data: scoreEvent({
                Seq: 3,
                Id: 4,
                Clock: { Running: true, Seconds: 1_680 },
              }),
            };
            return;
          }
          yield {
            data: scoreEvent({
              Seq: 1,
              Id: 2,
              Clock: { Running: true, Seconds: 1_800 },
            }),
          };
        },
        getHistoricalScoreReplay: async () => {
          replayCalls += 1;
          return [
            {
              data: scoreEvent({
                Seq: 1,
                Id: 2,
                Clock: { Running: true, Seconds: 1_860 },
              }),
            },
            { data: "invalid-score-event" },
          ];
        },
      }),
      nowMs: () => 1_783_164_030_000,
    });

    await expect(
      adapter.refreshCheckpoint("M15", new AbortController().signal),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_INPUT" });
    expect(() => adapter.getSnapshot("M15")).toThrow(
      "Missing live decision checkpoint: M15",
    );

    await adapter.refreshCheckpoint("M15", new AbortController().signal);

    expect(adapter.getSnapshot("M15")).toMatchObject({
      providerSequence: 2,
      match: { minute: 15 },
    });
    expect(replayCalls).toBe(1);
  });

  it("leaves score state unchanged when caller aborts during historical resync", async () => {
    const controller = new AbortController();
    let streamCalls = 0;
    let replayCalls = 0;
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [scoreEvent()],
        getScoreStream: async function* () {
          streamCalls += 1;
          if (streamCalls === 1) {
            yield {
              data: scoreEvent({
                Seq: 3,
                Id: 4,
                Clock: { Running: true, Seconds: 1_680 },
              }),
            };
            return;
          }
          yield {
            data: scoreEvent({
              Seq: 1,
              Id: 2,
              Clock: { Running: true, Seconds: 1_800 },
            }),
          };
        },
        getHistoricalScoreReplay: async () => {
          replayCalls += 1;
          return [
            {
              data: scoreEvent({
                Seq: 1,
                Id: 2,
                Clock: { Running: true, Seconds: 1_860 },
              }),
            },
            {
              get data() {
                controller.abort();
                return scoreEvent({
                  Seq: 2,
                  Id: 3,
                  Clock: { Running: true, Seconds: 1_740 },
                });
              },
            },
          ];
        },
      }),
      nowMs: () => 1_783_164_030_000,
    });

    await expect(
      adapter.refreshCheckpoint("M15", controller.signal),
    ).rejects.toMatchObject({ code: "PROVIDER_ABORTED" });
    expect(() => adapter.getSnapshot("M15")).toThrow(
      "Missing live decision checkpoint: M15",
    );

    await adapter.refreshCheckpoint("M15", new AbortController().signal);

    expect(adapter.getSnapshot("M15")).toMatchObject({
      providerSequence: 2,
      match: { minute: 15 },
    });
    expect(replayCalls).toBe(1);
  });

  it.each([
    [
      "conflicting",
      [{ data: scoreEvent({ Stats: { "1": 1, "2": 0 } }) }],
      "SEQUENCE_CONFLICT",
    ],
    [
      "incomplete",
      [
        {
          data: scoreEvent({
            Seq: 1,
            Id: 2,
            Clock: { Running: true, Seconds: 1_800 },
          }),
        },
      ],
      "SEQUENCE_GAP",
    ],
    ["invalid", [{ data: "not-a-score-event" }], "INVALID_PROVIDER_INPUT"],
  ] as const)(
    "fails closed after one %s historical resync",
    async (_case, replay, expectedCode) => {
      let replayCalls = 0;
      const adapter = createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding,
        delayed: false,
        client: createClient({
          getScoreSnapshot: async () => [
            scoreEvent({ Clock: { Running: true, Seconds: 1_860 } }),
          ],
          getScoreStream: async function* () {
            yield {
              data: scoreEvent({
                Seq: 3,
                Id: 4,
                Clock: { Running: true, Seconds: 1_680 },
              }),
            };
          },
          getHistoricalScoreReplay: async () => {
            replayCalls += 1;
            return replay;
          },
        }),
        nowMs: () => 1_783_164_030_000,
      });

      await expect(
        adapter.refreshCheckpoint("M15", new AbortController().signal),
      ).rejects.toMatchObject({ code: expectedCode });
      expect(replayCalls).toBe(1);
      expect(() => adapter.getSnapshot("M15")).toThrow(
        "Missing live decision checkpoint: M15",
      );
    },
  );

  it.each([
    [5, { "1": 2, "2": 1 }, "HOME"],
    [100, { "1": 1, "2": 1 }, "DRAW"],
    [5, { "1": 0, "2": 2 }, "AWAY"],
  ] as const)(
    "prepares FINAL from authoritative status %s and score %j",
    async (statusId, stats, expectedResult) => {
      const client = createClient({
        getScoreSnapshot: async () => [
          scoreEvent({
            Action: "game_finalised",
            StatusId: statusId,
            Clock: undefined,
            Stats: stats,
          }),
        ],
        getOddsSnapshot: async () => {
          throw new Error("FINAL must not request odds");
        },
        getOddsUpdates: async () => {
          throw new Error("FINAL must not request odds");
        },
      });
      const adapter = createTxlineLiveDataAdapter({
        arenaId: "arena-live-001",
        fixtureBinding,
        delayed: false,
        client,
        nowMs: () => 1_783_164_010_000,
      });

      await adapter.refreshCheckpoint("FINAL", new AbortController().signal);

      expect(adapter.getTerminalEvidence().winningAssetId).toBe(expectedResult);
    },
  );

  it("publishes FINAL after a suspended authoritative final recovers", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({
            Action: "game_finalised",
            StatusId: 5,
            Clock: undefined,
            Stats: { "1": 2, "2": 1 },
            Data: { Reliable: false },
          }),
        ],
        getScoreStream: async function* () {
          yield {
            data: scoreEvent({
              Seq: 1,
              Id: 2,
              Action: "connected",
              StatusId: undefined,
              Clock: undefined,
              Stats: { "1": 2, "2": 1 },
              Data: { Reliable: true, Locked: false },
            }),
          };
        },
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await adapter.refreshCheckpoint("FINAL", new AbortController().signal);

    expect(adapter.getTerminalEvidence().winningAssetId).toBe("HOME");
  });

  it("keeps FINAL unavailable when a suspended authoritative final has no recovery", async () => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({
            Action: "game_finalised",
            StatusId: 5,
            Clock: undefined,
            Stats: { "1": 2, "2": 1 },
            Data: { Reliable: false },
          }),
        ],
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await expect(
      adapter.refreshCheckpoint("FINAL", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_INPUT",
      message: "TxLINE checkpoint state unavailable",
    });
    expect(() => adapter.getTerminalEvidence()).toThrow(
      "Live fixture has no prepared FINAL result",
    );
  });

  it("publishes suspended state with trusted delayed configuration and one time sample", async () => {
    let nowCalls = 0;
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: true,
      client: createClient({
        getScoreSnapshot: async () => [
          scoreEvent({ Data: { Reliable: false, Locked: false } }),
        ],
      }),
      nowMs: () => {
        nowCalls += 1;
        return 1_783_164_010_000;
      },
    });

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF")).toMatchObject({
      observedAtUtc: "2026-07-04T11:20:10.000Z",
      freshness: {
        marketUpdatedAtUtc: "2026-07-04T11:20:05.000Z",
        delayed: true,
        suspended: true,
      },
    });
    expect(nowCalls).toBe(1);
  });

  it("returns a cached successful refresh without provider access or a new time sample", async () => {
    const calls = {
      fixture: 0,
      score: 0,
      oddsSnapshot: 0,
      oddsUpdates: 0,
      now: 0,
    };
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getFixtureSnapshot: async () => {
          calls.fixture += 1;
          return [fixtureRow()];
        },
        getScoreSnapshot: async () => {
          calls.score += 1;
          return [scoreEvent()];
        },
        getOddsSnapshot: async () => {
          calls.oddsSnapshot += 1;
          return [marketRow()];
        },
        getOddsUpdates: async () => {
          calls.oddsUpdates += 1;
          return [];
        },
      }),
      nowMs: () => {
        calls.now += 1;
        return 1_783_164_010_000;
      },
    });

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);
    const first = adapter.getSnapshot("KICKOFF");
    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF")).toEqual(first);
    expect(calls).toEqual({
      fixture: 1,
      score: 1,
      oddsSnapshot: 1,
      oddsUpdates: 1,
      now: 1,
    });
  });

  it.each([
    ["maximum age", 1_783_163_710_000],
    ["maximum future skew", 1_783_164_040_000],
  ])("accepts a market at the inclusive %s boundary", async (_case, marketTs) => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getOddsSnapshot: async () => [marketRow({ Ts: marketTs })],
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await adapter.refreshCheckpoint("KICKOFF", new AbortController().signal);

    expect(adapter.getSnapshot("KICKOFF").freshness.marketUpdatedAtUtc).toBe(
      new Date(marketTs).toISOString(),
    );
  });

  it.each([
    ["stale", 1_783_163_709_999],
    ["future-invalid", 1_783_164_040_001],
  ])("fails closed for a %s market", async (_case, marketTs) => {
    const adapter = createTxlineLiveDataAdapter({
      arenaId: "arena-live-001",
      fixtureBinding,
      delayed: false,
      client: createClient({
        getOddsSnapshot: async () => [marketRow({ Ts: marketTs })],
      }),
      nowMs: () => 1_783_164_010_000,
    });

    await expect(
      adapter.refreshCheckpoint("KICKOFF", new AbortController().signal),
    ).rejects.toMatchObject({
      code: "INVALID_MARKET",
      message: "Invalid selected TxLINE market",
    });
    expect(() => adapter.getSnapshot("KICKOFF")).toThrow(
      "Missing live decision checkpoint: KICKOFF",
    );
  });
});
