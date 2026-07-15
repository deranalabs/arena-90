import { createSpectatorSession } from "@/lib/arena-api/spectator-session";
import {
  ArenaTransportError,
  type RuntimeTransport,
} from "@/lib/arena-api/transport";

import { publicEvent, publicHistory, publicState } from "../test-support/arena-api-fixtures";

const portfolios = publicState().portfolios;

function roundComplete(sequence: number) {
  return publicEvent(sequence, "ROUND_COMPLETE", {
    checkpointId: "KICKOFF",
    payload: { portfolios, nextCheckpointId: "M15" },
  });
}

function finalizing(sequence: number) {
  return publicEvent(sequence, "FINALIZING", { checkpointId: "FINAL" });
}

function completed(sequence: number) {
  return publicEvent(sequence, "COMPLETED", {
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
  });
}

function scriptedTransport(overrides: Partial<RuntimeTransport> = {}) {
  return {
    readState: jest.fn().mockResolvedValue(publicState()),
    readHistory: jest.fn().mockResolvedValue(publicHistory([publicEvent(1)])),
    streamEvents: jest.fn().mockResolvedValue({ status: "TERMINAL" }),
    ...overrides,
  } as unknown as RuntimeTransport & {
    readState: jest.Mock;
    readHistory: jest.Mock;
    streamEvents: jest.Mock;
  };
}

async function* events(...items: unknown[]) {
  for (const item of items) yield item;
}

