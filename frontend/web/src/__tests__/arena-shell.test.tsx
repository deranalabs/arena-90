import { act, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";

import { ArenaShell } from "@/components/arena/ArenaShell";
import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicEventHistoryV1,
} from "@/lib/arena-api/contracts";
import type {
  RuntimeEventStream,
  RuntimeTransport,
} from "@/lib/arena-api/transport";
import {
  publicEvent,
  publicHistory,
  publicSnapshot,
  publicState,
} from "@/test-support/arena-api-fixtures";

const arenaId = "arena-replay-001";

function CommitProbe({
  children,
  onCommit,
}: {
  children: ReactNode;
  onCommit: (visibleText: string) => void;
}) {
  useLayoutEffect(() => {
    onCommit(document.body.textContent ?? "");
  });
  return children;
}

function openStream(
  events: readonly PublicArenaEventV1[] = [],
): RuntimeEventStream {
  return {
    status: "OPEN",
    events: {
      async *[Symbol.asyncIterator]() {
        yield* events;
      },
    },
  };
}

function followingStream(): RuntimeEventStream {
  return {
    status: "OPEN",
    events: {
      [Symbol.asyncIterator]() {
        let finish: (() => void) | undefined;
        return {
          next: () => new Promise<IteratorResult<PublicArenaEventV1>>((resolve) => {
            finish = () => resolve({ done: true, value: undefined });
          }),
          return: async () => {
            finish?.();
            return { done: true, value: undefined };
          },
        };
      },
    },
  };
}

function transportFor(options: {
  state?: PublicArenaStateV1;
  history?: PublicEventHistoryV1;
  stream?: RuntimeEventStream;
  streamEvents?: RuntimeTransport["streamEvents"];
} = {}): RuntimeTransport {
  const readyEvent = publicEvent(1) as PublicArenaEventV1;
  const state = (options.state ?? publicState()) as PublicArenaStateV1;
  const history =
    options.history ?? (publicHistory([readyEvent]) as PublicEventHistoryV1);

  return {
    readState: jest.fn().mockResolvedValue(state),
    readHistory: jest.fn().mockResolvedValue(history),
    streamEvents:
      options.streamEvents ??
      jest.fn().mockResolvedValue(options.stream ?? followingStream()),
  };
}

function runningFixture() {
  const snapshot = {
    ...publicSnapshot(),
    snapshotId: "snapshot-m15",
    checkpointId: "M15",
    match: {
      ...publicSnapshot().match,
      minute: 15,
      homeScore: 1,
      awayScore: 0,
    },
  };
  const events = [
    publicEvent(1),
    publicEvent(2, "CHECKPOINT_OPENED", {
      checkpointId: "M15",
      payload: { snapshot },
    }),
    publicEvent(3, "AGENTS_ANALYZING", {
      checkpointId: "M15",
      payload: {},
    }),
  ] as PublicArenaEventV1[];
  const state = publicState({
    phase: "RUNNING",
    currentSnapshot: snapshot,
    nextCheckpointId: "M15",
    lastEventSequence: 3,
  }) as PublicArenaStateV1;
  return {
    state,
    history: publicHistory(events) as PublicEventHistoryV1,
  };
}

