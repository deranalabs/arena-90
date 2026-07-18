import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  projectArenaEventHistory,
  projectArenaState,
} from "../dist/api/index.js";
import { createNodeHttpRuntimeComposition } from "../dist/runtime/node-http.js";

const exportFile = process.env.ARENA90_REPLAY_EXPORT_FILE;
const recordingFile = process.env.ARENA90_REPLAY_RECORDING_FILE;
if (!exportFile || !recordingFile) {
  console.error("Replay artifact export failed: CONFIG_FAILURE.");
  process.exit(2);
}

let composition;
try {
  composition = await createNodeHttpRuntimeComposition({
    env: {
      ...process.env,
      ARENA90_RUNTIME_MODE: "REPLAY",
      ARENA90_AUTOSTART: "false",
      ARENA90_HTTP_PORT: "3100",
    },
  });
  await composition.runner.create(composition.manifest);
  const completed = await composition.runner.run(
    composition.manifest.arenaId,
    new AbortController().signal,
  );
  const persisted = await composition.store.read(composition.manifest.arenaId, 0);
  if (
    completed.phase !== "COMPLETED" ||
    completed.finalResult === undefined ||
    persisted === "NOT_FOUND"
  ) {
    throw new Error("incomplete replay");
  }
  const revealedRounds = persisted.state.checkpoints;
  const failures = revealedRounds.flatMap((checkpoint) => checkpoint.failures);
  const agentsWithExposure = new Set(
    revealedRounds.flatMap((checkpoint) =>
      Object.entries(checkpoint.revealedDecisions)
        .filter(([, decision]) => decision?.action === "TARGET_ALLOCATION")
        .map(([agentId]) => agentId),
    ),
  );
  if (
    revealedRounds.length !== 6 ||
    failures.length !== 0 ||
    !agentsWithExposure.has("alpha") ||
    !agentsWithExposure.has("beta")
  ) {
    throw new Error("replay failed clean competition acceptance");
  }
  const recording = JSON.parse(await readFile(recordingFile, "utf8"));
  const provenance = recording?.provenance;
  if (
    recording?.arenaId !== composition.manifest.arenaId ||
    recording?.fixtureId !== composition.manifest.fixtureId ||
    provenance?.source !== "TXLINE_HISTORICAL_API" ||
    String(provenance.sourceFixtureId) !== composition.manifest.fixtureId ||
    typeof provenance.sourceKickoffUtc !== "string" ||
    Number.isNaN(Date.parse(provenance.sourceKickoffUtc)) ||
    typeof provenance.capturedAtUtc !== "string" ||
    typeof provenance.scoreEventCount !== "number" ||
    typeof provenance.oddsUpdateCount !== "number" ||
    typeof provenance.inputHash !== "string"
  ) {
    throw new Error("recording provenance unavailable");
  }
  const artifact = {
    schemaVersion: 1,
    recordedSource: {
      label: "RECORDED TxLINE DATA",
      fixtureId: composition.manifest.fixtureId,
      matchDateUtc: provenance.sourceKickoffUtc,
      capturedAtUtc: provenance.capturedAtUtc,
      scoreEventCount: provenance.scoreEventCount,
      oddsUpdateCount: provenance.oddsUpdateCount,
      inputHash: provenance.inputHash,
    },
    state: projectArenaState(persisted.state),
    history: projectArenaEventHistory(persisted.state, persisted.events, 0),
  };
  await mkdir(dirname(exportFile), { recursive: true });
  await writeFile(exportFile, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o644,
  });
  console.log(
    JSON.stringify({
      arenaId: composition.manifest.arenaId,
      phase: completed.phase,
      checkpoints: completed.checkpoints.length,
      events: persisted.events.length,
      winner: completed.finalResult.winner,
    }),
  );
} catch (error) {
  const reason =
    error instanceof Error
      ? `${error.name}:${"category" in error ? String(error.category) : "RUNTIME"}`
      : "UNKNOWN";
  console.error(`Replay artifact export failed: ${reason}.`);
  process.exitCode = 1;
} finally {
  await composition?.shutdown().catch(() => undefined);
}
