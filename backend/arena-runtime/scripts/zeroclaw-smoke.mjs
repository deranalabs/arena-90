import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  createAgentDecisionSchema,
  createRecordedDataAdapter,
  createZeroClawAgentAdapter,
  initializePortfolio,
} from "../dist/index.js";
import {
  formatZeroClawSmokeResult,
  runZeroClawSmokeAgent,
} from "../dist/adapters/agents/zeroclaw-smoke.js";

const binaryPath = process.env.ZEROCLAW_BIN ?? "zeroclaw";
const availability = spawnSync(binaryPath, ["--version"], { stdio: "ignore" });

if (availability.status !== 0) {
  console.log("ZeroClaw smoke skipped: binary unavailable.");
  process.exit(0);
}

const configDir = process.env.ZEROCLAW_CONFIG_DIR;
if (configDir === undefined || configDir.trim() === "") {
  console.error("ZeroClaw smoke requires ZEROCLAW_CONFIG_DIR.");
  process.exit(2);
}

const timeoutMs = Number(process.env.ARENA90_AGENT_TIMEOUT_MS ?? "30000");
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
  console.error("ARENA90_AGENT_TIMEOUT_MS must be a positive integer.");
  process.exit(2);
}

let snapshot;
try {
  const fixture = JSON.parse(
    await readFile(
      new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
      "utf8",
    ),
  );
  snapshot = createRecordedDataAdapter(fixture).getSnapshot("KICKOFF");
} catch {
  console.error("ZeroClaw smoke failed: SETUP_FAILURE.");
  process.exit(2);
}

async function invokeAgent(agentId) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    return await createZeroClawAgentAdapter({
      agentId,
      binaryPath,
      configDir,
    }).invoke({
      snapshot,
      portfolio: initializePortfolio(agentId, "100000000"),
      attempt: 0,
      validationErrors: [],
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all(
  ["alpha", "beta"].map((agentId) =>
    runZeroClawSmokeAgent(
      agentId,
      () => invokeAgent(agentId),
      (output) =>
        createAgentDecisionSchema({
          arenaId: snapshot.arenaId,
          snapshotId: snapshot.snapshotId,
          checkpointId: snapshot.checkpointId,
          agentId,
        }).parse(output),
    ),
  ),
);
const failures = results.filter((result) => result.status !== "PASSED");

if (failures.length === 0) {
  console.log("ZeroClaw smoke passed for Alpha and Beta.");
} else {
  for (const failure of failures) {
    console.error(formatZeroClawSmokeResult(failure));
  }
  process.exitCode = 1;
}
