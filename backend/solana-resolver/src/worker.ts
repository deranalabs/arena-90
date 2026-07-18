import type { ArenaLifecycleStore } from "@arena90/arena-runtime/services";
import {
  createSupporterResolverSupervisor,
  type SupporterChainResolver,
  type SupporterLockResult,
  type SupporterPreparationResult,
  type SupporterSettlementResult,
} from "@arena90/arena-runtime/services";

export type ResolverTickResult =
  | { readonly status: "WAITING_FOR_RUNTIME" }
  | { readonly status: "NOT_ELIGIBLE" }
  | {
      readonly status: "ACTIVE";
      readonly preparation: Exclude<SupporterPreparationResult, "NOT_ELIGIBLE">;
      readonly lock: Exclude<SupporterLockResult, "NOT_ELIGIBLE">;
      readonly settlement?: Exclude<SupporterSettlementResult, "NOT_ELIGIBLE">;
    };

export interface SupporterResolutionWorker {
  tick(signal: AbortSignal): Promise<ResolverTickResult>;
}

export function createSupporterResolutionWorker(input: {
  readonly arenaId: string;
  readonly store: Pick<ArenaLifecycleStore, "read">;
  readonly chain: SupporterChainResolver;
}): SupporterResolutionWorker {
  if (input.arenaId === "" || input.arenaId.trim() !== input.arenaId) {
    throw new Error("arenaId must be a non-empty canonical identifier");
  }
  const supervisor = createSupporterResolverSupervisor(input.chain);

  return Object.freeze({
    async tick(signal: AbortSignal): Promise<ResolverTickResult> {
      signal.throwIfAborted();
      const persisted = await input.store.read(input.arenaId, 0);
      if (persisted === "NOT_FOUND") return { status: "WAITING_FOR_RUNTIME" };

      const { manifest } = persisted.state;
      if (manifest.mode !== "LIVE") return { status: "NOT_ELIGIBLE" };

      const preparation = await supervisor.prepare(manifest, signal);
      if (preparation === "NOT_ELIGIBLE") return { status: "NOT_ELIGIBLE" };

      const lock = await supervisor.lock(manifest, signal);
      if (lock === "NOT_ELIGIBLE") return { status: "NOT_ELIGIBLE" };

      if (
        lock === "NOT_DUE" ||
        persisted.state.phase !== "COMPLETED" ||
        persisted.state.finalResult === undefined
      ) {
        return { status: "ACTIVE", preparation, lock };
      }

      const settlement = await supervisor.settle(
        manifest,
        persisted.state.finalResult,
        signal,
      );
      if (settlement === "NOT_ELIGIBLE") return { status: "NOT_ELIGIBLE" };
      return { status: "ACTIVE", preparation, lock, settlement };
    },
  });
}
