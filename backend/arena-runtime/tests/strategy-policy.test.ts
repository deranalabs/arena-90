import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createRecordedDataAdapter } from "../src/adapters/data/index.js";
import type { CheckpointId } from "../src/contracts/index.js";
import {
  deriveStrategyEvidence,
  evaluateStrategyPolicy,
} from "../src/services/index.js";

const DECISION_CHECKPOINTS = [
  "KICKOFF",
  "M15",
  "M30",
  "HALFTIME",
  "M60",
  "M75",
] as const satisfies readonly Exclude<CheckpointId, "FINAL">[];

async function policyAt(
  fixtureFile: string,
  checkpointId: (typeof DECISION_CHECKPOINTS)[number],
  agentId: "alpha" | "beta",
) {
  const fixture = JSON.parse(
    await readFile(new URL(`../fixtures/replay/${fixtureFile}`, import.meta.url), "utf8"),
  ) as unknown;
  const adapter = createRecordedDataAdapter(fixture);
  const checkpointIndex = DECISION_CHECKPOINTS.indexOf(checkpointId);
  const history = DECISION_CHECKPOINTS.slice(0, checkpointIndex).map((id) =>
    adapter.getSnapshot(id),
  );
  const snapshot = adapter.getSnapshot(checkpointId);

  return evaluateStrategyPolicy(
    agentId,
    snapshot,
    deriveStrategyEvidence(snapshot, history),
  );
}

describe("deterministic strategy policy", () => {
  it("makes Beta follow a still-underpriced one-goal lead", async () => {
    await expect(
      policyAt(
        "world-cup-2026-france-spain-semifinal-replay-checkpoints.json",
        "M30",
        "beta",
      ),
    ).resolves.toMatchObject({
      active: true,
      signalId: "BETA_SCORE_STATE_UNDERREACTION",
      requiredAction: "TARGET_ALLOCATION",
      focusAsset: "AWAY",
      direction: "TOWARD",
    });
  });

  it("makes Alpha fade an extreme post-goal repricing", async () => {
    await expect(
      policyAt(
        "world-cup-2026-france-spain-semifinal-replay-checkpoints.json",
        "M60",
        "alpha",
      ),
    ).resolves.toMatchObject({
      active: true,
      signalId: "ALPHA_POST_GOAL_OVERREACTION",
      requiredAction: "TARGET_ALLOCATION",
      focusAsset: "AWAY",
      direction: "AWAY_FROM",
    });
  });

  it("can give the agents opposing views of the same verified move", async () => {
    const fixture =
      "world-cup-2026-england-argentina-semifinal-replay-checkpoints.json";

    await expect(policyAt(fixture, "M60", "alpha")).resolves.toMatchObject({
      active: true,
      focusAsset: "HOME",
      direction: "AWAY_FROM",
    });
    await expect(policyAt(fixture, "M60", "beta")).resolves.toMatchObject({
      active: true,
      focusAsset: "HOME",
      direction: "TOWARD",
    });
  });

  it("does not misclassify a multi-goal interval as exactly one new goal", async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/replay/world-cup-2026-england-argentina-semifinal-replay-checkpoints.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as unknown;
    const adapter = createRecordedDataAdapter(fixture);
    const history = DECISION_CHECKPOINTS.slice(0, 4).map((id) =>
      adapter.getSnapshot(id),
    );
    const snapshot = adapter.getSnapshot("M60");
    const evidence = deriveStrategyEvidence(snapshot, history);

    expect(
      evaluateStrategyPolicy("beta", snapshot, {
        ...evidence,
        matchDeltaFromPrevious: {
          minutesElapsed: 15,
          homeScoreDelta: 2,
          awayScoreDelta: 0,
        },
      }),
    ).toMatchObject({ active: false, requiredAction: "NO_TRADE" });
  });
});
