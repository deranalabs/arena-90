import type {
  AgentAdapter,
  AgentInvocationRequest,
} from "../adapters/agents/fake.js";
import { AgentOutputError } from "../adapters/agents/zeroclaw.js";
import {
  agentDecisionStructureSchema,
  createAgentDecisionSchema,
  persistedArenaEventV1Schema,
  type AgentDecision,
  type AgentDecisionIdentity,
  type ArenaAgentId,
  type CanonicalSnapshot,
  type CheckpointFailureV1,
  type MoneyMicros,
  type PersistedArenaEventV1,
  type PortfolioState,
} from "../contracts/index.js";
import { applyDecision, markToMarket } from "../engine/index.js";

export interface CheckpointExecutionPortfolios {
  readonly alpha: PortfolioState;
  readonly beta: PortfolioState;
}

export interface PreparedCheckpointExecutionResult {
  readonly outcome: "REVEALED";
  readonly revealedDecisions: Readonly<
    Partial<Record<ArenaAgentId, AgentDecision>>
  >;
  readonly failures: readonly CheckpointFailureV1[];
  readonly portfoliosAfter: CheckpointExecutionPortfolios;
  readonly events: readonly PersistedArenaEventV1[];
}

export class CheckpointExecutionAbortedError extends Error {
  readonly code = "ABORTED";

  constructor() {
    super("Arena checkpoint execution was aborted");
    this.name = "CheckpointExecutionAbortedError";
  }
}

type InvocationFailureReason = "TIMEOUT" | "PROCESS_FAILURE" | "MISSING_OUTPUT";
type InvocationOutcome =
  | { readonly status: "RECEIVED"; readonly output: unknown }
  | {
      readonly status: "OUTPUT_FAILED";
      readonly category: AgentOutputError["category"];
      readonly candidateCount: number;
    }
  | { readonly status: "FAILED"; readonly reason: InvocationFailureReason };

interface InitialResolution {
  readonly invocation: InvocationOutcome;
  readonly decision?: AgentDecision;
  readonly validationErrors?: readonly string[];
}

interface FinalResolution {
  readonly decision?: AgentDecision;
  readonly failure?: CheckpointFailureV1;
}

export type AgentDecisionOutputFailureCategory =
  | "SCHEMA_FAILURE"
  | "VALIDATION_FAILURE";

type DecisionValidation =
  | { readonly outcome: "VALID"; readonly decision: AgentDecision }
  | {
      readonly outcome: "INVALID";
      readonly category: AgentDecisionOutputFailureCategory;
      readonly candidateCount: 1;
      readonly validationErrors: readonly string[];
    };

export function classifyAgentDecisionOutput(
  output: unknown,
  expected: AgentDecisionIdentity,
): DecisionValidation {
  const structure = agentDecisionStructureSchema.safeParse(output);
  if (!structure.success) {
    return {
      outcome: "INVALID",
      category: "SCHEMA_FAILURE",
      candidateCount: 1,
      validationErrors: [
        "SCHEMA_FAILURE",
        ...structure.error.issues.slice(0, 8).map((issue) => issue.message),
      ],
    };
  }
  const decision = createAgentDecisionSchema(expected).safeParse(structure.data);
  return decision.success
    ? { outcome: "VALID", decision: decision.data }
    : {
        outcome: "INVALID",
        category: "VALIDATION_FAILURE",
        candidateCount: 1,
        validationErrors: [
          "VALIDATION_FAILURE",
          ...decision.error.issues.slice(0, 8).map((issue) => issue.message),
        ],
      };
}

function invokeWithTimeout(
  adapter: AgentAdapter,
  request: Omit<AgentInvocationRequest, "signal">,
  timeoutMs: number,
  callerSignal: AbortSignal,
): Promise<InvocationOutcome> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();

    const cleanup = () => {
      clearTimeout(timeout);
      callerSignal.removeEventListener("abort", onCallerAbort);
    };
    const finish = (outcome: InvocationOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };
    const onCallerAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      reject(new CheckpointExecutionAbortedError());
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      controller.abort();
      finish({ status: "FAILED", reason: "TIMEOUT" });
    }, timeoutMs);

    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    if (callerSignal.aborted) {
      onCallerAbort();
      return;
    }

    Promise.resolve()
      .then(() => adapter.invoke({ ...request, signal: controller.signal }))
      .then(
        (output) => {
          finish(
            output === undefined || output === null
              ? { status: "FAILED", reason: "MISSING_OUTPUT" }
              : { status: "RECEIVED", output },
          );
        },
        (error) =>
          finish(
            error instanceof AgentOutputError
              ? {
                  status: "OUTPUT_FAILED",
                  category: error.category,
                  candidateCount: error.candidateCount,
                }
              : { status: "FAILED", reason: "PROCESS_FAILURE" },
          ),
      );
  });
}

