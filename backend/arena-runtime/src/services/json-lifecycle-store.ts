import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readlink,
  rename,
  symlink,
  unlink,
} from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import {
  arenaLifecyclePersistenceV1Schema,
  arenaRunStateV1Schema,
  type ArenaLifecyclePersistenceV1,
  type ArenaRunStateV1,
  type PersistedArenaEventV1,
} from "../contracts/index.js";
import {
  ArenaLifecycleStoreError,
  type ArenaLifecycleReadResult,
  type ArenaLifecycleStore,
  type ArenaRunLease,
} from "./lifecycle-store.js";

const jsonStoreRecordV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    fencingSequence: z.number().int().nonnegative().safe(),
    lease: z
      .object({
        ownerId: z.string().min(1),
        processId: z.number().int().positive().safe(),
        fencingSequence: z.number().int().positive().safe(),
        fencingToken: z.string().min(1),
        expiresAtMs: z.number().int().nonnegative().safe(),
      })
      .strict()
      .optional(),
    persistence: arenaLifecyclePersistenceV1Schema,
  })
  .strict();

type JsonStoreRecordV1 = z.infer<typeof jsonStoreRecordV1Schema>;

interface JsonArenaLifecycleStoreConfig {
  readonly directory: string;
  readonly nowMs: () => number;
}

interface ActiveLease {
  readonly ownerId: string;
  readonly fencingSequence: number;
  readonly fencingToken: string;
  expiresAtMs: number;
}

function invalidInput(): ArenaLifecycleStoreError {
  return new ArenaLifecycleStoreError(
    "INVALID_STORE_INPUT",
    "Invalid arena lifecycle store input",
  );
}

