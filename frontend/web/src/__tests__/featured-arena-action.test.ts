import { resolveFeaturedArenaAction } from "@/components/site/FeaturedArenaAction";

const liveArena = {
  arenaHref: "/arena/final",
  arenaId: "final",
  backingDeadlineUtc: "2026-07-19T19:00:00.000Z",
  mode: "LIVE" as const,
  watchHref: "/arena/final",
};

describe("featured arena lifecycle action", () => {
  it("only offers backing while a mapped live arena is ready before kickoff", () => {
    expect(
      resolveFeaturedArenaAction(liveArena, "READY", Date.parse("2026-07-19T18:59:00Z")),
    ).toEqual({ href: "/arena/final#support-arena", label: "Back an Agent" });
    expect(
      resolveFeaturedArenaAction(liveArena, "READY", Date.parse("2026-07-19T19:00:00Z")),
    ).toEqual({ href: "/arena/final", label: "View Arena" });
  });

  it("maps runtime phases to honest public actions", () => {
    expect(resolveFeaturedArenaAction(liveArena, "RUNNING")).toEqual({
      href: "/arena/final",
      label: "Watch Live",
    });
    expect(resolveFeaturedArenaAction(liveArena, "FINALIZING")).toEqual({
      href: "/arena/final",
      label: "Track Settlement",
    });
    expect(resolveFeaturedArenaAction(liveArena, "COMPLETED")).toEqual({
      href: "/arena/final",
      label: "Watch Replay",
    });
  });

  it("keeps replay actions independent of runtime availability", () => {
    expect(
      resolveFeaturedArenaAction(
        { ...liveArena, mode: "REPLAY", watchHref: "/arena/final/replay" },
        undefined,
      ),
    ).toEqual({ href: "/arena/final/replay", label: "Watch Replay" });
  });
});
