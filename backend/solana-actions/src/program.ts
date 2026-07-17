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
export type ArenaState = "OPEN" | "LOCKED" | "SETTLED" | "VOID";

export interface ArenaLifecycle {
  readonly backingDeadlineUnix: bigint;
  readonly state: ArenaState;
}

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

const ARENA_ACCOUNT_DISCRIMINATOR = createHash("sha256")
  .update("account:Arena")
  .digest()
  .subarray(0, 8);
const ARENA_BACKING_DEADLINE_OFFSET = 209;
const ARENA_STATE_OFFSET = 217;

export function decodeArenaLifecycle(data: Buffer): ArenaLifecycle {
  if (
    data.length <= ARENA_STATE_OFFSET ||
    !data.subarray(0, 8).equals(ARENA_ACCOUNT_DISCRIMINATOR)
  ) {
    throw new Error("invalid Arena90 V2 arena account data");
  }

  const state = (["OPEN", "LOCKED", "SETTLED", "VOID"] as const)[
    data[ARENA_STATE_OFFSET] ?? -1
  ];
  if (state === undefined) throw new Error("invalid Arena90 V2 arena state");

  return {
    backingDeadlineUnix: data.readBigInt64LE(ARENA_BACKING_DEADLINE_OFFSET),
    state,
  };
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
