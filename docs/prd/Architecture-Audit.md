# Arena90 — Architecture Audit & Development Directive

## Project Definition

Arena90 is a 90-minute AI agent prediction arena for football matches.

Two strategy agents, ISAGI and AIKU, analyze the same TxLINE/TxODDS market data and take opposing positions on a football market such as Total Goals Over/Under 2.5.

Users back one of the agents through Solana Blinks. User funds must be deposited into an Anchor-controlled escrow vault. After the match is finalized, verified result data determines which agent was correct, and winning bettors may claim their proportional share of the pool.

The intended lifecycle is:

TxLINE data
→ deterministic agent strategies
→ immutable Clash Manifest
→ Anchor arena initialization
→ Blink staking transaction
→ escrow and optional yield deployment
→ verified resolution
→ proportional winner claims

## Current Implementation Status

Arena90 currently consists of multiple working proof-of-concept layers, but they are not yet fully connected end-to-end.

### Agent Layer

Current flow:

txodds-mock.json
→ read_odds.py
→ deterministic decisions
→ ZeroClaw runtime acknowledgment
→ clash-state.json

Important facts:

* The actual agent decisions are currently calculated by `read_odds.py`.
* ISAGI is currently hardcoded to choose Over 2.5.
* AIKU is currently hardcoded to choose Under 2.5.
* ZeroClaw currently receives a prompt containing the required deterministic decision and returns an acknowledgment.
* ZeroClaw is therefore currently a runtime/provenance layer, not the primary decision engine.
* The current model must not be presented as an autonomous LLM prediction engine.
* Current `confidenceBps` values are internal strategy scores, not calibrated probabilities.

### Solana Actions / Blink Layer

Current Blink flow:

clash-state.json
→ GET action metadata
→ POST action transaction
→ native SOL transfer to a treasury wallet

Important facts:

* The UI says the user is staking 10 mock USDC.
* The actual transaction transfers 0.01 SOL.
* The POST action does not currently call the Anchor `stake_agent` instruction.
* The Blink and Anchor escrow flows are disconnected.
* A production or hackathon-final Blink must call `stake_agent` and transfer the configured SPL token to the arena vault.

### Anchor Contract Layer

Currently implemented:

* `initialize_arena`
* `stake_agent`
* total ISAGI stake tracking
* total AIKU stake tracking
* mock Kamino CPI deposit
* mock Kamino CPI withdrawal
* manual `resolve_arena(winning_side)`
* protection against double resolution
* authority validation
* principal-loss rollback tests

Currently missing:

* per-user bettor tracking
* Position/Ticket PDA
* betting lock timestamp
* explicit arena lifecycle/state machine
* verified oracle/result resolution
* `claim_payout`
* refund flow
* void/cancelled match flow
* proportional payout snapshot
* real Kamino integration
* Blink-to-Anchor integration

## Non-Negotiable Architectural Principles

### 1. One Immutable Clash Manifest

Before an arena is opened, generate one canonical Clash Manifest containing:

* schema version
* arena ID
* fixture ID
* market type and line
* ISAGI strategy version and position
* AIKU strategy version and position
* source data timestamp
* source data hash
* opening time
* lock time
* manifest hash

Once staking begins, the clash definition must not be mutable.

The Anchor arena should store at minimum:

* deterministic 32-byte arena ID
* clash manifest hash
* fixture ID hash
* market definition
* ISAGI position
* AIKU position
* opens_at
* locks_at

Do not rely on a mutable JSON file as the final source of truth after user funds are accepted.

### 2. Deterministic Strategy, Optional LLM Explanation

The recommended agent architecture is:

TxLINE adapter
→ validated feature engine
→ versioned ISAGI policy
→ versioned AIKU policy
→ deterministic agent decisions
→ optional LLM explanation

The LLM must not control settlement-critical output.

Both agents must be capable of selecting either side of the market.

A clash should only be opened when their decisions disagree. If both agents choose the same position, the orchestrator should choose another fixture or market.

For a Total Goals 2.5 market, use actual totals-market input such as Over and Under prices. Do not infer a production Over/Under prediction only from 1X2 home/draw/away odds.

Rename `confidenceBps` to `signalScoreBps` unless the score has been backtested and calibrated as a real probability.

### 3. Blink Must Call Anchor

The final POST action must build an Anchor `stake_agent` transaction.

Required flow:

* validate arena exists
* validate arena status is Open
* validate current time is before lock time
* validate selected agent
* derive Arena PDA
* derive vault token account
* derive bettor token account
* derive Position PDA
* construct `stake_agent`
* return the transaction for user signing

Do not transfer funds to a normal treasury wallet as the final implementation.

### 4. Explicit Arena State Machine

Replace `is_resolved` as the primary lifecycle indicator with an explicit status enum such as:

* Draft
* Open
* Locked
* Yielding
* Resolved
* Voided

`stake_agent` must only succeed when:

* arena status is Open
* current on-chain time is before `locks_at`
* amount is greater than zero
* arena has not been resolved or voided

New staking must not be accepted after funds have been deployed to the yield provider unless the accounting model explicitly supports it.

### 5. Per-Bettor Position PDA

Create a Position or Ticket PDA that records:

* arena
* bettor
* selected side
* amount
* claimed status
* bump

Each stake must:

* transfer tokens to the vault
* increment the user Position amount
* increment the correct arena-side total
* emit a stake event

At resolution, store:

