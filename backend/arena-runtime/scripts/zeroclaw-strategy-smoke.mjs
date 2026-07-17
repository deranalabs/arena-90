import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  calculateSnapshotHash,
  createAgentDecisionSchema,
  createRecordedDataAdapter,
  createZeroClawAgentAdapter,
  deriveStrategyEvidence,
  initializePortfolio,
} from "../dist/index.js";

const binaryPath = process.env.ZEROCLAW_BIN ?? "zeroclaw";
if (spawnSync(binaryPath, ["--version"], { stdio: "ignore" }).status !== 0) {
  console.error("ZeroClaw strategy smoke failed: CONFIG_FAILURE.");
  process.exit(2);
}

const configDir = process.env.ZEROCLAW_CONFIG_DIR;
const timeoutMs = Number(process.env.ARENA90_AGENT_TIMEOUT_MS ?? "30000");
if (
  configDir === undefined ||
  configDir.trim() === "" ||
  !Number.isSafeInteger(timeoutMs) ||
  timeoutMs <= 0
) {
  console.error("ZeroClaw strategy smoke failed: CONFIG_FAILURE.");
  process.exit(2);
}

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
    "utf8",
  ),
);
const kickoff = createRecordedDataAdapter(fixture).getSnapshot("KICKOFF");

function scenarioSnapshot({ snapshotId, priceMicros, homeScore, awayScore }) {
  const hashInput = {
    ...kickoff,
    providerSequence: 2,
    snapshotId,
    checkpointId: "M15",
    observedAtUtc: "2026-07-13T12:15:00.000Z",
    sourceEventId: `scenario:${snapshotId}`,
    match: {
      ...kickoff.match,
      minute: 15,
      homeScore,
      awayScore,
    },
    priceMicros,
    freshness: {
      ...kickoff.freshness,
      marketUpdatedAtUtc: "2026-07-13T12:14:58.000Z",
    },
  };
  const { snapshotHash: _oldHash, ...canonicalInput } = hashInput;
  return { ...canonicalInput, snapshotHash: calculateSnapshotHash(canonicalInput) };
}

const scenarios = [
  {
    id: "UNDERREACTION",
    agentId: "beta",
    expectedAction: "TARGET_ALLOCATION",
    snapshot: scenarioSnapshot({
      snapshotId: "scenario-underreaction",
      priceMicros: { HOME: 560_000, DRAW: 270_000, AWAY: 170_000 },
      homeScore: 1,
      awayScore: 0,
    }),
  },
  {
    id: "OVERREACTION",
    agentId: "alpha",
    expectedAction: "TARGET_ALLOCATION",
    snapshot: scenarioSnapshot({
      snapshotId: "scenario-overreaction",
      priceMicros: { HOME: 680_000, DRAW: 200_000, AWAY: 120_000 },
      homeScore: 0,
      awayScore: 0,
    }),
  },
  ...["alpha", "beta"].map((agentId) => ({
    id: `NO_EDGE_${agentId.toUpperCase()}`,
    agentId,
    expectedAction: "NO_TRADE",
    snapshot: scenarioSnapshot({
      snapshotId: `scenario-no-edge-${agentId}`,
      priceMicros: { HOME: 510_000, DRAW: 295_000, AWAY: 195_000 },
      homeScore: 0,
      awayScore: 0,
    }),
  })),
];

async function invokeScenario(scenario) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const output = await createZeroClawAgentAdapter({
      agentId: scenario.agentId,
      binaryPath,
      configDir,
    }).invoke({
      snapshot: scenario.snapshot,
      strategyEvidence: deriveStrategyEvidence(scenario.snapshot, [kickoff]),
      portfolio: initializePortfolio(scenario.agentId, "100000000"),
      attempt: 0,
      validationErrors: [],
      signal: controller.signal,
    });
    const decision = createAgentDecisionSchema({
      arenaId: scenario.snapshot.arenaId,
      snapshotId: scenario.snapshot.snapshotId,
      checkpointId: scenario.snapshot.checkpointId,
      agentId: scenario.agentId,
    }).parse(output);
    const unsupportedClaim =
      /historical|win rate|model probability|baseline probability|external model/iu.test(
        decision.publicExplanation,
      );
    return decision.action === scenario.expectedAction && !unsupportedClaim;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all(
  scenarios.map(async (scenario) => ({
    id: scenario.id,
    passed: await invokeScenario(scenario),
  })),
);
const failures = results.filter((result) => !result.passed);
if (failures.length > 0) {
  console.error(
    `ZeroClaw strategy smoke failed: ${failures.map(({ id }) => id).join(", ")}.`,
  );
  process.exitCode = 1;
} else {
  console.log("ZeroClaw strategy smoke passed: underreaction, overreaction, no-edge.");
}
