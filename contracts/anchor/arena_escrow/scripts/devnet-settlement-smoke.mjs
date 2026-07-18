import anchor from "@coral-xyz/anchor"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const rpcUrl = process.env.SOLANA_RPC_URL
const keypairPath = process.env.SOLANA_KEYPAIR
const credentialsPath = process.env.TXLINE_CREDENTIALS_FILE
const fixtureIdNumber = Number(process.env.TXLINE_PROOF_FIXTURE_ID ?? "17926686")
const providerSeq = Number(process.env.TXLINE_PROOF_SEQ ?? "880")
const txlineProgramId = new anchor.web3.PublicKey(
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
)

if (!rpcUrl || !keypairPath || !credentialsPath) {
  throw new Error(
    "SOLANA_RPC_URL, SOLANA_KEYPAIR, and TXLINE_CREDENTIALS_FILE are required",
  )
}
if (!Number.isSafeInteger(fixtureIdNumber) || !Number.isSafeInteger(providerSeq)) {
  throw new Error("Proof fixture and sequence must be safe integers")
}

const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"))
const secret = Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8")))
const payer = anchor.web3.Keypair.fromSecretKey(secret)
const betaSupporter = anchor.web3.Keypair.generate()
const connection = new anchor.web3.Connection(rpcUrl, "confirmed")
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(payer),
  { commitment: "confirmed" },
)
anchor.setProvider(provider)

const idl = JSON.parse(readFileSync("target/idl/arena_escrow.json", "utf8"))
const program = new anchor.Program(idl, provider)

function toBytes32(value) {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : Buffer.from(value.startsWith("0x") ? value.slice(2) : value, value.startsWith("0x") ? "hex" : "base64")
  if (bytes.length !== 32) throw new Error(`Expected 32 bytes, got ${bytes.length}`)
  return [...bytes]
}

function toProofNodes(nodes = []) {
  return nodes.map((node) => ({
    hash: toBytes32(node.hash ?? node.Hash),
    isRightSibling: node.isRightSibling ?? node.IsRightSibling,
  }))
}

