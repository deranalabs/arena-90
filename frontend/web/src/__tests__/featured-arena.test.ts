import { resolveFeaturedArena } from "@/lib/featured-arena";

describe("featured arena catalog seam", () => {
  it("keeps Replay as the fail-safe default", () => {
    expect(resolveFeaturedArena(undefined)).toMatchObject({
      preset: "FOUNDATION_REPLAY",
      mode: "REPLAY",
      arenaId: "arena-replay-001",
      watchHref: "/arena/arena-replay-001/replay",
      navigationLabel: "Replay Arena",
    });
  });

  it("switches every public link to the verified World Cup third-place arena", () => {
    expect(resolveFeaturedArena("WORLD_CUP_THIRD_PLACE")).toEqual({
      preset: "WORLD_CUP_THIRD_PLACE",
      arenaId: "world-cup-2026-france-england-third-place",
      mode: "LIVE",
      competition: "World Cup 2026 · Third place",
      homeTeam: "France",
      awayTeam: "England",
      kickoffUtc: "2026-07-18T21:00:00.000Z",
      sourceLabel: "TxLINE + TxODDS live",
      arenaHref: "/arena/world-cup-2026-france-england-third-place",
      watchHref: "/arena/world-cup-2026-france-england-third-place",
      proofHref: "/arena/world-cup-2026-france-england-third-place/proof",
      navigationLabel: "Live Arena",
      watchLabel: "Watch Live Arena",
    });
  });

  it("fails build configuration closed instead of inventing an arena", () => {
    expect(() => resolveFeaturedArena("WORLD_CUP_SEMIFINAL")).toThrow(
      "not an approved preset",
    );
  });
});