describe("canonical arena shell", () => {
  it("renders READY from canonical public state without inventing score or mode", async () => {
    render(<ArenaShell arenaId={arenaId} transport={transportFor()} />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading arena/i);
    expect(await screen.findByRole("heading", { name: /home fc vs away fc/i })).toBeInTheDocument();
    expect(screen.getByText("REPLAY")).toBeInTheDocument();
    expect(screen.queryByText(/fixture source/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TXLINE_LIVE|TXLINE_RECORDED/)).not.toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.queryByLabelText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/minute/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Alpha" })).toBeInTheDocument();
    expect(screen.getByText("Momentum & Repricing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Beta" })).toBeInTheDocument();
    expect(screen.getByText("Structure & Valuation Control")).toBeInTheDocument();
    expect(screen.getAllByText("100.00 vUSD")).toHaveLength(4);
    expect(screen.getByText("KICKOFF").closest("li")).toHaveTextContent("NEXT");
    expect(screen.queryByText("SNAPSHOT LOCKED")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to arena90/i })).toHaveAttribute("href", "/");
  });

  it("renders RUNNING locked checkpoint and ANALYZING without private decisions", async () => {
    const fixture = runningFixture();
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor(fixture)}
      />,
    );

    expect(await screen.findByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByLabelText("Score")).toHaveTextContent("1–0");
    expect(screen.getByText("15′")).toBeInTheDocument();
    expect(screen.getByText("TXLINE_RECORDED")).toBeInTheDocument();
    expect(screen.getByText(/locked public snapshot/i)).toBeInTheDocument();
    expect(screen.getByText("ANALYZING")).toBeInTheDocument();
    expect(screen.queryByText(/publicExplanation|targetAllocation/i)).not.toBeInTheDocument();
  });

  it("keeps the next checkpoint waiting until a matching snapshot is locked", async () => {
    const oldSnapshot = publicSnapshot();
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor({
          state: publicState({
            phase: "RUNNING",
            currentSnapshot: oldSnapshot,
            nextCheckpointId: "M15",
          }) as PublicArenaStateV1,
        })}
      />,
    );

    await screen.findByText("RUNNING");
    expect(screen.getByText("M15").closest("li")).toHaveTextContent("NEXT");
    expect(screen.queryByText("SNAPSHOT LOCKED")).not.toBeInTheDocument();
  });

  it("never labels a READY checkpoint as snapshot locked", async () => {
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor({
          state: publicState({ currentSnapshot: publicSnapshot() }) as PublicArenaStateV1,
        })}
      />,
    );

    await screen.findByText("READY");
    expect(screen.getByText("KICKOFF").closest("li")).toHaveTextContent("NEXT");
    expect(screen.queryByText("SNAPSHOT LOCKED")).not.toBeInTheDocument();
  });

  it("shows SNAPSHOT LOCKED only when public state and event evidence match", async () => {
    const snapshot = {
      ...publicSnapshot(),
      snapshotId: "snapshot-m15-locked",
      checkpointId: "M15" as const,
    };
    const checkpointOpened = publicEvent(2, "CHECKPOINT_OPENED", {
      checkpointId: "M15",
      payload: { snapshot },
    }) as PublicArenaEventV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor({
          state: publicState({
            phase: "RUNNING",
            currentSnapshot: snapshot,
            nextCheckpointId: "M15",
            lastEventSequence: 2,
          }) as PublicArenaStateV1,
          history: publicHistory([
            publicEvent(1) as PublicArenaEventV1,
            checkpointOpened,
          ]) as PublicEventHistoryV1,
        })}
      />,
    );

    await screen.findByText("RUNNING");
    expect(screen.getByText("M15").closest("li")).toHaveTextContent(
      "SNAPSHOT LOCKED",
    );
    expect(screen.getByText(/locked public snapshot · m15/i)).toBeInTheDocument();
  });

  it.each(["FINALIZING", "COMPLETED"] as const)(
    "renders %s truthfully",
    async (phase) => {
      const stream = phase === "COMPLETED" ? { status: "TERMINAL" as const } : followingStream();
      render(
        <ArenaShell
          arenaId={arenaId}
          transport={transportFor({
            state: publicState({
              phase,
              nextCheckpointId: phase === "FINALIZING" ? "FINAL" : undefined,
            }) as PublicArenaStateV1,
            stream,
          })}
        />,
      );

      expect(await screen.findByText(phase)).toBeInTheDocument();
      if (phase === "FINALIZING") {
        expect(screen.getByText(/verifying final result/i)).toBeInTheDocument();
      } else {
        expect(screen.getByRole("status")).toHaveTextContent(/arena record complete/i);
      }
    },
  );

  it("announces connecting and reconnecting without claiming a live connection", async () => {
    let resolveStream: ((value: RuntimeEventStream) => void) | undefined;
    const firstStream = new Promise<RuntimeEventStream>((resolve) => {
      resolveStream = resolve;
    });
    const transport = transportFor({
      streamEvents: jest
        .fn()
        .mockReturnValueOnce(firstStream)
        .mockResolvedValueOnce(openStream()),
    });
    render(<ArenaShell arenaId={arenaId} transport={transport} />);

    expect(await screen.findByText(/connecting to public event stream/i)).toBeInTheDocument();
    await act(async () => resolveStream?.(openStream()));
    expect(await screen.findByText(/reconnecting to public event stream/i)).toBeInTheDocument();
    expect(screen.queryByText(/stream active/i)).not.toBeInTheDocument();
  });

  it("shows degraded freshness only from the canonical snapshot", async () => {
    const snapshot = {
      ...publicSnapshot(),
      freshness: { ...publicSnapshot().freshness, delayed: true },
    };
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor({
          state: publicState({ currentSnapshot: snapshot }) as PublicArenaStateV1,
        })}
      />,
    );

    expect(await screen.findByText(/public data delayed/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/degraded/i);
  });

  it("fails closed with a sanitized unavailable state when the stream gaps", async () => {
    const gap = publicEvent(3) as PublicArenaEventV1;
    render(
      <ArenaShell
        arenaId={arenaId}
        transport={transportFor({ stream: openStream([gap]) })}
      />,
    );

    expect(await screen.findByText("Arena unavailable")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/verified public data could not be continued/i);
    expect(screen.queryByText(/invalid_data|transport_failure|sequence/i)).not.toBeInTheDocument();
  });

  it("aborts the spectator stream when unmounted", async () => {
    let observedSignal: AbortSignal | undefined;
    const transport = transportFor({
      streamEvents: jest.fn(async (_arenaId, _after, signal) => {
        observedSignal = signal;
        return followingStream();
      }),
    });
    const view = render(<ArenaShell arenaId={arenaId} transport={transport} />);

    await screen.findByText(/public event stream active/i);
    view.unmount();

    await waitFor(() => expect(observedSignal?.aborted).toBe(true));
  });

  it("disposes the old spectator stream when the route arena changes", async () => {
    const signals: AbortSignal[] = [];
    const commits: string[] = [];
    const pendingArenaState = new Promise<PublicArenaStateV1>(() => undefined);
    const transport: RuntimeTransport = {
      readState: jest.fn(async (requestedArenaId) => {
        if (requestedArenaId !== arenaId) return pendingArenaState;
        const state = publicState() as PublicArenaStateV1;
        return {
          ...state,
          manifest: {
            ...state.manifest,
            arenaId: requestedArenaId,
          },
        };
      }),
      readHistory: jest.fn(async (requestedArenaId) => {
        const event = {
          ...publicEvent(1),
          arenaId: requestedArenaId,
        } as PublicArenaEventV1;
        return {
          ...publicHistory([event]),
          arenaId: requestedArenaId,
        } as PublicEventHistoryV1;
      }),
      streamEvents: jest.fn(async (_requestedArenaId, _after, signal) => {
        signals.push(signal);
        return followingStream();
      }),
    };
    const view = render(
      <CommitProbe onCommit={(text) => commits.push(text)}>
        <ArenaShell arenaId={arenaId} transport={transport} />
      </CommitProbe>,
    );
    await screen.findByRole("heading", { name: /home fc vs away fc/i });
    await screen.findByText(/public event stream active/i);
    commits.length = 0;

    view.rerender(
      <CommitProbe onCommit={(text) => commits.push(text)}>
        <ArenaShell arenaId="arena-replay-002" transport={transport} />
      </CommitProbe>,
    );

    expect(screen.getByText("arena-replay-002")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /home fc vs away fc/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /arena loading/i })).toBeInTheDocument();
    expect(
      commits.some(
        (text) => text.includes("arena-replay-002") && text.includes("Home FC"),
      ),
    ).toBe(false);
    expect(signals[0]?.aborted).toBe(true);
  });
});
