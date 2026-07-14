import type {
  ArenaAssetId,
  ArenaManifest,
  ArenaRunStateV1,
  CanonicalSnapshot,
  CheckpointId,
  DecisionCheckpointId,
} from "../contracts/index.js";

export interface ArenaLifecycleRunner {
  create(manifest: unknown): Promise<ArenaRunStateV1>;
  run(arenaId: string, signal: AbortSignal): Promise<ArenaRunStateV1>;
}

export interface ArenaLifecycleDataSource {
  prepare(checkpointId: CheckpointId, signal: AbortSignal): Promise<void>;
  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
  getFinalResult(): ArenaAssetId;
}

export type ArenaLifecycleDataSourceFactory = (
  manifest: ArenaManifest,
) => ArenaLifecycleDataSource;

export interface ArenaLifecycleTiming {
  nowMs(): number;
  waitForCheckpoint(
    manifest: ArenaManifest,
    checkpointId: CheckpointId,
    signal: AbortSignal,
  ): Promise<void>;
}
