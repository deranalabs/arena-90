/** @jest-environment node */

import {
  listRecordedReplayArtifacts,
  serveRecordedReplayRequest,
} from "@/lib/arena-api/recorded-replay-artifacts";

const franceSpain = "world-cup-2026-france-spain-semifinal-replay";

describe("recorded Replay artifacts", () => {
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

  it("publishes two clean competitions with distinct strategy exposure", () => {
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
    ]);
  });
});
