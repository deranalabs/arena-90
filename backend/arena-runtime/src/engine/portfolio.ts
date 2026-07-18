import type {
  AgentDecision,
  ArenaAgentId,
  ArenaAssetId,
  CanonicalSnapshot,
  CheckpointId,
  MoneyMicros,
  PortfolioState,
} from "../contracts/index.js";
import {
  BASIS_POINTS_SCALE,
  UNIT_MICROS_SCALE,
  multiplyDivideTruncating,
  parseBase10Integer,
  toBase10Integer,
} from "../fixed-point.js";

function calculateAssetValueMicros(unitMicros: bigint, priceMicros: number): bigint {
  return multiplyDivideTruncating(
    unitMicros,
    BigInt(priceMicros),
    UNIT_MICROS_SCALE,
  );
}

function calculateTargetUnitMicros(
  navMicros: bigint,
  allocationBps: number,
  priceMicros: number,
): bigint {
  const targetValueMicros = multiplyDivideTruncating(
    navMicros,
    BigInt(allocationBps),
    BASIS_POINTS_SCALE,
  );

  return multiplyDivideTruncating(
    targetValueMicros,
    UNIT_MICROS_SCALE,
    BigInt(priceMicros),
  );
}

function calculateReturnBps(navMicros: bigint, startingBankrollMicros: MoneyMicros): number {
  const startingBankroll = parseBase10Integer(startingBankrollMicros);
  const returnBps = multiplyDivideTruncating(
    navMicros - startingBankroll,
    BASIS_POINTS_SCALE,
    startingBankroll,
  );
  const serializedReturnBps = Number(returnBps);

  if (!Number.isSafeInteger(serializedReturnBps)) {
    throw new RangeError("Return basis points exceed the safe integer range");
  }

  return serializedReturnBps;
}

export function initializePortfolio(
  agentId: ArenaAgentId,
  startingBankrollMicros: MoneyMicros,
): PortfolioState {
  const bankroll = toBase10Integer(parseBase10Integer(startingBankrollMicros));

  return {
    agentId,
    cashMicros: bankroll,
    unitMicros: {
      HOME: "0",
      DRAW: "0",
      AWAY: "0",
    },
    navMicros: bankroll,
    returnBps: 0,
    updatedAtCheckpoint: "KICKOFF",
  };
}

export function markToMarket(
  portfolio: PortfolioState,
  priceMicros: CanonicalSnapshot["priceMicros"],
  checkpointId: CheckpointId,
  startingBankrollMicros: MoneyMicros,
): PortfolioState {
  const cashMicros = parseBase10Integer(portfolio.cashMicros);
  const homeValueMicros = calculateAssetValueMicros(
    parseBase10Integer(portfolio.unitMicros.HOME),
    priceMicros.HOME,
  );
  const drawValueMicros = calculateAssetValueMicros(
    parseBase10Integer(portfolio.unitMicros.DRAW),
    priceMicros.DRAW,
  );
  const awayValueMicros = calculateAssetValueMicros(
    parseBase10Integer(portfolio.unitMicros.AWAY),
    priceMicros.AWAY,
  );
  const navMicros = cashMicros + homeValueMicros + drawValueMicros + awayValueMicros;

  return {
    ...portfolio,
    navMicros: toBase10Integer(navMicros),
    returnBps: calculateReturnBps(navMicros, startingBankrollMicros),
    updatedAtCheckpoint: checkpointId,
  };
}

export function applyDecision(
  portfolio: PortfolioState,
  decision: AgentDecision,
  priceMicros: CanonicalSnapshot["priceMicros"],
  startingBankrollMicros: MoneyMicros,
): PortfolioState {
  if (decision.agentId !== portfolio.agentId) {
    throw new RangeError("Decision agentId must match portfolio agentId");
  }

  if (decision.action === "NO_TRADE") {
    return markToMarket(
      portfolio,
      priceMicros,
      decision.checkpointId,
      startingBankrollMicros,
    );
  }

  const markedPortfolio = markToMarket(
    portfolio,
    priceMicros,
    decision.checkpointId,
    startingBankrollMicros,
  );
  const navMicros = parseBase10Integer(markedPortfolio.navMicros);
  const homeUnitMicros = calculateTargetUnitMicros(
    navMicros,
    decision.targetAllocationBps.HOME,
    priceMicros.HOME,
  );
  const drawUnitMicros = calculateTargetUnitMicros(
    navMicros,
    decision.targetAllocationBps.DRAW,
    priceMicros.DRAW,
  );
  const awayUnitMicros = calculateTargetUnitMicros(
    navMicros,
    decision.targetAllocationBps.AWAY,
    priceMicros.AWAY,
  );
  const markedHomeValueMicros = calculateAssetValueMicros(
    homeUnitMicros,
    priceMicros.HOME,
  );
  const markedDrawValueMicros = calculateAssetValueMicros(
    drawUnitMicros,
    priceMicros.DRAW,
  );
  const markedAwayValueMicros = calculateAssetValueMicros(
    awayUnitMicros,
    priceMicros.AWAY,
  );
  const cashMicros =
    navMicros - markedHomeValueMicros - markedDrawValueMicros - markedAwayValueMicros;

  return markToMarket(
    {
      ...markedPortfolio,
      cashMicros: toBase10Integer(cashMicros),
      unitMicros: {
        HOME: toBase10Integer(homeUnitMicros),
        DRAW: toBase10Integer(drawUnitMicros),
        AWAY: toBase10Integer(awayUnitMicros),
      },
    },
    priceMicros,
    decision.checkpointId,
    startingBankrollMicros,
  );
}

export function settlePortfolio(
  portfolio: PortfolioState,
  winningAssetId: ArenaAssetId,
  startingBankrollMicros: MoneyMicros,
): PortfolioState {
  const cashMicros = parseBase10Integer(portfolio.cashMicros);
  const winningAssetUnitMicros = parseBase10Integer(portfolio.unitMicros[winningAssetId]);
  const finalNavMicros = cashMicros + winningAssetUnitMicros;

  return {
    ...portfolio,
    navMicros: toBase10Integer(finalNavMicros),
    returnBps: calculateReturnBps(finalNavMicros, startingBankrollMicros),
    updatedAtCheckpoint: "FINAL",
  };
}

export function determineWinner(
  alpha: PortfolioState,
  beta: PortfolioState,
): ArenaAgentId | "DRAW" {
  const alphaNavMicros = parseBase10Integer(alpha.navMicros);
  const betaNavMicros = parseBase10Integer(beta.navMicros);

  if (alphaNavMicros > betaNavMicros) {
    return alpha.agentId;
  }

  if (betaNavMicros > alphaNavMicros) {
    return beta.agentId;
  }

  return "DRAW";
}