function createEvent(input: {
  readonly arenaId: string;
  readonly sequence: number;
  readonly type: string;
  readonly occurredAtUtc: string;
  readonly checkpointId: CanonicalSnapshot["checkpointId"];
  readonly agentId?: ArenaAgentId;
  readonly publicPayload: unknown;
}): PersistedArenaEventV1 {
  return persistedArenaEventV1Schema.parse({
    eventId: `${input.arenaId}:${input.sequence}`,
    arenaId: input.arenaId,
    sequence: input.sequence,
    type: input.type,
    occurredAtUtc: input.occurredAtUtc,
    checkpointId: input.checkpointId,
    ...(input.agentId === undefined ? {} : { agentId: input.agentId }),
    publicPayload: input.publicPayload,
  });
}

export function createCheckpointOpeningEvents(
  snapshot: CanonicalSnapshot,
  initialEventSequence: number,
): readonly [PersistedArenaEventV1, PersistedArenaEventV1] {
  return [
    createEvent({
      arenaId: snapshot.arenaId,
      sequence: initialEventSequence + 1,
      type: "CHECKPOINT_OPENED",
      occurredAtUtc: snapshot.observedAtUtc,
      checkpointId: snapshot.checkpointId,
      publicPayload: { snapshotId: snapshot.snapshotId },
    }),
    createEvent({
      arenaId: snapshot.arenaId,
      sequence: initialEventSequence + 2,
      type: "AGENTS_ANALYZING",
      occurredAtUtc: snapshot.observedAtUtc,
      checkpointId: snapshot.checkpointId,
      publicPayload: {},
    }),
  ];
}

