import type {
  TxlineHttpRequest,
  TxlineHttpResponse,
  TxlineProviderClient,
  TxlineProviderClientConfig,
  TxlineRetryDelay,
  TxlineSseEvent,
} from "./domain.js";
import {
  TxlineDataError,
  TxlineHttpStatusError,
} from "./domain.js";
import { createTxlineSseParser } from "./sse.js";

const RETRY_DELAY_MS = 250;
const ATTEMPT_COUNT = 2;

type FailureKind =
  | "ABORTED"
  | "TIMEOUT"
  | "NETWORK"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "HTTP";

class AttemptInterrupted extends Error {
  readonly kind: "ABORTED" | "TIMEOUT";

  constructor(kind: "ABORTED" | "TIMEOUT") {
    super("TxLINE provider attempt interrupted");
    this.kind = kind;
  }
}

class ParsedStreamFailure extends Error {
  readonly failure: TxlineDataError;

  constructor(failure: TxlineDataError) {
    super("TxLINE stream parsing failed");
    this.failure = failure;
  }
}

function providerFailure(kind: FailureKind): TxlineDataError {
  switch (kind) {
    case "ABORTED":
      return new TxlineDataError(
        "PROVIDER_ABORTED",
        "TxLINE provider request aborted",
      );
    case "TIMEOUT":
      return new TxlineDataError(
        "PROVIDER_TIMEOUT",
        "TxLINE provider request timed out",
      );
    case "NETWORK":
      return new TxlineDataError(
        "PROVIDER_NETWORK_FAILURE",
        "TxLINE provider network failure",
      );
    case "AUTHENTICATION":
      return new TxlineDataError(
        "PROVIDER_AUTHENTICATION_FAILURE",
        "TxLINE provider authentication failure",
      );
    case "AUTHORIZATION":
      return new TxlineDataError(
        "PROVIDER_AUTHORIZATION_FAILURE",
        "TxLINE provider authorization failure",
      );
    case "HTTP":
      return new TxlineDataError(
        "PROVIDER_HTTP_FAILURE",
        "TxLINE provider HTTP failure",
      );
  }
}

function invalidResponse(): TxlineDataError {
  return new TxlineDataError(
    "PROVIDER_INVALID_RESPONSE",
    "Invalid TxLINE provider response",
  );
}

function responseLimit(): TxlineDataError {
  return new TxlineDataError(
    "PROVIDER_RESPONSE_LIMIT",
    "TxLINE provider response limit exceeded",
  );
}

function invalidConfig(): TxlineDataError {
  return new TxlineDataError(
    "INVALID_PROVIDER_CONFIG",
    "Invalid TxLINE provider client configuration",
  );
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidConfig();
  }

  const normalizedInput = value.replace(/\/+$/, "");
  const canonicalUrl = parsed.href.replace(/\/+$/, "");
  if (
    value.trim() !== value ||
    normalizedInput !== canonicalUrl ||
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw invalidConfig();
  }

  return canonicalUrl;
}

function validateSecret(value: string): void {
  if (
    value.trim() === "" ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidConfig();
  }
}

function validateFixtureId(fixtureId: number): void {
  if (!isPositiveSafeInteger(fixtureId)) {
    throw new TxlineDataError(
      "INVALID_PROVIDER_INPUT",
      "Invalid TxLINE fixture ID",
    );
  }
}

function classifyStatus(status: number): FailureKind | undefined {
  if (status >= 200 && status <= 299) return undefined;
  if (status === 401) return "AUTHENTICATION";
  if (status === 403) return "AUTHORIZATION";
  return "HTTP";
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

const defaultRetryDelay: TxlineRetryDelay = (delayMs, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AttemptInterrupted("ABORTED"));
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      cleanup();
      reject(new AttemptInterrupted("ABORTED"));
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });

async function waitBeforeRetry(
  delay: TxlineRetryDelay,
  signal: AbortSignal,
): Promise<void> {
  try {
    await delay(RETRY_DELAY_MS, signal);
  } catch {
    if (signal.aborted) throw providerFailure("ABORTED");
    throw providerFailure("NETWORK");
  }
}

function createRequest(
  baseUrl: string,
  path: string,
  config: TxlineProviderClientConfig,
  signal: AbortSignal,
): TxlineHttpRequest {
  const request: TxlineHttpRequest = {
    method: "GET",
    url: `${baseUrl}${path}`,
    headers: Object.freeze({
      Authorization: `Bearer ${config.jwt}`,
      "X-Api-Token": config.apiToken,
    }),
    signal,
    maxResponseBytes: config.maxResponseBytes,
  };
  return Object.freeze(request);
}

