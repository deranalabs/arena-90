export type FeaturedArenaPreset =
  | "FOUNDATION_REPLAY"
  | "WORLD_CUP_THIRD_PLACE"
  | "WORLD_CUP_FINAL";

export type FeaturedArena = Readonly<{
  preset: FeaturedArenaPreset;
  arenaId: string;
  mode: "LIVE" | "REPLAY";
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  sourceLabel: string;
  arenaHref: string;
  watchHref: string;
  proofHref: string;
  navigationLabel: "Live Arena" | "Replay Arena";
  watchLabel: "Watch Live Arena" | "Watch Replay";
}>;

const presets = {
  FOUNDATION_REPLAY: {
    arenaId: "arena-replay-001",
    mode: "REPLAY",
    competition: "Foundation Replay",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    kickoffUtc: "2026-07-13T12:00:00.000Z",
    sourceLabel: "TxLINE recorded",
  },
  WORLD_CUP_THIRD_PLACE: {
    arenaId: "world-cup-2026-france-england-third-place-v4",
    mode: "LIVE",
    competition: "World Cup 2026 · Third place",
    homeTeam: "France",
    awayTeam: "England",
    kickoffUtc: "2026-07-18T21:00:00.000Z",
    sourceLabel: "TxLINE + TxODDS live",
  },
  WORLD_CUP_FINAL: {
    arenaId: "world-cup-2026-spain-argentina-final",
    mode: "LIVE",
    competition: "World Cup 2026 · Final",
    homeTeam: "Spain",
    awayTeam: "Argentina",
    kickoffUtc: "2026-07-19T19:00:00.000Z",
    sourceLabel: "TxLINE + TxODDS live",
  },
} as const;

export function resolveFeaturedArena(
  configuredPreset: string | undefined = process.env.ARENA90_FEATURED_ARENA,
): FeaturedArena {
  const preset = configuredPreset ?? "FOUNDATION_REPLAY";
  if (!(preset in presets)) {
    throw new Error("ARENA90_FEATURED_ARENA is not an approved preset");
  }
  const identity = presets[preset as FeaturedArenaPreset];
  const arenaHref = `/arena/${identity.arenaId}`;
  const live = identity.mode === "LIVE";

  return Object.freeze({
    preset: preset as FeaturedArenaPreset,
    ...identity,
    arenaHref,
    watchHref: live ? arenaHref : `${arenaHref}/replay`,
    proofHref: `${arenaHref}/proof`,
    navigationLabel: live ? "Live Arena" : "Replay Arena",
    watchLabel: live ? "Watch Live Arena" : "Watch Replay",
  });
}

export const FEATURED_ARENA = resolveFeaturedArena();
