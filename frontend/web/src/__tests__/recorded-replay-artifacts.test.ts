/** @jest-environment node */

import {
  listRecordedReplayArtifacts,
  parseRecordedReplayArtifact,
  serveRecordedReplayRequest,
} from "@/lib/arena-api/recorded-replay-artifacts";
import recoveryReplayInput from "@/data/replays/world-cup-2026-france-england-third-place-recovery-replay-01.json";
import franceSpainInput from "@/data/replays/world-cup-2026-france-spain-semifinal-replay.json";

const franceSpain = "world-cup-2026-france-spain-semifinal-replay";

describe("recorded Replay artifacts", () => {
  it("parses the completed third-place Recovery Replay artifact", () => {
    const artifact = parseRecordedReplayArtifact(recoveryReplayInput);

    expect(artifact).toMatchObject({
      semanticHash:
        "37c0133130b92ab3f9cec1a534ff7492bcf69ab77d8d3ea8d4603e80c96b7832",
      state: {
        phase: "COMPLETED",
        manifest: {
          arenaId:
            "world-cup-2026-france-england-third-place-recovery-replay-01",
          mode: "REPLAY",
          replayDisclosure:
            "RECOVERY REPLAY — recorded data, not live execution",
        },
      },
      history: { lastEventSequence: 39 },
    });
    expect(artifact.state.checkpoints).toHaveLength(6);
    expect(
      artifact.state.checkpoints.every(
        ({ failures, revealedDecisions }) =>
          failures.length === 0 &&
          revealedDecisions.alpha !== undefined &&
          revealedDecisions.beta !== undefined,
      ),
    ).toBe(true);
  });

  it("accepts six clean NO_TRADE decisions as valid Alpha participation", () => {
    const input = structuredClone(franceSpainInput);
    input.semanticHash = "b".repeat(64);
    for (const checkpoint of input.state.checkpoints) {
      const decision = checkpoint.revealedDecisions.alpha;
      if (decision === undefined) throw new Error("Missing Alpha decision");
      checkpoint.revealedDecisions.alpha = {
        schemaVersion: decision.schemaVersion,
        arenaId: decision.arenaId,
        snapshotId: decision.snapshotId,
        checkpointId: decision.checkpointId,
        agentId: decision.agentId,
        action: "NO_TRADE",
        publicExplanation: "Keep the accepted portfolio unchanged.",
      };
    }

    expect(parseRecordedReplayArtifact(input)).toMatchObject({
      semanticHash: "b".repeat(64),
      state: {
        phase: "COMPLETED",
        checkpoints: expect.arrayContaining([
          expect.objectContaining({
            revealedDecisions: {
              alpha: expect.objectContaining({ action: "NO_TRADE" }),
              beta: expect.any(Object),
            },
          }),
        ]),
      },
    });
  });

  it("serves completed state and cursor-safe history through the runtime contract", async () => {
    const stateResponse = serveRecordedReplayRequest(
      new Request(`http://frontend.local/api/arenas/${franceSpain}`),
    );
    expect(stateResponse?.status).toBe(200);
    await expect(stateResponse?.json()).resolves.toMatchObject({
      phase: "COMPLETED",
      manifest: { arenaId: franceSpain, mode: "REPLAY" },
    });

    const historyResponse = serveRecordedReplayRequest(
      new Request(
        `http://frontend.local/api/arenas/${franceSpain}/events?after=38`,
      ),
    );
    await expect(historyResponse?.json()).resolves.toMatchObject({
      arenaId: franceSpain,
      afterSequence: 38,
      lastEventSequence: 39,
      events: [{ sequence: 39, type: "COMPLETED" }],
    });
  });

  it("returns terminal stream state and ignores non-recorded arenas", () => {
    expect(
      serveRecordedReplayRequest(
        new Request(
          `http://frontend.local/api/arenas/${franceSpain}/events/stream`,
          { headers: { "Last-Event-ID": "39" } },
        ),
      )?.status,
    ).toBe(204);
    expect(
      serveRecordedReplayRequest(
        new Request("http://frontend.local/api/arenas/not-recorded"),
      ),
    ).toBeUndefined();
  });

  it("exposes the Recovery Replay disclosure from the canonical artifact", () => {
    expect(
      listRecordedReplayArtifacts().find(
        ({ arenaId }) =>
          arenaId ===
          "world-cup-2026-france-england-third-place-recovery-replay-01",
      ),
    ).toMatchObject({
      disclosure: "RECOVERY REPLAY — recorded data, not live execution",
    });
  });

  it("publishes the completed semifinals and third-place Recovery Replay", () => {
    expect(
      listRecordedReplayArtifacts().map(({ arenaId, winner, eventCount, watchHref }) => ({
        arenaId,
        winner,
        eventCount,
        watchHref,
      })),
    ).toEqual([
      {
        arenaId: "world-cup-2026-france-spain-semifinal-replay",
        winner: "beta",
        eventCount: 39,
        watchHref:
          "/arena/world-cup-2026-france-spain-semifinal-replay/archive",
      },
      {
        arenaId: "world-cup-2026-england-argentina-semifinal-replay",
        winner: "alpha",
        eventCount: 39,
        watchHref:
          "/arena/world-cup-2026-england-argentina-semifinal-replay/archive",
      },
      {
        arenaId:
          "world-cup-2026-france-england-third-place-recovery-replay-01",
        winner: "alpha",
        eventCount: 39,
        watchHref:
          "/arena/world-cup-2026-france-england-third-place-recovery-replay-01/archive",
      },
    ]);
  });
});
