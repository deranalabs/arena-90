use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

// Public localnet program id generated for the Arena90 mock; it is not a secret.
declare_id!("YLpCb4gCq2NCn3PsxJog7in3J9TZFghvFLojBCgxrh3");

pub const RESERVE_AUTHORITY_SEED: &[u8] = b"reserve-authority";

#[program]
pub mod kamino_mock {
    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, KaminoMockError::InvalidAmount);

        let liquidity_before = ctx.accounts.liquidity_vault.amount;
        let receipt_supply = ctx.accounts.receipt_mint.supply;
        let receipt_amount = if receipt_supply == 0 {
            amount
        } else {
            require!(liquidity_before > 0, KaminoMockError::InvalidReserve);
            proportional_amount(amount, receipt_supply, liquidity_before)?
        };
        require!(receipt_amount > 0, KaminoMockError::DepositTooSmall);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.liquidity_source.to_account_info(),
                    to: ctx.accounts.liquidity_vault.to_account_info(),
                    authority: ctx.accounts.depositor_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        let liquidity_mint_key = ctx.accounts.liquidity_mint.key();
        let signer_seeds: &[&[u8]] = &[
            RESERVE_AUTHORITY_SEED,
            liquidity_mint_key.as_ref(),
            &[ctx.bumps.reserve_authority],
        ];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.receipt_mint.to_account_info(),
                    to: ctx.accounts.receipt_destination.to_account_info(),
                    authority: ctx.accounts.reserve_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            receipt_amount,
        )?;

        msg!(
            "Kamino mock deposited {} and minted {} kTokens",
            amount,
            receipt_amount
        );
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, receipt_amount: u64) -> Result<()> {
        require!(receipt_amount > 0, KaminoMockError::InvalidAmount);
        let receipt_supply = ctx.accounts.receipt_mint.supply;
        require!(receipt_supply > 0, KaminoMockError::InvalidReserve);

        // Reserve donations increase the amount redeemable per receipt token, modeling yield.
        let liquidity_amount = proportional_amount(
            receipt_amount,
            ctx.accounts.liquidity_vault.amount,
            receipt_supply,
        )?;

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Burn {
                    mint: ctx.accounts.receipt_mint.to_account_info(),
                    from: ctx.accounts.receipt_source.to_account_info(),
                    authority: ctx.accounts.redeemer_authority.to_account_info(),
                },
            ),
            receipt_amount,
        )?;

        let liquidity_mint_key = ctx.accounts.liquidity_mint.key();
        let signer_seeds: &[&[u8]] = &[
            RESERVE_AUTHORITY_SEED,
            liquidity_mint_key.as_ref(),
            &[ctx.bumps.reserve_authority],
        ];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.liquidity_vault.to_account_info(),
                    to: ctx.accounts.liquidity_destination.to_account_info(),
                    authority: ctx.accounts.reserve_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            liquidity_amount,
        )?;

        msg!(
            "Kamino mock burned {} kTokens and returned {}",
            receipt_amount,
            liquidity_amount
        );
        Ok(())
    }

    pub fn realize_loss(ctx: Context<RealizeLoss>, amount: u64) -> Result<()> {
        require!(amount > 0, KaminoMockError::InvalidAmount);

        let liquidity_mint_key = ctx.accounts.liquidity_mint.key();
        let signer_seeds: &[&[u8]] = &[
            RESERVE_AUTHORITY_SEED,
            liquidity_mint_key.as_ref(),
            &[ctx.bumps.reserve_authority],
        ];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.liquidity_vault.to_account_info(),
                    to: ctx.accounts.loss_destination.to_account_info(),
                    authority: ctx.accounts.reserve_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
        )?;

        msg!("Kamino mock realized {} liquidity loss", amount);
        Ok(())
    }
}

fn proportional_amount(value: u64, numerator: u64, denominator: u64) -> Result<u64> {
    let result = u128::from(value)
        .checked_mul(u128::from(numerator))
        .ok_or(KaminoMockError::MathOverflow)?
        .checked_div(u128::from(denominator))
        .ok_or(KaminoMockError::InvalidReserve)?;
    u64::try_from(result).map_err(|_| error!(KaminoMockError::MathOverflow))
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub depositor_authority: Signer<'info>,
    pub liquidity_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = depositor_authority
    )]
    pub liquidity_source: Account<'info, TokenAccount>,
    /// CHECK: PDA constrained by seeds and used only as a token authority.
    #[account(
        seeds = [RESERVE_AUTHORITY_SEED, liquidity_mint.key().as_ref()],
        bump
    )]
    pub reserve_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = reserve_authority
    )]
    pub liquidity_vault: Account<'info, TokenAccount>,
    #[account(mut, mint::authority = reserve_authority)]
    pub receipt_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = receipt_mint,
        token::authority = depositor_authority
    )]
    pub receipt_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub redeemer_authority: Signer<'info>,
    pub liquidity_mint: Account<'info, Mint>,
    /// CHECK: PDA constrained by seeds and used only as a token authority.
    #[account(
        seeds = [RESERVE_AUTHORITY_SEED, liquidity_mint.key().as_ref()],
        bump
    )]
    pub reserve_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = reserve_authority
    )]
    pub liquidity_vault: Account<'info, TokenAccount>,
    #[account(mut, mint::authority = reserve_authority)]
    pub receipt_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = receipt_mint,
        token::authority = redeemer_authority
    )]
    pub receipt_source: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = redeemer_authority
    )]
    pub liquidity_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RealizeLoss<'info> {
    pub loss_authority: Signer<'info>,
    #[account(mint::authority = loss_authority)]
    pub liquidity_mint: Account<'info, Mint>,
    /// CHECK: PDA constrained by seeds and used only as a token authority.
    #[account(
        seeds = [RESERVE_AUTHORITY_SEED, liquidity_mint.key().as_ref()],
        bump
    )]
    pub reserve_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = reserve_authority
    )]
    pub liquidity_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = liquidity_mint,
        token::authority = loss_authority
    )]
    pub loss_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum KaminoMockError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Reserve exchange-rate state is invalid")]
    InvalidReserve,
    #[msg("Amount overflowed during exchange-rate calculation")]
    MathOverflow,
    #[msg("Deposit is too small to mint a receipt token")]
    DepositTooSmall,
}
