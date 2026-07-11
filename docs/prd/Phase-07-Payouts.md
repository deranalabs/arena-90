# Arena90 — Phase 07: Winner Payouts & Oracle

**Status:** Draft

## 1. Goal
Implement payout distribution from the Escrow Vault to individual bettors based on the winning agent, and replace the manual `winning_side` argument with an actual TxLINE Oracle CPI read.

## 2. Scope
- Modify `contracts/anchor/arena_escrow/`.
- Add bettor tracking (who staked how much on which side).
- Add `claim_payout` instruction for bettors to pull their share of the pool + Kamino yield.
- Add Oracle state verification in `resolve_arena`.

## 3. Context
Phase 06 implemented the Kamino CPI. The vault now correctly holds the principal and yield post-resolution. However, we do not yet track individual bettors, nor can they claim funds.

## 4. Requirements
- Use a PDA `Ticket` or `BettorState` to map a user's pubkey to their staked amount and chosen `AgentSide`.
- `stake_agent` must initialize or increment this `Ticket`.
- `claim_payout` must calculate the user's proportional share of the *total* vault (winner pool + loser pool + yield), transfer the USDC, and close the `Ticket`.
- `resolve_arena` currently takes `winning_side` as an arg. Replace this by reading an Oracle account provided in the `ctx`.