# Arena90

**Two autonomous football strategy agents. One verified evidence set. A
deterministic arena with supporter participation on Solana devnet.**

<img width="1440" height="818" alt="Screenshot 2026-07-18 at 22 43 24" src="https://github.com/user-attachments/assets/61a4d03a-0c21-4259-a2fb-dc299d0a5438" />


[Live MVP](https://arena90.xyz) · [X profile](https://x.com/arena90ai) ·
[Technical docs](docs/README.md) · [Demo runbook](docs/demo/00-Demo-and-Submission-Runbook.md) ·
[Submission sheet](SUBMISSION.md)

## What Arena90 does

Arena90 turns one football fixture into a strategy competition. Alpha and Beta
receive the same canonical TxLINE/TxODDS snapshot, start with equal virtual
bankrolls, and independently manage portfolios at approved checkpoints. Arena90
validates their structured decisions, executes and accounts for them
deterministically, reveals the result, and records a final winner.

Supporters can back Alpha or Beta with a user-signed Solana devnet transaction.
Supporter funds remain separate from agent capital and never become a strategy
input. Watching an arena is wallet-free.

Arena90 is not a sportsbook, a user-facing trading terminal, copy trading, an
AI-controlled wallet, or a scripted battle.

## Product loop

```text
TxLINE / TxODDS evidence
        ↓
Canonical fixture + market snapshot
        ↓
Alpha and Beta decide independently
        ↓
Fail-closed validation and deterministic execution
        ↓
Accounting, simultaneous reveal, and winner calculation
        ↓
Public state, SSE event ledger, and proof views
        ↓
Solana devnet supporter lifecycle
```

The Arena Runtime is the deep module. Its public state, ordered events, and
terminal result are the interface consumed by the frontend and settlement
modules. Provider payloads, prompts, raw model output, private reasoning, and
wallet authority stay behind their seams.

## Strategy agents

| Agent | Product name | Policy identity | Question |
| --- | --- | --- | --- |
| Alpha | Reversion | Overreaction | Did price move faster than verified match evidence? |
| Beta | Continuation | Underreaction | Did verified match evidence move faster than price? |

Neither agent is assigned HOME, DRAW, or AWAY. Each checkpoint returns a
structured target allocation or intentional `NO_TRADE`; invalid output fails
closed and is never converted into a fabricated trade.

Decision checkpoints are kickoff, 15', 30', halftime, 60', and 75'. Final
settlement is a terminal event, not another agent decision.

## TxLINE / TxODDS integration

The live adapter uses credentials supplied through environment variables. No
provider credential is committed to the repository.

| Provider surface | Arena90 use |
| --- | --- |
| `GET /api/fixtures/snapshot` | Fixture identity, participants, home/away mapping, start time |
| `GET /api/odds/snapshot/{fixtureId}` | Initial approved full-match `1X2` market |
| `GET /api/odds/updates/{fixtureId}` | Newest market envelope and freshness selection |
| `GET /api/scores/snapshot/{fixtureId}` | Score, phase, clock, and initial sequence |
| `GET /api/scores/stream?fixtureId={fixtureId}` | Live score events and resumable sequence updates |
| `GET /api/scores/historical/{fixtureId}` | Recorded score stream used for Replay evidence |

Before a checkpoint is admitted, the adapter verifies fixture identity,
participant mapping, score and clock validity, sequence monotonicity, market
identity, odds completeness, freshness, and suspension state. Stale, malformed,
or mismatched data produces a failed or missed checkpoint; Arena90 does not
fall back to an older market or invent a decision.

Implementation: [`client.ts`](backend/arena-runtime/src/adapters/data/txline/client.ts),
[`live.ts`](backend/arena-runtime/src/adapters/data/txline/live.ts), and the
[TxLINE adapter specification](docs/specs/03-TxLINE-Live-Data-Adapter.md).

## Solana supporter layer

The supporter layer is deliberately separate from agent execution:

```text
Frontend → constrained unsigned Action transaction
         → supporter wallet signs
         → Anchor escrow on Solana devnet
         → lock → terminal proof → settle → claim/refund
```

- Action API: [`backend/solana-actions`](backend/solana-actions/)
- Restricted resolver: [`backend/solana-resolver`](backend/solana-resolver/)
- Rust/Anchor program: [`contracts/anchor/arena_escrow`](contracts/anchor/arena_escrow/)
- Network: Solana devnet
- Arena90 program: `3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ`
- Current Action: [Back an Arena90 agent](https://arena90.xyz/actions/arena/7LHP2afdUPTJErHEy9QNRTusVA7TUyy47agyHsUfFz6y)
- Verified devnet transaction: [Explorer proof](https://explorer.solana.com/tx/3t9sqcxu853QwELQ6Nfb3Uf5HbMKjEtp75GZ4vE7hxZQw9NwxLvZdzdDpKZYNKRENJnZvz59BurAz1zRH7K1gF6F?cluster=devnet)

The backend only constructs constrained unsigned transactions. It never holds
supporter private keys or controls supporter wallets.

## Live and Replay

Live and Replay share the same competition rules and engine. Live consumes
current TxLINE/TxODDS evidence. Replay consumes recorded TxLINE evidence and
generates fresh autonomous Alpha/Beta decisions through the same engine; it is
not presented as live data.

- [Live MVP](https://arena90.xyz)
- [Replay archive](https://arena90.xyz/replays)
- [France–Spain semifinal Replay](https://arena90.xyz/arena/world-cup-2026-france-spain-semifinal-replay/archive)
- [England–Argentina semifinal Replay](https://arena90.xyz/arena/world-cup-2026-england-argentina-semifinal-replay/archive)

## Technology

- Next.js 15, React 19, TypeScript, CSS Modules, and shared global design tokens
- Node.js TypeScript runtime with Zod contracts and SSE public events
- ZeroClaw-compatible autonomous agent adapter with structured decision output
- Solana Actions and `@solana/web3.js`
- Rust/Anchor escrow and TxLINE terminal-proof validation
- Vercel frontend with separately deployed runtime, Actions, and resolver

## Repository map

| Path | Responsibility |
| --- | --- |
| `frontend/web/` | Spectator, arena, Replay, proof, agents, and supporter UX |
| `backend/arena-runtime/` | Ingestion, canonical snapshots, agents, validation, execution, accounting, persistence, HTTP, SSE |
| `backend/solana-actions/` | Wallet-signed Action/Blink transaction surfaces |
| `backend/solana-resolver/` | Restricted runtime-result to terminal-proof settlement adapter |
| `contracts/anchor/arena_escrow/` | Devnet SOL escrow, lifecycle, proof receipt, settlement, claim, refund |
| `docs/` | Approved product, technical specifications, deployment, and demo documentation |
| `ops/deployment/` | Service units, reverse proxy example, env examples, activation and rollback notes |

## Run locally

Copy the relevant `.env.example` to a local ignored `.env`; never commit it.

```bash
# Frontend
cd frontend/web
npm ci
npm run dev

# Runtime HTTP API
cd backend/arena-runtime
npm ci
npm run start:http

# Solana Actions
cd backend/solana-actions
npm ci
npm run build && npm start

# Resolver and Anchor require configured devnet credentials/tooling.
cd backend/solana-resolver && npm ci && npm test
cd contracts/anchor/arena_escrow && npm ci && anchor build && cargo test
```

Frontend checks:

```bash
cd frontend/web
npm run lint
npm test -- --runInBand
npm run build
```

Runtime, Actions, resolver, and Anchor commands are documented in the
[documentation index](docs/README.md) and deployment guide.

## Evidence and current status

Proven:

- Two semifinal Replay artifacts run fresh autonomous decisions through the
  canonical competition engine.
- An always-on World Cup Live runtime is deployed and resumes from persisted
  state without a public start trigger.
- Public arena state, SSE events, Replay archives, proof routes, and frontend
  pages are deployed at `arena90.xyz`.
- Solana devnet backing, locking, terminal-proof validation, settlement, claim,
  and void/refund smokes pass in isolation.

Still open:

- A real World Cup Live checkpoint has not yet been evidenced through the full
  TxLINE/TxODDS → both agents → deterministic execution → browser ledger →
  canonical Solana settlement path.

Replay is valid demo evidence for autonomous decision behavior, but it is not a
substitute for the required live-input acceptance. See the [V2 delivery
roadmap](docs/specs/02-V2-Delivery-Roadmap.md) and [demo runbook](docs/demo/00-Demo-and-Submission-Runbook.md)
for the evidence-owned status.

## Security

Secrets come from environment variables. Do not commit `.env` files, API
credentials, private keys, seed phrases, wallet files, RPC credentials, build
output, or local validator ledgers. Watching is wallet-free; supporter
transactions are user-signed; private reasoning and raw provider payloads are
not public product output.

## Documentation

- [Documentation index](docs/README.md)
- [Autonomous game loop](docs/product/01-Autonomous-Game-Loop-Decision.md)
- [Product definition](docs/product/02-Product-Definition-V2.md)
- [UX and routes](docs/product/03-User-Experience-and-Routes.md)
- [Runtime specification](docs/specs/01-P0-Arena-Runtime.md)
- [TxLINE adapter specification](docs/specs/03-TxLINE-Live-Data-Adapter.md)
- [Solana escrow and settlement specification](docs/specs/04-Supporter-Escrow-and-Blink-Settlement.md)
- [Demo and submission runbook](docs/demo/00-Demo-and-Submission-Runbook.md)

## License

Arena90 is available under the [MIT License](LICENSE).
