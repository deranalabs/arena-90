import type {
  ArenaAgentId,
  CanonicalSnapshot,
  PortfolioState,
  StrategyEvidenceV1,
} from "../../contracts/index.js";

export interface AgentInvocationRequest {
  snapshot: CanonicalSnapshot;
  strategyEvidence: StrategyEvidenceV1;
  portfolio: PortfolioState;
  attempt: 0 | 1;
  validationErrors: readonly string[];
  signal: AbortSignal;
}

export interface AgentAdapter {
  agentId: ArenaAgentId;
  invoke(request: AgentInvocationRequest): Promise<unknown>;
}

type FakeAgentHandler = (request: AgentInvocationRequest) => Promise<unknown>;

export function createFakeAgentAdapter(
  agentId: ArenaAgentId,
  handler: FakeAgentHandler,
): AgentAdapter {
  return {
    agentId,
    invoke: handler,
  };
}
