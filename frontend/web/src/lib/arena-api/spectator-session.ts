import {
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
  type PublicArenaEventV1,
  type PublicArenaStateV1,
} from "./contracts";
import {
  ArenaTransportError,
  type RuntimeEventStream,
  type RuntimeTransport,
} from "./transport";

export type SpectatorSessionStatus =
  | "IDLE"
  | "BOOTSTRAPPING"
  | "FOLLOWING"
  | "TERMINAL"
  | "FAILED"
  | "DISPOSED";

export interface SpectatorSessionSnapshot {
  status: SpectatorSessionStatus;
  state?: PublicArenaStateV1;
  events: readonly PublicArenaEventV1[];
  lastConfirmedSequence: number;
  failure?: { category: "INVALID_DATA" | "TRANSPORT_FAILURE" };
}

export interface SpectatorSession {
  start(): Promise<void>;
  dispose(): Promise<void>;
  getSnapshot(): SpectatorSessionSnapshot;
  subscribe(listener: (snapshot: SpectatorSessionSnapshot) => void): () => void;
}

class SessionInvariantError extends Error {}

function aborted() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted", "AbortError");
  }
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isTransient(error: unknown) {
  if (error instanceof SessionInvariantError) return false;
  if (!(error instanceof ArenaTransportError)) return true;
  return (
    error.category === "NETWORK_FAILURE" ||
    (error.category === "API_ERROR" && (error.status ?? 0) >= 500)
  );
}

