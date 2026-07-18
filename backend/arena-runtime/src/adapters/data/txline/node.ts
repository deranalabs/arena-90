import type {
  TxlineHttpResponse,
  TxlineHttpTransport,
  TxlineProviderClient,
  TxlineSseTransport,
} from "./domain.js";
import { TxlineDataError, TxlineHttpStatusError } from "./domain.js";
import { createTxlineProviderClient } from "./client.js";

type FetchImplementation = typeof globalThis.fetch;

export interface TxlineNodeProviderClientOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetch?: FetchImplementation;
}

function invalidConfig(): TxlineDataError {
  return new TxlineDataError(
    "INVALID_PROVIDER_CONFIG",
    "Invalid TxLINE Node transport configuration",
  );
}

function transportFailure(kind: "HTTP" | "SSE"): Error {
  return new Error(`TxLINE Node ${kind} transport failure`);
}

async function cancelBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  try {
    await body?.cancel();
  } catch {
    // Cleanup failures must not expose provider or infrastructure details.
  }
}

export function createTxlineNodeTransports(
  fetchImpl: FetchImplementation = globalThis.fetch,
): Readonly<{
  transport: TxlineHttpTransport;
  sseTransport: TxlineSseTransport;
}> {
  if (typeof fetchImpl !== "function") throw invalidConfig();

  const transport: TxlineHttpTransport = async (request) => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let completed = false;
    let canceled = false;
    try {
      if (request.signal.aborted) throw transportFailure("HTTP");
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
        redirect: "error",
      });
      const status = response.status;
      if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
        throw transportFailure("HTTP");
      }
      if (status < 200 || status > 299) {
        await cancelBody(response.body);
        return Object.freeze({ status, body: "", bodyLimitExceeded: false });
      }
      if (response.body === null) {
        return Object.freeze({ status, body: "", bodyLimitExceeded: false });
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let body = "";
      let receivedBytes = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        receivedBytes += next.value.byteLength;
        if (receivedBytes > request.maxResponseBytes) {
          canceled = true;
          try {
            await reader.cancel();
          } catch {
            // Response-limit classification must survive cleanup failure.
          }
          return Object.freeze({
            status,
            body: "",
            bodyLimitExceeded: true,
          });
        }
        body += decoder.decode(next.value, { stream: true });
      }
      completed = true;
      body += decoder.decode();
      const result: TxlineHttpResponse = {
        status,
        body,
        bodyLimitExceeded: false,
      };
      return Object.freeze(result);
    } catch {
      throw transportFailure("HTTP");
    } finally {
      if (!completed && !canceled) {
        try {
          await reader?.cancel();
        } catch {
          // Cleanup failures must not expose provider or infrastructure details.
        }
      }
      try {
        reader?.releaseLock();
      } catch {
        // Cleanup failures must not expose provider or infrastructure details.
      }
    }
  };

  const sseTransport: TxlineSseTransport = async function* (request) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let completed = false;
    try {
      if (request.signal.aborted) throw transportFailure("SSE");
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
        redirect: "error",
      });
      const status = response.status;
      if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
        throw transportFailure("SSE");
      }
      if (status < 200 || status > 299) {
        await cancelBody(response.body);
        throw new TxlineHttpStatusError(status);
      }
      if (response.body === null) throw transportFailure("SSE");

      reader = response.body.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) {
          completed = true;
          return;
        }
        yield next.value;
      }
    } catch (error) {
      if (error instanceof TxlineHttpStatusError) throw error;
      throw transportFailure("SSE");
    } finally {
      if (!completed) {
        try {
          await reader?.cancel();
        } catch {
          // Cleanup failures must not expose provider or infrastructure details.
        }
      }
      try {
        reader?.releaseLock();
      } catch {
        // Cleanup failures must not expose provider or infrastructure details.
      }
    }
  };

  return Object.freeze({ transport, sseTransport });
}

function requiredEnvironmentValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = env[name];
  if (value === undefined || value === "") throw invalidConfig();
  return value;
}

function positiveEnvironmentInteger(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): number {
  const value = requiredEnvironmentValue(env, name);
  if (!/^[1-9]\d*$/.test(value)) throw invalidConfig();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw invalidConfig();
  return parsed;
}

export function createTxlineProviderClientFromEnv(
  options: TxlineNodeProviderClientOptions = {},
): TxlineProviderClient {
  if (typeof options !== "object" || options === null) throw invalidConfig();
  const env = options.env ?? process.env;
  const transports = createTxlineNodeTransports(
    options.fetch ?? globalThis.fetch,
  );

  return createTxlineProviderClient({
    baseUrl: requiredEnvironmentValue(env, "TXLINE_BASE_URL"),
    jwt: requiredEnvironmentValue(env, "TXLINE_JWT"),
    apiToken: requiredEnvironmentValue(env, "TXLINE_API_TOKEN"),
    timeoutMs: positiveEnvironmentInteger(env, "TXLINE_TIMEOUT_MS"),
    maxResponseBytes: positiveEnvironmentInteger(
      env,
      "TXLINE_MAX_RESPONSE_BYTES",
    ),
    maxSseEvents: positiveEnvironmentInteger(env, "TXLINE_MAX_SSE_EVENTS"),
    ...transports,
  });
}
