# Arena90

**A football-first autonomous AI strategy arena powered by real match and market data.**

Arena90 turns one football fixture into a competition between two autonomous
strategy agents.

Agent Alpha and Agent Beta receive the same canonical snapshot, begin with equal
virtual bankrolls, independently choose target portfolio allocations, and
compete under deterministic execution and winner rules.

Supporters may back the strategy they trust through Solana. Supporter funds are
separate from agent virtual capital and never influence agent decisions.

## Product Model

```text
Football and market data
→ Shared canonical snapshot
→ Independent autonomous decisions
→ Deterministic portfolio execution
→ Visible competition result
→ Solana supporter settlement
```

Arena90 is not a conventional sportsbook, user-facing trading terminal,
copy-trading product, AI-controlled wallet, or scripted agent battle.

Watching an arena does not require authentication or a wallet.

## Strategy Agents

- **Agent Alpha — Momentum & Repricing**
  Reacts to meaningful match-state changes and repricing opportunities.

- **Agent Beta — Structure & Valuation Control**
  Focuses on market structure, valuation discipline, concentration, and risk.

These are strategy identities, not fixed football outcomes. Both agents may
select similar allocations, hold cash, reduce exposure, or return `NO_TRADE`.

## Competition Model

Decision rounds occur at:

- Kickoff
- 15 minutes
- 30 minutes
- Halftime
- 60 minutes
- 75 minutes

Final Settlement is a deterministic terminal event, not another agent decision
round.

Live and Replay use the same competition rules. Replay uses recorded football
data while generating new autonomous agent decisions.

## Repository Structure

### `frontend/web/`

Next.js 15, React 19, TypeScript, Tailwind CSS v4, and Framer Motion.

Public spectator, arena, replay, proof, agent, and participation experiences.

### `backend/solana-actions/`

Node.js and Express API using `@solana/actions` and `@solana/web3.js`.

Provides Solana Action and Blink-compatible surfaces.

### `contracts/anchor/arena_escrow/`

Rust and Anchor workspace for supporter escrow and settlement development.

The workspace still contains experimental and V1 artifacts. Their presence does
not make them authoritative V2 requirements.

### `agents/zeroclaw/`

ZeroClaw autonomous-agent runtime and supporting tools.

The existing `run_clash.sh` still contains legacy machine-specific paths and
must be inspected before use.

### `docs/`

Product decisions, technical specifications, plans, and references.

## Authoritative Documents

Only documents marked `Approved` are implementation-authoritative.

- `docs/product/01-Autonomous-Game-Loop-Decision.md`
  defines checkpoints, decisions, failures, deterministic execution, winner
  rules, and Live/Replay equivalence.

- `docs/product/02-Product-Definition-V2.md`
  defines the product, users, agent identities, principles, scope, and
  boundaries.

- `docs/product/03-User-Experience-and-Routes.md`
  defines routes, page responsibilities, Live and Replay UX, Solana
  participation, identity, and cross-route behavior.

AI coding tools must also follow `AGENTS.md` and the nearest subsystem
`AGENTS.md` when one exists.

Existing V1 code, mocks, filenames, or comments do not override approved V2
decisions.

## Development

### Frontend

```bash
cd frontend/web
npm ci
npm run dev
```

Validation:

```bash
npm run lint
npm test -- --runInBand
npm run build
```

### Solana Actions Backend

```bash
cd backend/solana-actions
npm ci
npm run dev
```

Validation:

```bash
npm run build
npm test -- --runInBand
```

### Anchor Contracts

```bash
cd contracts/anchor/arena_escrow
npm ci
anchor build
npm test
cargo test
```

Solana and Anchor tooling must be installed before contract validation.

### ZeroClaw Agents

Inspect `agents/zeroclaw/` before executing the legacy runner.

Do not treat `run_clash.sh` as portable until its absolute-path assumptions are
removed.

## Security and Honesty

Secrets must come from environment variables.

Never commit `.env` files, API credentials, private keys, seed phrases, wallet
files, RPC credentials, build output, or local validator ledgers.

Mocks, trusted components, simulations, and incomplete integrations must be
identified honestly. They must not be described as live, verified,
decentralized, autonomous, or production-ready unless that claim has been
validated.

## Current V2 Status

The V2 product direction and UX are approved.

The repository still contains V1 and experimental artifacts that must be
reviewed against the approved V2 documents before being retained or modified.

Current documentation work:

- compress Product Definition V2 without changing approved decisions;
- compress User Experience and Routes without changing approved decisions;
- audit consistency across documents `01`, `02`, and `03`;
- add subsystem-specific instructions as implementation resumes.
