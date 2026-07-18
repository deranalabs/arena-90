import type {
  PublicArenaEventV1,
  PublicArenaStateV1,
  PublicCheckpointV1,
  PublicDecisionV1,
} from "@/lib/arena-api/contracts";
import { validateSpectatorView } from "@/lib/arena-api/view-invariants";
import {
  publicEvent,
  publicFinalResult,
  publicPortfolio,
  publicSnapshot,
  publicState,
} from "@/test-support/arena-api-fixtures";

const arenaId = "arena-replay-001";

function decision(agentId: "alpha" | "beta"): PublicDecisionV1 {
  return {
    schemaVersion: 1,
    arenaId,
    snapshotId: "snapshot-kickoff",
    checkpointId: "KICKOFF",
    agentId,
    action: "NO_TRADE",
    publicExplanation: `${agentId} public response`,
  };
}

function revealedCheckpoint(
  decisions: PublicCheckpointV1["revealedDecisions"] = {
    alpha: decision("alpha"),
    beta: decision("beta"),
  },
  failures: PublicCheckpointV1["failures"] = [],
): PublicCheckpointV1 {
  const portfolios = {
    alpha: publicPortfolio("alpha"),
    beta: publicPortfolio("beta"),
  };
  return {
    checkpointId: "KICKOFF",
    outcome: "REVEALED",
    snapshot: publicSnapshot(),
    revealedDecisions: decisions,
    failures,
    portfoliosBefore: portfolios,
    portfoliosAfter: portfolios,
    firstEventSequence: 2,
    lastEventSequence: 2,
  };
}

function revealEvent(checkpoint: PublicCheckpointV1): PublicArenaEventV1 {
  return publicEvent(2, "ROUND_REVEALED", {
    checkpointId: checkpoint.checkpointId,
    payload: {
      decisions: checkpoint.revealedDecisions,
      failures: checkpoint.failures,
      portfoliosBefore: checkpoint.portfoliosBefore,
      portfoliosAfter: checkpoint.portfoliosAfter,
    },
  }) as PublicArenaEventV1;
}

function runningState(checkpoint: PublicCheckpointV1): PublicArenaStateV1 {
  return publicState({
    phase: "RUNNING",
    checkpoints: [checkpoint],
    nextCheckpointId: "M15",
    lastEventSequence: 2,
  }) as PublicArenaStateV1;
}

function readyEvent(): PublicArenaEventV1 {
  return publicEvent(1) as PublicArenaEventV1;
}

function completedState(overrides: Record<string, unknown> = {}) {
  const alpha = {
    ...publicPortfolio("alpha"),
    cashMicros: "12500000",
    unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
    navMicros: "112500000",
    returnBps: 1_250,
    updatedAtCheckpoint: "FINAL" as const,
  };
  const beta = {
    ...publicPortfolio("beta"),
    cashMicros: "8000000",
    unitMicros: { HOME: "100000000", DRAW: "0", AWAY: "0" },
    navMicros: "108000000",
    returnBps: 800,
    updatedAtCheckpoint: "FINAL" as const,
  };
  return publicState({
    phase: "COMPLETED",
    nextCheckpointId: undefined,
    portfolios: { alpha, beta },
    leader: { result: "alpha", provisional: false },
    finalResult: publicFinalResult({
      alphaFinalNavMicros: alpha.navMicros,
      betaFinalNavMicros: beta.navMicros,
    }),
    ...overrides,
  }) as PublicArenaStateV1;
}

function completedEvent(state: PublicArenaStateV1): PublicArenaEventV1 {
  return publicEvent(2, "COMPLETED", {
    checkpointId: "FINAL",
    payload: {
      result: state.finalResult,
      portfolios: state.portfolios,
    },
  }) as PublicArenaEventV1;
}

