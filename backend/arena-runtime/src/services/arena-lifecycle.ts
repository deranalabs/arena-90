import type {
  ArenaManifest,
  ArenaRunStateV1,
  CanonicalSnapshot,
  CheckpointId,
  DecisionCheckpointId,
  TerminalEvidenceV1,
} from "../contracts/index.js";

export interface ArenaLifecycleRunner {
  create(manifest: unknown): Promise<ArenaRunStateV1>;
  run(arenaId: string, signal: AbortSignal): Promise<ArenaRunStateV1>;
}

export interface ArenaLifecycleDataSource {
  prepare(checkpointId: CheckpointId, signal: AbortSignal): Promise<void>;
  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
  getTerminalEvidence(): TerminalEvidenceV1;
}

export type ArenaLifecycleDataSourceFactory = (
  manifest: ArenaManifest,
) => ArenaLifecycleDataSource;

export interface ArenaLifecycleTiming {
  nowMs(): number;
  wait(delayMs: number, signal: AbortSignal): Promise<void>;
  waitForCheckpoint(
    manifest: ArenaManifest,
    checkpointId: CheckpointId,
    signal: AbortSignal,
  ): Promise<void>;
}
