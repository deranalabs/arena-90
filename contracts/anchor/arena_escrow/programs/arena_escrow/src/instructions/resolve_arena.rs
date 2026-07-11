use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{AgentSide, Arena},
};

#[derive(Accounts)]
pub struct ResolveArena<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.match_id.as_bytes()],
        bump = arena.arena_bump,
        has_one = authority,
        has_one = usdc_mint,
        has_one = vault_token_account,
        has_one = kamino_program @ ErrorCode::KaminoAccountMismatch,
        has_one = kamino_reserve @ ErrorCode::KaminoAccountMismatch,
        has_one = k_token_mint @ ErrorCode::KaminoAccountMismatch,
        has_one = k_token_account @ ErrorCode::KaminoAccountMismatch
    )]
    pub arena: Box<Account<'info, Arena>>,
    pub authority: Signer<'info>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// CHECK: Escrow PDA validated by seeds and used as the CPI signer.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, arena.key().as_ref()],
        bump = arena.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,
    pub kamino_program: Program<'info, kamino_mock::program::KaminoMock>,
    /// CHECK: Kamino mock PDA is validated again by the invoked program.
    #[account(
        seeds = [kamino_mock::RESERVE_AUTHORITY_SEED, usdc_mint.key().as_ref()],
        bump,
        seeds::program = kamino_program.key()
    )]
    pub kamino_reserve_authority: UncheckedAccount<'info>,
    #[account(mut, token::mint = usdc_mint)]
    pub kamino_reserve: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub k_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        token::mint = k_token_mint,
        token::authority = vault_authority
    )]
    pub k_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_resolve_arena(ctx: Context<ResolveArena>, winning_side: AgentSide) -> Result<()> {
    require!(!ctx.accounts.arena.is_resolved, ErrorCode::ArenaResolved);
    let receipt_amount = ctx.accounts.arena.kamino_k_tokens_received;
    require!(receipt_amount > 0, ErrorCode::NothingToWithdraw);

    let vault_balance_before = ctx.accounts.vault_token_account.amount;
    let arena_key = ctx.accounts.arena.key();
    let signer_seeds: &[&[u8]] = &[
        VAULT_AUTHORITY_SEED,
        arena_key.as_ref(),
        &[ctx.accounts.arena.vault_authority_bump],
    ];
    let cpi_accounts = kamino_mock::cpi::accounts::Withdraw {
        redeemer_authority: ctx.accounts.vault_authority.to_account_info(),
        liquidity_mint: ctx.accounts.usdc_mint.to_account_info(),
        reserve_authority: ctx.accounts.kamino_reserve_authority.to_account_info(),
        liquidity_vault: ctx.accounts.kamino_reserve.to_account_info(),
        receipt_mint: ctx.accounts.k_token_mint.to_account_info(),
        receipt_source: ctx.accounts.k_token_account.to_account_info(),
        liquidity_destination: ctx.accounts.vault_token_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    kamino_mock::cpi::withdraw(
        CpiContext::new_with_signer(
            ctx.accounts.kamino_program.key(),
            cpi_accounts,
            &[signer_seeds],
        ),
        receipt_amount,
    )?;

    ctx.accounts.vault_token_account.reload()?;
    let withdrawn_amount = ctx
        .accounts
        .vault_token_account
        .amount
        .checked_sub(vault_balance_before)
        .ok_or(ErrorCode::KaminoTrackingOverflow)?;
    require!(
        withdrawn_amount >= ctx.accounts.arena.kamino_deposited_amount,
        ErrorCode::PrincipalLoss
    );

    let arena = &mut ctx.accounts.arena;
    arena.kamino_withdrawn_amount = withdrawn_amount;
    arena.yield_earned = withdrawn_amount
        .checked_sub(arena.kamino_deposited_amount)
        .ok_or(ErrorCode::KaminoTrackingOverflow)?;
    arena.winning_side = Some(winning_side);
    arena.is_resolved = true;

    msg!(
        "Arena resolved for {:?}: withdrew {} USDC including {} yield",
        winning_side,
        withdrawn_amount,
        arena.yield_earned
    );
    Ok(())
}
