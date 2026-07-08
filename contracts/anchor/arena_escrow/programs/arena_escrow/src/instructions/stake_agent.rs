use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{AgentSide, Arena},
};

#[derive(Accounts)]
pub struct StakeAgent<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.match_id.as_bytes()],
        bump = arena.arena_bump,
        has_one = usdc_mint,
        has_one = vault_token_account
    )]
    pub arena: Account<'info, Arena>,
    #[account(mut)]
    pub bettor: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = bettor
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: PDA authority for the escrow vault token account.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, arena.key().as_ref()],
        bump = arena.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_stake_agent(
    ctx: Context<StakeAgent>,
    agent: AgentSide,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidStakeAmount);

    let cpi_accounts = Transfer {
        from: ctx.accounts.bettor_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.bettor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let arena = &mut ctx.accounts.arena;
    match agent {
        AgentSide::Isagi => {
            arena.isagi_stake = arena
                .isagi_stake
                .checked_add(amount)
                .ok_or(ErrorCode::StakeOverflow)?;
        }
        AgentSide::Aiku => {
            arena.aiku_stake = arena
                .aiku_stake
                .checked_add(amount)
                .ok_or(ErrorCode::StakeOverflow)?;
        }
    }

    msg!("Stake recorded for {:?}: {}", agent, amount);
    Ok(())
}
