import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  parseArenaAccount,
  parseSupporterPositionAccount,
  type ArenaAccount,
  type SupporterPositionAccount,
} from "./anchor-resolver.js";
import { loadResolverConfig, type ResolverConfig } from "./config.js";

export interface VoidArenaRequest {
  readonly arenaAddress: PublicKey;
  readonly identityHash: Uint8Array;
  readonly fixtureId: bigint;
  readonly reason: number;
  readonly expectedAlphaPool: bigint;
  readonly expectedBetaPool: bigint;
  readonly expectedPositionCount: number;
}

interface RpcBuilder {
  accountsPartial(accounts: Record<string, PublicKey>): RpcBuilder;
  rpc(): Promise<string>;
}

interface OperatorMethods {
  voidArena(reason: number): RpcBuilder;
}

interface OperatorAccounts {
  arena: { fetchNullable(address: PublicKey): Promise<unknown | null> };
  supporterPosition: {
    all(filters: readonly unknown[]): Promise<readonly { account: unknown }[]>;
  };
}

function requiredArgument(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (value === undefined || value === "") throw new Error(`${name} is required`);
  return value;
}

export function parseVoidArenaArguments(args: readonly string[]): VoidArenaRequest {
  if (args.length % 2 !== 0) throw new Error("Operator arguments must be name/value pairs");
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (name === undefined || value === undefined || !name.startsWith("--")) {
      throw new Error("Operator arguments must be name/value pairs");
    }
    if (values.has(name)) throw new Error(`${name} must occur once`);
    values.set(name, value);
  }
  const allowed = new Set([
    "--arena",
    "--identity-hash",
    "--fixture-id",
    "--reason",
    "--expected-alpha-pool",
    "--expected-beta-pool",
    "--expected-position-count",
  ]);
  for (const name of values.keys()) {
    if (!allowed.has(name)) throw new Error(`Unknown operator argument ${name}`);
  }

  const identityHex = requiredArgument(values, "--identity-hash");
  if (!/^[0-9a-f]{64}$/u.test(identityHex)) {
    throw new Error("--identity-hash must be 32-byte lowercase hex");
  }
  const fixtureInput = requiredArgument(values, "--fixture-id");
  if (!/^[1-9]\d*$/u.test(fixtureInput)) {
    throw new Error("--fixture-id must be a positive integer");
  }
  const reasonInput = requiredArgument(values, "--reason");
  if (!/^[1-9]\d*$/u.test(reasonInput)) {
    throw new Error("--reason must be a positive integer");
  }
  const reason = Number(reasonInput);
  if (!Number.isSafeInteger(reason) || reason > 65_535) {
    throw new Error("--reason must fit u16");
  }
  const expectedAlphaPoolInput = requiredArgument(values, "--expected-alpha-pool");
  const expectedBetaPoolInput = requiredArgument(values, "--expected-beta-pool");
  if (!/^(?:0|[1-9]\d*)$/u.test(expectedAlphaPoolInput)) {
    throw new Error("--expected-alpha-pool must be nonnegative integer lamports");
  }
  if (!/^(?:0|[1-9]\d*)$/u.test(expectedBetaPoolInput)) {
    throw new Error("--expected-beta-pool must be nonnegative integer lamports");
  }
  const expectedPositionCountInput = requiredArgument(values, "--expected-position-count");
  if (!/^(?:0|[1-9]\d*)$/u.test(expectedPositionCountInput)) {
    throw new Error("--expected-position-count must be a nonnegative integer");
  }
  const expectedPositionCount = Number(expectedPositionCountInput);
  if (!Number.isSafeInteger(expectedPositionCount)) {
    throw new Error("--expected-position-count must be a safe integer");
  }

  return Object.freeze({
    arenaAddress: new PublicKey(requiredArgument(values, "--arena")),
    identityHash: Uint8Array.from(Buffer.from(identityHex, "hex")),
    fixtureId: BigInt(fixtureInput),
    reason,
    expectedAlphaPool: BigInt(expectedAlphaPoolInput),
    expectedBetaPool: BigInt(expectedBetaPoolInput),
    expectedPositionCount,
  });
}

export function deriveArenaAddress(programId: PublicKey, identityHash: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arena"), Buffer.from(identityHash)],
    programId,
  )[0];
}

/**
 * Void reason codes are a client-side convention only. The on-chain program
 * (handle_void_arena) accepts any nonzero u16 and attaches no semantics to
 * the value beyond nonzero -- see ArenaError::InvalidVoidReason. This
 * operator script enforces a stricter, documented convention so that every
 * void performed through this CLI is backed by a known, reviewed scenario.
 *
 *   Reason 4 -- OPEN, pre-kickoff arena. Backing must be unwound before the
 *               match starts (e.g. cancelled fixture, setup error) and no
 *               Live run has occurred.
 *   Reason 5 -- LOCKED, post-kickoff arena whose Live run failed and will
 *               not be resumed as the original Live execution (see issue
 *               #14). Supporter positions are refunded in full; a Recovery
 *               Replay may be created separately under a new arena id.
 */