describe("spectator session coordinator", () => {
  it("bootstraps state and durable history, then opens SSE after the reconciled tail", async () => {
    const transport = scriptedTransport({
      readState: jest
        .fn()
        .mockResolvedValueOnce(publicState({ lastEventSequence: 1 }))
        .mockResolvedValueOnce(publicState({ lastEventSequence: 2 })),
      readHistory: jest
        .fn()
        .mockResolvedValue(publicHistory([publicEvent(1), publicEvent(2)])),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(transport.streamEvents).toHaveBeenCalledWith(
      "arena-replay-001",
      2,
      expect.any(AbortSignal),
    );
    expect(session.getSnapshot()).toMatchObject({
      status: "TERMINAL",
      lastConfirmedSequence: 2,
      state: { lastEventSequence: 2 },
    });
    expect(session.getSnapshot().events.map((event) => event.sequence)).toEqual([
      1, 2,
    ]);
  });

  it("reconnects from the last confirmed event and refreshes canonical state", async () => {
    const transport = scriptedTransport({
      readState: jest
        .fn()
        .mockResolvedValueOnce(publicState({ phase: "RUNNING", lastEventSequence: 1 }))
        .mockResolvedValueOnce(publicState({ phase: "RUNNING", lastEventSequence: 2 }))
        .mockResolvedValueOnce(publicState({ phase: "FINALIZING", lastEventSequence: 3 }))
        .mockResolvedValueOnce(publicState({ phase: "COMPLETED", lastEventSequence: 4 })),
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({ status: "OPEN", events: events(roundComplete(2)) })
        .mockResolvedValueOnce({
          status: "OPEN",
          events: events(finalizing(3), completed(4)),
        }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(transport.streamEvents.mock.calls.map(([, cursor]) => cursor)).toEqual([
      1, 2,
    ]);
    expect(transport.readState).toHaveBeenCalledTimes(4);
    expect(session.getSnapshot()).toMatchObject({
      status: "TERMINAL",
      lastConfirmedSequence: 4,
      state: { phase: "COMPLETED", lastEventSequence: 4 },
    });
  });

  it("reconnects after a transient stream failure from the same confirmed cursor", async () => {
    const transport = scriptedTransport({
      streamEvents: jest
        .fn()
        .mockRejectedValueOnce(new ArenaTransportError("NETWORK_FAILURE"))
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(transport.streamEvents.mock.calls.map(([, cursor]) => cursor)).toEqual([
      1, 1,
    ]);
    expect(session.getSnapshot().status).toBe("TERMINAL");
  });

  it("announces connecting, following, and reconnecting from real stream transitions", async () => {
    const transport = scriptedTransport({
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({ status: "OPEN", events: events() })
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });
    const observed: string[] = [];
    session.subscribe(({ status }) => observed.push(status));

    await session.start();

    expect(observed).toEqual(
      expect.arrayContaining([
        "BOOTSTRAPPING",
        "CONNECTING",
        "FOLLOWING",
        "RECONNECTING",
        "TERMINAL",
      ]),
    );
  });

  it("fails closed on a sequence gap instead of reconnecting past it", async () => {
    const transport = scriptedTransport({
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({ status: "OPEN", events: events(publicEvent(3)) })
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(session.getSnapshot()).toMatchObject({
      status: "FAILED",
      lastConfirmedSequence: 1,
      failure: { category: "INVALID_DATA" },
    });
    expect(transport.streamEvents).toHaveBeenCalledTimes(1);
  });

  it("ignores an exact duplicate but rejects a conflicting duplicate", async () => {
    const acceptedTransport = scriptedTransport({
      readState: jest
        .fn()
        .mockResolvedValueOnce(publicState({ lastEventSequence: 1 }))
        .mockResolvedValueOnce(publicState({ phase: "RUNNING", lastEventSequence: 2 })),
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({
          status: "OPEN",
          events: events(publicEvent(1), roundComplete(2)),
        })
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const accepted = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport: acceptedTransport,
      reconnectDelayMs: 0,
    });

    await accepted.start();
    expect(accepted.getSnapshot().events.map((event) => event.sequence)).toEqual([
      1, 2,
    ]);

    const rejectedTransport = scriptedTransport({
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: events(publicEvent(1, "ARENA_READY", { eventId: "forged" })),
      }),
    });
    const rejected = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport: rejectedTransport,
      reconnectDelayMs: 0,
    });

    await rejected.start();
    expect(rejected.getSnapshot()).toMatchObject({
      status: "FAILED",
      failure: { category: "INVALID_DATA" },
    });
  });

  it("rejects an exact historical duplicate after the current stream moved forward", async () => {
    const transport = scriptedTransport({
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({
          status: "OPEN",
          events: events(publicEvent(2), publicEvent(1)),
        })
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(session.getSnapshot()).toMatchObject({
      status: "FAILED",
      lastConfirmedSequence: 2,
      failure: { category: "INVALID_DATA" },
    });
    expect(transport.streamEvents).toHaveBeenCalledTimes(1);
  });

  it("fails closed when an event reorders behind the confirmed cursor", async () => {
    const transport = scriptedTransport({
      readState: jest
        .fn()
        .mockResolvedValueOnce(publicState({ lastEventSequence: 1 }))
        .mockResolvedValueOnce(publicState({ phase: "RUNNING", lastEventSequence: 2 })),
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: events(
          roundComplete(2),
          publicEvent(1, "ARENA_READY", { eventId: "reordered-conflict" }),
        ),
      }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(session.getSnapshot()).toMatchObject({
      status: "FAILED",
      lastConfirmedSequence: 2,
      failure: { category: "INVALID_DATA" },
    });
  });

  it("fails closed when an injected stream bypasses transport schema validation", async () => {
    const transport = scriptedTransport({
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: events({ ...publicEvent(2), providerPayload: { private: true } }),
      }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(session.getSnapshot()).toMatchObject({
      status: "FAILED",
      lastConfirmedSequence: 1,
      failure: { category: "INVALID_DATA" },
    });
  });

  it("dispose aborts hanging bootstrap work and is idempotent", async () => {
    const observedSignals: AbortSignal[] = [];
    const never = (_arenaId: string, signal?: AbortSignal) => {
      if (signal) observedSignals.push(signal);
      return new Promise<never>(() => undefined);
    };
    const transport = scriptedTransport({
      readState: jest.fn(never),
      readHistory: jest.fn((_arenaId, _afterSequence, signal) =>
        never(_arenaId, signal),
      ),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
    });

    const running = session.start();
    await Promise.resolve();
    session.dispose();
    session.dispose();
    await running;

    expect(observedSignals).toHaveLength(1);
    expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
    expect(session.getSnapshot().status).toBe("DISPOSED");
  });

  it("start after dispose remains disposed and performs no transport work", async () => {
    const transport = scriptedTransport();
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
    });

    session.dispose();
    await session.start();

    expect(session.getSnapshot().status).toBe("DISPOSED");
    expect(transport.readState).not.toHaveBeenCalled();
    expect(transport.readHistory).not.toHaveBeenCalled();
    expect(transport.streamEvents).not.toHaveBeenCalled();
  });

  it("dispose cancels a hanging event iterator and pending reconnect work", async () => {
    let iteratorNextCalled = false;
    let iteratorReturned = false;
    const hangingEvents: AsyncIterable<never> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            iteratorNextCalled = true;
            return new Promise<IteratorResult<never>>(() => undefined);
          },
          return: async () => {
            iteratorReturned = true;
            return { done: true, value: undefined };
          },
        };
      },
    };
    const transport = scriptedTransport({
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: hangingEvents,
      }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 60_000,
    });

    const running = session.start();
    while (!iteratorNextCalled) await Promise.resolve();
    session.dispose();
    await running;

    expect(iteratorReturned).toBe(true);
    expect(session.getSnapshot().status).toBe("DISPOSED");
  });

  it("awaits iterator cleanup before start and dispose finish", async () => {
    let iteratorNextCalled = false;
    let iteratorReturnCalled = false;
    let releaseCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const hangingEvents: AsyncIterable<never> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            iteratorNextCalled = true;
            return new Promise<IteratorResult<never>>(() => undefined);
          },
          return: async () => {
            iteratorReturnCalled = true;
            await cleanup;
            return { done: true, value: undefined };
          },
        };
      },
    };
    const transport = scriptedTransport({
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: hangingEvents,
      }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
    });
    let startFinished = false;
    const running = session.start().then(() => {
      startFinished = true;
    });
    while (!iteratorNextCalled) await Promise.resolve();

    const disposing = session.dispose();
    await Promise.resolve();

    expect(disposing).toBeInstanceOf(Promise);
    expect(iteratorReturnCalled).toBe(true);
    expect(startFinished).toBe(false);

    releaseCleanup();
    await Promise.all([running, disposing]);
    expect(startFinished).toBe(true);
  });

  it("awaits normal iterator cleanup before reconnecting", async () => {
    let releaseCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const completedIterator: AsyncIterable<never> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: true, value: undefined }),
          return: async () => {
            await cleanup;
            return { done: true, value: undefined };
          },
        };
      },
    };
    const transport = scriptedTransport({
      streamEvents: jest
        .fn()
        .mockResolvedValueOnce({ status: "OPEN", events: completedIterator })
        .mockResolvedValueOnce({ status: "TERMINAL" }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });
    const running = session.start();
    while (transport.streamEvents.mock.calls.length === 0) await Promise.resolve();
    await Promise.resolve();

    expect(transport.streamEvents).toHaveBeenCalledTimes(1);
    releaseCleanup();
    await running;
    expect(transport.streamEvents).toHaveBeenCalledTimes(2);
  });

  it("preserves a primary ordering failure when iterator cleanup also fails", async () => {
    const brokenCleanupEvents: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]() {
        let sent = false;
        return {
          next: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: publicEvent(3) };
          },
          return: async () => {
            throw new Error("cleanup failed");
          },
        };
      },
    };
    const transport = scriptedTransport({
      streamEvents: jest.fn().mockResolvedValue({
        status: "OPEN",
        events: brokenCleanupEvents,
      }),
    });
    const session = createSpectatorSession({
      arenaId: "arena-replay-001",
      transport,
      reconnectDelayMs: 0,
    });

    await session.start();

    expect(session.getSnapshot()).toMatchObject({
      status: "FAILED",
      failure: { category: "INVALID_DATA" },
    });
    expect(transport.streamEvents).toHaveBeenCalledTimes(1);
  });

  it("dispose clears a scheduled reconnect timer", async () => {
    jest.useFakeTimers();
    try {
      const transport = scriptedTransport({
        streamEvents: jest.fn().mockResolvedValue({
          status: "OPEN",
          events: events(),
        }),
      });
      const session = createSpectatorSession({
        arenaId: "arena-replay-001",
        transport,
        reconnectDelayMs: 60_000,
      });

      const running = session.start();
      while (jest.getTimerCount() === 0) await Promise.resolve();
      session.dispose();
      await running;

      expect(jest.getTimerCount()).toBe(0);
      expect(transport.streamEvents).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
