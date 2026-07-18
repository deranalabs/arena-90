import { Buffer } from "buffer";

export type SupporterRecord = {
  agent: "alpha" | "beta";
  amount: string;
  signature: string;
  wallet: string;
  state: "SUBMITTED" | "CONFIRMED";
  claim?: {
    signature: string;
    state: "SUBMITTED" | "CONFIRMED";
  };
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const SOL_AMOUNT = /^(0|[1-9]\d*)(\.\d{1,9})?$/;
const BACK_AGENT_DISCRIMINATOR = Buffer.from([28, 12, 95, 85, 115, 225, 18, 63]);
const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
const POSITION_DISCRIMINATOR = Buffer.from([235, 34, 48, 162, 250, 227, 34, 170]);

function amountLamports(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt("1000000000") + BigInt(fraction.padEnd(9, "0"));
}

export function parseSupporterRecord(value: string): SupporterRecord | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<SupporterRecord>;
    if (
      (parsed.agent !== "alpha" && parsed.agent !== "beta") ||
      (parsed.state !== "SUBMITTED" && parsed.state !== "CONFIRMED") ||
      typeof parsed.amount !== "string" ||
      !SOL_AMOUNT.test(parsed.amount) ||
      typeof parsed.signature !== "string" ||
      parsed.signature.length < 80 ||
      parsed.signature.length > 90 ||
      !BASE58.test(parsed.signature) ||
      typeof parsed.wallet !== "string" ||
      parsed.wallet.length < 32 ||
      parsed.wallet.length > 44 ||
      !BASE58.test(parsed.wallet)
    ) {
      return undefined;
    }
    if (
      parsed.claim !== undefined &&
      (
        (parsed.claim.state !== "SUBMITTED" && parsed.claim.state !== "CONFIRMED") ||
        typeof parsed.claim.signature !== "string" ||
        parsed.claim.signature.length < 80 ||
        parsed.claim.signature.length > 90 ||
        !BASE58.test(parsed.claim.signature)
      )
    ) {
      return undefined;
    }
    return parsed as SupporterRecord;
  } catch {
    return undefined;
  }
}

export async function verifySupporterRecord(
  record: SupporterRecord,
  arenaAddress: string,
  programAddress: string,
  rpcUrl: string,
): Promise<boolean> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const rpc = new URL(rpcUrl);
    if (rpc.protocol !== "https:" && rpc.hostname !== "localhost") return false;
    const programId = new PublicKey(programAddress);
    const arena = new PublicKey(arenaAddress);
    const wallet = new PublicKey(record.wallet);
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), arena.toBuffer(), wallet.toBuffer()],
      programId,
    );
    const connection = new Connection(rpc.toString(), "confirmed");
    const [signatureStatus, positionAccount, transaction] = await Promise.all([
      connection.getSignatureStatus(record.signature, { searchTransactionHistory: true }),
      connection.getAccountInfo(position, "confirmed"),
      connection.getTransaction(record.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }),
    ]);
    const confirmation = signatureStatus.value?.confirmationStatus;
    if (
      signatureStatus.value?.err !== null ||
      (confirmation !== "confirmed" && confirmation !== "finalized") ||
      !positionAccount?.owner.equals(programId) ||
      !transaction ||
      transaction.meta?.err !== null ||
      transaction.transaction.signatures[0] !== record.signature
    ) {
      return false;
    }

    const positionData = Buffer.from(positionAccount.data);
    if (
      positionData.length < 83 ||
      !positionData.subarray(0, 8).equals(POSITION_DISCRIMINATOR) ||
      !new PublicKey(positionData.subarray(8, 40)).equals(arena) ||
      !new PublicKey(positionData.subarray(40, 72)).equals(wallet) ||
      positionData[72] !== (record.agent === "alpha" ? 0 : 1) ||
      positionData.readBigUInt64LE(73) < amountLamports(record.amount)
    ) {
      return false;
    }

    const message = transaction.transaction.message;
    const accountKeys = message.getAccountKeys(
      transaction.meta?.loadedAddresses
        ? { accountKeysFromLookups: transaction.meta.loadedAddresses }
        : undefined,
    );
    const expectedLamports = amountLamports(record.amount);
    return message.compiledInstructions.some((instruction) => {
      const data = Buffer.from(instruction.data);
      const [arenaIndex, walletIndex, positionIndex] = instruction.accountKeyIndexes;
      return (
        accountKeys.get(instruction.programIdIndex)?.equals(programId) === true &&
        arenaIndex !== undefined && accountKeys.get(arenaIndex)?.equals(arena) === true &&
        walletIndex !== undefined && accountKeys.get(walletIndex)?.equals(wallet) === true &&
        message.isAccountSigner(walletIndex) &&
        positionIndex !== undefined && accountKeys.get(positionIndex)?.equals(position) === true &&
        data.length === 17 &&
        data.subarray(0, 8).equals(BACK_AGENT_DISCRIMINATOR) &&
        data[8] === (record.agent === "alpha" ? 0 : 1) &&
        data.readBigUInt64LE(9) === expectedLamports
      );
    });
  } catch {
    return false;
  }
}

