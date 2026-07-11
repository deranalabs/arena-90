# Arena90 — Phase 06: Anchor Kamino Yield & TxLINE Resolution

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Integrate Kamino Finance (`klend` / Kamino Lending) into the Arena90 Anchor escrow contract so staked USDC generates yield during the 90-minute match, and implement the Settlement instruction to resolve the clash based on the TxLINE Oracle CPI.

## 2. Scope
- Modify `contracts/anchor/arena_escrow/`.
- **Kamino CPI Integration:** Implement a `deposit_to_kamino` instruction using the `@kamino-finance/klend-sdk` / Kamino Rust crate logic. The Escrow PDA must CPI into the Kamino main/devnet lending vault to deposit idle USDC and receive K-Tokens.
- **TxLINE Resolution:** Implement a `resolve_arena` instruction that simulates or prepares for an oracle CPI to read the match state and payout the winning faction (principal + yield).

## 3. User Stories
- **US-6.1:** As the Protocol, I want user funds (USDC) held in the Escrow PDA to be deposited into Kamino Lend during the 90-minute match to earn interest.
- **US-6.2:** As a User who backed the winning agent, when `resolve_arena` is called, I want my USDC + the opposing side's lost USDC + the Kamino yield to be withdrawable.

## 4. Functional Requirements
- **FR-1:** Research and add the correct `kamino-lending` Rust dependency to `Cargo.toml`. *(Note: Kamino's documentation lists SDKs, but for on-chain Anchor Rust CPI, we need to correctly declare the external program ID and CPI accounts).*
- **FR-2:** Create `deposit_to_kamino.rs` instruction. The Escrow `vault_authority` PDA must sign the CPI transaction to transfer USDC from `vault_token_account` to Kamino's reserve, receiving kTokens in return.
- **FR-3:** Modify `Arena` state to track `k_token_mint` and `k_token_account`.
- **FR-4:** Create `resolve_arena.rs` instruction that accepts the winning `AgentSide` and triggers a Kamino withdrawal CPI, exchanging kTokens back to USDC before distributing them.

## 5. Security & Isolation Constraints
- **PDA Signatures:** The escrow `vault_authority` PDA MUST sign the Kamino CPI. Do not pass user signers to the Kamino interaction.
- **No Private Keys:** Do not hardcode testnet private keys.
- **Mock Interfaces:** If Kamino's Rust CPI is too complex or missing public Devnet deployment for the hackathon, Codex must create an isolated *Mock Kamino Program* interface in the same workspace to demonstrate the CPI flow without stalling the build.

## 6. Definition of Done
- The Anchor program compiles (`anchor build`) with the new Kamino CPI or Mock CPI logic.
- A basic Typescript test (`anchor test`) invokes the stake and then successfully deposits to the (mocked/real) Kamino vault.
- Code conforms to Phase 04 standards and passes `cargo clippy`.

---
*Note for Codex/Agents:* Please read `docs/references/anchor-basics.md` and check Kamino's devnet availability before executing. If `kamino-lending` Rust crate is unavailable or closed-source, fallback to a Mock CPI interface to prove the architecture.