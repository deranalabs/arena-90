import { z } from "zod";

import {
  arenaAgentIdSchema,
  decisionCheckpointIdSchema,
  nonBlankStringSchema,
  type ArenaAgentId,
  type DecisionCheckpointId,
} from "./primitives.js";

const allocationBpsSchema = z.number().int().min(0).max(10_000);

const targetAllocationBpsStructureSchema = z
  .object({
    cash: allocationBpsSchema,
    HOME: allocationBpsSchema,
    DRAW: allocationBpsSchema,
    AWAY: allocationBpsSchema,
  })
  .strict();

const agentDecisionIdentityShape = {
  schemaVersion: z.literal(1),
  arenaId: nonBlankStringSchema,
  snapshotId: nonBlankStringSchema,
  checkpointId: decisionCheckpointIdSchema,
  agentId: arenaAgentIdSchema,
  publicExplanation: nonBlankStringSchema,
} as const;

const noTradeDecisionSchema = z
  .object({
    ...agentDecisionIdentityShape,
    action: z.literal("NO_TRADE"),
  })
  .strict();

const targetAllocationDecisionSchema = z
  .object({
    ...agentDecisionIdentityShape,
    action: z.literal("TARGET_ALLOCATION"),
    targetAllocationBps: targetAllocationBpsStructureSchema,
  })
  .strict();

export const agentDecisionStructureSchema = z.discriminatedUnion("action", [
  noTradeDecisionSchema,
  targetAllocationDecisionSchema,
]);

export const agentDecisionSchema = agentDecisionStructureSchema.superRefine(
  (decision, context) => {
    if (decision.action !== "TARGET_ALLOCATION") return;
    const allocation = decision.targetAllocationBps;
    const total = allocation.cash + allocation.HOME + allocation.DRAW + allocation.AWAY;
    if (total !== 10_000) {
      context.addIssue({
        code: "custom",
        path: ["targetAllocationBps"],
        message: "Target allocations must sum to 10000 basis points",
      });
    }
  },
);

export interface AgentDecisionIdentity {
  arenaId: string;
  snapshotId: string;
  checkpointId: DecisionCheckpointId;
  agentId: ArenaAgentId;
}

export function createAgentDecisionSchema(expected: AgentDecisionIdentity) {
  return agentDecisionSchema.superRefine((decision, context) => {
    const fields = ["arenaId", "snapshotId", "checkpointId", "agentId"] as const;

    for (const field of fields) {
      if (decision[field] !== expected[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} does not match the decision request`,
        });
      }
    }
  });
}

export type AgentDecision = z.infer<typeof agentDecisionSchema>;
