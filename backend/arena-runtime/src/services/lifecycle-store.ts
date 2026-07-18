import { isDeepStrictEqual } from "node:util";

import {
  arenaLifecyclePersistenceV1Schema,
  arenaRunStateV1Schema,
  type ArenaLifecyclePersistenceV1,
  type ArenaRunStateV1,
  type PersistedArenaEventV1,
} from "../contracts/index.js";

export type ArenaLifecycleStoreErrorCode =
  | "INVALID_STORE_INPUT"
  | "MANIFEST_CONFLICT"
  | "LEASE_LOST"
  | "REVISION_CONFLICT"
  | "IMMUTABLE_STATE_CONFLICT"
  | "EVENT_SEQUENCE_CONFLICT"
  | "EVENT_RANGE_CONFLICT"
  | "PERSISTENCE_FAILURE";

export class ArenaLifecycleStoreError extends Error {
  readonly code: ArenaLifecycleStoreErrorCode;

  constructor(code: ArenaLifecycleStoreErrorCode, message: string) {
    super(message);
    this.name = "ArenaLifecycleStoreError";
    this.code = code;
  }
}

export interface ArenaRunLease {
  readonly storedState: unknown;
  readonly fencingToken: string;

  renew(expiresAtMs: number): Promise<void>;
  commit(input: {
    readonly nextState: ArenaRunStateV1;
    readonly appendEvents: readonly PersistedArenaEventV1[];
  }): Promise<ArenaRunStateV1>;
  release(): Promise<void>;
}

export interface ArenaLifecycleStore {
  initialize(
    state: ArenaRunStateV1,
    events: readonly PersistedArenaEventV1[],
  ): Promise<ArenaRunStateV1>;

  read(
    arenaId: string,
    afterEventSequence: number,
  ): Promise<ArenaLifecycleReadResult | "NOT_FOUND">;

  acquire(
    arenaId: string,
    ownerId: string,
    expiresAtMs: number,
  ): Promise<ArenaRunLease | "BUSY" | "NOT_FOUND">;
}

export interface ArenaLifecycleReadResult {
  readonly state: ArenaRunStateV1;
  readonly events: readonly PersistedArenaEventV1[];
}

interface ActiveLease {
  ownerId: string;
  fencingToken: string;
  expiresAtMs: number;
}

interface StoredArena {
  state: ArenaRunStateV1;
  events: PersistedArenaEventV1[];
  fencingSequence: number;
  lease?: ActiveLease;
}

interface InMemoryArenaLifecycleStoreConfig {
  readonly nowMs: () => number;
}

function invalidInput(): ArenaLifecycleStoreError {
  return new ArenaLifecycleStoreError(
    "INVALID_STORE_INPUT",
    "Invalid arena lifecycle store input",
  );
}

function parseTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw invalidInput();
  return value;
}

function parseOwnerId(value: string): string {
  if (value === "" || value.trim() !== value) throw invalidInput();
  return value;
}

function parsePersistence(
  state: unknown,
  events: unknown,
): ArenaLifecyclePersistenceV1 {
  const result = arenaLifecyclePersistenceV1Schema.safeParse({ state, events });
  if (!result.success) {
    if (
      result.error.issues.some(
        (issue) =>
          issue.message ===
          "Checkpoint event ranges must match persisted history",
      )
    ) {
      throw new ArenaLifecycleStoreError(
        "EVENT_RANGE_CONFLICT",
        "Checkpoint event ranges must match persisted history",
      );
    }
    if (
      result.error.issues.some(
        (issue) =>
          issue.message === "Persisted event history must be ordered and complete",
      )
    ) {
      throw new ArenaLifecycleStoreError(
        "EVENT_SEQUENCE_CONFLICT",
        "Arena lifecycle events must append contiguously",
      );
    }
    throw invalidInput();
  }

  try {
    return structuredClone(result.data);
  } catch {
    throw invalidInput();
  }
}

