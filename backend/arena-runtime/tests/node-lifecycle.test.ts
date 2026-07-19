import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  TxlineDataError,
  type TxlineProviderClient,
} from "../src/adapters/data/index.js";
import { CHECKPOINT_IDS } from "../src/contracts/index.js";
import { createNodeArenaLifecycleComposition } from "../src/runtime/node-lifecycle.js";

const manifest = {
  schemaVersion: 1,
  arenaId: "arena-replay-001",
  mode: "REPLAY",
  competition: "Premier League",
  fixtureId: "fixture-recorded-001",
  homeTeam: { name: "Home FC", code: "HOM" },
  awayTeam: { name: "Away FC", code: "AWY" },
  kickoffUtc: "2026-07-13T12:00:00.000Z",
  startingBankrollMicros: "100000000",
  currency: "VIRTUAL_USD_MICROS",
  assets: [
    { id: "HOME", market: "FULL_TIME_1X2", label: "Home win" },
    { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
    { id: "AWAY", market: "FULL_TIME_1X2", label: "Away win" },
  ],
  checkpoints: [...CHECKPOINT_IDS],
  createdAtUtc: "2026-07-13T10:00:00.000Z",
} as const;

const runtimeMetadata = {
  runtimeId: "arena90-node-runtime",
  runtimeVersion: "6-acceptance",
  executionRuleVersion: "p0-v1",
  winnerRuleVersion: "FINAL_NAV_ONLY_V1",
  agentTimeoutMs: 1_000,
  agents: {
    alpha: {
      adapterId: "fake",
      adapterVersion: "1",
      strategyId: "alpha-test",
      strategyVersion: "1",
    },
    beta: {
      adapterId: "fake",
      adapterVersion: "1",
      strategyId: "beta-test",
      strategyVersion: "1",
    },
  },
} as const;

const liveFixtureBinding = {
  fixtureId: 18_185_036,
  participant1Id: 101,
  participant2Id: 202,
  participant1IsHome: true,
  startTime: 1_783_164_000_000,
} as const;

function fixtureRow() {
  return {
    FixtureId: liveFixtureBinding.fixtureId,
    Participant1Id: liveFixtureBinding.participant1Id,
    Participant2Id: liveFixtureBinding.participant2Id,
    Participant1IsHome: liveFixtureBinding.participant1IsHome,
    StartTime: liveFixtureBinding.startTime,
  };
}

function scoreEvent(
  sequence: number,
  statusId: number,
  seconds: number | undefined,
  action = "coverage_update",
) {
  return {
    FixtureId: liveFixtureBinding.fixtureId,
    Seq: sequence,
    Id: sequence + 1,
    Ts: liveFixtureBinding.startTime + sequence * 60_000,
    Action: action,
    StatusId: statusId,
    ...(seconds === undefined
      ? { Clock: undefined }
      : { Clock: { Running: true, Seconds: seconds } }),
    Stats: sequence === 6 ? { "1": 2, "2": 1 } : { "1": 0, "2": 0 },
  };
}

function marketRow(messageId: string) {
  return {
    FixtureId: liveFixtureBinding.fixtureId,
    MessageId: messageId,
    Ts: 1_783_164_005_000,
    Bookmaker: "TXLineStablePriceDemargined",
    BookmakerId: 10_021,
    SuperOddsType: "1X2_PARTICIPANT_RESULT",
    InRunning: true,
    MarketPeriod: null,
    MarketParameters: null,
    PriceNames: ["part1", "draw", "part2"],
    Pct: ["50.000", "30.000", "20.000"],
  };
}

function createLiveClient(
  onCall: (operation: string) => void,
  bootstrapSequence = 0,
): TxlineProviderClient {
  const allEvents = [
    scoreEvent(0, 2, 2_700),
    scoreEvent(1, 2, 1_800),
    scoreEvent(2, 2, 900),
    scoreEvent(3, 3, undefined, "halftime_finalised"),
    scoreEvent(4, 4, 1_800),
    scoreEvent(5, 4, 900),
    scoreEvent(6, 5, undefined, "game_finalised"),
  ];
  const streamEvents = allEvents.filter(
    (event) => event.Seq > bootstrapSequence,
  );
  let marketSequence = 0;
  return {
    async getFixtureSnapshot() {
      onCall("fixture");
      return [fixtureRow()];
    },
    async getOddsSnapshot() {
      onCall("odds-snapshot");
      marketSequence += 1;
      return [marketRow(`odds-${marketSequence}`)];
    },
    async getOddsUpdates() {
      onCall("odds-updates");
      return [];
    },
    async getScoreSnapshot() {
      onCall("score-snapshot");
      return [allEvents[bootstrapSequence]];
    },
    async *getScoreStream() {
      onCall("score-stream");
      const event = streamEvents.shift();
      if (event !== undefined) yield { data: event };
    },
    async getHistoricalScoreReplay() {
      onCall("historical");
      return [];
    },
  };
}

function heartbeatWait(_delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

async function loadRecordedFixture(): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

describe("Node arena lifecycle composition", () => {
  it("keeps real TxLINE pre-kickoff idle state READY without durable miss", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-upcoming-001",
      mode: "LIVE" as const,
      fixtureId: String(liveFixtureBinding.fixtureId),
      kickoffUtc: new Date(liveFixtureBinding.startTime).toISOString(),
    };
    const baseClient = createLiveClient(() => undefined);
    const controller = new AbortController();
    let notifyRetryWait!: () => void;
    const retryWaiting = new Promise<void>((resolve) => {
      notifyRetryWait = resolve;
    });
    const composition = createNodeArenaLifecycleComposition({
      live: {
        fixtureBinding: liveFixtureBinding,
        delayed: false,
        client: {
          ...baseClient,
          getScoreSnapshot: async () => [scoreEvent(0, 1, undefined)],
          getScoreStream: async function* () {},
        },
      },
      agents: {
        alpha: { agentId: "alpha", invoke: async () => undefined },
        beta: { agentId: "beta", invoke: async () => undefined },
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_783_164_010_000,
        wait: async (delayMs, signal) => {
          if (delayMs === 5_000) notifyRetryWait();
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else
              signal.addEventListener("abort", () => resolve(), { once: true });
          });
        },
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "live-upcoming", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await composition.runner.create(liveManifest);

    const run = composition.runner.run(liveManifest.arenaId, controller.signal);
    const outcome = await Promise.race([
      retryWaiting.then(() => "RETRYING" as const),
      run.then(
        () => "SETTLED" as const,
        () => "SETTLED" as const,
      ),
    ]);
    expect(outcome).toBe("RETRYING");
    controller.abort();
    await expect(run).rejects.toMatchObject({ code: "ABORTED" });

    await expect(
      composition.store.read(liveManifest.arenaId, 0),
    ).resolves.toMatchObject({
      state: { phase: "READY", checkpoints: [], lastEventSequence: 1 },
      events: [{ sequence: 1, type: "ARENA_READY" }],
    });
  });

  it("fails LIVE provider authentication without fabricating missed rounds", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-auth-failure-001",
      mode: "LIVE" as const,
      fixtureId: String(liveFixtureBinding.fixtureId),
      kickoffUtc: new Date(liveFixtureBinding.startTime).toISOString(),
    };
    const baseClient = createLiveClient(() => undefined);
    const composition = createNodeArenaLifecycleComposition({
      live: {
        fixtureBinding: liveFixtureBinding,
        delayed: false,
        client: {
          ...baseClient,
          getFixtureSnapshot: async () => {
            throw new TxlineDataError(
              "PROVIDER_AUTHENTICATION_FAILURE",
              "TxLINE provider authentication failure",
            );
          },
        },
      },
      agents: {
        alpha: { agentId: "alpha", invoke: async () => undefined },
        beta: { agentId: "beta", invoke: async () => undefined },
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_783_164_010_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "live-auth-failure", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await composition.runner.create(liveManifest);

    await expect(
      composition.runner.run(
        liveManifest.arenaId,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTHENTICATION_FAILURE" });
    await expect(
      composition.store.read(liveManifest.arenaId, 0),
    ).resolves.toMatchObject({
      state: { phase: "READY", checkpoints: [], lastEventSequence: 1 },
      events: [{ sequence: 1, type: "ARENA_READY" }],
    });
  });

  it("runs the mandatory Replay recording through six decisions and FINAL", async () => {
    const invoked: string[] = [];
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId:
            | "KICKOFF"
            | "M15"
            | "M30"
            | "HALFTIME"
            | "M60"
            | "M75";
        };
      }) {
        invoked.push(`${agentId}:${request.snapshot.checkpointId}`);
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Hold the current portfolio.",
        };
      },
    });
    const composition = createNodeArenaLifecycleComposition({
      recordedFixture: await loadRecordedFixture(),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "replay-smoke", ttlMs: 10_000, renewEveryMs: 1_000 },
    });

    await composition.runner.create(manifest);
    const completed = await composition.runner.run(
      manifest.arenaId,
      new AbortController().signal,
    );
    const persisted = await composition.store.read(manifest.arenaId, 0);

    expect({
      phase: completed.phase,
      checkpoints: completed.checkpoints.map(({ checkpointId }) => checkpointId),
      invoked,
      finalResult: completed.finalResult,
      eventSequences:
        persisted === "NOT_FOUND"
          ? []
          : persisted.events.map(({ sequence }) => sequence),
    }).toEqual({
      phase: "COMPLETED",
      checkpoints: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75"],
      invoked: [
        "alpha:KICKOFF",
        "beta:KICKOFF",
        "alpha:M15",
        "beta:M15",
        "alpha:M30",
        "beta:M30",
        "alpha:HALFTIME",
        "beta:HALFTIME",
        "alpha:M60",
        "beta:M60",
        "alpha:M75",
        "beta:M75",
      ],
      finalResult: expect.objectContaining({
        arenaId: manifest.arenaId,
        winningAssetId: "HOME",
      }),
      eventSequences: Array.from({ length: 39 }, (_, index) => index + 1),
    });
  });

  it("runs LIVE through the real TxLINE adapter seam without Replay substitution", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-001",
      mode: "LIVE" as const,
      fixtureId: String(liveFixtureBinding.fixtureId),
      kickoffUtc: new Date(liveFixtureBinding.startTime).toISOString(),
    };
    const providerCalls: string[] = [];
    const invoked: string[] = [];
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId:
            | "KICKOFF"
            | "M15"
            | "M30"
            | "HALFTIME"
            | "M60"
            | "M75";
          source: string;
        };
      }) {
        invoked.push(`${agentId}:${request.snapshot.checkpointId}`);
        expect(request.snapshot.source).toBe("TXLINE_LIVE");
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Hold the current portfolio.",
        };
      },
    });
    const composition = createNodeArenaLifecycleComposition({
      recordedFixture: await loadRecordedFixture(),
      live: {
        fixtureBinding: liveFixtureBinding,
        delayed: false,
        client: createLiveClient((operation) => providerCalls.push(operation)),
      },
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_783_164_010_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "live-runner", ttlMs: 10_000, renewEveryMs: 1_000 },
    });

    await composition.runner.create(liveManifest);
    const completed = await composition.runner.run(
      liveManifest.arenaId,
      new AbortController().signal,
    );

    expect({
      phase: completed.phase,
      sources: completed.checkpoints.map(({ snapshot }) => snapshot?.source),
      invoked,
      providerCalls,
    }).toEqual({
      phase: "COMPLETED",
      sources: Array.from({ length: 6 }, () => "TXLINE_LIVE"),
      invoked: [
        "alpha:KICKOFF",
        "beta:KICKOFF",
        "alpha:M15",
        "beta:M15",
        "alpha:M30",
        "beta:M30",
        "alpha:HALFTIME",
        "beta:HALFTIME",
        "alpha:M60",
        "beta:M60",
        "alpha:M75",
        "beta:M75",
      ],
      providerCalls: [
        "fixture",
        "score-snapshot",
        "odds-snapshot",
        "score-stream",
        "odds-snapshot",
        "score-stream",
        "odds-snapshot",
        "score-stream",
        "odds-snapshot",
        "score-stream",
        "odds-snapshot",
        "score-stream",
        "odds-snapshot",
        "score-stream",
      ],
    });
  });

  it("resumes a pending LIVE checkpoint without refreshing its provider snapshot", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-resume-001",
      mode: "LIVE" as const,
      fixtureId: String(liveFixtureBinding.fixtureId),
      kickoffUtc: new Date(liveFixtureBinding.startTime).toISOString(),
    };
    const firstProviderCalls: string[] = [];
    let started = 0;
    let notifyStarted!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const blockingAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke({ signal }: { signal: AbortSignal }) {
        started += 1;
        if (started === 2) notifyStarted();
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return undefined;
      },
    });
    const first = createNodeArenaLifecycleComposition({
      live: {
        fixtureBinding: liveFixtureBinding,
        delayed: false,
        client: createLiveClient((operation) => firstProviderCalls.push(operation)),
      },
      agents: {
        alpha: blockingAgent("alpha"),
        beta: blockingAgent("beta"),
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_783_164_010_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "live-first", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await first.runner.create(liveManifest);
    const firstController = new AbortController();
    const interrupted = first.runner.run(liveManifest.arenaId, firstController.signal);
    await bothStarted;
    firstController.abort();
    await expect(interrupted).rejects.toMatchObject({ code: "ABORTED" });

    const resumeTrace: string[] = [];
    const resumedAgent = (agentId: "alpha" | "beta") => ({
      agentId,
      async invoke(request: {
        snapshot: {
          arenaId: string;
          snapshotId: string;
          checkpointId:
            | "KICKOFF"
            | "M15"
            | "M30"
            | "HALFTIME"
            | "M60"
            | "M75";
        };
      }) {
        resumeTrace.push(`agent:${agentId}:${request.snapshot.checkpointId}`);
        return {
          schemaVersion: 1 as const,
          arenaId: request.snapshot.arenaId,
          snapshotId: request.snapshot.snapshotId,
          checkpointId: request.snapshot.checkpointId,
          agentId,
          action: "NO_TRADE" as const,
          publicExplanation: "Hold the current portfolio.",
        };
      },
    });
    const resumed = createNodeArenaLifecycleComposition({
      live: {
        fixtureBinding: liveFixtureBinding,
        delayed: false,
        client: createLiveClient(
          (operation) => resumeTrace.push(`provider:${operation}`),
          1,
        ),
      },
      agents: {
        alpha: resumedAgent("alpha"),
        beta: resumedAgent("beta"),
      },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_783_164_010_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "live-resumed", ttlMs: 10_000, renewEveryMs: 1_000 },
      store: first.store,
    });
    const completed = await resumed.runner.run(
      liveManifest.arenaId,
      new AbortController().signal,
    );

    expect({
      phase: completed.phase,
      firstProviderCalls,
      firstResumedProviderIndex: resumeTrace.findIndex((item) =>
        item.startsWith("provider:"),
      ),
      resumedKickoffCalls: resumeTrace.slice(0, 2),
      resumedOddsRefreshes: resumeTrace.filter(
        (item) => item === "provider:odds-updates",
      ).length,
    }).toEqual({
      phase: "COMPLETED",
      firstProviderCalls: [
        "fixture",
        "score-snapshot",
        "odds-snapshot",
      ],
      firstResumedProviderIndex: 2,
      resumedKickoffCalls: ["agent:alpha:KICKOFF", "agent:beta:KICKOFF"],
      resumedOddsRefreshes: 0,
    });
  });

  it("rejects LIVE when only Replay data is configured", async () => {
    const liveManifest = {
      ...manifest,
      arenaId: "arena-live-no-fallback",
      mode: "LIVE" as const,
    };
    const agent = (agentId: "alpha" | "beta") => ({
      agentId,
      invoke: async () => undefined,
    });
    const composition = createNodeArenaLifecycleComposition({
      recordedFixture: await loadRecordedFixture(),
      agents: { alpha: agent("alpha"), beta: agent("beta") },
      runtimeMetadata,
      timing: {
        nowMs: () => 1_000,
        wait: heartbeatWait,
        waitForCheckpoint: async () => undefined,
      },
      lease: { ownerId: "no-fallback", ttlMs: 10_000, renewEveryMs: 1_000 },
    });
    await composition.runner.create(liveManifest);

    await expect(
      composition.runner.run(
        liveManifest.arenaId,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Arena lifecycle LIVE data source is not configured");
  });
});