function persistenceFailure(): ArenaLifecycleStoreError {
  return new ArenaLifecycleStoreError(
    "PERSISTENCE_FAILURE",
    "Arena lifecycle persistence failed",
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
  return structuredClone(result.data);
}

function arenaFileName(arenaId: string): string {
  const digest = createHash("sha256").update(arenaId).digest("hex");
  return `arena-${digest}.json`;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

function processIsAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
}

export function createJsonArenaLifecycleStore(
  config: JsonArenaLifecycleStoreConfig,
): ArenaLifecycleStore {
  if (
    typeof config?.directory !== "string" ||
    config.directory === "" ||
    config.directory.trim() !== config.directory ||
    typeof config.nowMs !== "function"
  ) {
    throw invalidInput();
  }

  const directory = config.directory;
  const activeLeases = new Map<string, ActiveLease>();
  let operationTail: Promise<void> = Promise.resolve();

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function ensureDirectory(): Promise<void> {
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
    } catch {
      throw persistenceFailure();
    }
  }

  function recordPath(arenaId: string): string {
    return join(directory, arenaFileName(arenaId));
  }

  async function withFileLock<T>(
    arenaId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    await ensureDirectory();
    const lockPath = `${recordPath(arenaId)}.lock`;
    const lockToken = `${process.pid}-${randomUUID()}`;
    let acquired = false;

    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      try {
        await symlink(lockToken, lockPath);
        acquired = true;
        break;
      } catch (error) {
        if (errorCode(error) !== "EEXIST") throw persistenceFailure();
      }

      let currentToken: string;
      try {
        currentToken = await readlink(lockPath);
      } catch (error) {
        if (errorCode(error) === "ENOENT") continue;
        throw persistenceFailure();
      }
      const separator = currentToken.indexOf("-");
      const processId = Number(currentToken.slice(0, separator));
      if (
        separator <= 0 ||
        !Number.isSafeInteger(processId) ||
        processId <= 0
      ) {
        throw persistenceFailure();
      }
      if (!processIsAlive(processId)) {
        try {
          if ((await readlink(lockPath)) === currentToken) {
            await unlink(lockPath);
          }
        } catch (error) {
          if (errorCode(error) !== "ENOENT") throw persistenceFailure();
        }
        continue;
      }
      await delay(5);
    }

    if (!acquired) throw persistenceFailure();
    try {
      return await operation();
    } finally {
      try {
        if ((await readlink(lockPath)) === lockToken) {
          await unlink(lockPath);
        }
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw persistenceFailure();
      }
    }
  }

  async function loadRecord(arenaId: string): Promise<JsonStoreRecordV1 | undefined> {
    await ensureDirectory();
    let serialized: string;
    try {
      serialized = await readFile(recordPath(arenaId), "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw persistenceFailure();
    }

    try {
      return jsonStoreRecordV1Schema.parse(JSON.parse(serialized) as unknown);
    } catch {
      throw persistenceFailure();
    }
  }

  async function syncDirectory(): Promise<void> {
    let directoryHandle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      directoryHandle = await open(directory, "r");
      await directoryHandle.sync();
    } catch {
      throw persistenceFailure();
    } finally {
      try {
        await directoryHandle?.close();
      } catch {
        // Preserve the sanitized persistence failure from directory sync.
      }
    }
  }

  async function writeRecord(
    arenaId: string,
    record: JsonStoreRecordV1,
  ): Promise<void> {
    await ensureDirectory();
    const parsed = jsonStoreRecordV1Schema.parse(record);
    const target = recordPath(arenaId);
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(parsed)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, target);
      await syncDirectory();
    } catch {
      try {
        await handle?.close();
      } catch {
        // Preserve the sanitized persistence failure.
      }
      try {
        await unlink(temporary);
      } catch {
        // The temporary file may already have been atomically renamed.
      }
      throw persistenceFailure();
    }
  }

  function requireActiveLease(
    arenaId: string,
    lease: ActiveLease,
    record: JsonStoreRecordV1,
  ): void {
    const active = activeLeases.get(arenaId);
    const nowMs = parseTimestamp(config.nowMs());
    if (
      active === undefined ||
      active.fencingToken !== lease.fencingToken ||
      active.ownerId !== lease.ownerId ||
      active.expiresAtMs <= nowMs
    ) {
      throw new ArenaLifecycleStoreError(
        "LEASE_LOST",
        "Arena lifecycle lease is no longer active",
      );
    }
    if (
      record.fencingSequence !== lease.fencingSequence ||
      record.lease?.ownerId !== lease.ownerId ||
      record.lease.processId !== process.pid ||
      record.lease.fencingSequence !== lease.fencingSequence ||
      record.lease.fencingToken !== lease.fencingToken ||
      record.lease.expiresAtMs <= nowMs
    ) {
      throw new ArenaLifecycleStoreError(
        "LEASE_LOST",
        "Arena lifecycle lease is no longer active",
      );
    }
  }

  return {
    initialize(stateInput, eventInputs) {
      return exclusive(async () => {
        const persistence = parsePersistence(stateInput, eventInputs);
        const arenaId = persistence.state.manifest.arenaId;
        return withFileLock(arenaId, async () => {
          const existing = await loadRecord(arenaId);
          if (existing !== undefined) {
            if (
              !isDeepStrictEqual(
                existing.persistence.state.manifest,
                persistence.state.manifest,
              )
            ) {
              throw new ArenaLifecycleStoreError(
                "MANIFEST_CONFLICT",
                "Arena manifest conflicts with persisted state",
              );
            }
            if (
              !isDeepStrictEqual(
                existing.persistence.state.runtimeMetadata,
                persistence.state.runtimeMetadata,
              )
            ) {
              throw new ArenaLifecycleStoreError(
                "IMMUTABLE_STATE_CONFLICT",
                "Arena runtime metadata conflicts with persisted state",
              );
            }
            return structuredClone(existing.persistence.state);
          }

          await writeRecord(arenaId, {
            schemaVersion: 1,
            fencingSequence: 0,
            persistence,
          });
          return structuredClone(persistence.state);
        });
      });
    },

    read(arenaId, afterEventSequenceInput) {
      return exclusive(async (): Promise<ArenaLifecycleReadResult | "NOT_FOUND"> => {
        const afterEventSequence = parseTimestamp(afterEventSequenceInput);
        const record = await loadRecord(arenaId);
        if (record === undefined) return "NOT_FOUND";
        if (afterEventSequence > record.persistence.state.lastEventSequence) {
          throw invalidInput();
        }
        return {
          state: structuredClone(record.persistence.state),
          events: structuredClone(
            record.persistence.events.filter(
              (event) => event.sequence > afterEventSequence,
            ),
          ),
        };
      });
    },

    acquire(arenaId, ownerIdInput, expiresAtMsInput) {
      return exclusive(async (): Promise<ArenaRunLease | "BUSY" | "NOT_FOUND"> => {
        const ownerId = parseOwnerId(ownerIdInput);
        const expiresAtMs = parseTimestamp(expiresAtMsInput);
        const nowMs = parseTimestamp(config.nowMs());
        if (expiresAtMs <= nowMs) throw invalidInput();
        return withFileLock(arenaId, async () => {
          const record = await loadRecord(arenaId);
          if (record === undefined) return "NOT_FOUND";
          if (
            record.lease !== undefined &&
            record.lease.expiresAtMs > nowMs &&
            processIsAlive(record.lease.processId)
          ) {
            return "BUSY";
          }
          const fencingSequence = record.fencingSequence + 1;
          const lease: ActiveLease = {
            ownerId,
            fencingSequence,
            fencingToken: `${arenaId}:${fencingSequence}`,
            expiresAtMs,
          };
          await writeRecord(arenaId, {
            ...record,
            fencingSequence,
            lease: {
              ...lease,
              processId: process.pid,
            },
          });
          activeLeases.set(arenaId, lease);
          const storedState = structuredClone(record.persistence.state);

          return {
            storedState,
            fencingToken: lease.fencingToken,
            renew(nextExpiresAtMsInput) {
              return exclusive(async () =>
                withFileLock(arenaId, async () => {
                  const current = await loadRecord(arenaId);
                  if (current === undefined) throw persistenceFailure();
                  requireActiveLease(arenaId, lease, current);
                  const nextExpiresAtMs = parseTimestamp(nextExpiresAtMsInput);
                  if (nextExpiresAtMs <= parseTimestamp(config.nowMs())) {
                    throw invalidInput();
                  }
                  await writeRecord(arenaId, {
                    ...current,
                    lease: {
                      ownerId: lease.ownerId,
                      processId: process.pid,
                      fencingSequence: lease.fencingSequence,
                      fencingToken: lease.fencingToken,
                      expiresAtMs: nextExpiresAtMs,
                    },
                  });
                  lease.expiresAtMs = nextExpiresAtMs;
                }),
              );
            },
            commit({ nextState: nextStateInput, appendEvents: eventInputs }) {
              return exclusive(async () =>
                withFileLock(arenaId, async () => {
                  const current = await loadRecord(arenaId);
                  if (current === undefined) throw persistenceFailure();
                  requireActiveLease(arenaId, lease, current);
              const nextStateResult = arenaRunStateV1Schema.safeParse(nextStateInput);
              if (!nextStateResult.success) throw invalidInput();
              const nextState = nextStateResult.data;
              const currentState = current.persistence.state;
              if (nextState.revision !== currentState.revision + 1) {
                throw new ArenaLifecycleStoreError(
                  "REVISION_CONFLICT",
                  "Arena lifecycle revision must advance by one",
                );
              }
              if (!isDeepStrictEqual(nextState.manifest, currentState.manifest)) {
                throw new ArenaLifecycleStoreError(
                  "MANIFEST_CONFLICT",
                  "Arena manifest conflicts with persisted state",
                );
              }
              if (
                !isDeepStrictEqual(
                  nextState.runtimeMetadata,
                  currentState.runtimeMetadata,
                )
              ) {
                throw new ArenaLifecycleStoreError(
                  "IMMUTABLE_STATE_CONFLICT",
                  "Arena runtime metadata conflicts with persisted state",
                );
              }
              const persistence = parsePersistence(nextState, [
                ...current.persistence.events,
                ...eventInputs,
              ]);
              await writeRecord(arenaId, { ...current, persistence });
              return structuredClone(persistence.state);
                }),
              );
            },
            release() {
              return exclusive(async () =>
                withFileLock(arenaId, async () => {
                  const current = await loadRecord(arenaId);
                  if (
                    current !== undefined &&
                    current.lease?.fencingToken === lease.fencingToken &&
                    current.lease.processId === process.pid
                  ) {
                    const { lease: _persistedLease, ...withoutLease } = current;
                    await writeRecord(arenaId, withoutLease);
                  }
                  const active = activeLeases.get(arenaId);
                  if (active?.fencingToken === lease.fencingToken) {
                    activeLeases.delete(arenaId);
                  }
                }),
              );
            },
          };
        });
      });
    },
  };
}
