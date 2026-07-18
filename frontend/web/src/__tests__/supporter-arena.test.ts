import { resolveSupporterArena } from "@/lib/solana-actions/supporter-arena";

describe("supporter arena catalog", () => {
  it("binds only the prepared canonical Live arena to its devnet account", () => {
    expect(
      resolveSupporterArena("world-cup-2026-france-england-third-place-v4"),
    ).toEqual({
      arenaAddress: "7LHP2afdUPTJErHEy9QNRTusVA7TUyy47agyHsUfFz6y",
      backingDeadlineUtc: "2026-07-18T21:00:00.000Z",
      programId: "3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ",
      rpcUrl: "https://api.devnet.solana.com",
    });
    expect(
      resolveSupporterArena("world-cup-2026-france-england-third-place-rehearsal-v2"),
    ).toEqual({
      arenaAddress: "4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2",
      backingDeadlineUtc: "2026-07-18T21:00:00.000Z",
      programId: "3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ",
      rpcUrl: "https://api.devnet.solana.com",
    });
    expect(resolveSupporterArena("arena-replay-001")).toBeUndefined();
    expect(resolveSupporterArena("world-cup-2026-spain-argentina-final")).toBeUndefined();
  });
});