async function runWithTimeout<T>(
  callerSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (callerSignal.aborted) throw new AttemptInterrupted("ABORTED");

  const controller = new AbortController();
  let interruption: "ABORTED" | "TIMEOUT" | undefined;
  let rejectInterruption: ((error: AttemptInterrupted) => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterruption = reject;
  });
  const interrupt = (kind: "ABORTED" | "TIMEOUT"): void => {
    if (interruption !== undefined) return;
    interruption = kind;
    controller.abort();
    rejectInterruption?.(new AttemptInterrupted(kind));
  };
  const onAbort = (): void => interrupt("ABORTED");
  callerSignal.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => interrupt("TIMEOUT"), timeoutMs);

  try {
    return await Promise.race([operation(controller.signal), interrupted]);
  } catch (error) {
    if (error instanceof AttemptInterrupted) throw error;
    if (interruption !== undefined) throw new AttemptInterrupted(interruption);
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal.removeEventListener("abort", onAbort);
  }
}

function materializeHttpResponse(response: unknown): TxlineHttpResponse {
  try {
    if (typeof response !== "object" || response === null) {
      throw invalidResponse();
    }
    const candidate = response as Record<string, unknown>;
    const status = candidate["status"];
    const body = candidate["body"];
    const bodyLimitExceeded = candidate["bodyLimitExceeded"];
    if (
      typeof status !== "number" ||
      !Number.isSafeInteger(status) ||
      status < 100 ||
      status > 599 ||
      typeof body !== "string" ||
      typeof bodyLimitExceeded !== "boolean"
    ) {
      throw invalidResponse();
    }
    return Object.freeze({
      status,
      body,
      bodyLimitExceeded,
    });
  } catch {
    throw invalidResponse();
  }
}

function parseStreamFrames(
  operation: () => readonly TxlineSseEvent[],
): readonly TxlineSseEvent[] {
  try {
    return operation();
  } catch (error) {
    const failure =
      error instanceof TxlineDataError &&
      error.code === "PROVIDER_RESPONSE_LIMIT"
        ? responseLimit()
        : invalidResponse();
    throw new ParsedStreamFailure(failure);
  }
}

