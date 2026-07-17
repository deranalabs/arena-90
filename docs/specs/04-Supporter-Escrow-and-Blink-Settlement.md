# Arena90 — Supporter Escrow and Blink Settlement Specification

**Status:** Approved
**Last verified:** 2026-07-17

This specification owns the Arena90 V2 Solana supporter vertical slice. It
does not move agent strategy, virtual portfolio execution, accounting, or
winner calculation on-chain.

## 1. Module Ownership

```text
Arena Runtime
  owns snapshots, agent decisions, virtual execution, NAV, winner,
  terminal evidence, and finalResultHash

Supporter Program
  owns supporter SOL, deadlines, positions, proof receipts, settlement,
  claims, refunds, and on-chain replay protection

Solana Actions
  builds unsigned user transactions and read-only metadata

Frontend
  displays state and asks the connected wallet to sign
```

Agents and LLM processes never receive wallet keys, resolver authority,
supporter funds, or arbitrary transaction capability.

## 2. MVP Asset and Network

- Cluster: Solana devnet.
- Support asset: native devnet SOL.
- Demo protocol fee: `0` basis points.
- Program configuration may support `0..500` basis points for later use.
- A nonzero fee applies only to the losing pool after an Alpha/Beta result.
- Mainnet, SPL-token support, yield, and Kamino are excluded.

## 3. Accounts

### Arena

One PDA per canonical Arena90 arena. It stores:

- schema version and immutable arena identity hash;
- live fixture ID and locked manifest hash;
- operator, restricted resolver, treasury, and vault identities;
- backing deadline and lifecycle state;
- Alpha and Beta aggregate backing;
- fee basis points;
- verified terminal-proof receipt identity;
- canonical `finalResultHash`, Alpha NAV, Beta NAV, and winner/draw/void state;
- claimed winning stake, paid amount, and settlement timestamps;
- PDA bumps.

Initialization requires a Live manifest. Replay runs cannot initialize a
supporter arena.

### SupporterPosition

One PDA per arena and supporter wallet. It stores owner, chosen side, total
backed lamports, and claim/refund state.

A wallet chooses Alpha or Beta on its first backing transaction. It may add to
that same side before the deadline, but cannot switch sides or back both.

### TerminalProofReceipt

One PDA per arena. It stores the fixture ID, verified final HOME/AWAY score,
TxLINE proof-data hash, TxLINE root account, verification slot, and consumed
state.

TxLINE validation and Arena settlement use separate transactions. The proven
V2 payload already approaches Solana transaction-size limits; a receipt keeps
the settlement transaction small and auditable.

## 4. Instructions

### `initialize_arena`

Creates the Arena and vault from canonical Live identity, fixture ID, manifest
hash, backing deadline, resolver, treasury, and fee. Rejects Replay identity,
past deadlines, invalid fee, and duplicate identity.

### `back_agent`

Transfers user-signed SOL into the arena vault before the deadline. Creates or
adds to the wallet position. Rejects zero amount, late backing, side changes,
closed state, and arithmetic overflow.

### `lock_arena`

Permissionless after the immutable deadline. It prevents further backing.
Normal automation calls it from the resolver process, but correctness does not
depend on a privileged caller.

### `verify_txline_terminal`

Permissionless proof submission for a locked arena. The program:

1. accepts only the fixed TxLINE devnet program;
2. requires a TxLINE-owned `daily_scores_roots` PDA;
3. accepts only `validate_stat_v2` terminal-score validation;
4. requires the payload fixture ID to equal the Arena fixture ID;
5. requires exactly score keys `1` and `2`, nonnegative values, and period
   `100` for both final score leaves;
6. constructs equality predicates internally rather than trusting a caller's
   arbitrary strategy;
7. invokes TxLINE and accepts only return data from TxLINE encoding `true`;
8. records a one-time terminal proof receipt and proof-data hash.

The TxLINE V2 on-chain instruction does not expose the API request sequence as
an explicit argument. Provider `seq` remains part of Arena90 terminal evidence,
but must not be described as independently checked by this program.

### `settle_arena`

Restricted resolver only. Requires a locked arena and unused terminal proof
receipt. Stores the runtime's canonical `finalResultHash`, final Alpha/Beta NAV,
and `ALPHA`, `BETA`, or `DRAW` result. The receipt proves terminal football
evidence; the resolver attests the deterministic Arena90 competition result.
Neither source substitutes for the other.

Settlement is one-time. The proof receipt becomes consumed. Duplicate or
unauthorized settlement fails.

### `void_arena`

Restricted resolver only and unavailable after settlement. Records a bounded
reason code and makes every position refundable. It cannot select a winner.

### `claim`

User-signed and one-time per position.

- Draw or void: refund the position's full principal.
- Alpha/Beta result with no backing on the winning side: refund every
  position's full principal.
- Winning position: receive proportional distributable pool.
- Losing position: not claimable.

For a winning side with backing:

```text
fee = floor(losingPool * feeBps / 10000)
distributablePool = alphaPool + betaPool - fee
payout = floor(positionAmount * distributablePool / winningPool)
```

All intermediate multiplication uses `u128` with checked conversion. The final
unclaimed winning position receives remaining distributable lamports so integer
rounding cannot strand supporter funds. Protocol fee transfers only to the
configured treasury. With demo fee `0`, no protocol fee is taken.

## 5. Solana Action Interface

The Action module provides read-only metadata plus unsigned transactions for:

- Back Alpha;
- Back Beta;
- View Arena;
- Claim or Refund when eligible.

The server never signs for a supporter, chooses a wallet, claims automatically,
or exposes resolver transactions publicly. Action inputs are schema-validated,
amount-bounded, origin-checked, and built from current on-chain state.

## 6. Runtime and Resolver Interface

The restricted resolver consumes only persisted canonical runtime output. It
may submit `lock_arena`, `verify_txline_terminal`, and `settle_arena`; it cannot
change decisions, NAV, winner rules, supporter positions, or proof contents.

Required settlement fields are:

- arena identity hash and manifest hash;
- fixture ID;
- terminal evidence hash and provider sequence for public provenance;
- TxLINE proof payload and root account;
- `finalResultHash`;
- Alpha and Beta final NAV;
- winner or draw.

Resolver keys stay outside Git, frontend, ZeroClaw, LLM prompts, public logs,
and immutable release artifacts.

## 7. Required Tests and Acceptance

Program tests must cover:

- initialize, repeat initialize, and Replay rejection;
- first backing, same-side add, opposite-side rejection, zero amount, and late
  backing;
- permissionless deadline lock and post-lock rejection;
- valid TxLINE CPI receipt, wrong fixture/root/program/period/stat keys,
  tampered proof, false return, and duplicate receipt;
- authorized settlement, unauthorized/duplicate settlement, proof consumption,
  and final-result storage;
- Alpha payout, Beta payout, draw refund, void refund, no-winning-supporter
  refund, duplicate claim, losing claim, fee, rounding, and overflow;
- supporter funds never entering agent capital or runtime accounting.

Vertical acceptance additionally requires Action GET/POST tests, one wallet
backing on devnet, terminal receipt and settlement transactions, claim/refund,
frontend transaction evidence, and matching `finalResultHash` across runtime,
program, and proof UI.