export async function verifySupporterClaim(
  record: SupporterRecord,
  claimSignature: string,
  arenaAddress: string,
  programAddress: string,
  rpcUrl: string,
): Promise<boolean> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const rpc = new URL(rpcUrl);
    if (rpc.protocol !== "https:" && rpc.hostname !== "localhost") return false;
    const programId = new PublicKey(programAddress);
    const arena = new PublicKey(arenaAddress);
    const wallet = new PublicKey(record.wallet);
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), arena.toBuffer(), wallet.toBuffer()],
      programId,
    );
    const connection = new Connection(rpc.toString(), "confirmed");
    const [signatureStatus, positionAccount, transaction] = await Promise.all([
      connection.getSignatureStatus(claimSignature, { searchTransactionHistory: true }),
      connection.getAccountInfo(position, "confirmed"),
      connection.getTransaction(claimSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }),
    ]);
    const confirmation = signatureStatus.value?.confirmationStatus;
    if (
      signatureStatus.value?.err !== null ||
      (confirmation !== "confirmed" && confirmation !== "finalized") ||
      !positionAccount?.owner.equals(programId) ||
      !transaction ||
      transaction.meta?.err !== null ||
      transaction.transaction.signatures[0] !== claimSignature
    ) {
      return false;
    }

    const positionData = Buffer.from(positionAccount.data);
    if (
      positionData.length < 83 ||
      !positionData.subarray(0, 8).equals(POSITION_DISCRIMINATOR) ||
      !new PublicKey(positionData.subarray(8, 40)).equals(arena) ||
      !new PublicKey(positionData.subarray(40, 72)).equals(wallet) ||
      positionData[72] !== (record.agent === "alpha" ? 0 : 1) ||
      positionData.readBigUInt64LE(73) < amountLamports(record.amount) ||
      positionData[81] !== 1
    ) {
      return false;
    }

    const message = transaction.transaction.message;
    const accountKeys = message.getAccountKeys(
      transaction.meta?.loadedAddresses
        ? { accountKeysFromLookups: transaction.meta.loadedAddresses }
        : undefined,
    );
    return message.compiledInstructions.some((instruction) => {
      const data = Buffer.from(instruction.data);
      const [arenaIndex, walletIndex, positionIndex] = instruction.accountKeyIndexes;
      return (
        accountKeys.get(instruction.programIdIndex)?.equals(programId) === true &&
        arenaIndex !== undefined && accountKeys.get(arenaIndex)?.equals(arena) === true &&
        walletIndex !== undefined && accountKeys.get(walletIndex)?.equals(wallet) === true &&
        message.isAccountSigner(walletIndex) &&
        positionIndex !== undefined && accountKeys.get(positionIndex)?.equals(position) === true &&
        data.equals(CLAIM_DISCRIMINATOR)
      );
    });
  } catch {
    return false;
  }
}
