/** @jest-environment node */

import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

import {
  parseSupporterRecord,
  type SupporterRecord,
  verifySupporterRecord,
} from "../lib/solana-actions/supporter-proof";

const getSignatureStatus = jest.fn();
const getAccountInfo = jest.fn();
const getTransaction = jest.fn();

jest.mock("@solana/web3.js", () => {
  class MockPublicKey {
    readonly bytes: Buffer;
    readonly label: string;

    constructor(value: string | Uint8Array) {
      if (typeof value === "string") {
        this.label = value;
        const fill = value === "position" ? 3 : value.startsWith("3eaE") ? 1 : 2;
        this.bytes = Buffer.alloc(32, fill);
      } else {
        this.bytes = Buffer.from(value);
        this.label = this.bytes[0] === 1 ? "program" : this.bytes[0] === 3 ? "position" : arenaAddress;
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
      return [new MockPublicKey("position"), 255] as const;
    }
  }
  return {
    PublicKey: MockPublicKey,
    Connection: jest.fn(() => ({ getSignatureStatus, getAccountInfo, getTransaction })),
  };
});

const programId = new PublicKey("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");
const arenaAddress = "4Fch1s6fV1QTbBzLFxd5VUPq82oMdnE1SSpx28Md1Vz2";
const record: SupporterRecord = {
  agent: "alpha",
  amount: "0.01",
  signature: "5".repeat(88),
  wallet: arenaAddress,
  state: "SUBMITTED",
};

describe("supporter proof", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed browser records", () => {
    expect(parseSupporterRecord("not-json")).toBeUndefined();
    expect(parseSupporterRecord(JSON.stringify({ ...record, signature: "fabricated" }))).toBeUndefined();
    expect(parseSupporterRecord(JSON.stringify({ ...record, state: "CONFIRMED" }))).toEqual({
      ...record,
      state: "CONFIRMED",
    });
  });

  it("requires both a confirmed signature and a program-owned supporter position", async () => {
    const arena = new PublicKey(arenaAddress);
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), arena.toBuffer(), arena.toBuffer()],
      programId,
    );
    const positionData = Buffer.alloc(83);
    Buffer.from([235, 34, 48, 162, 250, 227, 34, 170]).copy(positionData);
    arena.toBuffer().copy(positionData, 8);
    arena.toBuffer().copy(positionData, 40);
    positionData[72] = 0;
    positionData.writeBigUInt64LE(BigInt("10000000"), 73);
    const instructionData = Buffer.alloc(17);
    Buffer.from([28, 12, 95, 85, 115, 225, 18, 63]).copy(instructionData);
    instructionData[8] = 0;
    instructionData.writeBigUInt64LE(BigInt("10000000"), 9);
    const keys = [programId, arena, arena, position];
    getSignatureStatus.mockResolvedValue({
      value: { confirmationStatus: "confirmed", err: null },
    });
    getAccountInfo.mockResolvedValue({ owner: programId, data: positionData });
    getTransaction.mockResolvedValue({
      meta: { err: null, loadedAddresses: null },
      transaction: {
        signatures: [record.signature],
        message: {
          compiledInstructions: [{
            programIdIndex: 0,
            accountKeyIndexes: [1, 2, 3],
            data: instructionData,
          }],
          getAccountKeys: () => ({ get: (index: number) => keys[index] }),
          isAccountSigner: (index: number) => index === 2,
        },
      },
    });

    await expect(
      verifySupporterRecord(record, arenaAddress, programId.toBase58(), "https://api.devnet.solana.com"),
    ).resolves.toBe(true);

    getAccountInfo.mockResolvedValueOnce(null);
    await expect(
      verifySupporterRecord(record, arenaAddress, programId.toBase58(), "https://api.devnet.solana.com"),
    ).resolves.toBe(false);

    getAccountInfo.mockResolvedValueOnce({ owner: new PublicKey(arenaAddress) });
    await expect(
      verifySupporterRecord(record, arenaAddress, programId.toBase58(), "https://api.devnet.solana.com"),
    ).resolves.toBe(false);

    getAccountInfo.mockResolvedValueOnce({ owner: programId, data: positionData });
    instructionData[8] = 1;
    await expect(
      verifySupporterRecord(record, arenaAddress, programId.toBase58(), "https://api.devnet.solana.com"),
    ).resolves.toBe(false);
  });
});
