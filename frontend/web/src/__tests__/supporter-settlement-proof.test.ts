/** @jest-environment node */

import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

import { readVerifiedSupporterSettlement } from "../lib/solana-actions/supporter-settlement-proof";

const getAccountInfo = jest.fn();

jest.mock("@solana/web3.js", () => {
  class MockPublicKey {
    readonly bytes: Buffer;
    readonly label: string;

    constructor(value: string | Uint8Array) {
      if (typeof value === "string") {
        this.label = value;
        const fill = value === "receipt" ? 3 : value.startsWith("3eaE") ? 1 : 2;
        this.bytes = Buffer.alloc(32, fill);
      } else {
        this.bytes = Buffer.from(value);
        this.label = this.bytes[0] === 1 ? "program" : this.bytes[0] === 3 ? "receipt" : "arena";
      }
    }

    equals(other: MockPublicKey) {
      return this.bytes.equals(other.bytes);
    }

    toBuffer() {
      return Buffer.from(this.bytes);
    }

    toBase58() {
      return this.label;
    }

    static findProgramAddressSync() {
      return [new MockPublicKey("receipt"), 255] as const;
    }
  }
  return {
    PublicKey: MockPublicKey,
    Connection: jest.fn(() => ({ getAccountInfo })),
  };
});

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const arenaAddress = "4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2";
const expectedHash = "ab".repeat(32);

describe("supporter settlement proof", () => {
  beforeEach(() => jest.clearAllMocks());

  it("accepts only a program-owned settlement with a consumed terminal receipt and matching runtime hash", async () => {
    const arena = new PublicKey(arenaAddress);
    const receipt = new PublicKey("receipt");
    const arenaData = Buffer.alloc(354);
    Buffer.from([243, 215, 44, 44, 231, 211, 232, 168]).copy(arenaData);
    arenaData.writeBigInt64LE(BigInt("18257739"), 73);
    arenaData[217] = 2;
    receipt.toBuffer().copy(arenaData, 236);
    Buffer.from(expectedHash, "hex").copy(arenaData, 268);
    arenaData.writeBigUInt64LE(BigInt("110000000"), 300);
    arenaData.writeBigUInt64LE(BigInt("90000000"), 308);
    arenaData[316] = 1;
    arenaData[317] = 0;

    const receiptData = Buffer.alloc(130);
    Buffer.from([162, 7, 28, 45, 243, 50, 157, 76]).copy(receiptData);
    arena.toBuffer().copy(receiptData, 8);
    receiptData.writeBigInt64LE(BigInt("18257739"), 40);
    receiptData.writeInt32LE(2, 48);
    receiptData.writeInt32LE(1, 52);
    receiptData.writeBigUInt64LE(BigInt("476965667"), 120);
    receiptData[128] = 1;

    getAccountInfo
      .mockResolvedValueOnce({ owner: programId, data: arenaData })
      .mockResolvedValueOnce({ owner: programId, data: receiptData });

    await expect(readVerifiedSupporterSettlement(
      expectedHash,
      arenaAddress,
      programId.toBase58(),
      "https://api.devnet.solana.com",
    )).resolves.toEqual({
      alphaFinalNavMicros: "110000000",
      betaFinalNavMicros: "90000000",
      finalResultHash: expectedHash,
      fixtureId: "18257739",
      finalScore: { home: 2, away: 1 },
      result: "alpha",
      verificationSlot: "476965667",
    });

    arenaData[268] ^= 1;
    getAccountInfo.mockReset();
    getAccountInfo.mockResolvedValueOnce({ owner: programId, data: arenaData });
    await expect(readVerifiedSupporterSettlement(
      expectedHash,
      arenaAddress,
      programId.toBase58(),
      "https://api.devnet.solana.com",
    )).resolves.toBeUndefined();
  });
});
