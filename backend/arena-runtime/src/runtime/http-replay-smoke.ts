import { isDeepStrictEqual } from "node:util";

import {
  publicArenaEventV1Schema,
  publicArenaStateV1Schema,
  publicEventHistoryV1Schema,
} from "../api/contracts.js";
import {
  projectArenaEventHistory,
  projectArenaState,
} from "../api/public-projection.js";
import {
  DECISION_CHECKPOINT_IDS,
  arenaFinalResultV1Schema,
} from "../contracts/index.js";
import {
  classifyNodeHttpRuntimeFailure,
  createNodeHttpRuntimeComposition,
  type CreateNodeHttpRuntimeCompositionOptions,
  type NodeHttpRuntimeComposition,
} from "./node-http.js";

export type ReplayHttpAcceptanceSmokeStatus =
  | "PASSED"
  | "CONFIG_FAILURE"
  | "STARTUP_FAILURE"
  | "API_FAILURE"
  | "TIMEOUT"
  | "VERIFICATION_FAILURE"
  | "SHUTDOWN_FAILURE";

export interface ReplayHttpAcceptanceSmokeResult {
  readonly status: ReplayHttpAcceptanceSmokeStatus;
}

export type ReplayHttpAcceptanceMode =
  | "PRODUCT_ACCEPTANCE"
  | "CLEAN_SHOWCASE";

export interface RunReplayHttpAcceptanceSmokeOptions {
  readonly mode?: ReplayHttpAcceptanceMode;
  readonly composition?: CreateNodeHttpRuntimeCompositionOptions;
  readonly fetch?: typeof globalThis.fetch;
  readonly overallTimeoutMs?: number;
}

class SmokeFailure extends Error {
  readonly status: ReplayHttpAcceptanceSmokeStatus;

  constructor(status: ReplayHttpAcceptanceSmokeStatus) {
    super("Arena Replay HTTP acceptance smoke failed");
    this.name = "SmokeFailure";
    this.status = status;
  }
}

function result(
  status: ReplayHttpAcceptanceSmokeStatus,
): ReplayHttpAcceptanceSmokeResult {
  return Object.freeze({ status });
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new SmokeFailure("API_FAILURE");
  }
}

function parseSseEvents(serialized: string) {
  const events = [];
  for (const frame of serialized.split("\n\n")) {
    if (frame === "" || frame.startsWith(":")) continue;
    const lines = frame.split("\n");
    const idLine = lines.find((line) => line.startsWith("id: "));
    const eventLine = lines.find((line) => line.startsWith("event: "));
    const dataLine = lines.find((line) => line.startsWith("data: "));
    if (
      idLine === undefined ||
      eventLine !== "event: arena-event" ||
      dataLine === undefined
    ) {
      throw new SmokeFailure("VERIFICATION_FAILURE");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLine.slice("data: ".length)) as unknown;
    } catch {
      throw new SmokeFailure("VERIFICATION_FAILURE");
    }
    const eventResult = publicArenaEventV1Schema.safeParse(parsed);
    if (
      !eventResult.success ||
      idLine !== `id: ${eventResult.data.sequence}`
    ) {
      throw new SmokeFailure("VERIFICATION_FAILURE");
    }
    events.push(eventResult.data);
  }
  return events;
}

