import { readFile } from "node:fs/promises";

import anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

import type {
  SolanaArenaPreparationIntentV1,
  SolanaSettlementIntentV1,
} from "@arena90/arena-runtime/contracts";
import type { SupporterChainResolver } from "@arena90/arena-runtime/services";

import type { ResolverConfig } from "./config.js";
import { fetchTerminalProofPayload } from "./txline-proof.js";

type ArenaState = "OPEN" | "LOCKED" | "SETTLED" | "VOID";

export interface ArenaAccount {
  readonly identityHash: Uint8Array;
  readonly manifestHash: Uint8Array;
  readonly fixtureId: bigint;
  readonly operator: PublicKey;
  readonly resolver: PublicKey;
  readonly treasury: PublicKey;
  readonly vault: PublicKey;
  readonly backingDeadline: bigint;
  readonly state: ArenaState;
  readonly alphaPool: bigint;
  readonly betaPool: bigint;
  readonly feeBps: number;
  readonly terminalProof: PublicKey;
  readonly finalResultHash: Uint8Array;
  readonly alphaNav: bigint;
  readonly betaNav: bigint;
  readonly result?: "alpha" | "beta" | "DRAW";
}

export interface SupporterPositionAccount {
  readonly arena: PublicKey;
  readonly owner: PublicKey;
  readonly side: "alpha" | "beta";
  readonly amount: bigint;
  readonly claimed: boolean;
}

interface ReceiptAccount {
  readonly fixtureId: bigint;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly consumed: boolean;
}

interface RpcBuilder {
  accountsPartial(accounts: Record<string, PublicKey>): RpcBuilder;
  preInstructions(instructions: readonly unknown[]): RpcBuilder;
  rpc(): Promise<string>;
}

interface ResolverMethods {
  initializeArena(
    identityHash: number[],
    manifestHash: number[],
    fixtureId: anchor.BN,
    backingDeadline: anchor.BN,
    resolver: PublicKey,
    treasury: PublicKey,
    feeBps: number,
    mode: { live: Record<string, never> },
  ): RpcBuilder;
  lockArena(): RpcBuilder;
  verifyTxlineTerminal(payload: unknown): RpcBuilder;
  settleArena(
    finalResultHash: number[],
    alphaNav: anchor.BN,
    betaNav: anchor.BN,
    result: { alpha: Record<string, never> } | { beta: Record<string, never> } | { draw: Record<string, never> },
  ): RpcBuilder;
}

interface ResolverAccounts {
  arena: { fetchNullable(address: PublicKey): Promise<unknown | null> };
  terminalProofReceipt: {
    fetchNullable(address: PublicKey): Promise<unknown | null>;
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} has invalid on-chain data`);
  }
  return value as Record<string, unknown>;
}

function bytes(value: unknown, label: string): Uint8Array {
  const entries = value instanceof Uint8Array ? [...value] : value;
  if (!Array.isArray(entries) || entries.length !== 32 || !entries.every(
    (entry) => Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) <= 255,
  )) {
    throw new Error(`${label} must contain 32 on-chain bytes`);
  }
  return Uint8Array.from(entries as number[]);
}

function key(value: unknown, label: string): PublicKey {
  if (!(value instanceof PublicKey)) throw new Error(`${label} is not a public key`);
  return value;
}

function integer(value: unknown, label: string): bigint {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toString" in value) ||
    typeof value.toString !== "function"
  ) {
    throw new Error(`${label} is not an Anchor integer`);
  }
  const parsed = BigInt(value.toString());
  return parsed;
}

function smallInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} is not a safe integer`);
  return Number(value);
}

function variant(value: unknown, variants: readonly string[], label: string): string {
  const input = object(value, label);
  const found = variants.find((name) => input[name] !== undefined);
  if (found === undefined) throw new Error(`${label} is invalid`);
  return found;
}

