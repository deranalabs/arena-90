import {
  strategyEvidenceV1Schema,
  type CanonicalSnapshot,
  type StrategyEvidenceV1,
} from "../contracts/index.js";

type PriceRecord = CanonicalSnapshot["priceMicros"];

function subtractPrices(current: PriceRecord, prior: PriceRecord) {
  return {
    HOME: current.HOME - prior.HOME,
    DRAW: current.DRAW - prior.DRAW,
    AWAY: current.AWAY - prior.AWAY,
  };
}

function assertAcceptedHistory(
  current: CanonicalSnapshot,
  history: readonly CanonicalSnapshot[],
): void {
  const seenSnapshotIds = new Set<string>();
  let previousSequence = 0;

  for (const snapshot of history) {
    if (
      snapshot.arenaId !== current.arenaId ||
      snapshot.fixtureId !== current.fixtureId ||
      snapshot.source !== current.source ||
      snapshot.providerSequence >= current.providerSequence ||
      snapshot.providerSequence <= previousSequence ||
      snapshot.snapshotId === current.snapshotId ||
      seenSnapshotIds.has(snapshot.snapshotId)
    ) {
      throw new Error("Strategy evidence history is not an accepted snapshot prefix");
    }
    seenSnapshotIds.add(snapshot.snapshotId);
    previousSequence = snapshot.providerSequence;
  }
}

export function deriveStrategyEvidence(
  current: CanonicalSnapshot,
  acceptedHistory: readonly CanonicalSnapshot[],
): StrategyEvidenceV1 {
  assertAcceptedHistory(current, acceptedHistory);

  const kickoff =
    current.checkpointId === "KICKOFF"
      ? current
      : acceptedHistory.find((snapshot) => snapshot.checkpointId === "KICKOFF") ??
        null;
  const previous = acceptedHistory.at(-1) ?? null;

  return strategyEvidenceV1Schema.parse({
    schemaVersion: 1,
    arenaId: current.arenaId,
    currentSnapshotId: current.snapshotId,
    anchorSnapshotId: kickoff?.snapshotId ?? null,
    previousSnapshotId: previous?.snapshotId ?? null,
    anchorPriceMicros: kickoff?.priceMicros ?? null,
    previousPriceMicros: previous?.priceMicros ?? null,
    priceDeltaFromAnchorMicros:
      kickoff === null ? null : subtractPrices(current.priceMicros, kickoff.priceMicros),
    priceDeltaFromPreviousMicros:
      previous === null
        ? null
        : subtractPrices(current.priceMicros, previous.priceMicros),
    matchDeltaFromPrevious:
      previous === null
        ? null
        : {
            minutesElapsed: current.match.minute - previous.match.minute,
            homeScoreDelta: current.match.homeScore - previous.match.homeScore,
            awayScoreDelta: current.match.awayScore - previous.match.awayScore,
          },
  });
}
