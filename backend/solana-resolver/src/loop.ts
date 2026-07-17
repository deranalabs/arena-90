import { setTimeout as delay } from "node:timers/promises";

import type {
  ResolverTickResult,
  SupporterResolutionWorker,
} from "./worker.js";

export interface ResolverLoopObservation {
  readonly consecutiveFailures: number;
  readonly result?: ResolverTickResult;
  readonly errorName?: string;
  readonly errorCode?: string;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const direct = "code" in error ? error.code : undefined;
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct).slice(0, 80);
  }
  if (!("error" in error) || typeof error.error !== "object" || error.error === null) {
    return undefined;
  }
  const nested = error.error as Record<string, unknown>;
  const errorCodeInput = nested["errorCode"];
  if (
    typeof errorCodeInput === "object" &&
    errorCodeInput !== null &&
    "code" in errorCodeInput
  ) {
    return String(errorCodeInput.code).slice(0, 80);
  }
  return undefined;
}

export async function runResolverLoop(input: {
  readonly worker: SupporterResolutionWorker;
  readonly pollMs: number;
  readonly signal: AbortSignal;
  readonly observe: (observation: ResolverLoopObservation) => void;
  readonly sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}): Promise<void> {
  if (!Number.isSafeInteger(input.pollMs) || input.pollMs < 1_000) {
    throw new Error("Resolver poll interval must be at least 1000ms");
  }
  const sleep =
    input.sleep ??
    (async (milliseconds: number, signal: AbortSignal) => {
      await delay(milliseconds, undefined, { signal });
    });
  let consecutiveFailures = 0;

  while (!input.signal.aborted) {
    try {
      const result = await input.worker.tick(input.signal);
      consecutiveFailures = 0;
      input.observe({ consecutiveFailures, result });
    } catch (error) {
      if (input.signal.aborted) return;
      consecutiveFailures += 1;
      const code = errorCode(error);
      input.observe({
        consecutiveFailures,
        errorName: error instanceof Error ? error.name : "UnknownError",
        ...(code === undefined ? {} : { errorCode: code }),
      });
    }

    try {
      await sleep(input.pollMs, input.signal);
    } catch (error) {
      if (input.signal.aborted) return;
      throw error;
    }
  }
}