export function parseArenaAccount(value: unknown): ArenaAccount {
  const input = object(value, "Arena account");
  const state = variant(input["state"], ["open", "locked", "settled", "void"], "Arena state");
  const resultInput = input["result"];
  const result: ArenaAccount["result"] =
    resultInput === null || resultInput === undefined
      ? undefined
      : (variant(resultInput, ["alpha", "beta", "draw"], "Arena result") === "draw"
          ? "DRAW"
          : (variant(resultInput, ["alpha", "beta"], "Arena result") as
              | "alpha"
              | "beta"));
  return {
    identityHash: bytes(input["identityHash"], "Arena identity hash"),
    manifestHash: bytes(input["manifestHash"], "Arena manifest hash"),
    fixtureId: integer(input["fixtureId"], "Arena fixture id"),
    operator: key(input["operator"], "Arena operator"),
    resolver: key(input["resolver"], "Arena resolver"),
    treasury: key(input["treasury"], "Arena treasury"),
    vault: key(input["vault"], "Arena vault"),
    backingDeadline: integer(input["backingDeadline"], "Arena backing deadline"),
    state: state.toUpperCase() as ArenaState,
    alphaPool: integer(input["alphaPool"], "Arena Alpha pool"),
    betaPool: integer(input["betaPool"], "Arena Beta pool"),
    feeBps: smallInteger(input["feeBps"], "Arena fee bps"),
    terminalProof: key(input["terminalProof"], "Arena terminal proof"),
    finalResultHash: bytes(input["finalResultHash"], "Arena final result hash"),
    alphaNav: integer(input["alphaNav"], "Arena Alpha NAV"),
    betaNav: integer(input["betaNav"], "Arena Beta NAV"),
    ...(result === undefined ? {} : { result }),
  };
}

export function parseSupporterPositionAccount(value: unknown): SupporterPositionAccount {
  const input = object(value, "Supporter position account");
  if (typeof input["claimed"] !== "boolean") {
    throw new Error("Supporter position claimed state is invalid");
  }
  const side = variant(input["side"], ["alpha", "beta"], "Supporter position side");
  return {
    arena: key(input["arena"], "Supporter position arena"),
    owner: key(input["owner"], "Supporter position owner"),
    side: side as "alpha" | "beta",
    amount: integer(input["amount"], "Supporter position amount"),
    claimed: input["claimed"],
  };
}

function parseReceipt(value: unknown): ReceiptAccount {
  const input = object(value, "Terminal proof receipt");
  if (typeof input["consumed"] !== "boolean") {
    throw new Error("Terminal proof consumed state is invalid");
  }
  return {
    fixtureId: integer(input["fixtureId"], "Receipt fixture id"),
    homeScore: smallInteger(input["homeScore"], "Receipt home score"),
    awayScore: smallInteger(input["awayScore"], "Receipt away score"),
    consumed: input["consumed"],
  };
}

