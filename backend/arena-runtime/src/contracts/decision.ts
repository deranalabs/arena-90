import { z } from "zod";

import {
  arenaAgentIdSchema,
  decisionCheckpointIdSchema,
  nonBlankStringSchema,
  type ArenaAgentId,
  type DecisionCheckpointId,
} from "./primitives.js";

const allocationBpsSchema = z.number().int().min(0).max(10_000);

const targetAllocationBpsSchema = z
  .object({
    cash: allocationBpsSchema,
    HOME: allocationBpsSchema,
    DRAW: allocationBpsSchema,
    AWAY: allocationBpsSchema,
  })
  .strict()
  .superRefine((allocation, context) => {
    const total = allocation.cash + allocation.HOME + allocation.DRAW + allocation.AWAY;
    if (total !== 10_000) {
      context.addIssue({
        code: "custom",
        message: "Target allocations must sum to 10000 basis points",
      });
    }
  });

export const agentDecisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    arenaId: nonBlankStringSchema,
    snapshotId: nonBlankStringSchema,
    checkpointId: decisionCheckpointIdSchema,
    agentId: arenaAgentIdSchema,
    action: z.enum(["TARGET_ALLOCATION", "NO_TRADE"]),
    targetAllocationBps: targetAllocationBpsSchema,
    publicExplanation: nonBlankStringSchema,
  })
  .strict();

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
