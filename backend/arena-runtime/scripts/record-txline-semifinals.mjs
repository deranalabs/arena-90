import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  compileRecordedTxlineFixture,
  createTxlineProviderClientFromEnv,
  resolveTxlineCredentialEnvironment,
} from "../dist/adapters/data/index.js";
import { arenaManifestSchema } from "../dist/contracts/index.js";

const catalogPath = resolve("fixtures/replay/world-cup-2026-semifinals.json");

try {
  const env = await resolveTxlineCredentialEnvironment(
    {
      ...process.env,
      TXLINE_TIMEOUT_MS: process.env.TXLINE_TIMEOUT_MS ?? "60000",
      TXLINE_MAX_RESPONSE_BYTES:
        process.env.TXLINE_MAX_RESPONSE_BYTES ?? "67108864",
      TXLINE_MAX_SSE_EVENTS: process.env.TXLINE_MAX_SSE_EVENTS ?? "20000",
    },
    (path) => readFile(path, "utf8"),
  );
  const client = createTxlineProviderClientFromEnv({ env });
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const capturedAtUtc = new Date().toISOString();

  for (const entry of catalog) {
    const signal = new AbortController().signal;
    const historical = await client.getHistoricalScoreReplay(
      entry.fixture.fixtureId,
      signal,
    );
    console.log(
      JSON.stringify({ fixtureId: entry.fixture.fixtureId, scoreEvents: historical.length }),
    );
    const oddsUpdates = await client.getOddsUpdates(
      entry.fixture.fixtureId,
      signal,
    );
    const recording = compileRecordedTxlineFixture({
      arenaId: entry.arenaId,
      fixture: entry.fixture,
      scoreEvents: historical.map(({ data }) => data),
      oddsUpdates,
      capturedAtUtc,
    });
    const manifest = arenaManifestSchema.parse({
      schemaVersion: 1,
      arenaId: entry.arenaId,
      mode: "REPLAY",
      competition: "FIFA World Cup 2026",
      fixtureId: String(entry.fixture.fixtureId),
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      kickoffUtc: recording.provenance.sourceKickoffUtc,
      startingBankrollMicros: "100000000",
      currency: "VIRTUAL_USD_MICROS",
      assets: [
        { id: "HOME", market: "FULL_TIME_1X2", label: `${entry.homeTeam.name} win` },
        { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
        { id: "AWAY", market: "FULL_TIME_1X2", label: `${entry.awayTeam.name} win` },
      ],
      checkpoints: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
      createdAtUtc: capturedAtUtc,
    });
    const base = resolve("fixtures/replay", entry.arenaId);
    await Promise.all([
      writeFile(`${base}-checkpoints.json`, `${JSON.stringify(recording, null, 2)}\n`, {
        mode: 0o644,
      }),
      writeFile(`${base}-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, {
        mode: 0o644,
      }),
    ]);
    console.log(
      JSON.stringify({
        arenaId: entry.arenaId,
        fixtureId: entry.fixture.fixtureId,
        scoreEvents: recording.provenance.scoreEventCount,
        oddsUpdates: recording.provenance.oddsUpdateCount,
        inputHash: recording.provenance.inputHash,
      }),
    );
  }
} catch (error) {
  const reason =
    error instanceof Error
      ? `${error.name}:${"code" in error ? String(error.code) : "UNKNOWN"}:${error.message}`
      : "UNKNOWN";
  console.error(`TxLINE semifinal recording failed: ${reason}.`);
  process.exitCode = 1;
}
