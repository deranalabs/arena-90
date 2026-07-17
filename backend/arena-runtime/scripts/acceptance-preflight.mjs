import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";

const env = process.env;
const blockers = new Set();

function nonblank(name) {
  const value = env[name];
  if (value === undefined || value === "" || value.trim() !== value) {
    blockers.add(name);
    return undefined;
  }
  return value;
}

function positiveInteger(name) {
  const value = nonblank(name);
  if (value !== undefined && !/^[1-9]\d*$/.test(value)) blockers.add(name);
}

function optionalPositiveInteger(name) {
  const value = env[name];
  if (value !== undefined && !/^[1-9]\d*$/.test(value)) blockers.add(name);
}

async function readableFile(name) {
  const path = nonblank(name);
  if (path === undefined) return;
  try {
    const metadata = await stat(path);
    if (!metadata.isFile()) throw new Error("not a file");
    await access(path, constants.R_OK);
  } catch {
    blockers.add(name);
  }
}

async function writableDirectory(name) {
  const path = nonblank(name);
  if (path === undefined) return;
  try {
    const metadata = await stat(path);
    if (!metadata.isDirectory()) throw new Error("not a directory");
    await access(path, constants.R_OK | constants.W_OK);
  } catch {
    blockers.add(name);
  }
}

async function readableDirectory(name) {
  const path = nonblank(name);
  if (path === undefined) return;
  try {
    const metadata = await stat(path);
    if (!metadata.isDirectory()) throw new Error("not a directory");
    await access(path, constants.R_OK);
  } catch {
    blockers.add(name);
  }
}

const binary = env.ZEROCLAW_BIN?.trim() || "zeroclaw";
if (
  spawnSync(binary, ["--version"], { stdio: "ignore", timeout: 5_000 })
    .status !== 0
) {
  blockers.add("ZEROCLAW_BIN");
}

await readableDirectory("ZEROCLAW_CONFIG_DIR");
await writableDirectory("ARENA90_PERSISTENCE_DIR");
await readableFile("ARENA90_MANIFEST_FILE");
positiveInteger("ARENA90_AGENT_TIMEOUT_MS");
optionalPositiveInteger("ARENA90_HTTP_SMOKE_TIMEOUT_MS");

const mode = env.ARENA90_RUNTIME_MODE;
if (mode !== "REPLAY" && mode !== "LIVE") {
  blockers.add("ARENA90_RUNTIME_MODE");
}
if (env.ARENA90_AUTOSTART !== "true") blockers.add("ARENA90_AUTOSTART");

if (mode === "REPLAY") {
  await readableFile("ARENA90_REPLAY_RECORDING_FILE");
  optionalPositiveInteger("ARENA90_REPLAY_SMOKE_TIMEOUT_MS");
  if (
    env.ARENA90_HTTP_SMOKE_MODE !== undefined &&
    env.ARENA90_HTTP_SMOKE_MODE !== "PRODUCT_ACCEPTANCE" &&
    env.ARENA90_HTTP_SMOKE_MODE !== "CLEAN_SHOWCASE"
  ) {
    blockers.add("ARENA90_HTTP_SMOKE_MODE");
  }
}

if (mode === "LIVE") {
  await readableFile("ARENA90_LIVE_FIXTURE_BINDING_FILE");
  if (
    env.ARENA90_LIVE_DELAYED !== "true" &&
    env.ARENA90_LIVE_DELAYED !== "false"
  ) {
    blockers.add("ARENA90_LIVE_DELAYED");
  }

  const credentialFile = env.TXLINE_CREDENTIALS_FILE;
  if (credentialFile === undefined || credentialFile.trim() === "") {
    nonblank("TXLINE_BASE_URL");
    nonblank("TXLINE_JWT");
    nonblank("TXLINE_API_TOKEN");
  } else {
    await readableFile("TXLINE_CREDENTIALS_FILE");
    try {
      const parsed = JSON.parse(await readFile(credentialFile, "utf8"));
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed) ||
        !["apiOrigin", "jwt", "apiToken"].every((key) => {
          const explicit =
            key === "apiOrigin"
              ? env.TXLINE_BASE_URL
              : key === "jwt"
                ? env.TXLINE_JWT
                : env.TXLINE_API_TOKEN;
          const fileValue = parsed[key];
          return (
            (typeof explicit === "string" && explicit.trim() !== "") ||
            (typeof fileValue === "string" && fileValue.trim() !== "")
          );
        })
      ) {
        blockers.add("TXLINE_CREDENTIALS_FILE");
      }
    } catch {
      blockers.add("TXLINE_CREDENTIALS_FILE");
    }
  }
  positiveInteger("TXLINE_TIMEOUT_MS");
  positiveInteger("TXLINE_MAX_RESPONSE_BYTES");
  positiveInteger("TXLINE_MAX_SSE_EVENTS");
}

if (blockers.size === 0) {
  console.log("Arena90 acceptance preflight: PASSED.");
} else {
  console.error(
    `Arena90 acceptance preflight: BLOCKED_CONFIG (${[...blockers].sort().join(", ")}).`,
  );
  process.exitCode = 2;
}
