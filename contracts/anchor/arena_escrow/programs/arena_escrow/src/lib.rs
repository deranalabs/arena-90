pub mod constants;
pub mod error;
pub mod instructions;
pub mod settlement;
pub mod state;
pub mod txline;

use anchor_lang::prelude::*;
pub use instructions::*;
pub use state::*;
pub use txline::StatValidationInput;

declare_id!("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");

#[program]
pub mod arena_escrow {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_arena(
        ctx: Context<InitializeArena>,
        identity_hash: [u8; 32],
        manifest_hash: [u8; 32],
        fixture_id: i64,
        backing_deadline: i64,
        resolver: Pubkey,
        treasury: Pubkey,
        fee_bps: u16,
        mode: ArenaMode,
    ) -> Result<()> {
        instructions::handle_initialize_arena(
            ctx,
            identity_hash,
            manifest_hash,
            fixture_id,
            backing_deadline,
            resolver,
            treasury,
            fee_bps,
            mode,
        )
    }

    pub fn back_agent(ctx: Context<BackAgent>, side: AgentSide, amount: u64) -> Result<()> {
        instructions::handle_back_agent(ctx, side, amount)
    }

    pub fn lock_arena(ctx: Context<LockArena>) -> Result<()> {
        instructions::handle_lock_arena(ctx)
    }

    pub fn verify_txline_terminal(
        ctx: Context<VerifyTxlineTerminal>,
        payload: StatValidationInput,
    ) -> Result<()> {
        instructions::handle_verify_txline_terminal(ctx, payload)
    }

    pub fn settle_arena(
        ctx: Context<SettleArena>,
        final_result_hash: [u8; 32],
        alpha_nav: u64,
        beta_nav: u64,
        result: CompetitionResult,
    ) -> Result<()> {
        instructions::handle_settle_arena(ctx, final_result_hash, alpha_nav, beta_nav, result)
    }

    pub fn void_arena(ctx: Context<VoidArena>, reason: u16) -> Result<()> {
        instructions::handle_void_arena(ctx, reason)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::handle_claim(ctx)
    }
}
