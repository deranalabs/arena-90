import { createHash } from "node:crypto";

import { z } from "zod";

import {
  projectArenaEventHistory,
  projectArenaState,
} from "../api/index.js";
import {
  DECISION_CHECKPOINT_IDS,
  arenaLifecyclePersistenceV1Schema,
  type ArenaAgentId,
} from "../contracts/index.js";
import type { ArenaLifecycleReadResult } from "../services/index.js";

const recordedReplaySourceSchema = z
  .object({
    label: z.literal("RECORDED TxLINE DATA"),
    fixtureId: z.string().trim().min(1),
    matchDateUtc: z.iso.datetime({ offset: true }),
    capturedAtUtc: z.iso.datetime({ offset: true }),
    scoreEventCount: z.number().int().nonnegative().safe(),
    oddsUpdateCount: z.number().int().nonnegative().safe(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

export type RecordedReplaySource = z.infer<typeof recordedReplaySourceSchema>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateReplaySemanticHash(
  persistenceInput: ArenaLifecycleReadResult,
): string {
  const persistence = arenaLifecyclePersistenceV1Schema.parse(persistenceInput);
  return createHash("sha256").update(canonicalJson(persistence)).digest("hex");
}

function acceptedDecisionCount(
  persistence: ArenaLifecycleReadResult,
  agentId: ArenaAgentId,
): number {
  return persistence.state.checkpoints.filter(
    (checkpoint) => checkpoint.revealedDecisions[agentId] !== undefined,
  ).length;
}

export function createRecordedReplayArtifact(input: Readonly<{
  persistence: ArenaLifecycleReadResult;
  source: RecordedReplaySource;
}>) {
  const persistence = arenaLifecyclePersistenceV1Schema.parse(input.persistence);
  const source = recordedReplaySourceSchema.parse(input.source);
  const state = persistence.state;
  const failures = state.checkpoints.flatMap((checkpoint) => checkpoint.failures);
  const missedRounds = persistence.events.filter(
    (event) => event.type === "MISSED_DECISION_ROUND",
  );
  const completedEvents = persistence.events.filter(
    (event) => event.type === "COMPLETED",
  );

  if (
    state.phase !== "COMPLETED" ||
    state.finalResult === undefined ||
    state.checkpoints.length !== DECISION_CHECKPOINT_IDS.length ||
    acceptedDecisionCount(persistence, "alpha") !==
      DECISION_CHECKPOINT_IDS.length ||
    acceptedDecisionCount(persistence, "beta") !==
      DECISION_CHECKPOINT_IDS.length ||
    failures.length !== 0 ||
    missedRounds.length !== 0 ||
    completedEvents.length !== 1 ||
    source.fixtureId !== state.manifest.fixtureId
  ) {
    throw new Error("Replay failed clean competition acceptance");
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    semanticHash: calculateReplaySemanticHash(persistence),
    recordedSource: source,
    state: projectArenaState(state),
    history: projectArenaEventHistory(state, persistence.events, 0),
  });
}
