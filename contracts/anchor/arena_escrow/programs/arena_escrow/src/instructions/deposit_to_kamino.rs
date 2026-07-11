use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::ErrorCode, state::Arena};

#[derive(Accounts)]
pub struct DepositToKamino<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.match_id.as_bytes()],
        bump = arena.arena_bump,
        has_one = authority,
        has_one = usdc_mint,
        has_one = vault_token_account
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

pub fn handle_deposit_to_kamino(ctx: Context<DepositToKamino>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidKaminoDepositAmount);
    require!(!ctx.accounts.arena.is_resolved, ErrorCode::ArenaResolved);

    let first_deposit = ctx.accounts.arena.kamino_program == Pubkey::default();
    if !first_deposit {
        require_keys_eq!(
            ctx.accounts.arena.kamino_program,
            ctx.accounts.kamino_program.key(),
            ErrorCode::KaminoAccountMismatch
        );
        require_keys_eq!(
            ctx.accounts.arena.kamino_reserve,
            ctx.accounts.kamino_reserve.key(),
            ErrorCode::KaminoAccountMismatch
        );
        require_keys_eq!(
            ctx.accounts.arena.k_token_mint,
            ctx.accounts.k_token_mint.key(),
            ErrorCode::KaminoAccountMismatch
        );
        require_keys_eq!(
            ctx.accounts.arena.k_token_account,
            ctx.accounts.k_token_account.key(),
            ErrorCode::KaminoAccountMismatch
        );
    }

    let k_tokens_before = ctx.accounts.k_token_account.amount;
    let arena_key = ctx.accounts.arena.key();
    let signer_seeds: &[&[u8]] = &[
        VAULT_AUTHORITY_SEED,
        arena_key.as_ref(),
        &[ctx.accounts.arena.vault_authority_bump],
    ];
    let cpi_accounts = kamino_mock::cpi::accounts::Deposit {
        depositor_authority: ctx.accounts.vault_authority.to_account_info(),
        liquidity_mint: ctx.accounts.usdc_mint.to_account_info(),
        liquidity_source: ctx.accounts.vault_token_account.to_account_info(),
        reserve_authority: ctx.accounts.kamino_reserve_authority.to_account_info(),
        liquidity_vault: ctx.accounts.kamino_reserve.to_account_info(),
        receipt_mint: ctx.accounts.k_token_mint.to_account_info(),
        receipt_destination: ctx.accounts.k_token_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    kamino_mock::cpi::deposit(
        CpiContext::new_with_signer(
            ctx.accounts.kamino_program.key(),
            cpi_accounts,
            &[signer_seeds],
        ),
        amount,
    )?;

    ctx.accounts.k_token_account.reload()?;
    let k_tokens_received = ctx
        .accounts
        .k_token_account
        .amount
        .checked_sub(k_tokens_before)
        .ok_or(ErrorCode::KaminoTrackingOverflow)?;

    let arena = &mut ctx.accounts.arena;
    if first_deposit {
        arena.kamino_program = ctx.accounts.kamino_program.key();
        arena.kamino_reserve = ctx.accounts.kamino_reserve.key();
        arena.k_token_mint = ctx.accounts.k_token_mint.key();
        arena.k_token_account = ctx.accounts.k_token_account.key();
    }
    arena.kamino_deposited_amount = arena
        .kamino_deposited_amount
        .checked_add(amount)
        .ok_or(ErrorCode::KaminoTrackingOverflow)?;
    arena.kamino_k_tokens_received = arena
        .kamino_k_tokens_received
        .checked_add(k_tokens_received)
        .ok_or(ErrorCode::KaminoTrackingOverflow)?;

    msg!(
        "Escrow deposited {} USDC and received {} kTokens",
        amount,
        k_tokens_received
    );
    Ok(())
}
