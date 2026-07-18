import { resolveFeaturedArena } from "@/lib/featured-arena";

describe("featured arena catalog seam", () => {
  it("keeps the verified live World Cup arena as the default", () => {
    expect(resolveFeaturedArena(undefined)).toMatchObject({
      preset: "WORLD_CUP_THIRD_PLACE",
      mode: "LIVE",
      arenaId: "world-cup-2026-france-england-third-place-v4",
      watchHref: "/arena/world-cup-2026-france-england-third-place-v4",
      navigationLabel: "Live Arena",
    });
  });

  it("switches every public link to the verified World Cup third-place arena", () => {
    expect(resolveFeaturedArena("WORLD_CUP_THIRD_PLACE")).toEqual({
      preset: "WORLD_CUP_THIRD_PLACE",
      arenaId: "world-cup-2026-france-england-third-place-v4",
      mode: "LIVE",
      competition: "World Cup 2026 · Third place",
      homeTeam: "France",
      awayTeam: "England",
      kickoffUtc: "2026-07-18T21:00:00.000Z",
      sourceLabel: "TxLINE + TxODDS live",
      arenaHref:
        "/arena/world-cup-2026-france-england-third-place-v4",
      watchHref:
        "/arena/world-cup-2026-france-england-third-place-v4",
      proofHref:
        "/arena/world-cup-2026-france-england-third-place-v4/proof",
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
