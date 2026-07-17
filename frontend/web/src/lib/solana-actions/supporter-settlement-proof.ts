import { Buffer } from "buffer";

export type VerifiedSupporterSettlement = {
  readonly alphaFinalNavMicros: string;
  readonly betaFinalNavMicros: string;
  readonly finalResultHash: string;
  readonly fixtureId: string;
  readonly finalScore: {
    readonly home: number;
    readonly away: number;
  };
  readonly result: "alpha" | "beta" | "DRAW";
  readonly verificationSlot: string;
};

const ARENA_DISCRIMINATOR = Buffer.from([243, 215, 44, 44, 231, 211, 232, 168]);
const RECEIPT_DISCRIMINATOR = Buffer.from([162, 7, 28, 45, 243, 50, 157, 76]);

export async function readVerifiedSupporterSettlement(
  expectedFinalResultHash: string,
  arenaAddress: string,
  programAddress: string,
  rpcUrl: string,
): Promise<VerifiedSupporterSettlement | undefined> {
  try {
    if (!/^[0-9a-f]{64}$/.test(expectedFinalResultHash)) return undefined;
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const rpc = new URL(rpcUrl);
    if (rpc.protocol !== "https:" && rpc.hostname !== "localhost") return undefined;
    const programId = new PublicKey(programAddress);
    const arena = new PublicKey(arenaAddress);
    const [receipt] = PublicKey.findProgramAddressSync(
      [Buffer.from("terminal-proof"), arena.toBuffer()],
      programId,
    );
    const connection = new Connection(rpc.toString(), "confirmed");
    const arenaAccount = await connection.getAccountInfo(arena, "confirmed");
    if (!arenaAccount?.owner.equals(programId)) return undefined;
    const arenaData = Buffer.from(arenaAccount.data);
    if (
      arenaData.length < 354 ||
      !arenaData.subarray(0, 8).equals(ARENA_DISCRIMINATOR) ||
      arenaData[217] !== 2 ||
      !new PublicKey(arenaData.subarray(236, 268)).equals(receipt) ||
      arenaData.subarray(268, 300).toString("hex") !== expectedFinalResultHash ||
      arenaData[316] !== 1
    ) {
      return undefined;
    }
    const result = (["alpha", "beta", "DRAW"] as const)[arenaData[317] ?? -1];
    if (result === undefined) return undefined;

    const receiptAccount = await connection.getAccountInfo(receipt, "confirmed");
    if (!receiptAccount?.owner.equals(programId)) return undefined;
    const receiptData = Buffer.from(receiptAccount.data);
    const fixtureId = arenaData.readBigInt64LE(73);
    const homeScore = receiptData.length >= 56 ? receiptData.readInt32LE(48) : -1;
    const awayScore = receiptData.length >= 56 ? receiptData.readInt32LE(52) : -1;
    if (
      receiptData.length < 130 ||
      !receiptData.subarray(0, 8).equals(RECEIPT_DISCRIMINATOR) ||
      !new PublicKey(receiptData.subarray(8, 40)).equals(arena) ||
      receiptData.readBigInt64LE(40) !== fixtureId ||
      homeScore < 0 ||
      awayScore < 0 ||
      receiptData[128] !== 1
    ) {
      return undefined;
    }

    return {
      alphaFinalNavMicros: arenaData.readBigUInt64LE(300).toString(),
      betaFinalNavMicros: arenaData.readBigUInt64LE(308).toString(),
      finalResultHash: expectedFinalResultHash,
      fixtureId: fixtureId.toString(),
      finalScore: { home: homeScore, away: awayScore },
      result,
      verificationSlot: receiptData.readBigUInt64LE(120).toString(),
    };
  } catch {
    return undefined;
  }
}