async function fetchStatProof(statKey) {
  const url = new URL(`${credentials.apiOrigin}/api/scores/stat-validation`)
  url.searchParams.set("fixtureId", String(fixtureIdNumber))
  url.searchParams.set("seq", String(providerSeq))
  url.searchParams.set("statKey", String(statKey))
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.jwt}`,
      "X-Api-Token": credentials.apiToken,
    },
  })
  if (!response.ok) {
    throw new Error(`TxLINE proof ${statKey} failed with status ${response.status}`)
  }
  return response.json()
}

const [homeProof, awayProof] = await Promise.all([fetchStatProof(1), fetchStatProof(2)])
if (
  homeProof.summary.fixtureId !== awayProof.summary.fixtureId ||
  JSON.stringify(homeProof.eventStatRoot) !== JSON.stringify(awayProof.eventStatRoot)
) {
  throw new Error("TxLINE HOME/AWAY proofs do not share canonical roots")
}

const targetTs = homeProof.summary.updateStats.minTimestamp
const payload = {
  ts: new anchor.BN(targetTs),
  fixtureSummary: {
    fixtureId: new anchor.BN(homeProof.summary.fixtureId),
    updateStats: {
      updateCount: homeProof.summary.updateStats.updateCount,
      minTimestamp: new anchor.BN(homeProof.summary.updateStats.minTimestamp),
      maxTimestamp: new anchor.BN(homeProof.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: toBytes32(homeProof.summary.eventStatsSubTreeRoot),
  },
  fixtureProof: toProofNodes(homeProof.subTreeProof),
  mainTreeProof: toProofNodes(homeProof.mainTreeProof),
  eventStatRoot: toBytes32(homeProof.eventStatRoot),
  stats: [homeProof, awayProof].map((proof) => ({
    stat: proof.statToProve,
    statProof: toProofNodes(proof.statProof),
  })),
}

const identityHash = [...createHash("sha256").update(`settlement:${Date.now()}`).digest()]
const manifestHash = [...createHash("sha256").update("arena90-devnet-settlement-v2").digest()]
const finalResultHash = [...createHash("sha256").update("alpha-wins-devnet-smoke").digest()]
const fixtureId = new anchor.BN(fixtureIdNumber)
const backingDeadline = new anchor.BN(Math.floor(Date.now() / 1000) + 8)
const alphaAmount = new anchor.BN(1_000_000)
const betaAmount = new anchor.BN(2_000_000)

const [arena] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("arena"), Buffer.from(identityHash)],
  program.programId,
)
const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), arena.toBuffer()],
  program.programId,
)
const [alphaPosition] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("position"), arena.toBuffer(), payer.publicKey.toBuffer()],
  program.programId,
)
const [betaPosition] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("position"), arena.toBuffer(), betaSupporter.publicKey.toBuffer()],
  program.programId,
)
const [receipt] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("terminal-proof"), arena.toBuffer()],
  program.programId,
)
const epochDay = Math.floor(targetTs / 86_400_000)
const [dailyScoresMerkleRoots] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toArrayLike(Buffer, "le", 2)],
  txlineProgramId,
)

const fundBetaSignature = await anchor.web3.sendAndConfirmTransaction(
  connection,
  new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: betaSupporter.publicKey,
      lamports: 10_000_000,
    }),
  ),
  [payer],
)

const initializeSignature = await program.methods
  .initializeArena(
    identityHash,
    manifestHash,
    fixtureId,
    backingDeadline,
    payer.publicKey,
    payer.publicKey,
    0,
    { live: {} },
  )
  .accountsPartial({
    operator: payer.publicKey,
    arena,
    vault,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc()

const alphaBackSignature = await program.methods
  .backAgent({ alpha: {} }, alphaAmount)
  .accountsPartial({
    arena,
    supporter: payer.publicKey,
    position: alphaPosition,
    vault,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc()

const betaBackSignature = await program.methods
  .backAgent({ beta: {} }, betaAmount)
  .accountsPartial({
    arena,
    supporter: betaSupporter.publicKey,
    position: betaPosition,
    vault,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([betaSupporter])
  .rpc()

const waitMs = Math.max(0, backingDeadline.toNumber() * 1000 - Date.now() + 1_500)
await new Promise((resolve) => setTimeout(resolve, waitMs))

const lockSignature = await program.methods.lockArena().accountsPartial({ arena }).rpc()
const proofSignature = await program.methods
  .verifyTxlineTerminal(payload)
  .accountsPartial({
    arena,
    receipt,
    payer: payer.publicKey,
    txlineProgram: txlineProgramId,
    dailyScoresMerkleRoots,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .preInstructions([
    anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
  ])
  .rpc()

const settleSignature = await program.methods
  .settleArena(
    finalResultHash,
    new anchor.BN(1_100_000),
    new anchor.BN(900_000),
    { alpha: {} },
  )
  .accountsPartial({
    arena,
    resolver: payer.publicKey,
    terminalProof: receipt,
    vault,
    treasury: payer.publicKey,
  })
  .rpc()

let losingClaimRejected = false
try {
  await program.methods
    .claim()
    .accountsPartial({
      arena,
      supporter: betaSupporter.publicKey,
      position: betaPosition,
      owner: betaSupporter.publicKey,
      vault,
    })
    .signers([betaSupporter])
    .rpc()
} catch {
  losingClaimRejected = true
}
if (!losingClaimRejected) throw new Error("Losing supporter claim unexpectedly succeeded")

const alphaClaimSignature = await program.methods
  .claim()
  .accountsPartial({
    arena,
    supporter: payer.publicKey,
    position: alphaPosition,
    owner: payer.publicKey,
    vault,
  })
  .rpc()

const arenaState = await program.account.arena.fetch(arena)
const receiptState = await program.account.terminalProofReceipt.fetch(receipt)
const alphaPositionState = await program.account.supporterPosition.fetch(alphaPosition)
const vaultInfo = await connection.getAccountInfo(vault)
if (!vaultInfo) throw new Error("Vault disappeared after settlement")
const rentReserve = await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length)

if (
  !arenaState.state.settled ||
  !receiptState.consumed ||
  !alphaPositionState.claimed ||
  vaultInfo.lamports !== rentReserve
) {
  throw new Error("Devnet winner settlement invariants failed")
}

console.log(JSON.stringify({
  programId: program.programId.toBase58(),
  arena: arena.toBase58(),
  fixtureId: fixtureId.toString(),
  providerSeq,
  finalScore: {
    home: payload.stats[0].stat.value,
    away: payload.stats[1].stat.value,
  },
  pools: { alpha: alphaAmount.toString(), beta: betaAmount.toString() },
  result: "alpha",
  losingClaimRejected,
  winnerClaimed: true,
  transactions: {
    fundBeta: fundBetaSignature,
    initialize: initializeSignature,
    alphaBack: alphaBackSignature,
    betaBack: betaBackSignature,
    lock: lockSignature,
    terminalProof: proofSignature,
    settle: settleSignature,
    alphaClaim: alphaClaimSignature,
  },
}, null, 2))
