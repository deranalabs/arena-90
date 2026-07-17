import anchor from "@coral-xyz/anchor"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const rpcUrl = process.env.SOLANA_RPC_URL
const keypairPath = process.env.SOLANA_KEYPAIR

if (!rpcUrl || !keypairPath) {
  throw new Error("SOLANA_RPC_URL and SOLANA_KEYPAIR are required")
}

const secret = Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8")))
const payer = anchor.web3.Keypair.fromSecretKey(secret)
const connection = new anchor.web3.Connection(rpcUrl, "confirmed")
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(payer),
  { commitment: "confirmed" },
)
anchor.setProvider(provider)

const idl = JSON.parse(readFileSync("target/idl/arena_escrow.json", "utf8"))
const program = new anchor.Program(idl, provider)
const identityHash = [...createHash("sha256").update(`smoke:${Date.now()}`).digest()]
const manifestHash = [...createHash("sha256").update("arena90-devnet-smoke-v2").digest()]
const fixtureId = new anchor.BN(18257865)
const backingDeadline = new anchor.BN(Math.floor(Date.now() / 1000) + 5)
const amount = new anchor.BN(1_000_000)

const [arena] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("arena"), Buffer.from(identityHash)],
  program.programId,
)
const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), arena.toBuffer()],
  program.programId,
)
const [position] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("position"), arena.toBuffer(), payer.publicKey.toBuffer()],
  program.programId,
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

const backSignature = await program.methods
  .backAgent({ alpha: {} }, amount)
  .accountsPartial({
    arena,
    supporter: payer.publicKey,
    position,
    vault,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc()

const waitMs = Math.max(0, backingDeadline.toNumber() * 1000 - Date.now() + 1_500)
await new Promise((resolve) => setTimeout(resolve, waitMs))

const lockSignature = await program.methods
  .lockArena()
  .accountsPartial({ arena })
  .rpc()

const voidSignature = await program.methods
  .voidArena(1)
  .accountsPartial({ arena, resolver: payer.publicKey })
  .rpc()

const claimSignature = await program.methods
  .claim()
  .accountsPartial({
    arena,
    supporter: payer.publicKey,
    position,
    owner: payer.publicKey,
    vault,
  })
  .rpc()

const arenaState = await program.account.arena.fetch(arena)
const positionState = await program.account.supporterPosition.fetch(position)

if (!arenaState.state.void || !positionState.claimed) {
  throw new Error("Devnet lifecycle did not reach void + claimed")
}

console.log(JSON.stringify({
  programId: program.programId.toBase58(),
  arena: arena.toBase58(),
  fixtureId: fixtureId.toString(),
  backedLamports: amount.toString(),
  state: "void",
  claimed: true,
  transactions: {
    initialize: initializeSignature,
    back: backSignature,
    lock: lockSignature,
    void: voidSignature,
    claim: claimSignature,
  },
}, null, 2))
