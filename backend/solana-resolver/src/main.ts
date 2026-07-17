import { createJsonArenaLifecycleStore } from "@arena90/arena-runtime/services";

import { createAnchorSupporterChainResolver } from "./anchor-resolver.js";
import { loadResolverConfig } from "./config.js";
import { runResolverLoop, type ResolverLoopObservation } from "./loop.js";
import { createSupporterResolutionWorker } from "./worker.js";

function writeObservation(observation: ResolverLoopObservation) {
  if (observation.result !== undefined) {
    console.log(JSON.stringify({ event: "supporter_resolver_tick", ...observation.result }));
    return;
  }
  console.error(
    JSON.stringify({
      event: "supporter_resolver_tick_failed",
      consecutiveFailures: observation.consecutiveFailures,
      errorName: observation.errorName,
      ...(observation.errorCode === undefined
        ? {}
        : { errorCode: observation.errorCode }),
    }),
  );
}

async function main() {
  const config = await loadResolverConfig();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const store = createJsonArenaLifecycleStore({
    directory: config.persistenceDirectory,
    nowMs: Date.now,
  });
  const chain = await createAnchorSupporterChainResolver(config);
  const worker = createSupporterResolutionWorker({
    arenaId: config.arenaId,
    store,
    chain,
  });
  console.log(
    JSON.stringify({
      event: "supporter_resolver_started",
      arenaId: config.arenaId,
      resolver: config.resolver.publicKey.toBase58(),
      programId: config.programId.toBase58(),
      network: "solana-devnet",
    }),
  );
  await runResolverLoop({
    worker,
    pollMs: config.pollMs,
    signal: controller.signal,
    observe: writeObservation,
  });
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "supporter_resolver_boot_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  process.exitCode = 1;
}
