import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { compileRecordedTxlineFixture } from "../dist/adapters/data/index.js";
import { arenaManifestSchema } from "../dist/contracts/index.js";

const evidenceDirectory = process.env.ARENA90_TXLINE_EVIDENCE_DIR;
if (!evidenceDirectory) {
  throw new Error("ARENA90_TXLINE_EVIDENCE_DIR is required");
}

const arenaId = "world-cup-2026-france-england-third-place-recovery-replay-01";
const scoreCapture = JSON.parse(
  gunzipSync(
    await readFile(join(evidenceDirectory, "captures/fixture-18257865-score-raw.json.gz")),
  ).toString("utf8"),
);
const oddsCapture = JSON.parse(
  gunzipSync(
    await readFile(join(evidenceDirectory, "captures/fixture-18257865-odds-raw.json.gz")),
  ).toString("utf8"),
);
const fixture = {
  fixtureId: 18_257_865,
  participant1Id: 1_999,
  participant2Id: 1_888,
  participant1IsHome: true,
  startTime: 1_784_408_400_000,
};
const recording = compileRecordedTxlineFixture({
  arenaId,
  fixture,
  scoreEvents: scoreCapture.entries.map(({ data }) => data),
  oddsUpdates: oddsCapture.updates,
  capturedAtUtc: oddsCapture.capturedAtUtc,
});
const manifest = arenaManifestSchema.parse({
  schemaVersion: 1,
  arenaId,
  mode: "REPLAY",
  competition: "World Cup 2026 · Third Place Recovery Replay",
  fixtureId: String(fixture.fixtureId),
  homeTeam: { name: "France", code: "FRA" },
  awayTeam: { name: "England", code: "ENG" },
  kickoffUtc: recording.provenance.sourceKickoffUtc,
  startingBankrollMicros: "100000000",
  currency: "VIRTUAL_USD_MICROS",
  assets: [
    { id: "HOME", market: "FULL_TIME_1X2", label: "France win" },
    { id: "DRAW", market: "FULL_TIME_1X2", label: "Draw" },
    { id: "AWAY", market: "FULL_TIME_1X2", label: "England win" },
  ],
  checkpoints: ["KICKOFF", "M15", "M30", "HALFTIME", "M60", "M75", "FINAL"],
  replayDisclosure: "RECOVERY REPLAY — recorded data, not live execution",
  createdAtUtc: oddsCapture.capturedAtUtc,
});
const base = resolve("fixtures/replay", arenaId);
await Promise.all([
  writeFile(`${base}-checkpoints.json`, `${JSON.stringify(recording, null, 2)}\n`, { mode: 0o644 }),
  writeFile(`${base}-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 }),
]);

console.log(JSON.stringify({ arenaId, inputHash: recording.provenance.inputHash }));