const OPEN_PRE_KICKOFF_REASON = 4;
const LOCKED_FAILED_LIVE_RUN_REASON = 5;

export function assertVoidCandidate(
  account: ArenaAccount,
  positions: readonly SupporterPositionAccount[],
  request: VoidArenaRequest,
  chainTime: bigint,
): void {
  if (request.reason === OPEN_PRE_KICKOFF_REASON) {
    if (account.state !== "OPEN") {
      throw new Error("Reason 4 requires an OPEN arena");
    }
    if (chainTime >= account.backingDeadline) {
      throw new Error("Reason 4 requires a pre-kickoff arena");
    }
  } else if (request.reason === LOCKED_FAILED_LIVE_RUN_REASON) {
    if (account.state !== "LOCKED") {
      throw new Error("Reason 5 requires a LOCKED arena");
    }
    if (chainTime < account.backingDeadline) {
      throw new Error("Reason 5 requires a post-kickoff arena");
    }
  } else {
    throw new Error("Unsupported void reason code for this operator script");
  }
  if (
    account.alphaPool !== request.expectedAlphaPool ||
    account.betaPool !== request.expectedBetaPool
  ) {
    throw new Error("Arena pools do not match operator expectations");
  }
  if (positions.length !== request.expectedPositionCount) {
    throw new Error("Supporter position count does not match operator expectation");
  }
  let alphaPool = 0n;
  let betaPool = 0n;
  for (const position of positions) {
    if (!position.arena.equals(request.arenaAddress) || position.claimed) {
      throw new Error("Supporter position conflicts with void constraints");
    }
    if (position.side === "alpha") alphaPool += position.amount;
    else betaPool += position.amount;
  }
  if (alphaPool !== account.alphaPool || betaPool !== account.betaPool) {
    throw new Error("Supporter positions do not reconcile with arena pools");
  }
}

export async function voidArena(
  config: ResolverConfig,
  request: VoidArenaRequest,
): Promise<Readonly<{ status: "VOIDED" | "ALREADY_VOID"; signature?: string }>> {
  const expectedAddress = deriveArenaAddress(config.programId, request.identityHash);
  if (!expectedAddress.equals(request.arenaAddress)) {
    throw new Error("Arena address does not match expected identity PDA");
  }

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
  const methods = program.methods as unknown as OperatorMethods;
  const accounts = program.account as unknown as OperatorAccounts;
  const value = await accounts.arena.fetchNullable(request.arenaAddress);
  if (value === null) throw new Error("Arena account does not exist");
  const account = parseArenaAccount(value);
  if (
    !Buffer.from(account.identityHash).equals(Buffer.from(request.identityHash)) ||
    account.fixtureId !== request.fixtureId ||
    !account.resolver.equals(config.resolver.publicKey)
  ) {
    throw new Error("Arena account conflicts with operator constraints");
  }
  if (account.state === "VOID") return Object.freeze({ status: "ALREADY_VOID" });
  const positionValues = await accounts.supporterPosition.all([
    { memcmp: { offset: 8, bytes: request.arenaAddress.toBase58() } },
  ]);
  const positions = positionValues.map(({ account: position }) =>
    parseSupporterPositionAccount(position),
  );
  const slot = await connection.getSlot("confirmed");
  const blockTime = await connection.getBlockTime(slot);
  if (blockTime === null) throw new Error("Confirmed Solana block time is unavailable");
  assertVoidCandidate(account, positions, request, BigInt(blockTime));

  const signature = await methods
    .voidArena(request.reason)
    .accountsPartial({
      arena: request.arenaAddress,
      resolver: config.resolver.publicKey,
    })
    .rpc();
  const updatedValue = await accounts.arena.fetchNullable(request.arenaAddress);
  if (updatedValue === null || parseArenaAccount(updatedValue).state !== "VOID") {
    throw new Error("Arena void transaction did not reach confirmed VOID state");
  }
  return Object.freeze({ status: "VOIDED", signature });
}

async function main() {
  const config = await loadResolverConfig();
  const request = parseVoidArenaArguments(process.argv.slice(2));
  const result = await voidArena(config, request);
  console.log(JSON.stringify({
    event: "supporter_arena_void",
    arena: request.arenaAddress.toBase58(),
    fixtureId: request.fixtureId.toString(),
    reason: request.reason,
    expectedAlphaPool: request.expectedAlphaPool.toString(),
    expectedBetaPool: request.expectedBetaPool.toString(),
    expectedPositionCount: request.expectedPositionCount,
    ...result,
  }));
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  try {
    await main();
  } catch (error) {
    console.error(JSON.stringify({
      event: "supporter_arena_void_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    }));
    process.exitCode = 1;
  }
}
