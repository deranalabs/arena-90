pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");

#[program]
pub mod arena_escrow {
    use super::*;

    pub fn initialize_arena(ctx: Context<InitializeArena>, match_id: String) -> Result<()> {
        crate::instructions::initialize_arena::handle_initialize_arena(ctx, match_id)
    }

    pub fn stake_agent(ctx: Context<StakeAgent>, agent: AgentSide, amount: u64) -> Result<()> {
        crate::instructions::stake_agent::handle_stake_agent(ctx, agent, amount)
    }
}
