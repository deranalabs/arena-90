import { render, screen } from "@testing-library/react";

import { ArenaExperience } from "@/components/arena/ArenaExperience";
import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicCheckpointV1,
  PublicDecisionV1,
} from "@/lib/arena-api/contracts";
import type { RuntimeTransport } from "@/lib/arena-api/transport";
import {
  publicEvent,
  publicHistory,
  publicPortfolio,
  publicSnapshot,
  publicState,
} from "@/test-support/arena-api-fixtures";

const arenaId = "arena-replay-001";

function transportFor(
  state: PublicArenaStateV1,
  events: PublicArenaEventV1[],
): RuntimeTransport {
  return {
    readState: jest.fn().mockResolvedValue(state),
    readHistory: jest.fn().mockResolvedValue(publicHistory(events)),
    streamEvents: jest.fn().mockResolvedValue({ status: "TERMINAL" }),
  };
}

function decision(agentId: "alpha" | "beta"): PublicDecisionV1 {
  return {
    schemaVersion: 1,
    arenaId,
    snapshotId: "snapshot-kickoff",
    checkpointId: "KICKOFF",
    agentId,
    action: "NO_TRADE",
    publicExplanation: `${agentId} found no validated edge in the locked snapshot.`,
  };
}

function revealedRun() {
  const portfolios = {
    alpha: publicPortfolio("alpha"),
    beta: publicPortfolio("beta"),
  };
  const decisions = { alpha: decision("alpha"), beta: decision("beta") };
  const checkpoint: PublicCheckpointV1 = {
    checkpointId: "KICKOFF",
    outcome: "REVEALED",
    snapshot: publicSnapshot(),
    revealedDecisions: decisions,
    failures: [],
    portfoliosBefore: portfolios,
    portfoliosAfter: portfolios,
    firstEventSequence: 2,
    lastEventSequence: 2,
  };
  const events = [
    publicEvent(1) as PublicArenaEventV1,
    publicEvent(2, "ROUND_REVEALED", {
      checkpointId: "KICKOFF",
      payload: {
        decisions,
        failures: [],
        portfoliosBefore: portfolios,
        portfoliosAfter: portfolios,
      },
    }) as PublicArenaEventV1,
  ];
  const state = publicState({
    phase: "RUNNING",
    currentSnapshot: publicSnapshot(),
    checkpoints: [checkpoint],
    nextCheckpointId: "M15",
    lastEventSequence: 2,
  }) as PublicArenaStateV1;
  return { state, events };
}

function preRevealRun() {
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
  return { state, events };
}

function globalMissedRun() {
  const portfolios = {
    alpha: publicPortfolio("alpha"),
    beta: publicPortfolio("beta"),
  };
  const checkpoint: PublicCheckpointV1 = {
    checkpointId: "KICKOFF",
    outcome: "GLOBAL_MISSED",
    revealedDecisions: {},
    failures: [{ scope: "GLOBAL", reason: "DATA_UNAVAILABLE" }],
    portfoliosBefore: portfolios,
    portfoliosAfter: portfolios,
    firstEventSequence: 2,
    lastEventSequence: 2,
  };
  const events = [
    publicEvent(1) as PublicArenaEventV1,
    publicEvent(2, "GLOBAL_MISSED_DECISION_ROUND", {
      checkpointId: "KICKOFF",
      payload: { reason: "DATA_UNAVAILABLE" },
    }) as PublicArenaEventV1,
  ];
  return {
    events,
    state: publicState({
      phase: "RUNNING",
      checkpoints: [checkpoint],
      nextCheckpointId: "M15",
      lastEventSequence: 2,
    }) as PublicArenaStateV1,
  };
}

