import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterAll, describe, expect, it } from "vitest";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "arena90-preflight-test-"));
const script = resolve("scripts/acceptance-preflight.mjs");

afterAll(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

function runPreflight(environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env["PATH"],
      ZEROCLAW_BIN: process.execPath,
      ZEROCLAW_CONFIG_DIR: temporaryDirectory,
      ARENA90_PERSISTENCE_DIR: temporaryDirectory,
      ARENA90_AGENT_TIMEOUT_MS: "30000",
      ...environment,
    },
  });
}

describe("acceptance preflight", () => {
  it("accepts an autonomous Replay runtime configuration", () => {
    const result = runPreflight({
      ARENA90_RUNTIME_MODE: "REPLAY",
      ARENA90_AUTOSTART: "true",
      ARENA90_MANIFEST_FILE: resolve("fixtures/recorded-manifest.json"),
      ARENA90_REPLAY_RECORDING_FILE: resolve(
        "fixtures/recorded-checkpoints.json",
      ),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Arena90 acceptance preflight: PASSED.");
  });

  it("accepts an autonomous Live runtime configuration", () => {
    const result = runPreflight({
      ARENA90_RUNTIME_MODE: "LIVE",
      ARENA90_AUTOSTART: "true",
      ARENA90_MANIFEST_FILE: resolve(
        "fixtures/live/world-cup-third-place-manifest.json",
      ),
      ARENA90_LIVE_FIXTURE_BINDING_FILE: resolve(
        "fixtures/live/world-cup-third-place-binding.json",
      ),
      ARENA90_LIVE_DELAYED: "false",
      TXLINE_BASE_URL: "https://example.invalid",
      TXLINE_JWT: "preflight-only",
      TXLINE_API_TOKEN: "preflight-only",
      TXLINE_TIMEOUT_MS: "15000",
      TXLINE_MAX_RESPONSE_BYTES: "5000000",
      TXLINE_MAX_SSE_EVENTS: "10",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Arena90 acceptance preflight: PASSED.");
  });

  it("rejects a runtime that requires a manual start", () => {
    const result = runPreflight({
      ARENA90_RUNTIME_MODE: "REPLAY",
      ARENA90_AUTOSTART: "false",
      ARENA90_MANIFEST_FILE: resolve("fixtures/recorded-manifest.json"),
      ARENA90_REPLAY_RECORDING_FILE: resolve(
        "fixtures/recorded-checkpoints.json",
      ),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ARENA90_AUTOSTART");
  });
});
