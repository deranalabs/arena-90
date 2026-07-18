import type { TxlineDataErrorCode } from "./domain.js";
import { TxlineDataError } from "./domain.js";
import { resolveTxlineCredentialEnvironment } from "./credential-environment.js";
import { createTxlineProviderClientFromEnv } from "./node.js";

type TxlineConnectivitySmokeFailure =
  | "CONFIG_FAILURE"
  | "AUTHENTICATION_FAILURE"
  | "AUTHORIZATION_FAILURE"
  | "TIMEOUT_FAILURE"
  | "NETWORK_FAILURE"
  | "HTTP_FAILURE"
  | "RESPONSE_LIMIT"
  | "INVALID_RESPONSE"
  | "ABORTED"
  | "INVOCATION_FAILURE";

export type TxlineConnectivitySmokeResult =
  | Readonly<{
      status: "PASSED";
      streamStatus: "EVENT_RECEIVED" | "IDLE";
    }>
  | Readonly<{ status: TxlineConnectivitySmokeFailure }>;

export interface TxlineConnectivitySmokeOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: typeof globalThis.fetch;
  readonly readFile: (path: string) => Promise<string>;
}

class SmokeConfigFailure extends Error {}
class SmokeInvalidResponse extends Error {}

function fixtureIdFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const value = env["TXLINE_FIXTURE_ID"];
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    throw new SmokeConfigFailure();
  }
  const fixtureId = Number(value);
  if (!Number.isSafeInteger(fixtureId)) throw new SmokeConfigFailure();
  return fixtureId;
}

function timeoutMsFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const value = env["TXLINE_TIMEOUT_MS"];
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    throw new SmokeConfigFailure();
  }
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs)) throw new SmokeConfigFailure();
  return timeoutMs;
}

function mapProviderFailure(
  code: TxlineDataErrorCode,
): TxlineConnectivitySmokeFailure {
  switch (code) {
    case "INVALID_PROVIDER_CONFIG":
      return "CONFIG_FAILURE";
    case "PROVIDER_AUTHENTICATION_FAILURE":
      return "AUTHENTICATION_FAILURE";
    case "PROVIDER_AUTHORIZATION_FAILURE":
      return "AUTHORIZATION_FAILURE";
    case "PROVIDER_TIMEOUT":
      return "TIMEOUT_FAILURE";
    case "PROVIDER_NETWORK_FAILURE":
      return "NETWORK_FAILURE";
    case "PROVIDER_HTTP_FAILURE":
      return "HTTP_FAILURE";
    case "PROVIDER_RESPONSE_LIMIT":
      return "RESPONSE_LIMIT";
    case "PROVIDER_INVALID_RESPONSE":
      return "INVALID_RESPONSE";
    case "PROVIDER_ABORTED":
      return "ABORTED";
    default:
      return "INVOCATION_FAILURE";
  }
}

export async function runTxlineConnectivitySmoke(
  options: TxlineConnectivitySmokeOptions,
): Promise<TxlineConnectivitySmokeResult> {
  try {
    if (typeof options !== "object" || options === null) {
      throw new SmokeConfigFailure();
    }
    if (typeof options.readFile !== "function") throw new SmokeConfigFailure();
    let env: Readonly<Record<string, string | undefined>>;
    try {
      env = await resolveTxlineCredentialEnvironment(
        options.env ?? process.env,
        options.readFile,
      );
    } catch {
      throw new SmokeConfigFailure();
    }
    const fixtureId = fixtureIdFromEnvironment(env);
    const timeoutMs = timeoutMsFromEnvironment(env);
    const client = createTxlineProviderClientFromEnv({
      env,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    const signal = new AbortController().signal;

    const fixtureSnapshot = await client.getFixtureSnapshot(signal);
    const oddsSnapshot = await client.getOddsSnapshot(fixtureId, signal);
    const oddsUpdates = await client.getOddsUpdates(fixtureId, signal);
    const scoreSnapshot = await client.getScoreSnapshot(fixtureId, signal);
    if (
      !Array.isArray(fixtureSnapshot) ||
      !Array.isArray(oddsSnapshot) ||
      !Array.isArray(oddsUpdates) ||
      !Array.isArray(scoreSnapshot)
    ) {
      throw new SmokeInvalidResponse();
    }

    await client.getHistoricalScoreReplay(fixtureId, signal);
    const streamController = new AbortController();
    let streamTimedOut = false;
    const streamTimeout = setTimeout(() => {
      streamTimedOut = true;
      streamController.abort();
    }, timeoutMs);
    const iterator = client
      .getScoreStream(fixtureId, streamController.signal)
      [Symbol.asyncIterator]();
    let streamStatus: "EVENT_RECEIVED" | "IDLE" = "EVENT_RECEIVED";
    try {
      try {
        const firstEvent = await iterator.next();
        if (firstEvent.done === true) throw new SmokeInvalidResponse();
      } catch (error) {
        if (streamTimedOut) {
          streamStatus = "IDLE";
        } else {
          throw error;
        }
      }
    } finally {
      clearTimeout(streamTimeout);
      try {
        await iterator.return?.();
      } catch {
        // Cleanup details are intentionally excluded from smoke results.
      }
    }
    return Object.freeze({ status: "PASSED", streamStatus });
  } catch (error) {
    if (error instanceof SmokeConfigFailure) {
      return Object.freeze({ status: "CONFIG_FAILURE" });
    }
    if (error instanceof SmokeInvalidResponse) {
      return Object.freeze({ status: "INVALID_RESPONSE" });
    }
    if (error instanceof TxlineDataError) {
      return Object.freeze({ status: mapProviderFailure(error.code) });
    }
    return Object.freeze({ status: "INVOCATION_FAILURE" });
  }
}

export function formatTxlineConnectivitySmokeResult(
  result: TxlineConnectivitySmokeResult,
): string {
  if (result.status !== "PASSED") {
    return `TxLINE connectivity smoke failed: ${result.status}.`;
  }
  return result.streamStatus === "EVENT_RECEIVED"
    ? "TxLINE connectivity smoke passed; live score event received."
    : "TxLINE connectivity smoke passed; live score stream idle.";
}
