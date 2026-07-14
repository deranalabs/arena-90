import type { AgentAdapter } from "../adapters/agents/fake.js";
import { createRecordedDataAdapter } from "../adapters/data/recorded.js";
import {
  createTxlineLiveDataAdapter,
  type TxlineFixtureBinding,
  type TxlineProviderClient,
} from "../adapters/data/txline/index.js";
import type {
  ArenaAgentId,
  ArenaRuntimeMetadataV1,
} from "../contracts/index.js";
import type { ArenaLifecycleTiming } from "../services/arena-lifecycle.js";
import { createArenaLifecycleRunner } from "../services/lifecycle-runner.js";
import {
  createInMemoryArenaLifecycleStore,
  type ArenaLifecycleStore,
} from "../services/lifecycle-store.js";

export interface CreateNodeArenaLifecycleCompositionConfig {
  readonly recordedFixture?: unknown;
  readonly live?: Readonly<{
    fixtureBinding: TxlineFixtureBinding;
    delayed: boolean;
    client: TxlineProviderClient;
  }>;
  readonly agents: Readonly<Record<ArenaAgentId, AgentAdapter>>;
  readonly runtimeMetadata: ArenaRuntimeMetadataV1;
  readonly timing: ArenaLifecycleTiming;
  readonly lease: Readonly<{
    ownerId: string;
    ttlMs: number;
    renewEveryMs: number;
  }>;
  readonly store?: ArenaLifecycleStore;
}

export function createNodeArenaLifecycleComposition(
  config: CreateNodeArenaLifecycleCompositionConfig,
) {
  const store =
    config.store ??
    createInMemoryArenaLifecycleStore({ nowMs: config.timing.nowMs });

  const runner = createArenaLifecycleRunner({
    store,
    agents: config.agents,
    runtimeMetadata: config.runtimeMetadata,
    timing: config.timing,
    lease: config.lease,
    dataSourceFactory(manifest) {
      if (manifest.mode === "LIVE") {
        if (config.live === undefined) {
          throw new Error("Arena lifecycle LIVE data source is not configured");
        }
        const live = createTxlineLiveDataAdapter({
          arenaId: manifest.arenaId,
          fixtureBinding: config.live.fixtureBinding,
          delayed: config.live.delayed,
          client: config.live.client,
          nowMs: config.timing.nowMs,
        });
        return {
          prepare: live.refreshCheckpoint,
          getSnapshot: live.getSnapshot,
          getFinalResult: live.getFinalResult,
        };
      }
      if (config.recordedFixture === undefined) {
        throw new Error("Arena lifecycle data source is not configured");
      }
      const recorded = createRecordedDataAdapter(config.recordedFixture);
      return {
        async prepare() {},
        getSnapshot: recorded.getSnapshot,
        getFinalResult: recorded.getFinalResult,
      };
    },
  });

  return Object.freeze({ runner, store });
}