* winning side
* distributable amount
* total winning stake
* total claimed
* resolved timestamp

Winner payout calculation:

user payout
= distributable amount × user winning stake ÷ total winning stake

Use `u128` for intermediate multiplication and division.

Do not calculate each payout from the live token account balance because external token transfers can alter that balance.

### 6. Token Transfer Safety

Use `transfer_checked` rather than plain token `transfer`.

Validate:

* token mint
* token decimals
* token account authority
* vault ownership
* configured settlement mint

Use a deterministic Associated Token Account owned by the vault-authority PDA when practical.

### 7. PDA Seed Safety

Do not use arbitrary long `match_id.as_bytes()` as a PDA seed.

A single Solana PDA seed cannot exceed 32 bytes.

Use a deterministic 32-byte hash for the arena PDA seed, for example:

sha256(network + fixture ID + market + line + opening time)

The original fixture ID may still be stored separately for display.

### 8. Separate Authorities

Use separate roles:

* admin authority
* resolver authority

The admin may initialize, pause, or void an arena.

The resolver may only submit verified match results.

Do not let the same unrestricted authority silently control every lifecycle action in the final design.

For the hackathon, a trusted resolver is acceptable if clearly disclosed. Do not describe it as fully trustless unless the program verifies an actual TxLINE proof or authoritative on-chain result account.

### 9. Yield Must Be Optional

Arena settlement must work even when:

* yield is disabled
* no deposit was made
* the yield provider is unavailable
* a yield deposit fails

Recommended abstraction:

* NoYield
* KaminoMock
* KaminoLend

Real Kamino integration must use the currently supported official account layout and instructions. Replacing the mock program ID is not sufficient.

Kamino is an infrastructure enhancement, not the core product.

### 10. Configuration and Portability

Remove all hardcoded local paths such as:

`/Users/derana/CodeDerana/arena-90/...`

Resolve paths relative to the repository or accept them through environment variables.

All environment-specific values must come from validated configuration:

* Solana cluster
* RPC URL
* Arena program ID
* settlement token mint
* public base URL
* TxLINE mode
* resolver authority
* yield provider mode

Production must fail fast when required configuration is missing.

## Required Development Priority

### P0 — System Truth and Portability

* remove hardcoded machine paths
* introduce runtime schema validation
* create canonical Clash Manifest
* use actual totals-market input
* rename confidence to signal score
* separate mock/devnet/live configuration
* document ZeroClaw’s actual current role

### P1 — Complete the Core Vertical Slice

Complete this flow before real oracle or real Kamino work:

initialize arena
→ open arena
→ two wallets stake
→ lock arena
→ trusted resolver resolves
→ winner claims payout

Required implementation:

* state machine
* lock timestamp
* Position PDA
* `claim_payout`
* `void_arena`
* refund mechanism
* payout snapshot
* Blink calling `stake_agent`

### P2 — TxLINE Verification

After the complete payout flow works:

* create live TxLINE adapter
* store source snapshot hash
* implement resolver worker
* verify fixture identity
* verify final status
* reject stale or mismatched results
* implement available TxLINE proof/account verification

### P3 — Real Kamino

Only after the core vertical slice is stable:

* integrate the supported Kamino instruction/account interface
* add no-yield fallback
* add emergency withdrawal path
* add devnet integration tests
* expose honest mock/live status in the UI

## Testing Requirements

### Agents

Test:

* fixture selection by ID
* malformed data rejection
* stale data rejection
* actual totals-market parsing
* both agents selecting both possible sides
* no clash when agents agree
* deterministic hash generation
* identical input producing identical output

### Backend

Test:

* Open, Locked, Resolved, and Voided action responses
* invalid wallet
* invalid arena
* invalid agent
* generated transaction contains the Arena90 program ID
* instruction decodes to `stake_agent`
* correct Arena, vault, token, and Position PDAs
* transaction simulation succeeds on local validator

### Contract

Test:

* multiple bettors
* both agent sides
* repeated stake
* stake after lock rejected
* stake after yield deployment rejected
* wrong mint rejected
* wrong vault rejected
* fake resolver rejected
* double resolution rejected
* exact proportional payout
* duplicate claim rejected
* payout conservation
* rounding dust
* zero winning pool
* cancelled match
* refund
* stale result
* wrong fixture
* no-yield resolution
* yield-provider failure path

## Definition of Done

Arena90 is only considered end-to-end complete when:

1. A fixture is selected from TxLINE data.
2. Both versioned strategy agents analyze the same validated snapshot.
3. The agents select opposing positions.
4. A canonical Clash Manifest is generated.
5. The manifest hash and market are locked into an Anchor arena.
6. A Solana Blink displays the same clash.
7. A user backs ISAGI through the Blink.
8. Another user backs AIKU through the Blink.
9. Both transactions call `stake_agent`.
10. The settlement token enters the program-controlled vault.
11. Staking is rejected after lock time.
12. A verified or explicitly trusted resolver resolves the arena.
13. The contract snapshots the payout pool.
14. Winning users call `claim_payout`.
15. Explorer links prove staking, resolution, and payout.
16. Mock, devnet, and live claims are clearly disclosed.

## Development Rules

Follow this order for every task:

inspect
→ implement
→ lint/typecheck
→ test
→ build
→ report

Do not modify multiple architecture layers without explicit authorization.

Do not implement all priorities in one task.

Complete and verify one phase at a time.

Do not overwrite existing working code without inspection.

Do not make claims that exceed the current verified implementation.