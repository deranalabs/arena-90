import { createHash } from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

const ARENA_SEED = Buffer.from("arena");
const VAULT_SEED = Buffer.from("vault");
const POSITION_SEED = Buffer.from("position");

export type AgentSide = "alpha" | "beta";

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export function deriveVault(programId: PublicKey, arena: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, arena.toBuffer()],
    programId,
  )[0];
}

export function derivePosition(
  programId: PublicKey,
  arena: PublicKey,
  supporter: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, arena.toBuffer(), supporter.toBuffer()],
    programId,
  )[0];
}

export function deriveArena(programId: PublicKey, identityHash: Uint8Array): PublicKey {
  if (identityHash.length !== 32) throw new Error("identityHash must be 32 bytes");
  return PublicKey.findProgramAddressSync([ARENA_SEED, identityHash], programId)[0];
}

export function backAgentInstruction(args: {
  programId: PublicKey;
  arena: PublicKey;
  supporter: PublicKey;
  side: AgentSide;
  lamports: bigint;
}): TransactionInstruction {
  if (args.lamports <= 0n || args.lamports > 0xffff_ffff_ffff_ffffn) {
    throw new Error("lamports outside u64 range");
  }
  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(args.lamports);
  const side = Buffer.from([args.side === "alpha" ? 0 : 1]);
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.arena, isSigner: false, isWritable: true },
      { pubkey: args.supporter, isSigner: true, isWritable: true },
      {
        pubkey: derivePosition(args.programId, args.arena, args.supporter),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: deriveVault(args.programId, args.arena),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([discriminator("back_agent"), side, amount]),
  });
}

export function claimInstruction(args: {
  programId: PublicKey;
  arena: PublicKey;
  supporter: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.arena, isSigner: false, isWritable: true },
      { pubkey: args.supporter, isSigner: true, isWritable: true },
      {
        pubkey: derivePosition(args.programId, args.arena, args.supporter),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: args.supporter, isSigner: false, isWritable: false },
      {
        pubkey: deriveVault(args.programId, args.arena),
        isSigner: false,
        isWritable: true,
      },
    ],
    data: discriminator("claim"),
  });
}