export async function executePreparedCheckpoint(input: {
  readonly snapshot: CanonicalSnapshot;
  readonly portfolios: CheckpointExecutionPortfolios;
  readonly agents: Readonly<Record<ArenaAgentId, AgentAdapter>>;
  readonly timeoutMs: number;
  readonly startingBankrollMicros: MoneyMicros;
  readonly initialEventSequence: number;
  readonly signal: AbortSignal;
}): Promise<PreparedCheckpointExecutionResult> {
  const { snapshot } = input;
  const validateDecisionOutput = (
    agentId: ArenaAgentId,
    output: unknown,
  ): DecisionValidation =>
    classifyAgentDecisionOutput(output, {
      arenaId: snapshot.arenaId,
      snapshotId: snapshot.snapshotId,
      checkpointId: snapshot.checkpointId,
      agentId,
    });
  const invocationRequest = (
    agentId: ArenaAgentId,
  ): Omit<AgentInvocationRequest, "signal"> => ({
    snapshot: structuredClone(snapshot),
    portfolio: structuredClone(input.portfolios[agentId]),
    attempt: 0,
    validationErrors: [],
  });
  const [alphaInvocation, betaInvocation] = await Promise.all([
    invokeWithTimeout(
      input.agents.alpha,
      invocationRequest("alpha"),
      input.timeoutMs,
      input.signal,
    ),
    invokeWithTimeout(
      input.agents.beta,
      invocationRequest("beta"),
      input.timeoutMs,
      input.signal,
    ),
  ]);

  function validateInitial(
    agentId: ArenaAgentId,
    invocation: InvocationOutcome,
  ): InitialResolution {
    if (invocation.status === "FAILED") return { invocation };
    if (invocation.status === "OUTPUT_FAILED") {
      return {
        invocation,
        validationErrors: [
          invocation.category,
          `candidateCount=${invocation.candidateCount}`,
        ],
      };
    }
    const validation = validateDecisionOutput(agentId, invocation.output);
    return validation.outcome === "VALID"
      ? { invocation, decision: validation.decision }
      : { invocation, validationErrors: validation.validationErrors };
  }

  const initial = {
    alpha: validateInitial("alpha", alphaInvocation),
    beta: validateInitial("beta", betaInvocation),
  };
  const repair = async (agentId: ArenaAgentId) => {
    const validationErrors = initial[agentId].validationErrors;
    if (validationErrors === undefined) return undefined;
    return invokeWithTimeout(
      input.agents[agentId],
      {
        snapshot: structuredClone(snapshot),
        portfolio: structuredClone(input.portfolios[agentId]),
        attempt: 1,
        validationErrors,
      },
      input.timeoutMs,
      input.signal,
    );
  };
  const [alphaRepair, betaRepair] = await Promise.all([
    repair("alpha"),
    repair("beta"),
  ]);
  const repairs = { alpha: alphaRepair, beta: betaRepair };

  function finalize(agentId: ArenaAgentId): FinalResolution {
    const first = initial[agentId];
    if (first.invocation.status === "FAILED") {
      return {
        failure: {
          scope: "AGENT",
          agentId,
          reason: first.invocation.reason,
        },
      };
    }
    if (first.decision !== undefined) return { decision: first.decision };

    const repaired = repairs[agentId];
    if (repaired === undefined || repaired.status === "FAILED") {
      return {
        failure: {
          scope: "AGENT",
          agentId,
          reason: repaired?.reason ?? "PROCESS_FAILURE",
        },
      };
    }
    if (repaired.status === "OUTPUT_FAILED") {
      return {
        failure: {
          scope: "AGENT",
          agentId,
          reason: "INVALID_OUTPUT",
        },
      };
    }
    const validation = validateDecisionOutput(agentId, repaired.output);
    return validation.outcome === "VALID"
      ? { decision: validation.decision }
      : {
          failure: {
            scope: "AGENT",
            agentId,
            reason: "INVALID_OUTPUT",
          },
        };
  }

  const final = { alpha: finalize("alpha"), beta: finalize("beta") };
  const events: PersistedArenaEventV1[] = [];
  let sequence = input.initialEventSequence;
  const emit = (
    type: string,
    publicPayload: unknown,
    agentId?: ArenaAgentId,
  ) => {
    sequence += 1;
    events.push(
      createEvent({
        arenaId: snapshot.arenaId,
        sequence,
        type,
        occurredAtUtc: snapshot.observedAtUtc,
        checkpointId: snapshot.checkpointId,
        ...(agentId === undefined ? {} : { agentId }),
        publicPayload,
      }),
    );
  };

  for (const agentId of ["alpha", "beta"] as const) {
    const first = initial[agentId];
    if (first.invocation.status === "FAILED") {
      emit("MISSED_DECISION_ROUND", { reason: first.invocation.reason }, agentId);
    } else {
      emit("DECISION_RECEIVED", { status: "RECEIVED" }, agentId);
      if (first.validationErrors !== undefined) {
        emit("RECHECKING_DECISION", { attempt: 1 }, agentId);
      }
    }
  }
  for (const agentId of ["alpha", "beta"] as const) {
    if (initial[agentId].validationErrors === undefined) continue;
    const repaired = repairs[agentId];
    if (repaired?.status === "RECEIVED") {
      emit("DECISION_RECEIVED", { status: "RECEIVED" }, agentId);
      if (final[agentId].decision === undefined) {
        emit("MISSED_DECISION_ROUND", { reason: "INVALID_OUTPUT" }, agentId);
      }
    } else if (repaired?.status === "OUTPUT_FAILED") {
      emit("MISSED_DECISION_ROUND", { reason: "INVALID_OUTPUT" }, agentId);
    } else {
      emit(
        "MISSED_DECISION_ROUND",
        { reason: repaired?.reason ?? "PROCESS_FAILURE" },
        agentId,
      );
    }
  }

  const revealedDecisions: Partial<Record<ArenaAgentId, AgentDecision>> = {
    ...(final.alpha.decision === undefined ? {} : { alpha: final.alpha.decision }),
    ...(final.beta.decision === undefined ? {} : { beta: final.beta.decision }),
  };
  const failures = [final.alpha.failure, final.beta.failure].filter(
    (failure): failure is CheckpointFailureV1 => failure !== undefined,
  );
  const portfoliosAfter = {
    alpha:
      final.alpha.decision === undefined
        ? markToMarket(
            input.portfolios.alpha,
            snapshot.priceMicros,
            snapshot.checkpointId,
            input.startingBankrollMicros,
          )
        : applyDecision(
            input.portfolios.alpha,
            final.alpha.decision,
            snapshot.priceMicros,
            input.startingBankrollMicros,
          ),
    beta:
      final.beta.decision === undefined
        ? markToMarket(
            input.portfolios.beta,
            snapshot.priceMicros,
            snapshot.checkpointId,
            input.startingBankrollMicros,
          )
        : applyDecision(
            input.portfolios.beta,
            final.beta.decision,
            snapshot.priceMicros,
            input.startingBankrollMicros,
          ),
  };

  emit("ROUND_REVEALED", { decisions: revealedDecisions });
  emit("ROUND_COMPLETE", {});
  return {
    outcome: "REVEALED",
    revealedDecisions,
    failures,
    portfoliosAfter,
    events,
  };
}