function completedRun() {
  const alpha = {
    ...publicPortfolio("alpha"),
    cashMicros: "12500000",
    unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
    navMicros: "112500000",
    returnBps: 1_250,
    updatedAtCheckpoint: "FINAL" as const,
  };
  const beta = {
    ...publicPortfolio("beta"),
    cashMicros: "8000000",
    unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
    navMicros: "108000000",
    returnBps: 800,
    updatedAtCheckpoint: "FINAL" as const,
  };
  const finalResult = {
    schemaVersion: 1 as const,
    arenaId,
    winningAssetId: "HOME" as const,
    winner: "alpha" as const,
    alphaFinalNavMicros: alpha.navMicros,
    betaFinalNavMicros: beta.navMicros,
    finalResultHash: "d".repeat(64),
  };
  const state = publicState({
    phase: "COMPLETED",
    nextCheckpointId: undefined,
    portfolios: { alpha, beta },
    leader: { result: "alpha", provisional: false },
    finalResult,
    lastEventSequence: 2,
  }) as PublicArenaStateV1;
  const events = [
    publicEvent(1) as PublicArenaEventV1,
    publicEvent(2, "COMPLETED", {
      checkpointId: "FINAL",
      payload: { result: finalResult, portfolios: { alpha, beta } },
    }) as PublicArenaEventV1,
  ];
  return { state, events };
}

describe("Arena90 spectator experience", () => {
  it("renders an honest autonomous Replay from canonical state and durable events", async () => {
    const run = revealedRun();
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(run.state, run.events)}
      />,
    );

    expect(await screen.findByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("AUTONOMOUS REPLAY · RECORDED MATCH DATA")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home FC vs Away FC" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Beta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Agent Alpha current allocation")).toHaveTextContent(
      /home fc.*0\.0%.*cash.*100\.0%/i,
    );
    expect(screen.getByRole("group", { name: "KICKOFF simultaneous reveal" })).toHaveTextContent(
      /alpha found no validated edge.*beta found no validated edge/i,
    );
    expect(screen.getByRole("region", { name: "Next decision round" })).toHaveTextContent("15′");
    expect(document.body).not.toHaveTextContent(/prompt|provider payload|chain-of-thought|live now/i);
  });

  it("shows aggregate receipt state without leaking either decision before ROUND_REVEALED", async () => {
    const run = preRevealRun();
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(run.state, run.events)}
      />,
    );

    expect(await screen.findByText("DECISIONS RECEIVED 1/2")).toBeInTheDocument();
    expect(screen.getByText(/allocations remain hidden until both outcomes are committed/i)).toBeInTheDocument();
    expect(screen.getAllByText("WAITING FOR REVEAL")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent(/validated edge|target allocation|public response/i);
  });

  it("presents a global missed round honestly and preserves both portfolios", async () => {
    const run = globalMissedRun();
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(run.state, run.events)}
      />,
    );

    expect((await screen.findAllByText("GLOBAL MISSED DECISION ROUND")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/both portfolios preserved/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/no fallback trade was created/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/no trade/i);
  });

  it("labels degraded recorded data without presenting it as live", async () => {
    const snapshot = publicSnapshot();
    const state = publicState({
      phase: "RUNNING",
      currentSnapshot: {
        ...snapshot,
        freshness: { ...snapshot.freshness, delayed: true },
      },
    }) as PublicArenaStateV1;
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(state, [publicEvent(1) as PublicArenaEventV1])}
      />,
    );

    expect(await screen.findByText("DATA DELAYED")).toBeInTheDocument();
    expect(screen.getByText("TXLINE_RECORDED")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/data live|live arena/i);
  });

  it("renders a verified terminal result only when final accounting is consistent", async () => {
    const run = completedRun();
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(run.state, run.events)}
      />,
    );

    expect(await screen.findByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Alpha wins" })).toBeInTheDocument();
    expect(screen.getAllByText("112.50 vUSD").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("108.00 vUSD").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(screen.getByText("d".repeat(64))).toBeInTheDocument();
  });

  it("fails closed when a Replay route receives a LIVE arena binding", async () => {
    const state = publicState({
      manifest: { ...publicState().manifest, mode: "LIVE" },
    }) as PublicArenaStateV1;
    render(
      <ArenaExperience
        arenaId={arenaId}
        experience="replay"
        transport={transportFor(state, [publicEvent(1) as PublicArenaEventV1])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Arena unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/no unverified fallback is shown/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("TXLINE_LIVE");
  });
});
