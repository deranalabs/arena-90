import { describe, expect, it } from "vitest";

import {
  formatZeroClawSmokeResult,
  runZeroClawSmokeAgent,
} from "../src/adapters/agents/zeroclaw-smoke.js";

describe("ZeroClaw smoke failure reporting", () => {
  it("reduces invocation errors to a sanitized category", async () => {
    const result = await runZeroClawSmokeAgent(
      "alpha",
      async () => {
        throw new Error(
          "raw output, stderr, /secret/config/path, and provider-key-value",
        );
      },
      () => undefined,
    );

    expect(result).toEqual({
      agentId: "alpha",
      status: "INVOCATION_FAILURE",
    });
    expect(formatZeroClawSmokeResult(result)).toBe(
      "ZeroClaw smoke failed: INVOCATION_FAILURE (ALPHA).",
    );
  });

  it("reduces schema errors to a sanitized category", async () => {
    const result = await runZeroClawSmokeAgent(
      "beta",
      async () => ({ rawModelOutput: "provider-key-value" }),
      () => {
        throw new Error("schema details containing raw model output");
      },
    );

    expect(result).toEqual({
      agentId: "beta",
      status: "SCHEMA_FAILURE",
    });
    expect(formatZeroClawSmokeResult(result)).toBe(
      "ZeroClaw smoke failed: SCHEMA_FAILURE (BETA).",
    );
  });
});
