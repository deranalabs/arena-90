export type SupporterArena = {
  readonly arenaAddress: string;
  readonly backingDeadlineUtc: string;
  readonly programId: string;
  readonly rpcUrl: string;
};

const programId = process.env.NEXT_PUBLIC_ARENA90_PROGRAM_ID ??
  "3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ";
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const supporterArenas: Readonly<Record<string, SupporterArena>> = Object.freeze({
  "world-cup-2026-france-england-third-place-v4": Object.freeze({
    arenaAddress: "7LHP2afdUPTJErHEy9QNRTusVA7TUyy47agyHsUfFz6y",
    backingDeadlineUtc: "2026-07-18T21:00:00.000Z",
    programId,
    rpcUrl,
  }),
  "world-cup-2026-france-england-third-place-rehearsal-v2": Object.freeze({
    arenaAddress: "4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2",
    backingDeadlineUtc: "2026-07-18T21:00:00.000Z",
    programId,
    rpcUrl,
  }),
});

export function resolveSupporterArena(arenaId: string) {
  return supporterArenas[arenaId];
}
