import { render, screen, within } from "@testing-library/react";

import { ArenaShell } from "@/components/arena/ArenaShell";
import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicCheckpointV1,
  PublicDecisionV1,
  PublicEventHistoryV1,
} from "@/lib/arena-api/contracts";
import type {
  RuntimeEventStream,
  RuntimeTransport,
} from "@/lib/arena-api/transport";
import {
  publicEvent,
  publicHistory,
  publicPortfolio,
  publicSnapshot,
  publicState,
} from "@/test-support/arena-api-fixtures";

const arenaId = "arena-replay-001";

function publicDecision(
  agentId: "alpha" | "beta",
  explanation: string,
): PublicDecisionV1 {
  return {
    schemaVersion: 1,
    arenaId,
    snapshotId: "snapshot-kickoff",
    checkpointId: "KICKOFF",
    agentId,
    action: "TARGET_ALLOCATION",
    publicExplanation: explanation,
    targetAllocationBps: {
      cash: 4_000,
      HOME: agentId === "alpha" ? 4_000 : 2_000,
      DRAW: 1_000,
      AWAY: agentId === "alpha" ? 1_000 : 3_000,
    },
  };
}

function revealedCheckpoint(): PublicCheckpointV1 {
  const portfolios = {
    alpha: publicPortfolio("alpha"),
    beta: publicPortfolio("beta"),
  };
  return {
    checkpointId: "KICKOFF",
    outcome: "REVEALED",
    snapshot: publicSnapshot(),
    revealedDecisions: {
      alpha: publicDecision("alpha", "Alpha public response"),
      beta: publicDecision("beta", "Beta public response"),
    },
    failures: [],
    portfoliosBefore: portfolios,
    portfoliosAfter: portfolios,
    firstEventSequence: 2,
    lastEventSequence: 2,
  };
}

function revealEvent(checkpoint: PublicCheckpointV1): PublicArenaEventV1 {
  return publicEvent(2, "ROUND_REVEALED", {
    checkpointId: checkpoint.checkpointId,
    payload: {
      decisions: checkpoint.revealedDecisions,
      failures: checkpoint.failures,
      portfoliosBefore: checkpoint.portfoliosBefore,
      portfoliosAfter: checkpoint.portfoliosAfter,
    },
  }) as PublicArenaEventV1;
}

function followingStream(): RuntimeEventStream {
  return {
    status: "OPEN",
    events: {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<PublicArenaEventV1>>(() => undefined),
          return: async () => ({ done: true, value: undefined }),
        };
      },
    },
  };
}

function staticTransport(
  state: PublicArenaStateV1,
  events: PublicArenaEventV1[] = [publicEvent(1) as PublicArenaEventV1],
  stream: RuntimeEventStream = followingStream(),
): RuntimeTransport {
  return {
    readState: jest.fn().mockResolvedValue(state),
    readHistory: jest
      .fn()
      .mockResolvedValue(publicHistory(events) as PublicEventHistoryV1),
    streamEvents: jest.fn().mockResolvedValue(stream),
  };
}

