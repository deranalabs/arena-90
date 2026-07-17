import {
  arenaFinalResultV2Schema,
  arenaManifestSchema,
  createSolanaArenaPreparationIntent,
  createSolanaSettlementIntent,
  type ArenaFinalResultV2,
  type ArenaManifest,
  type SolanaArenaPreparationIntentV1,
  type SolanaSettlementIntentV1,
} from "../contracts/index.js";

export type SupporterPreparationResult =
  | "PREPARED"
  | "ALREADY_PREPARED"
  | "NOT_ELIGIBLE";
export type SupporterSettlementResult =
  | "SETTLED"
  | "ALREADY_SETTLED"
  | "NOT_ELIGIBLE";

export interface SupporterChainResolver {
  prepare(
    intent: SolanaArenaPreparationIntentV1,
    signal: AbortSignal,
  ): Promise<"PREPARED" | "ALREADY_PREPARED">;
  settle(
    intent: SolanaSettlementIntentV1,
    signal: AbortSignal,
  ): Promise<"SETTLED" | "ALREADY_SETTLED">;
}

export interface SupporterResolverSupervisor {
  prepare(
    manifest: ArenaManifest,
    signal: AbortSignal,
  ): Promise<SupporterPreparationResult>;
  settle(
    manifest: ArenaManifest,
    finalResult: ArenaFinalResultV2,
    signal: AbortSignal,
  ): Promise<SupporterSettlementResult>;
}

export function createSupporterResolverSupervisor(
  resolver: SupporterChainResolver,
): SupporterResolverSupervisor {
  const supervisor: SupporterResolverSupervisor = {
    async prepare(manifestInput: ArenaManifest, signal: AbortSignal) {
      signal.throwIfAborted();
      const manifest = arenaManifestSchema.parse(manifestInput);
      if (manifest.mode !== "LIVE") return "NOT_ELIGIBLE";
      return resolver.prepare(createSolanaArenaPreparationIntent(manifest), signal);
    },
    async settle(
      manifestInput: ArenaManifest,
      finalResultInput: ArenaFinalResultV2,
      signal: AbortSignal,
    ) {
      signal.throwIfAborted();
      const manifest = arenaManifestSchema.parse(manifestInput);
      if (manifest.mode !== "LIVE") return "NOT_ELIGIBLE";
      const finalResult = arenaFinalResultV2Schema.parse(finalResultInput);
      return resolver.settle(
        createSolanaSettlementIntent(manifest, finalResult),
        signal,
      );
    },
  };
  return Object.freeze(supervisor);
}
