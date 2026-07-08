# Reference: Anchor Framework Basics

**Source:** https://www.anchor-lang.com/docs/high-level-overview

## Core Concepts
Anchor is a framework for Solana's Sealevel runtime providing several Rust macros to reduce boilerplate.

### Key Macros
- `declare_id!`: Specifies the on-chain program address.
- `#[program]`: Annotates the module with instruction handlers. Each public function is an instruction.
- `#[derive(Accounts)]`: Validates and deserializes the accounts an instruction requires.
- `#[account]`: Defines custom account types, managing their 8-byte discriminator automatically.

### Context
Instruction handlers receive a `Context<T>` where `T` implements `Accounts`. 
Access fields via:
- `ctx.accounts.<account_name>`
- `ctx.program_id`

### Best Practices
- Never use generic AccountInfo without explicit validation. Always use specific Anchor account types like `Account<'info, T>` to enforce structural and discriminator checks.