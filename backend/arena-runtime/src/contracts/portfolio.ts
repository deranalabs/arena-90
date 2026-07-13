import { z } from "zod";

import {
  arenaAgentIdSchema,
  checkpointIdSchema,
  moneyMicrosSchema,
  unitMicrosSchema,
} from "./primitives.js";

export const portfolioStateSchema = z
  .object({
    agentId: arenaAgentIdSchema,
    cashMicros: moneyMicrosSchema,
    unitMicros: z
      .object({
        HOME: unitMicrosSchema,
        DRAW: unitMicrosSchema,
        AWAY: unitMicrosSchema,
      })
      .strict(),
    navMicros: moneyMicrosSchema,
    returnBps: z.number().int(),
    updatedAtCheckpoint: checkpointIdSchema,
  })
  .strict();

export type PortfolioState = z.infer<typeof portfolioStateSchema>;
