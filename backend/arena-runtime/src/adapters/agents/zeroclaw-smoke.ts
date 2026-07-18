import type { ArenaAgentId } from "../../contracts/index.js";

export type ZeroClawSmokeResult =
  | { agentId: ArenaAgentId; status: "PASSED" }
  | {
      agentId: ArenaAgentId;
      status: "INVOCATION_FAILURE" | "SCHEMA_FAILURE";
    };

export async function runZeroClawSmokeAgent(
  agentId: ArenaAgentId,
  invoke: () => Promise<unknown>,
  validate: (output: unknown) => void,
): Promise<ZeroClawSmokeResult> {
  let output: unknown;
  try {
    output = await invoke();
  } catch {
    return { agentId, status: "INVOCATION_FAILURE" };
  }

  try {
    validate(output);
  } catch {
    return { agentId, status: "SCHEMA_FAILURE" };
  }
  return { agentId, status: "PASSED" };
}

export function formatZeroClawSmokeResult(
  result: ZeroClawSmokeResult,
): string {
  const agent = result.agentId.toUpperCase();

  return result.status === "PASSED"
    ? `ZeroClaw smoke passed (${agent}).`
    : `ZeroClaw smoke failed: ${result.status} (${agent}).`;
}