function sameEvent(left: PublicArenaEventV1, right: PublicArenaEventV1) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(aborted());
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export function createSpectatorSession(options: {
  arenaId: string;
  transport: RuntimeTransport;
  reconnectDelayMs?: number;
}): SpectatorSession {
  const { arenaId, transport } = options;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
  const controller = new AbortController();
  const listeners = new Set<(snapshot: SpectatorSessionSnapshot) => void>();
  const eventBySequence = new Map<number, PublicArenaEventV1>();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let startPromise: Promise<void> | undefined;
  let disposed = false;
  let snapshot: SpectatorSessionSnapshot = {
    status: "IDLE",
    events: [],
    lastConfirmedSequence: 0,
  };

  const publish = (next: SpectatorSessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  const update = (next: Partial<SpectatorSessionSnapshot>) => {
    publish({ ...snapshot, ...next });
  };

  const waitToReconnect = () =>
    new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) {
        reject(aborted());
        return;
      }

      const finish = () => {
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        controller.signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        controller.signal.removeEventListener("abort", onAbort);
        reject(aborted());
      };

      controller.signal.addEventListener("abort", onAbort, { once: true });
      reconnectTimer = setTimeout(finish, reconnectDelayMs);
    });

  const readState = async () => {
    const value = await raceAbort(
      transport.readState(arenaId, controller.signal),
      controller.signal,
    );
    const parsed = publicArenaStateV1Schema.safeParse(value);
    if (!parsed.success || parsed.data.manifest.arenaId !== arenaId) {
      throw new SessionInvariantError();
    }
    return parsed.data;
  };

  const readHistory = async (afterSequence: number) => {
    const value = await raceAbort(
      transport.readHistory(arenaId, afterSequence, controller.signal),
      controller.signal,
    );
    const parsed = publicEventHistoryV1Schema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.arenaId !== arenaId ||
      parsed.data.afterSequence !== afterSequence ||
      parsed.data.lastEventSequence !== afterSequence + parsed.data.events.length
    ) {
      throw new SessionInvariantError();
    }
    return parsed.data;
  };

  const parseEvent = (candidate: unknown) => {
    const parsed = publicArenaEventV1Schema.safeParse(candidate);
    if (!parsed.success || parsed.data.arenaId !== arenaId) {
      throw new SessionInvariantError();
    }
    return parsed.data;
  };

  const append = (candidate: unknown) => {
    const event = parseEvent(candidate);
    const existing = eventBySequence.get(event.sequence);
    if (existing) {
      if (!sameEvent(existing, event)) throw new SessionInvariantError();
      return false;
    }
    if (event.sequence !== snapshot.lastConfirmedSequence + 1) {
      throw new SessionInvariantError();
    }

    eventBySequence.set(event.sequence, event);
    update({
      events: [...snapshot.events, event],
      lastConfirmedSequence: event.sequence,
    });
    return true;
  };

  const refreshState = async () => {
    while (!controller.signal.aborted) {
      try {
        const state = await readState();
        if (state.lastEventSequence < snapshot.lastConfirmedSequence) {
          throw new SessionInvariantError();
        }
        update({ state });
        return;
      } catch (error) {
        if (isAbort(error) || !isTransient(error)) throw error;
        await waitToReconnect();
      }
    }
  };

  const reconcileBootstrap = async () => {
    let state = await readState();
    const firstHistory = await readHistory(0);
    firstHistory.events.forEach(append);

    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (state.lastEventSequence === snapshot.lastConfirmedSequence) {
        update({ state });
        return;
      }

      if (state.lastEventSequence < snapshot.lastConfirmedSequence) {
        state = await readState();
      } else {
        const history = await readHistory(snapshot.lastConfirmedSequence);
        if (history.events.length === 0) throw new SessionInvariantError();
        history.events.forEach(append);
      }
    }

    throw new SessionInvariantError();
  };

  const openStream = () =>
    raceAbort(
      transport.streamEvents(
        arenaId,
        snapshot.lastConfirmedSequence,
        controller.signal,
      ),
      controller.signal,
    );

  const consume = async (stream: RuntimeEventStream) => {
    if (stream.status === "TERMINAL") return "TERMINAL" as const;

    const iterator = stream.events[Symbol.asyncIterator]();
    let lastStreamSequence = snapshot.lastConfirmedSequence;
    let primaryError: unknown;
    try {
      while (!controller.signal.aborted) {
        const result = await raceAbort(iterator.next(), controller.signal);
        if (result.done) return "RECONNECT" as const;
        const event = parseEvent(result.value);
        if (event.sequence < lastStreamSequence) {
          throw new SessionInvariantError();
        }
        lastStreamSequence = event.sequence;
        const added = append(event);
        if (!added) continue;

        if (
          event.type === "ROUND_COMPLETE" ||
          event.type === "FINALIZING" ||
          event.type === "COMPLETED"
        ) {
          await refreshState();
        }
        if (event.type === "COMPLETED") return "TERMINAL" as const;
      }
      return "TERMINAL" as const;
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      if (iterator.return) {
        try {
          await iterator.return();
        } catch (cleanupError) {
          if (primaryError === undefined) throw cleanupError;
        }
      }
    }
  };

  const follow = async () => {
    update({ status: "FOLLOWING" });
    while (!controller.signal.aborted) {
      try {
        const outcome = await consume(await openStream());
        if (outcome === "TERMINAL") {
          update({ status: "TERMINAL" });
          return;
        }
      } catch (error) {
        if (isAbort(error)) return;
        if (!isTransient(error)) throw error;
      }
      await waitToReconnect();
    }
  };

  const run = async () => {
    update({ status: "BOOTSTRAPPING" });
    try {
      await reconcileBootstrap();
      await follow();
    } catch (error) {
      if (disposed || isAbort(error)) return;
      update({
        status: "FAILED",
        failure: {
          category:
            error instanceof SessionInvariantError ||
            (error instanceof ArenaTransportError &&
              (error.category === "INVALID_REQUEST" ||
                error.category === "INVALID_RESPONSE"))
              ? "INVALID_DATA"
              : "TRANSPORT_FAILURE",
        },
      });
    }
  };

  return {
    start() {
      if (disposed) {
        startPromise ??= Promise.resolve();
        return startPromise;
      }
      startPromise ??= run();
      return startPromise;
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        controller.abort();
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        update({ status: "DISPOSED" });
        listeners.clear();
      }
      await startPromise;
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
