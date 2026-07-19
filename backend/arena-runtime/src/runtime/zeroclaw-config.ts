import type { ArenaAgentId } from "../contracts/index.js";

type Environment = Readonly<Record<string, string | undefined>>;

const agentConfigEnvironmentNames = Object.freeze({
  alpha: "ZEROCLAW_ALPHA_CONFIG_DIR",
  beta: "ZEROCLAW_BETA_CONFIG_DIR",
} satisfies Record<ArenaAgentId, string>);

function validDirectory(value: string | undefined): string | undefined {
  if (value === undefined || value === "" || value.trim() !== value) {
    return undefined;
  }
  return value;
}

export function resolveZeroClawConfigDirectory(
  env: Environment,
  agentId: ArenaAgentId,
): string | undefined {
  const agentSpecificName = agentConfigEnvironmentNames[agentId];
  if (env[agentSpecificName] !== undefined) {
    return validDirectory(env[agentSpecificName]);
  }
  return validDirectory(env["ZEROCLAW_CONFIG_DIR"]);
}
