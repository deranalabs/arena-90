import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createRecordedDataAdapter } from "../src/adapters/data/index.js";
import { deriveStrategyEvidence } from "../src/services/index.js";

async function loadRecordedFixture(): Promise<unknown> {
  const contents = await readFile(
    new URL("../fixtures/recorded-checkpoints.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(contents) as unknown;
}

describe("strategy evidence", () => {
  it("anchors kickoff without inventing previous history", async () => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());
    const kickoff = adapter.getSnapshot("KICKOFF");

    expect(deriveStrategyEvidence(kickoff, [])).toEqual({
      schemaVersion: 1,
      arenaId: kickoff.arenaId,
      currentSnapshotId: kickoff.snapshotId,
      anchorSnapshotId: kickoff.snapshotId,
      previousSnapshotId: null,
      anchorPriceMicros: kickoff.priceMicros,
      previousPriceMicros: null,
      priceDeltaFromAnchorMicros: { HOME: 0, DRAW: 0, AWAY: 0 },
      priceDeltaFromPreviousMicros: null,
      matchDeltaFromPrevious: null,
    });
  });

  it("derives exact signed price and match deltas from accepted snapshots", async () => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());
    const kickoff = adapter.getSnapshot("KICKOFF");
    const m15 = adapter.getSnapshot("M15");
    const m30 = adapter.getSnapshot("M30");

    expect(deriveStrategyEvidence(m30, [kickoff, m15])).toEqual({
      schemaVersion: 1,
      arenaId: m30.arenaId,
      currentSnapshotId: m30.snapshotId,
      anchorSnapshotId: kickoff.snapshotId,
      previousSnapshotId: m15.snapshotId,
      anchorPriceMicros: kickoff.priceMicros,
      previousPriceMicros: m15.priceMicros,
      priceDeltaFromAnchorMicros: {
        HOME: m30.priceMicros.HOME - kickoff.priceMicros.HOME,
        DRAW: m30.priceMicros.DRAW - kickoff.priceMicros.DRAW,
        AWAY: m30.priceMicros.AWAY - kickoff.priceMicros.AWAY,
      },
      priceDeltaFromPreviousMicros: {
        HOME: m30.priceMicros.HOME - m15.priceMicros.HOME,
        DRAW: m30.priceMicros.DRAW - m15.priceMicros.DRAW,
        AWAY: m30.priceMicros.AWAY - m15.priceMicros.AWAY,
      },
      matchDeltaFromPrevious: {
        minutesElapsed: m30.match.minute - m15.match.minute,
        homeScoreDelta: m30.match.homeScore - m15.match.homeScore,
        awayScoreDelta: m30.match.awayScore - m15.match.awayScore,
      },
    });
  });

  it("rejects history from another arena or from the future", async () => {
    const adapter = createRecordedDataAdapter(await loadRecordedFixture());
    const kickoff = adapter.getSnapshot("KICKOFF");
    const m15 = adapter.getSnapshot("M15");

    expect(() =>
      deriveStrategyEvidence(kickoff, [m15]),
    ).toThrow("not an accepted snapshot prefix");
    expect(() =>
      deriveStrategyEvidence(m15, [{ ...kickoff, arenaId: "other-arena" }]),
    ).toThrow("not an accepted snapshot prefix");
  });
});