function hex32(value: string, label: string): number[] {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be lowercase hex`);
  return [...Buffer.from(value, "hex")];
}

function sameBytes(left: Uint8Array, right: readonly number[]): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function unixSeconds(value: string): bigint {
  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds) || milliseconds % 1_000 !== 0) {
    throw new Error("Backing deadline must resolve to exact Unix seconds");
  }
  return BigInt(milliseconds / 1_000);
}

function deriveAccounts(programId: PublicKey, identityHash: readonly number[]) {
  const [arenaAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("arena"), Buffer.from(identityHash)],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), arenaAddress.toBuffer()],
    programId,
  );
  const [receipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("terminal-proof"), arenaAddress.toBuffer()],
    programId,
  );
  return { arenaAddress, vault, receipt };
}

export function assertArenaMatchesPreparation(
  account: ArenaAccount,
  intent: SolanaArenaPreparationIntentV1,
  config: ResolverConfig,
  vault: PublicKey,
) {
  const identityHash = hex32(intent.identityHash, "identityHash");
  const manifestHash = hex32(intent.manifestHash, "manifestHash");
  if (
    !sameBytes(account.identityHash, identityHash) ||
    !sameBytes(account.manifestHash, manifestHash) ||
    account.fixtureId !== BigInt(intent.fixtureId) ||
    account.backingDeadline !== unixSeconds(intent.backingDeadlineUtc) ||
    account.feeBps !== intent.feeBps ||
    !account.operator.equals(config.resolver.publicKey) ||
    !account.resolver.equals(config.resolver.publicKey) ||
    !account.treasury.equals(config.treasury) ||
    !account.vault.equals(vault)
  ) {
    throw new Error("Existing Solana arena conflicts with canonical runtime intent");
  }
}

function resultVariant(result: SolanaSettlementIntentV1["result"]) {
  if (result === "alpha") return { alpha: {} };
  if (result === "beta") return { beta: {} };
  return { draw: {} };
}

export function assertSettlementMatches(
  account: ArenaAccount,
  intent: SolanaSettlementIntentV1,
) {
  if (
    !sameBytes(account.finalResultHash, hex32(intent.finalResultHash, "finalResultHash")) ||
    account.alphaNav !== BigInt(intent.alphaFinalNavMicros) ||
    account.betaNav !== BigInt(intent.betaFinalNavMicros) ||
    account.result !== intent.result
  ) {
    throw new Error("Existing Solana settlement conflicts with canonical runtime result");
  }
}

export async function createAnchorSupporterChainResolver(
  config: ResolverConfig,
  options: { readonly now?: () => number; readonly fetchImpl?: typeof fetch } = {},
): Promise<SupporterChainResolver> {
  const idl = JSON.parse(await readFile(config.idlPath, "utf8")) as anchor.Idl;
  if (idl.address !== config.programId.toBase58()) {
    throw new Error("Arena90 IDL address does not match ARENA90_PROGRAM_ID");
  }
  const connection = new Connection(config.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(config.resolver),
    { commitment: "confirmed" },
  );
  const program = new anchor.Program(idl, provider);
  const methods = program.methods as unknown as ResolverMethods;
  const accounts = program.account as unknown as ResolverAccounts;
  const now = options.now ?? Date.now;

  async function loadArena(intent: SolanaArenaPreparationIntentV1) {
    const identityHash = hex32(intent.identityHash, "identityHash");
    const derived = deriveAccounts(config.programId, identityHash);
    const value = await accounts.arena.fetchNullable(derived.arenaAddress);
    if (value === null) return { ...derived, account: null };
    const account = parseArenaAccount(value);
    assertArenaMatchesPreparation(account, intent, config, derived.vault);
    return { ...derived, account };
  }

  const resolver: SupporterChainResolver = {
    async prepare(
      intent: SolanaArenaPreparationIntentV1,
      signal: AbortSignal,
    ) {
      signal.throwIfAborted();
      let current = await loadArena(intent);
      if (current.account !== null) return "ALREADY_PREPARED";
      const deadline = unixSeconds(intent.backingDeadlineUtc);
      if (BigInt(Math.floor(now() / 1_000)) >= deadline) {
        throw new Error("Cannot initialize supporter arena at or after kickoff");
      }
      try {
        await methods
          .initializeArena(
            hex32(intent.identityHash, "identityHash"),
            hex32(intent.manifestHash, "manifestHash"),
            new anchor.BN(intent.fixtureId),
            new anchor.BN(deadline.toString()),
            config.resolver.publicKey,
            config.treasury,
            intent.feeBps,
            { live: {} },
          )
          .accountsPartial({
            operator: config.resolver.publicKey,
            arena: current.arenaAddress,
            vault: current.vault,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        return "PREPARED";
      } catch (error) {
        current = await loadArena(intent);
        if (current.account !== null) return "ALREADY_PREPARED";
        throw error;
      }
    },

    async lock(intent: SolanaArenaPreparationIntentV1, signal: AbortSignal) {
      signal.throwIfAborted();
      let current = await loadArena(intent);
      if (current.account === null) throw new Error("Supporter arena is not prepared");
      if (current.account.state !== "OPEN") return "ALREADY_LOCKED";
      if (BigInt(Math.floor(now() / 1_000)) < current.account.backingDeadline) {
        return "NOT_DUE";
      }
      try {
        await methods.lockArena().accountsPartial({ arena: current.arenaAddress }).rpc();
        return "LOCKED";
      } catch (error) {
        current = await loadArena(intent);
        if (current.account !== null && current.account.state !== "OPEN") {
          return "ALREADY_LOCKED";
        }
        throw error;
      }
    },

    async settle(intent: SolanaSettlementIntentV1, signal: AbortSignal) {
      signal.throwIfAborted();
      const identityHash = hex32(intent.identityHash, "identityHash");
      const derived = deriveAccounts(config.programId, identityHash);
      const arenaValue = await accounts.arena.fetchNullable(derived.arenaAddress);
      if (arenaValue === null) throw new Error("Supporter arena is not prepared");
      const arenaAccount = parseArenaAccount(arenaValue);
      if (arenaAccount.state === "SETTLED") {
        assertSettlementMatches(arenaAccount, intent);
        return "ALREADY_SETTLED";
      }
      if (arenaAccount.state !== "LOCKED") {
        throw new Error("Supporter arena must be locked before settlement");
      }
      if (
        !sameBytes(arenaAccount.identityHash, identityHash) ||
        !sameBytes(arenaAccount.manifestHash, hex32(intent.manifestHash, "manifestHash")) ||
        arenaAccount.fixtureId !== BigInt(intent.fixtureId) ||
        !arenaAccount.resolver.equals(config.resolver.publicKey) ||
        !arenaAccount.treasury.equals(config.treasury) ||
        !arenaAccount.vault.equals(derived.vault)
      ) {
        throw new Error("Locked Solana arena conflicts with canonical settlement intent");
      }
      let receiptValue = await accounts.terminalProofReceipt.fetchNullable(derived.receipt);
      if (receiptValue === null) {
        const proof = await fetchTerminalProofPayload({
          credentials: config.txlineCredentials,
          fixtureId: intent.fixtureId,
          providerSequence: intent.providerSequence,
          homeScore: intent.homeScore,
          awayScore: intent.awayScore,
          signal,
          ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
        });
        const [dailyScoresMerkleRoots] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("daily_scores_roots"),
            new anchor.BN(proof.epochDay).toArrayLike(Buffer, "le", 2),
          ],
          config.txlineProgramId,
        );
        try {
          await methods
            .verifyTxlineTerminal(proof.payload)
            .accountsPartial({
              arena: derived.arenaAddress,
              receipt: derived.receipt,
              payer: config.resolver.publicKey,
              txlineProgram: config.txlineProgramId,
              dailyScoresMerkleRoots,
              systemProgram: SystemProgram.programId,
            })
            .preInstructions([
              ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
            ])
            .rpc();
        } catch (error) {
          receiptValue = await accounts.terminalProofReceipt.fetchNullable(derived.receipt);
          if (receiptValue === null) throw error;
        }
        receiptValue ??= await accounts.terminalProofReceipt.fetchNullable(derived.receipt);
      }
      if (receiptValue === null) throw new Error("TxLINE terminal receipt was not created");
      const receipt = parseReceipt(receiptValue);
      if (
        receipt.fixtureId !== BigInt(intent.fixtureId) ||
        receipt.homeScore !== intent.homeScore ||
        receipt.awayScore !== intent.awayScore ||
        receipt.consumed
      ) {
        throw new Error("Terminal proof receipt conflicts with canonical final evidence");
      }

      try {
        await methods
          .settleArena(
            hex32(intent.finalResultHash, "finalResultHash"),
            new anchor.BN(intent.alphaFinalNavMicros),
            new anchor.BN(intent.betaFinalNavMicros),
            resultVariant(intent.result),
          )
          .accountsPartial({
            arena: derived.arenaAddress,
            resolver: config.resolver.publicKey,
            terminalProof: derived.receipt,
            vault: derived.vault,
            treasury: config.treasury,
          })
          .rpc();
        return "SETTLED";
      } catch (error) {
        const reloaded = await accounts.arena.fetchNullable(derived.arenaAddress);
        if (reloaded !== null) {
          const account = parseArenaAccount(reloaded);
          if (account.state === "SETTLED") {
            assertSettlementMatches(account, intent);
            return "ALREADY_SETTLED";
          }
        }
        throw error;
      }
    },
  };
  return Object.freeze(resolver);
}