async function executeAcceptanceFlow(
  composition: NodeHttpRuntimeComposition,
  fetchImpl: typeof globalThis.fetch,
  signal: AbortSignal,
  mode: ReplayHttpAcceptanceMode,
  invocations: readonly Readonly<{
    agentId: "alpha" | "beta";
    checkpointId: string;
    attempt: 0 | 1;
  }>[],
): Promise<void> {
  if (composition.mode !== "REPLAY") {
    throw new SmokeFailure("CONFIG_FAILURE");
  }
  const address = await composition.listen({ host: "127.0.0.1", port: 0 });
  const origin = `http://${address.host}:${address.port}`;
  const createResponse = await fetchImpl(`${origin}/api/arenas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: composition.manifest }),
    signal,
  });
  if (createResponse.status !== 201 && createResponse.status !== 200) {
    throw new SmokeFailure("API_FAILURE");
  }
  await readJsonResponse(createResponse);

  const runResponse = await fetchImpl(
    `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}/run`,
    { method: "POST", signal },
  );
  if (runResponse.status !== 202 && runResponse.status !== 200) {
    throw new SmokeFailure("API_FAILURE");
  }
  await readJsonResponse(runResponse);

  const stateResponse = await fetchImpl(
    `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}`,
    { signal },
  );
  if (stateResponse.status !== 200) throw new SmokeFailure("API_FAILURE");
  if (!publicArenaStateV1Schema.safeParse(await readJsonResponse(stateResponse)).success) {
    throw new SmokeFailure("VERIFICATION_FAILURE");
  }

  const initialHistoryResponse = await fetchImpl(
    `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}/events`,
    { signal },
  );
  if (initialHistoryResponse.status !== 200) {
    throw new SmokeFailure("API_FAILURE");
  }
  if (
    !publicEventHistoryV1Schema.safeParse(
      await readJsonResponse(initialHistoryResponse),
    ).success
  ) {
    throw new SmokeFailure("VERIFICATION_FAILURE");
  }

  const streamResponse = await fetchImpl(
    `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}/events/stream`,
    { headers: { accept: "text/event-stream" }, signal },
  );
  if (streamResponse.status !== 200) throw new SmokeFailure("API_FAILURE");
  const streamedEvents = parseSseEvents(await streamResponse.text());

  const [finalStateResponse, finalHistoryResponse] = await Promise.all([
    fetchImpl(
      `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}`,
      { signal },
    ),
    fetchImpl(
      `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}/events`,
      { signal },
    ),
  ]);
  if (finalStateResponse.status !== 200 || finalHistoryResponse.status !== 200) {
    throw new SmokeFailure("API_FAILURE");
  }
  const finalState = publicArenaStateV1Schema.safeParse(
    await readJsonResponse(finalStateResponse),
  );
  const finalHistory = publicEventHistoryV1Schema.safeParse(
    await readJsonResponse(finalHistoryResponse),
  );
  const persisted = await (async () => {
    try {
      const reloaded = await composition.store.read(
        composition.manifest.arenaId,
        0,
      );
      if (reloaded === "NOT_FOUND") {
        throw new SmokeFailure("VERIFICATION_FAILURE");
      }
      const historyCursor = Math.floor(reloaded.state.lastEventSequence / 2);
      const expectedState = projectArenaState(reloaded.state);
      const expectedHistory = projectArenaEventHistory(
        reloaded.state,
        reloaded.events,
        0,
      );
      const expectedCursorHistory = projectArenaEventHistory(
        reloaded.state,
        reloaded.events.slice(historyCursor),
        historyCursor,
      );
      let cursorHistoryResponse: Response;
      try {
        cursorHistoryResponse = await fetchImpl(
          `${origin}/api/arenas/${encodeURIComponent(composition.manifest.arenaId)}/events?after=${historyCursor}`,
          { signal },
        );
      } catch {
        throw new SmokeFailure("API_FAILURE");
      }
      if (cursorHistoryResponse.status !== 200) {
        throw new SmokeFailure("API_FAILURE");
      }
      const cursorHistory = publicEventHistoryV1Schema.safeParse(
        await readJsonResponse(cursorHistoryResponse),
      );
      if (
        !finalState.success ||
        !finalHistory.success ||
        !cursorHistory.success ||
        !isDeepStrictEqual(finalState.data, expectedState) ||
        !isDeepStrictEqual(finalHistory.data, expectedHistory) ||
        !isDeepStrictEqual(cursorHistory.data, expectedCursorHistory) ||
        !isDeepStrictEqual(streamedEvents, expectedHistory.events)
      ) {
        throw new SmokeFailure("VERIFICATION_FAILURE");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof SmokeFailure) throw error;
      throw new SmokeFailure("VERIFICATION_FAILURE");
    }
  })();
  const contiguous = streamedEvents.every(
    (event, index) => event.sequence === index + 1,
  );
  const productCheckpointsAreValid =
    finalState.success &&
    finalState.data.checkpoints.length === 6 &&
    finalState.data.checkpoints.every((checkpoint, index) => {
      if (
        checkpoint.checkpointId !== DECISION_CHECKPOINT_IDS[index] ||
        checkpoint.outcome !== "REVEALED" ||
        checkpoint.failures.some(
          (failure) =>
            failure.scope !== "AGENT" || failure.reason === "PROCESS_FAILURE",
        )
      ) {
        return false;
      }
      return (["alpha", "beta"] as const).every((agentId) => {
        const decision = checkpoint.revealedDecisions[agentId];
        const failures = checkpoint.failures.filter(
          (failure) => failure.scope === "AGENT" && failure.agentId === agentId,
        );
        return decision === undefined
          ? failures.length === 1
          : failures.length === 0;
      });
    });
  const primaryInvocations = invocations.filter(({ attempt }) => attempt === 0);
  const repairInvocations = invocations.filter(({ attempt }) => attempt === 1);
  const invocationsAreValid =
    primaryInvocations.length === 12 &&
    DECISION_CHECKPOINT_IDS.every((checkpointId) =>
      (["alpha", "beta"] as const).every(
        (agentId) =>
          primaryInvocations.filter(
            (invocation) =>
              invocation.checkpointId === checkpointId &&
              invocation.agentId === agentId,
          ).length === 1,
      ),
    ) &&
    invocations.every(({ checkpointId }) => checkpointId !== "FINAL") &&
    repairInvocations.every(
      (repair) =>
        repairInvocations.filter(
          (candidate) =>
            candidate.checkpointId === repair.checkpointId &&
            candidate.agentId === repair.agentId,
        ).length === 1,
    );
  const checkpointAccountingIsValid =
    finalState.success &&
    finalHistory.success &&
    finalState.data.checkpoints.every((checkpoint, index, checkpoints) => {
      const range = finalHistory.data.events.filter(
        (event) =>
          event.sequence >= checkpoint.firstEventSequence &&
          event.sequence <= checkpoint.lastEventSequence,
      );
      const reveal = range.find((event) => event.type === "ROUND_REVEALED");
      const roundComplete = range.find(
        (event) => event.type === "ROUND_COMPLETE",
      );
      const missed = range.filter(
        (event) => event.type === "MISSED_DECISION_ROUND",
      );
      const agentFailures = checkpoint.failures.filter(
        (failure) => failure.scope === "AGENT",
      );
      const rechecking = range.filter(
        (event) => event.type === "RECHECKING_DECISION",
      );
      const checkpointRepairs = repairInvocations.filter(
        (repair) => repair.checkpointId === checkpoint.checkpointId,
      );
      return (
        range.length ===
          checkpoint.lastEventSequence - checkpoint.firstEventSequence + 1 &&
        range[0]?.sequence === checkpoint.firstEventSequence &&
        range[0]?.type === "CHECKPOINT_OPENED" &&
        range.at(-1)?.sequence === checkpoint.lastEventSequence &&
        range.at(-1)?.type === "ROUND_COMPLETE" &&
        range.every(
          (event) =>
            "checkpointId" in event &&
            event.checkpointId === checkpoint.checkpointId,
        ) &&
        reveal?.type === "ROUND_REVEALED" &&
        JSON.stringify(reveal.payload.decisions) ===
          JSON.stringify(checkpoint.revealedDecisions) &&
        JSON.stringify(reveal.payload.failures) ===
          JSON.stringify(checkpoint.failures) &&
        JSON.stringify(reveal.payload.portfoliosBefore) ===
          JSON.stringify(checkpoint.portfoliosBefore) &&
        JSON.stringify(reveal.payload.portfoliosAfter) ===
          JSON.stringify(checkpoint.portfoliosAfter) &&
        roundComplete?.type === "ROUND_COMPLETE" &&
        JSON.stringify(roundComplete.payload.portfolios) ===
          JSON.stringify(checkpoint.portfoliosAfter) &&
        missed.length === agentFailures.length &&
        agentFailures.every(
          (failure) =>
            missed.filter(
              (event) =>
                event.agentId === failure.agentId &&
                event.payload.reason === failure.reason,
            ).length === 1,
        ) &&
        rechecking.length === checkpointRepairs.length &&
        checkpointRepairs.every(
          (repair) =>
            rechecking.filter((event) => event.agentId === repair.agentId)
              .length === 1,
        ) &&
        (index === 0
          ? checkpoint.firstEventSequence === 2
          : checkpoint.firstEventSequence ===
            (checkpoints[index - 1]?.lastEventSequence ?? 0) + 1)
      );
    });
  const persistedAccountingIsValid =
    finalState.success &&
    finalHistory.success &&
    persisted.state.lastEventSequence === finalState.data.lastEventSequence &&
    persisted.events.length === finalHistory.data.events.length &&
    persisted.events.every((event, index) => {
      const projected = finalHistory.data.events[index];
      return (
        event.sequence === index + 1 &&
        projected?.sequence === event.sequence &&
        projected.eventId === event.eventId &&
        projected.arenaId === event.arenaId &&
        projected.type === event.type &&
        (!("checkpointId" in projected) ||
          projected.checkpointId === event.checkpointId) &&
        (!("agentId" in projected) || projected.agentId === event.agentId)
      );
    });
  const completedEvent = finalHistory.success
    ? finalHistory.data.events.at(-1)
    : undefined;
  const settlementIsValid =
    finalState.success &&
    finalState.data.finalResult !== undefined &&
    arenaFinalResultV1Schema.safeParse(finalState.data.finalResult).success &&
    completedEvent?.type === "COMPLETED" &&
    JSON.stringify(completedEvent.payload.result) ===
      JSON.stringify(finalState.data.finalResult) &&
    JSON.stringify(completedEvent.payload.portfolios) ===
      JSON.stringify(finalState.data.portfolios);
  const showcaseCheckpointsAreClean =
    finalState.success &&
    finalState.data.checkpoints.every(
      (checkpoint) =>
        checkpoint.failures.length === 0 &&
        checkpoint.revealedDecisions.alpha !== undefined &&
        checkpoint.revealedDecisions.beta !== undefined,
    );
  if (
    !finalState.success ||
    !finalHistory.success ||
    finalState.data.phase !== "COMPLETED" ||
    !productCheckpointsAreValid ||
    !checkpointAccountingIsValid ||
    !persistedAccountingIsValid ||
    !settlementIsValid ||
    !invocationsAreValid ||
    (mode === "CLEAN_SHOWCASE" && !showcaseCheckpointsAreClean) ||
    (mode === "CLEAN_SHOWCASE" && repairInvocations.length !== 0) ||
    streamedEvents.length === 0 ||
    streamedEvents.at(-1)?.type !== "COMPLETED" ||
    !contiguous ||
    finalHistory.data.events.length !== streamedEvents.length ||
    JSON.stringify(finalHistory.data.events) !== JSON.stringify(streamedEvents) ||
    finalHistory.data.lastEventSequence !== streamedEvents.at(-1)?.sequence
  ) {
    throw new SmokeFailure("VERIFICATION_FAILURE");
  }
}

export async function runReplayHttpAcceptanceSmoke(
  options: RunReplayHttpAcceptanceSmokeOptions = {},
): Promise<ReplayHttpAcceptanceSmokeResult> {
  if (typeof options !== "object" || options === null) {
    return result("CONFIG_FAILURE");
  }
  const mode = options.mode ?? "PRODUCT_ACCEPTANCE";
  if (mode !== "PRODUCT_ACCEPTANCE" && mode !== "CLEAN_SHOWCASE") {
    return result("CONFIG_FAILURE");
  }
  const configuredTimeout =
    options.composition?.env?.["ARENA90_HTTP_SMOKE_TIMEOUT_MS"];
  const overallTimeoutMs =
    options.overallTimeoutMs ??
    (configuredTimeout === undefined || !/^[1-9]\d*$/u.test(configuredTimeout)
      ? configuredTimeout === undefined
        ? 900_000
        : Number.NaN
      : Number(configuredTimeout));
  if (!Number.isSafeInteger(overallTimeoutMs) || overallTimeoutMs <= 0) {
    return result("CONFIG_FAILURE");
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, overallTimeoutMs);
  timeout.unref();
  let composition: NodeHttpRuntimeComposition | undefined;
  let status: ReplayHttpAcceptanceSmokeStatus = "PASSED";
  let compositionCreated = false;
  const invocations: Array<{
    agentId: "alpha" | "beta";
    checkpointId: string;
    attempt: 0 | 1;
  }> = [];
  try {
    const configuredObserver = options.composition?.observeAgentInvocation;
    composition = await createNodeHttpRuntimeComposition({
      ...options.composition,
      observeAgentInvocation(observation) {
        invocations.push(observation);
        configuredObserver?.(observation);
      },
    });
    compositionCreated = true;
    await executeAcceptanceFlow(
      composition,
      options.fetch ?? globalThis.fetch,
      controller.signal,
      mode,
      invocations,
    );
  } catch (error) {
    if (timedOut) status = "TIMEOUT";
    else if (error instanceof SmokeFailure) status = error.status;
    else {
      const category = classifyNodeHttpRuntimeFailure(error);
      status =
        category === "LISTEN_FAILURE"
          ? "STARTUP_FAILURE"
          : compositionCreated
            ? "API_FAILURE"
            : "CONFIG_FAILURE";
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
    if (composition !== undefined) {
      try {
        await composition.shutdown();
      } catch {
        if (status === "PASSED") status = "SHUTDOWN_FAILURE";
      }
    }
  }
  return result(status);
}

export function formatReplayHttpAcceptanceSmokeResult(
  smokeResult: ReplayHttpAcceptanceSmokeResult,
  mode: ReplayHttpAcceptanceMode = "PRODUCT_ACCEPTANCE",
): string {
  const label =
    mode === "CLEAN_SHOWCASE"
      ? "Arena Replay HTTP clean showcase smoke"
      : "Arena Replay HTTP acceptance smoke";
  return smokeResult.status === "PASSED"
    ? `${label} passed.`
    : `${label} failed: ${smokeResult.status}.`;
}
