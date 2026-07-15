import {
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
} from "@/lib/arena-api/contracts";

import {
  publicEvent,
  publicHistory,
  publicPortfolio,
  publicSnapshot,
  publicState,
} from "../test-support/arena-api-fixtures";

const portfolios = {
  alpha: publicPortfolio("alpha"),
  beta: publicPortfolio("beta"),
};

describe("browser-safe Arena90 public contracts", () => {
  it("accepts the current public state and rejects hostile extra fields", () => {
    expect(publicArenaStateV1Schema.parse(publicState())).toEqual(publicState());

    expect(() =>
      publicArenaStateV1Schema.parse(
        publicState({ providerPayload: { secret: "must-not-pass" } }),
      ),
    ).toThrow();
  });

  it("maps every current public event variant with strict payloads", () => {
    const events = [
      publicEvent(1),
      publicEvent(2, "CHECKPOINT_OPENED", {
        checkpointId: "KICKOFF",
        payload: { snapshot: publicSnapshot() },
      }),
      publicEvent(3, "AGENTS_ANALYZING", { checkpointId: "KICKOFF" }),
      publicEvent(4, "DECISION_RECEIVED", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        payload: { status: "RECEIVED" },
      }),
      publicEvent(5, "RECHECKING_DECISION", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        payload: { attempt: 1 },
      }),
      publicEvent(6, "MISSED_DECISION_ROUND", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        payload: { reason: "INVALID_OUTPUT" },
      }),
      publicEvent(7, "GLOBAL_MISSED_DECISION_ROUND", {
        checkpointId: "KICKOFF",
        payload: { reason: "DATA_UNAVAILABLE" },
      }),
      publicEvent(8, "ROUND_REVEALED", {
        checkpointId: "KICKOFF",
        payload: {
          decisions: {},
          failures: [],
          portfoliosBefore: portfolios,
          portfoliosAfter: portfolios,
        },
      }),
      publicEvent(9, "ROUND_COMPLETE", {
        checkpointId: "KICKOFF",
        payload: { portfolios, nextCheckpointId: "M15" },
      }),
      publicEvent(10, "FINALIZING", {
        checkpointId: "FINAL",
      }),
      publicEvent(11, "COMPLETED", {
        checkpointId: "FINAL",
        payload: {
          result: {
            schemaVersion: 1,
            arenaId: "arena-replay-001",
            winningAssetId: "HOME",
            winner: "DRAW",
            alphaFinalNavMicros: "100000000",
            betaFinalNavMicros: "100000000",
            finalResultHash: "b".repeat(64),
          },
          portfolios,
        },
      }),
    ];

    expect(events.map((event) => publicArenaEventV1Schema.parse(event))).toHaveLength(11);
    expect(() =>
      publicArenaEventV1Schema.parse({
        ...events[3],
        payload: { status: "RECEIVED", rawModelOutput: "private" },
      }),
    ).toThrow();
  });

  it("requires history to be arena-bound and contiguous after its exclusive cursor", () => {
    expect(
      publicEventHistoryV1Schema.parse(
        publicHistory([publicEvent(2), publicEvent(3)], 1),
      ).events.map((event) => event.sequence),
    ).toEqual([2, 3]);

    expect(() =>
      publicEventHistoryV1Schema.parse(
        publicHistory([publicEvent(2), publicEvent(4)], 1),
      ),
    ).toThrow();
  });
});