export function createTxlineProviderClient(
  config: TxlineProviderClientConfig,
): TxlineProviderClient {
  if (
    typeof config !== "object" ||
    config === null ||
    typeof config.baseUrl !== "string" ||
    typeof config.jwt !== "string" ||
    typeof config.apiToken !== "string" ||
    typeof config.transport !== "function" ||
    typeof config.sseTransport !== "function" ||
    !isPositiveSafeInteger(config.timeoutMs) ||
    !isPositiveSafeInteger(config.maxResponseBytes) ||
    !isPositiveSafeInteger(config.maxSseEvents) ||
    (config.retryDelay !== undefined && typeof config.retryDelay !== "function")
  ) {
    throw invalidConfig();
  }

  const baseUrl = validateBaseUrl(config.baseUrl);
  validateSecret(config.jwt);
  validateSecret(config.apiToken);
  const retryDelay = config.retryDelay ?? defaultRetryDelay;

  async function requestBuffered(
    path: string,
    signal: AbortSignal,
  ): Promise<TxlineHttpResponse> {
    for (let attempt = 0; attempt < ATTEMPT_COUNT; attempt += 1) {
      let response: TxlineHttpResponse;
      try {
        response = await runWithTimeout(signal, config.timeoutMs, (attemptSignal) =>
          config.transport(createRequest(baseUrl, path, config, attemptSignal)),
        );
      } catch (error) {
        const kind =
          error instanceof AttemptInterrupted ? error.kind : "NETWORK";
        if (kind === "ABORTED") throw providerFailure("ABORTED");
        if (attempt + 1 < ATTEMPT_COUNT) {
          await waitBeforeRetry(retryDelay, signal);
          continue;
        }
        throw providerFailure(kind);
      }

      response = materializeHttpResponse(response);
      const statusFailure = classifyStatus(response.status);
      if (statusFailure !== undefined) {
        if (isRetryableStatus(response.status) && attempt + 1 < ATTEMPT_COUNT) {
          await waitBeforeRetry(retryDelay, signal);
          continue;
        }
        throw providerFailure(statusFailure);
      }
      if (
        response.bodyLimitExceeded ||
        Buffer.byteLength(response.body, "utf8") > config.maxResponseBytes
      ) {
        throw responseLimit();
      }
      return response;
    }
    throw providerFailure("NETWORK");
  }

  async function requestJson(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await requestBuffered(path, signal);
    try {
      return JSON.parse(response.body) as unknown;
    } catch {
      throw invalidResponse();
    }
  }

  async function requestHistoricalSse(
    path: string,
    signal: AbortSignal,
  ): Promise<readonly TxlineSseEvent[]> {
    const response = await requestBuffered(path, signal);
    const parser = createTxlineSseParser(
      config.maxResponseBytes,
      config.maxSseEvents,
    );
    const events = [
      ...parser.push(new TextEncoder().encode(response.body)),
      ...parser.finish(),
    ];
    return Object.freeze(events);
  }

  async function* requestScoreStream(
    path: string,
    callerSignal: AbortSignal,
  ): AsyncIterable<TxlineSseEvent> {
    let emitted = false;

    for (let attempt = 0; attempt < ATTEMPT_COUNT; attempt += 1) {
      const parser = createTxlineSseParser(
        config.maxResponseBytes,
        config.maxSseEvents,
      );
      const controller = new AbortController();
      const onAbort = (): void => controller.abort();
      callerSignal.addEventListener("abort", onAbort, { once: true });
      if (callerSignal.aborted) controller.abort();
      let iterator: AsyncIterator<Uint8Array> | undefined;

      try {
        if (callerSignal.aborted) throw new AttemptInterrupted("ABORTED");
        iterator = config
          .sseTransport(createRequest(baseUrl, path, config, controller.signal))
          [Symbol.asyncIterator]();

        while (true) {
          const next = await runWithTimeout(
            callerSignal,
            config.timeoutMs,
            async (pullSignal) => {
              const abortPull = (): void => controller.abort();
              pullSignal.addEventListener("abort", abortPull, { once: true });
              try {
                return await iterator?.next();
              } finally {
                pullSignal.removeEventListener("abort", abortPull);
              }
            },
          );
          if (next === undefined || next.done === true) break;
          for (const event of parseStreamFrames(() => parser.push(next.value))) {
            if (callerSignal.aborted) throw new AttemptInterrupted("ABORTED");
            emitted = true;
            yield event;
          }
        }

        for (const event of parseStreamFrames(() => parser.finish())) {
          if (callerSignal.aborted) throw new AttemptInterrupted("ABORTED");
          emitted = true;
          yield event;
        }
        return;
      } catch (error) {
        const status =
          error instanceof TxlineHttpStatusError ? error.status : undefined;
        const statusFailure =
          status === undefined ? undefined : classifyStatus(status);
        const kind: FailureKind =
          error instanceof AttemptInterrupted
            ? error.kind
            : statusFailure ?? "NETWORK";
        const retryable =
          !emitted &&
          attempt + 1 < ATTEMPT_COUNT &&
          (kind === "TIMEOUT" ||
            kind === "NETWORK" ||
            (status !== undefined && isRetryableStatus(status)));

        if (kind === "ABORTED" || callerSignal.aborted) {
          throw providerFailure("ABORTED");
        }
        if (error instanceof ParsedStreamFailure) throw error.failure;
        if (retryable) {
          await waitBeforeRetry(retryDelay, callerSignal);
          continue;
        }
        throw providerFailure(kind);
      } finally {
        callerSignal.removeEventListener("abort", onAbort);
        controller.abort();
        try {
          await iterator?.return?.();
        } catch {
          // Transport cleanup failures must never replace sanitized client errors.
        }
      }
    }
  }

  const client: TxlineProviderClient = {
    getFixtureSnapshot(signal) {
      return requestJson("/api/fixtures/snapshot", signal);
    },
    getOddsSnapshot(fixtureId, signal) {
      validateFixtureId(fixtureId);
      return requestJson(`/api/odds/snapshot/${fixtureId}`, signal);
    },
    getOddsUpdates(fixtureId, signal) {
      validateFixtureId(fixtureId);
      return requestJson(`/api/odds/updates/${fixtureId}`, signal);
    },
    getScoreSnapshot(fixtureId, signal) {
      validateFixtureId(fixtureId);
      return requestJson(`/api/scores/snapshot/${fixtureId}`, signal);
    },
    getScoreStream(fixtureId, signal) {
      validateFixtureId(fixtureId);
      return requestScoreStream(`/api/scores/stream?fixtureId=${fixtureId}`, signal);
    },
    getHistoricalScoreReplay(fixtureId, signal) {
      validateFixtureId(fixtureId);
      return requestHistoricalSse(`/api/scores/historical/${fixtureId}`, signal);
    },
  };
  return Object.freeze(client);
}
