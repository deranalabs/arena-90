import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { createNodeHttpRuntimeComposition } from "../dist/runtime/node-http.js";
import { createRecordedReplayArtifact } from "../dist/runtime/replay-artifact.js";

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
  const artifact = createRecordedReplayArtifact({
    persistence: persisted,
    source: {
      label: "RECORDED TxLINE DATA",
      fixtureId: composition.manifest.fixtureId,
      matchDateUtc: provenance.sourceKickoffUtc,
      capturedAtUtc: provenance.capturedAtUtc,
      scoreEventCount: provenance.scoreEventCount,
      oddsUpdateCount: provenance.oddsUpdateCount,
      inputHash: provenance.inputHash,
    },
  });
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
      semanticHash: artifact.semanticHash,
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
