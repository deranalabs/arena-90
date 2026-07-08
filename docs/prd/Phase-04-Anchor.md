# Arena90 — Phase 04: Anchor Escrow Contract

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Write the Solana Smart Contract that holds the USDC bets and resolves the winner.

## 2. Scope
- Anchor program with initialization and staking logic.
- *Out of Scope:* Kamino integration (deferred to Phase 5) and TxLINE CPI (deferred to Phase 6).

## 3. User Stories
- **US-4.1:** As the Protocol, I want an Escrow PDA (Program Derived Address) to hold user funds securely so that no human operator has custody.
- **US-4.2:** As a User, I want to call `stake_agent` and transfer my USDC into the Escrow PDA.

## 4. Functional Requirements
- **FR-1:** Modify `/contracts/anchor/arena_escrow/programs/arena_escrow/src/lib.rs`.
- **FR-2:** Implement `initialize_arena` instruction to create the arena state account.
- **FR-3:** Implement `stake_agent` instruction to transfer SPL tokens from the user to the PDA.

## 5. Definition of Done
- `anchor build` compiles successfully with 0 errors.
- Basic test in `tests/arena_escrow.ts` passes.