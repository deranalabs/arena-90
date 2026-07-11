use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::ErrorCode, state::Arena};

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct InitializeArena<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Arena::INIT_SPACE,
        seeds = [ARENA_SEED, match_id.as_bytes()],
        bump
    )]
    pub arena: Account<'info, Arena>,
    pub usdc_mint: Account<'info, Mint>,
    /// CHECK: PDA authority only signs via program seeds.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, arena.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize_arena(ctx: Context<InitializeArena>, match_id: String) -> Result<()> {
    require!(
        !match_id.is_empty() && match_id.len() <= MAX_MATCH_ID_LEN,
        ErrorCode::InvalidMatchId
    );

    let arena = &mut ctx.accounts.arena;
    arena.authority = ctx.accounts.payer.key();
    arena.usdc_mint = ctx.accounts.usdc_mint.key();
    arena.vault_token_account = ctx.accounts.vault_token_account.key();
    arena.kamino_program = Pubkey::default();
    arena.kamino_reserve = Pubkey::default();
    arena.k_token_mint = Pubkey::default();
    arena.k_token_account = Pubkey::default();
    arena.arena_bump = ctx.bumps.arena;
    arena.vault_authority_bump = ctx.bumps.vault_authority;
    arena.isagi_stake = 0;
    arena.aiku_stake = 0;
    arena.kamino_deposited_amount = 0;
    arena.kamino_k_tokens_received = 0;
    arena.kamino_withdrawn_amount = 0;
    arena.yield_earned = 0;
    arena.winning_side = None;
    arena.is_resolved = false;
    arena.match_id = match_id;

    msg!("Arena initialized for match {}", arena.match_id);
    Ok(())
}