describe("spectator view consistency boundary", () => {
  it("accepts a checkpoint only when its simultaneous reveal is in its event range", () => {
    const checkpoint = revealedCheckpoint();
    expect(
      validateSpectatorView(runningState(checkpoint), [
        readyEvent(),
        revealEvent(checkpoint),
      ]),
    ).toBe(true);
  });

  it("rejects a state decision without a matching ROUND_REVEALED", () => {
    const checkpoint = revealedCheckpoint();
    expect(validateSpectatorView(runningState(checkpoint), [readyEvent()])).toBe(
      false,
    );
  });

  it("rejects GLOBAL_MISSED containing a decision", () => {
    const checkpoint: PublicCheckpointV1 = {
      ...revealedCheckpoint({ alpha: decision("alpha") }, [
        { scope: "GLOBAL", reason: "DATA_UNAVAILABLE" },
      ]),
      outcome: "GLOBAL_MISSED",
    };
    const globalMissed = publicEvent(2, "GLOBAL_MISSED_DECISION_ROUND", {
      checkpointId: "KICKOFF",
      payload: { reason: "DATA_UNAVAILABLE" },
    }) as PublicArenaEventV1;

    expect(
      validateSpectatorView(runningState(checkpoint), [readyEvent(), globalMissed]),
    ).toBe(false);
  });

  it("rejects a missing decision without its matching sanitized agent failure", () => {
    const checkpoint = revealedCheckpoint({ beta: decision("beta") });
    expect(
      validateSpectatorView(runningState(checkpoint), [
        readyEvent(),
        revealEvent(checkpoint),
      ]),
    ).toBe(false);
  });

  it("rejects FINALIZING with a non-provisional leader", () => {
    const state = publicState({
      phase: "FINALIZING",
      nextCheckpointId: "FINAL",
      leader: { result: "alpha", provisional: false },
    }) as PublicArenaStateV1;
    expect(validateSpectatorView(state, [readyEvent()])).toBe(false);
  });

  it("rejects COMPLETED without a final result", () => {
    const state = completedState({ finalResult: undefined });
    expect(validateSpectatorView(state, [readyEvent()])).toBe(false);
  });

  it("rejects a COMPLETED result that disagrees with terminal state", () => {
    const valid = completedState();
    const state = completedState({
      finalResult: {
        ...valid.finalResult,
        arenaId: "forged-arena",
        betaFinalNavMicros: "999999999",
      },
    });
    expect(validateSpectatorView(state, [readyEvent()])).toBe(false);
  });

  it("rejects a COMPLETED event that disagrees with the final state", () => {
    const state = completedState({ lastEventSequence: 2 });
    const completed = publicEvent(2, "COMPLETED", {
      checkpointId: "FINAL",
      payload: {
        result: {
          ...state.finalResult,
          winningAssetId: "AWAY",
        },
        portfolios: state.portfolios,
      },
    }) as PublicArenaEventV1;

    expect(validateSpectatorView(state, [readyEvent(), completed])).toBe(false);
  });

  it("accepts a COMPLETED event that exactly agrees with terminal state", () => {
    const state = completedState({ lastEventSequence: 2 });
    const completed = completedEvent(state);

    expect(validateSpectatorView(state, [readyEvent(), completed])).toBe(true);
  });

  it("rejects forged terminal cash even when state and event agree", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      portfolios: {
        ...valid.portfolios,
        alpha: {
          ...valid.portfolios.alpha,
          cashMicros: "12500001",
        },
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects forged winning-asset units even when state and event agree", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      portfolios: {
        ...valid.portfolios,
        alpha: {
          ...valid.portfolios.alpha,
          unitMicros: {
            ...valid.portfolios.alpha.unitMicros,
            HOME: "100000001",
          },
        },
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects a forged terminal NAV across state, result, and event", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      portfolios: {
        ...valid.portfolios,
        alpha: { ...valid.portfolios.alpha, navMicros: "112500001" },
      },
      finalResult: {
        ...valid.finalResult!,
        alphaFinalNavMicros: "112500001",
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects a forged terminal return even when state and event agree", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      portfolios: {
        ...valid.portfolios,
        alpha: { ...valid.portfolios.alpha, returnBps: 1_251 },
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects equal terminal NAV with Alpha declared winner", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const beta = {
      ...valid.portfolios.alpha,
      agentId: "beta" as const,
    };
    const state = {
      ...valid,
      portfolios: { ...valid.portfolios, beta },
      finalResult: {
        ...valid.finalResult!,
        betaFinalNavMicros: beta.navMicros,
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects equal terminal NAV with Beta declared winner", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const beta = {
      ...valid.portfolios.alpha,
      agentId: "beta" as const,
    };
    const state = {
      ...valid,
      portfolios: { ...valid.portfolios, beta },
      leader: { result: "beta" as const, provisional: false },
      finalResult: {
        ...valid.finalResult!,
        winner: "beta" as const,
        betaFinalNavMicros: beta.navMicros,
      },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects unequal terminal NAV with DRAW declared", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      leader: { result: "DRAW" as const, provisional: false },
      finalResult: { ...valid.finalResult!, winner: "DRAW" as const },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects the wrong winning agent for unequal terminal NAV", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const state = {
      ...valid,
      leader: { result: "beta" as const, provisional: false },
      finalResult: { ...valid.finalResult!, winner: "beta" as const },
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it("rejects a terminal portfolio without the winning asset units", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const unitMicros: Partial<typeof valid.portfolios.alpha.unitMicros> = {
      ...valid.portfolios.alpha.unitMicros,
    };
    delete unitMicros.HOME;
    const state = {
      ...valid,
      portfolios: {
        ...valid.portfolios,
        alpha: { ...valid.portfolios.alpha, unitMicros },
      },
    } as unknown as PublicArenaStateV1;

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(false);
  });

  it.each(["0", "invalid"])(
    "rejects invalid starting bankroll %s",
    (startingBankrollMicros) => {
      const valid = completedState({ lastEventSequence: 2 });
      const state = {
        ...valid,
        manifest: { ...valid.manifest, startingBankrollMicros },
      } as PublicArenaStateV1;

      expect(
        validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
      ).toBe(false);
    },
  );

  it("uses BigInt truncation toward zero for a negative fractional return", () => {
    const valid = completedState({ lastEventSequence: 2 });
    const alpha = {
      ...valid.portfolios.alpha,
      cashMicros: "0",
      unitMicros: { HOME: "99999999", DRAW: "0", AWAY: "0" },
      navMicros: "99999999",
      returnBps: 0,
    };
    const beta = {
      ...valid.portfolios.beta,
      cashMicros: "0",
      unitMicros: { HOME: "90000000", DRAW: "0", AWAY: "0" },
      navMicros: "90000000",
      returnBps: -1_000,
    };
    const state = {
      ...valid,
      portfolios: { alpha, beta },
      finalResult: publicFinalResult({
        alphaFinalNavMicros: alpha.navMicros,
        betaFinalNavMicros: beta.navMicros,
      }),
    };

    expect(
      validateSpectatorView(state, [readyEvent(), completedEvent(state)]),
    ).toBe(true);
  });
});
