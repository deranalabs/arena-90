import type {
  ArenaAgentId,
  ArenaAssetId,
  CanonicalSnapshot,
  StrategyEvidenceV1,
} from "../contracts/index.js";

const ASSET_IDS = ["HOME", "DRAW", "AWAY"] as const;
const ALPHA_PRIMARY_MOVE_MICROS = 150_000;
const ALPHA_POST_GOAL_MOVE_MICROS = 300_000;
const BETA_PRIMARY_MOVE_MICROS = 80_000;
const BETA_SCORE_STATE_PRICE_CEILING_MICROS = 650_000;
const MAX_SIGNAL_INTERVAL_MINUTES = 15;

export interface StrategyPolicySignal {
  readonly policyVersion: 4;
  readonly agentId: ArenaAgentId;
  readonly active: boolean;
  readonly signalId:
    | "ALPHA_PRIMARY_OVERREACTION"
    | "ALPHA_POST_GOAL_OVERREACTION"
    | "BETA_PRIMARY_UNDERREACTION"
    | "BETA_SCORE_STATE_UNDERREACTION"
    | "NONE";
  readonly requiredAction: "TARGET_ALLOCATION" | "NO_TRADE";
  readonly focusAsset: ArenaAssetId | null;
  readonly direction: "TOWARD" | "AWAY_FROM" | null;
  readonly publicBasis: string;
}

function inactive(agentId: ArenaAgentId): StrategyPolicySignal {
  return Object.freeze({
    policyVersion: 4,
    agentId,
    active: false,
    signalId: "NONE",
    requiredAction: "NO_TRADE",
    focusAsset: null,
    direction: null,
    publicBasis: "No approved strategy signal is active at this checkpoint.",
  });
}

function scoringAsset(
  evidence: StrategyEvidenceV1,
): Extract<ArenaAssetId, "HOME" | "AWAY"> | null {
  const delta = evidence.matchDeltaFromPrevious;
  if (delta?.homeScoreDelta === 1 && delta.awayScoreDelta === 0) return "HOME";
  if (delta?.homeScoreDelta === 0 && delta.awayScoreDelta === 1) return "AWAY";
  return null;
}

function withinSignalWindow(evidence: StrategyEvidenceV1): boolean {
  const minutes = evidence.matchDeltaFromPrevious?.minutesElapsed;
  return minutes !== undefined && minutes > 0 && minutes <= MAX_SIGNAL_INTERVAL_MINUTES;
}

function largestAbsoluteMove(evidence: StrategyEvidenceV1) {
  const deltas = evidence.priceDeltaFromPreviousMicros;
  if (deltas === null) return null;
  return ASSET_IDS.map((assetId) => ({ assetId, deltaMicros: deltas[assetId] })).sort(
    (left, right) => Math.abs(right.deltaMicros) - Math.abs(left.deltaMicros),
  )[0] ?? null;
}

export function evaluateStrategyPolicy(
  agentId: ArenaAgentId,
  snapshot: CanonicalSnapshot,
  evidence: StrategyEvidenceV1,
): StrategyPolicySignal {
  if (
    evidence.arenaId !== snapshot.arenaId ||
    evidence.currentSnapshotId !== snapshot.snapshotId ||
    !withinSignalWindow(evidence)
  ) {
    return inactive(agentId);
  }

  const matchDelta = evidence.matchDeltaFromPrevious;
  const priceDelta = evidence.priceDeltaFromPreviousMicros;
  if (matchDelta === null || priceDelta === null) return inactive(agentId);

  const goalCount = matchDelta.homeScoreDelta + matchDelta.awayScoreDelta;
  if (agentId === "alpha") {
    if (goalCount === 0) {
      const largestMove = largestAbsoluteMove(evidence);
      if (
        largestMove !== null &&
        Math.abs(largestMove.deltaMicros) >= ALPHA_PRIMARY_MOVE_MICROS
      ) {
        return Object.freeze({
          policyVersion: 4,
          agentId,
          active: true,
          signalId: "ALPHA_PRIMARY_OVERREACTION",
          requiredAction: "TARGET_ALLOCATION",
          focusAsset: largestMove.assetId,
          direction: largestMove.deltaMicros > 0 ? "AWAY_FROM" : "TOWARD",
          publicBasis: `No goal occurred while ${largestMove.assetId} moved ${largestMove.deltaMicros} micros within ${matchDelta.minutesElapsed} minutes.`,
        });
      }
    }

    const scorer = scoringAsset(evidence);
    if (
      scorer !== null &&
      priceDelta[scorer] >= ALPHA_POST_GOAL_MOVE_MICROS
    ) {
      return Object.freeze({
        policyVersion: 4,
        agentId,
        active: true,
        signalId: "ALPHA_POST_GOAL_OVERREACTION",
        requiredAction: "TARGET_ALLOCATION",
        focusAsset: scorer,
        direction: "AWAY_FROM",
        publicBasis: `${scorer} scored once and its price rose ${priceDelta[scorer]} micros within ${matchDelta.minutesElapsed} minutes.`,
      });
    }
    return inactive(agentId);
  }

  const scorer = scoringAsset(evidence);
  if (scorer === null || priceDelta[scorer] < 0) return inactive(agentId);

  if (priceDelta[scorer] < BETA_PRIMARY_MOVE_MICROS) {
    return Object.freeze({
      policyVersion: 4,
      agentId,
      active: true,
      signalId: "BETA_PRIMARY_UNDERREACTION",
      requiredAction: "TARGET_ALLOCATION",
      focusAsset: scorer,
      direction: "TOWARD",
      publicBasis: `${scorer} scored once but its price rose only ${priceDelta[scorer]} micros within ${matchDelta.minutesElapsed} minutes.`,
    });
  }

  if (snapshot.priceMicros[scorer] <= BETA_SCORE_STATE_PRICE_CEILING_MICROS) {
    return Object.freeze({
      policyVersion: 4,
      agentId,
      active: true,
      signalId: "BETA_SCORE_STATE_UNDERREACTION",
      requiredAction: "TARGET_ALLOCATION",
      focusAsset: scorer,
      direction: "TOWARD",
      publicBasis: `${scorer} scored once but remains priced at ${snapshot.priceMicros[scorer]} micros.`,
    });
  }

  return inactive(agentId);
}