describe("completed spectator experience", () => {
  it("fails closed when state contains a decision without ROUND_REVEALED", async () => {
    const state = publicState({
      phase: "RUNNING",
      checkpoints: [revealedCheckpoint()],
      nextCheckpointId: "M15",
    }) as PublicArenaStateV1;

    render(<ArenaShell arenaId={arenaId} transport={staticTransport(state)} />);

    expect(await screen.findByText("Arena unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Alpha public response")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta public response")).not.toBeInTheDocument();
  });

  it("reveals Alpha and Beta together in one checkpoint record", async () => {
    const checkpoint = revealedCheckpoint();
    const state = publicState({
      phase: "RUNNING",
      checkpoints: [checkpoint],
      nextCheckpointId: "M15",
      lastEventSequence: 2,
    }) as PublicArenaStateV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={staticTransport(state, [
          publicEvent(1) as PublicArenaEventV1,
          revealEvent(checkpoint),
        ])}
      />,
    );

    const record = await screen.findByRole("article", {
      name: /kickoff decision record/i,
    });
    expect(within(record).getByText("Alpha public response")).toBeInTheDocument();
    expect(within(record).getByText("Beta public response")).toBeInTheDocument();
    expect(within(record).getAllByText("Target allocation")).toHaveLength(2);
    expect(within(record).getAllByText("Home FC")).toHaveLength(2);
    expect(within(record).getAllByText("Draw")).toHaveLength(2);
    expect(within(record).getAllByText("Away FC")).toHaveLength(2);
    expect(within(record).queryByText(/^(HOME|DRAW|AWAY)$/)).not.toBeInTheDocument();
  });

  it("does not expose either decision before ROUND_REVEALED", async () => {
    const snapshot = publicSnapshot();
    const events = [
      publicEvent(1) as PublicArenaEventV1,
      publicEvent(2, "CHECKPOINT_OPENED", {
        checkpointId: "KICKOFF",
        payload: { snapshot },
      }) as PublicArenaEventV1,
      publicEvent(3, "AGENTS_ANALYZING", {
        checkpointId: "KICKOFF",
      }) as PublicArenaEventV1,
      publicEvent(4, "DECISION_RECEIVED", {
        checkpointId: "KICKOFF",
        agentId: "alpha",
        payload: { status: "RECEIVED" },
      }) as PublicArenaEventV1,
    ];
    const state = publicState({
      phase: "RUNNING",
      currentSnapshot: snapshot,
      lastEventSequence: 4,
    }) as PublicArenaStateV1;
    render(
      <ArenaShell arenaId={arenaId} transport={staticTransport(state, events)} />,
    );

    expect(await screen.findByText("No decision has been revealed.")).toBeInTheDocument();
    expect(screen.queryByText("Alpha public response")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta public response")).not.toBeInTheDocument();
    expect(screen.queryByText("Target allocation")).not.toBeInTheDocument();
  });

  it("shows a missed agent without fabricating a decision or changing its portfolio", async () => {
    const alphaPortfolio = {
      ...publicPortfolio("alpha"),
      cashMicros: "80000000",
      unitMicros: { HOME: "1250000", DRAW: "500000", AWAY: "0" },
      navMicros: "101000000",
      returnBps: 125,
    };
    const betaPortfolio = {
      ...publicPortfolio("beta"),
      cashMicros: "70000000",
      navMicros: "102000000",
    };
    const checkpoint: PublicCheckpointV1 = {
      ...revealedCheckpoint(),
      revealedDecisions: {
        beta: publicDecision("beta", "Beta valid public response"),
      },
      failures: [
        { scope: "AGENT", agentId: "alpha", reason: "INVALID_OUTPUT" },
      ],
      portfoliosBefore: {
        alpha: alphaPortfolio,
        beta: publicPortfolio("beta"),
      },
      portfoliosAfter: { alpha: alphaPortfolio, beta: betaPortfolio },
    };
    const state = publicState({
      phase: "RUNNING",
      checkpoints: [checkpoint],
      portfolios: { alpha: alphaPortfolio, beta: betaPortfolio },
      nextCheckpointId: "M15",
      leader: { result: "beta", provisional: true },
      lastEventSequence: 2,
    }) as PublicArenaStateV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={staticTransport(state, [
          publicEvent(1) as PublicArenaEventV1,
          revealEvent(checkpoint),
        ])}
      />,
    );

    const record = await screen.findByRole("article", {
      name: /kickoff decision record/i,
    });
    expect(within(record).getByText("Missed decision round")).toBeInTheDocument();
    expect(within(record).getByText(/no decision applied · invalid_output/i)).toBeInTheDocument();
    expect(within(record).queryByText("No trade")).not.toBeInTheDocument();
    const alpha = screen.getByRole("article", { name: "Agent Alpha" });
    expect(within(alpha).getByText("80.00 vUSD")).toBeInTheDocument();
    expect(within(alpha).getByText("101.00 vUSD")).toBeInTheDocument();
    expect(within(alpha).getByText("+1.25%")).toBeInTheDocument();
    expect(within(alpha).getByText("1.25 units")).toBeInTheDocument();
    expect(within(alpha).getByText("0.5 units")).toBeInTheDocument();
    expect(within(alpha).getByText("0 units")).toBeInTheDocument();
  });

  it("shows a global missed round with both portfolios preserved", async () => {
    const checkpoint: PublicCheckpointV1 = {
      ...revealedCheckpoint(),
      outcome: "GLOBAL_MISSED",
      revealedDecisions: {},
      failures: [{ scope: "GLOBAL", reason: "DATA_UNAVAILABLE" }],
    };
    const state = publicState({
      phase: "RUNNING",
      checkpoints: [checkpoint],
      nextCheckpointId: "M15",
      lastEventSequence: 2,
    }) as PublicArenaStateV1;
    const globalMissedEvent = publicEvent(2, "GLOBAL_MISSED_DECISION_ROUND", {
      checkpointId: "KICKOFF",
      payload: { reason: "DATA_UNAVAILABLE" },
    }) as PublicArenaEventV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={staticTransport(state, [
          publicEvent(1) as PublicArenaEventV1,
          globalMissedEvent,
        ])}
      />,
    );

    const record = await screen.findByRole("article", {
      name: /kickoff decision record/i,
    });
    expect(within(record).getAllByText("Global missed decision round")).toHaveLength(2);
    expect(within(record).getAllByText(/portfolio preserved/i)).toHaveLength(2);
    expect(within(record).queryByText("Target allocation")).not.toBeInTheDocument();
  });

  it("keeps FINALIZING explicitly provisional without a winner or proof hash", async () => {
    const state = publicState({
      phase: "FINALIZING",
      nextCheckpointId: "FINAL",
      leader: { result: "alpha", provisional: true },
    }) as PublicArenaStateV1;
    render(<ArenaShell arenaId={arenaId} transport={staticTransport(state)} />);

    const result = await screen.findByRole("region", { name: /final settlement/i });
    expect(within(result).getByText("Finalizing result")).toBeInTheDocument();
    expect(within(result).getByText("Agent Alpha · provisional")).toBeInTheDocument();
    expect(within(result).queryByText(/^Winner/)).not.toBeInTheDocument();
    expect(within(result).queryByText(/final result hash/i)).not.toBeInTheDocument();
  });

  it("fails closed for a non-provisional FINALIZING state", async () => {
    const state = publicState({
      phase: "FINALIZING",
      nextCheckpointId: "FINAL",
      leader: { result: "alpha", provisional: false },
    }) as PublicArenaStateV1;

    render(<ArenaShell arenaId={arenaId} transport={staticTransport(state)} />);

    expect(await screen.findByText("Arena unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /final settlement/i })).not.toBeInTheDocument();
  });

  it("fails closed for a COMPLETED state with missing or contradictory result", async () => {
    const alpha = {
      ...publicPortfolio("alpha"),
      navMicros: "112500000",
      updatedAtCheckpoint: "FINAL" as const,
    };
    const beta = {
      ...publicPortfolio("beta"),
      navMicros: "108000000",
      updatedAtCheckpoint: "FINAL" as const,
    };
    const contradictory = publicState({
      phase: "COMPLETED",
      nextCheckpointId: undefined,
      portfolios: { alpha, beta },
      leader: { result: "alpha", provisional: false },
      finalResult: {
        schemaVersion: 1,
        arenaId: "forged-arena",
        winningAssetId: "AWAY",
        winner: "beta",
        alphaFinalNavMicros: "1",
        betaFinalNavMicros: "2",
        finalResultHash: "f".repeat(64),
      },
    }) as PublicArenaStateV1;
    const missing = {
      ...contradictory,
      finalResult: undefined,
    } as PublicArenaStateV1;

    for (const state of [missing, contradictory]) {
      const view = render(
        <ArenaShell
          arenaId={arenaId}
          transport={staticTransport(state, undefined, { status: "TERMINAL" })}
        />,
      );
      expect(await screen.findByText("Arena unavailable")).toBeInTheDocument();
      expect(screen.queryByText(/wins|arena draw/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: /final settlement/i })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("renders the verified COMPLETED winner, terminal NAV, asset, and hash", async () => {
    const alpha = {
      ...publicPortfolio("alpha"),
      cashMicros: "0",
      unitMicros: { HOME: "112500000", DRAW: "0", AWAY: "0" },
      navMicros: "112500000",
      returnBps: 1_250,
      updatedAtCheckpoint: "FINAL" as const,
    };
    const beta = {
      ...publicPortfolio("beta"),
      cashMicros: "0",
      unitMicros: { HOME: "108000000", DRAW: "0", AWAY: "0" },
      navMicros: "108000000",
      returnBps: 800,
      updatedAtCheckpoint: "FINAL" as const,
    };
    const finalResultHash = "b".repeat(64);
    const finalResult = {
      schemaVersion: 1 as const,
      arenaId,
      winningAssetId: "HOME" as const,
      winner: "alpha" as const,
      alphaFinalNavMicros: "112500000",
      betaFinalNavMicros: "108000000",
      finalResultHash,
    };
    const state = publicState({
      phase: "COMPLETED",
      nextCheckpointId: undefined,
      portfolios: { alpha, beta },
      leader: { result: "alpha", provisional: false },
      finalResult,
      lastEventSequence: 2,
    }) as PublicArenaStateV1;
    const completedEvent = publicEvent(2, "COMPLETED", {
      checkpointId: "FINAL",
      payload: { result: finalResult, portfolios: { alpha, beta } },
    }) as PublicArenaEventV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={staticTransport(
          state,
          [publicEvent(1) as PublicArenaEventV1, completedEvent],
          { status: "TERMINAL" },
        )}
      />,
    );

    const result = await screen.findByRole("region", { name: /final settlement/i });
    expect(within(result).getByText("Agent Alpha wins")).toBeInTheDocument();
    expect(within(result).getByText("Home FC")).toBeInTheDocument();
    expect(within(result).getByText("112.50 vUSD")).toBeInTheDocument();
    expect(within(result).getByText("108.00 vUSD")).toBeInTheDocument();
    expect(within(result).getByText(finalResultHash)).toBeInTheDocument();
    expect(within(result).queryByText(/provisional/i)).not.toBeInTheDocument();
  });

  it("follows canonical SSE updates from bootstrap through COMPLETED", async () => {
    const checkpoint = revealedCheckpoint();
    const portfolios = checkpoint.portfoliosAfter;
    const finalResult = {
      schemaVersion: 1 as const,
      arenaId,
      winningAssetId: "HOME" as const,
      winner: "alpha" as const,
      alphaFinalNavMicros: "105000000",
      betaFinalNavMicros: "100000000",
      finalResultHash: "c".repeat(64),
    };
    const finalPortfolios = {
      alpha: {
        ...portfolios.alpha,
        cashMicros: "0",
        unitMicros: { HOME: "105000000", DRAW: "0", AWAY: "0" },
        navMicros: finalResult.alphaFinalNavMicros,
        returnBps: 500,
        updatedAtCheckpoint: "FINAL" as const,
      },
      beta: {
        ...portfolios.beta,
        cashMicros: "0",
        unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
        navMicros: finalResult.betaFinalNavMicros,
        returnBps: 0,
        updatedAtCheckpoint: "FINAL" as const,
      },
    };
    const streamed = [
      publicEvent(2, "ROUND_REVEALED", {
        checkpointId: "KICKOFF",
        payload: {
          decisions: checkpoint.revealedDecisions,
          failures: [],
          portfoliosBefore: checkpoint.portfoliosBefore,
          portfoliosAfter: portfolios,
        },
      }),
      publicEvent(3, "ROUND_COMPLETE", {
        checkpointId: "KICKOFF",
        payload: { portfolios, nextCheckpointId: "FINAL" },
      }),
      publicEvent(4, "FINALIZING", {
        checkpointId: "FINAL",
        payload: {},
      }),
      publicEvent(5, "COMPLETED", {
        checkpointId: "FINAL",
        payload: { result: finalResult, portfolios: finalPortfolios },
      }),
    ] as PublicArenaEventV1[];
    const transport: RuntimeTransport = {
      readState: jest
        .fn()
        .mockResolvedValueOnce(publicState())
        .mockResolvedValueOnce(
          publicState({
            phase: "RUNNING",
            checkpoints: [checkpoint],
            nextCheckpointId: "FINAL",
            lastEventSequence: 3,
          }),
        )
        .mockResolvedValueOnce(
          publicState({
            phase: "FINALIZING",
            checkpoints: [checkpoint],
            nextCheckpointId: "FINAL",
            lastEventSequence: 4,
          }),
        )
        .mockResolvedValueOnce(
          publicState({
            phase: "COMPLETED",
            checkpoints: [checkpoint],
            nextCheckpointId: undefined,
            leader: { result: "alpha", provisional: false },
            portfolios: finalPortfolios,
            finalResult,
            lastEventSequence: 5,
          }),
        ),
      readHistory: jest
        .fn()
        .mockResolvedValue(
          publicHistory([publicEvent(1)]) as PublicEventHistoryV1,
        ),
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: {
          async *[Symbol.asyncIterator]() {
            yield* streamed;
          },
        },
      }),
    };
    render(<ArenaShell arenaId={arenaId} transport={transport} />);

    const result = await screen.findByRole("region", { name: /final settlement/i });
    expect(within(result).getByText("Agent Alpha wins")).toBeInTheDocument();
    const record = screen.getByRole("article", {
      name: /kickoff decision record/i,
    });
    expect(within(record).getByText("Alpha public response")).toBeInTheDocument();
    expect(within(record).getByText("Beta public response")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/arena record complete/i);
    expect(transport.streamEvents).toHaveBeenCalledWith(
      arenaId,
      1,
      expect.any(AbortSignal),
    );
  });
});