export function createInMemoryArenaLifecycleStore(
  config: InMemoryArenaLifecycleStoreConfig,
): ArenaLifecycleStore {
  if (typeof config?.nowMs !== "function") throw invalidInput();

  const arenas = new Map<string, StoredArena>();

  return {
    async initialize(stateInput, eventInputs) {
      const { state, events } = parsePersistence(stateInput, eventInputs);
      const existing = arenas.get(state.manifest.arenaId);
      if (existing !== undefined) {
        if (!isDeepStrictEqual(existing.state.manifest, state.manifest)) {
          throw new ArenaLifecycleStoreError(
            "MANIFEST_CONFLICT",
            "Arena manifest conflicts with persisted state",
          );
        }
        if (
          !isDeepStrictEqual(
            existing.state.runtimeMetadata,
            state.runtimeMetadata,
          )
        ) {
          throw new ArenaLifecycleStoreError(
            "IMMUTABLE_STATE_CONFLICT",
            "Arena runtime metadata conflicts with persisted state",
          );
        }
        return structuredClone(existing.state);
      }

      const storedState = structuredClone(state);
      const storedEvents = structuredClone(events);
      const responseState = structuredClone(state);
      arenas.set(state.manifest.arenaId, {
        state: storedState,
        events: storedEvents,
        fencingSequence: 0,
      });
      return responseState;
    },

    async read(arenaId, afterEventSequenceInput) {
      const afterEventSequence = parseTimestamp(afterEventSequenceInput);
      const arena = arenas.get(arenaId);
      if (arena === undefined) return "NOT_FOUND";
      const persistence = parsePersistence(arena.state, arena.events);
      if (afterEventSequence > persistence.state.lastEventSequence) {
        throw invalidInput();
      }
      return {
        state: persistence.state,
        events: persistence.events.filter(
          (event) => event.sequence > afterEventSequence,
        ),
      };
    },

    async acquire(arenaId, ownerIdInput, expiresAtMsInput) {
      const ownerId = parseOwnerId(ownerIdInput);
      const expiresAtMs = parseTimestamp(expiresAtMsInput);
      const nowMs = parseTimestamp(config.nowMs());
      if (expiresAtMs <= nowMs) throw invalidInput();

      const arena = arenas.get(arenaId);
      if (arena === undefined) return "NOT_FOUND";
      const storedArena = arena;
      if (
        storedArena.lease !== undefined &&
        storedArena.lease.expiresAtMs > nowMs
      ) {
        return "BUSY";
      }

      storedArena.fencingSequence += 1;
      const lease: ActiveLease = {
        ownerId,
        fencingToken: `${arenaId}:${storedArena.fencingSequence}`,
        expiresAtMs,
      };
      storedArena.lease = lease;

      function requireActiveLease(): void {
        const currentNowMs = parseTimestamp(config.nowMs());
        const activeLease = storedArena.lease;
        if (
          activeLease === undefined ||
          activeLease.fencingToken !== lease.fencingToken ||
          activeLease.ownerId !== lease.ownerId ||
          activeLease.expiresAtMs <= currentNowMs
        ) {
          throw new ArenaLifecycleStoreError(
            "LEASE_LOST",
            "Arena lifecycle lease is no longer active",
          );
        }
      }

      return {
        get storedState() {
          return structuredClone(storedArena.state);
        },
        fencingToken: lease.fencingToken,
        async renew(nextExpiresAtMsInput) {
          requireActiveLease();
          const nextExpiresAtMs = parseTimestamp(nextExpiresAtMsInput);
          if (nextExpiresAtMs <= parseTimestamp(config.nowMs())) {
            throw invalidInput();
          }
          lease.expiresAtMs = nextExpiresAtMs;
        },
        async commit({ nextState: nextStateInput, appendEvents: eventInputs }) {
          requireActiveLease();
          const nextState = arenaRunStateV1Schema.parse(nextStateInput);

          if (nextState.revision !== storedArena.state.revision + 1) {
            throw new ArenaLifecycleStoreError(
              "REVISION_CONFLICT",
              "Arena lifecycle revision must advance by one",
            );
          }
          if (
            !isDeepStrictEqual(nextState.manifest, storedArena.state.manifest)
          ) {
            throw new ArenaLifecycleStoreError(
              "MANIFEST_CONFLICT",
              "Arena manifest conflicts with persisted state",
            );
          }
          if (
            !isDeepStrictEqual(
              nextState.runtimeMetadata,
              storedArena.state.runtimeMetadata,
            )
          ) {
            throw new ArenaLifecycleStoreError(
              "IMMUTABLE_STATE_CONFLICT",
              "Arena runtime metadata conflicts with persisted state",
            );
          }

          const persistence = parsePersistence(nextState, [
            ...storedArena.events,
            ...eventInputs,
          ]);
          const responseState = structuredClone(persistence.state);
          storedArena.state = persistence.state;
          storedArena.events = [...persistence.events];
          return responseState;
        },
        async release() {
          if (storedArena.lease?.fencingToken === lease.fencingToken) {
            delete storedArena.lease;
          }
        },
      };
    },
  };
}
