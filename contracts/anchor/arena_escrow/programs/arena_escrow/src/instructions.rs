use crate::{
    constants::*,
    error::ArenaError,
    settlement,
    state::*,
    txline::{self, StatValidationInput},
};
use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};
use solana_sha256_hasher::hash;

#[derive(Accounts)]
#[instruction(identity_hash: [u8; 32])]
pub struct InitializeArena<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(
        init,
        payer = operator,
        space = 8 + Arena::INIT_SPACE,
        seeds = [ARENA_SEED, identity_hash.as_ref()],
        bump
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        init,
        payer = operator,
        space = 8 + SupporterVault::INIT_SPACE,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, SupporterVault>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_initialize_arena(
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
    require!(mode == ArenaMode::Live, ArenaError::ReplayUnsupported);
    require!(fixture_id > 0, ArenaError::InvalidFixtureId);
    require!(
        backing_deadline > Clock::get()?.unix_timestamp,
        ArenaError::InvalidDeadline
    );
    require!(fee_bps <= MAX_FEE_BPS, ArenaError::InvalidFee);
    require!(
        resolver != Pubkey::default() && treasury != Pubkey::default(),
        ArenaError::InvalidAuthority
    );

    let vault = &mut ctx.accounts.vault;
    vault.arena = ctx.accounts.arena.key();
    vault.bump = ctx.bumps.vault;

    let arena = &mut ctx.accounts.arena;
    arena.schema_version = SCHEMA_VERSION;
    arena.identity_hash = identity_hash;
    arena.manifest_hash = manifest_hash;
    arena.fixture_id = fixture_id;
    arena.operator = ctx.accounts.operator.key();
    arena.resolver = resolver;
    arena.treasury = treasury;
    arena.vault = vault.key();
    arena.backing_deadline = backing_deadline;
    arena.state = ArenaState::Open;
    arena.alpha_pool = 0;
    arena.beta_pool = 0;
    arena.fee_bps = fee_bps;
    arena.terminal_proof = Pubkey::default();
    arena.final_result_hash = [0; 32];
    arena.alpha_nav = 0;
    arena.beta_nav = 0;
    arena.result = None;
    arena.void_reason = 0;
    arena.fee_paid = 0;
    arena.claimed_winning_stake = 0;
    arena.paid_amount = 0;
    arena.settled_at = 0;
    arena.arena_bump = ctx.bumps.arena;
    arena.vault_bump = ctx.bumps.vault;
    Ok(())
}

#[derive(Accounts)]
pub struct BackAgent<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump,
        has_one = vault
    )]
    pub arena: Account<'info, Arena>,
    #[account(mut)]
    pub supporter: Signer<'info>,
    #[account(
        init_if_needed,
        payer = supporter,
        space = 8 + SupporterPosition::INIT_SPACE,
        seeds = [POSITION_SEED, arena.key().as_ref(), supporter.key().as_ref()],
        bump
    )]
    pub position: Account<'info, SupporterPosition>,
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump = arena.vault_bump
    )]
    pub vault: Account<'info, SupporterVault>,
    pub system_program: Program<'info, System>,
}

pub fn handle_back_agent(ctx: Context<BackAgent>, side: AgentSide, amount: u64) -> Result<()> {
    require!(amount > 0, ArenaError::InvalidAmount);
    require!(
        ctx.accounts.arena.state == ArenaState::Open,
        ArenaError::ArenaNotOpen
    );
    require!(
        Clock::get()?.unix_timestamp < ctx.accounts.arena.backing_deadline,
        ArenaError::BackingClosed
    );

    let position = &mut ctx.accounts.position;
    if position.owner == Pubkey::default() {
        position.arena = ctx.accounts.arena.key();
        position.owner = ctx.accounts.supporter.key();
        position.side = side;
        position.amount = 0;
        position.claimed = false;
        position.bump = ctx.bumps.position;
    } else {
        require!(position.side == side, ArenaError::SideChangeForbidden);
    }

    invoke(
        &system_instruction::transfer(
            &ctx.accounts.supporter.key(),
            &ctx.accounts.vault.key(),
            amount,
        ),
        &[
            ctx.accounts.supporter.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    position.amount = position
        .amount
        .checked_add(amount)
        .ok_or(ArenaError::MathOverflow)?;
    let pool = match side {
        AgentSide::Alpha => &mut ctx.accounts.arena.alpha_pool,
        AgentSide::Beta => &mut ctx.accounts.arena.beta_pool,
    };
    *pool = pool.checked_add(amount).ok_or(ArenaError::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct LockArena<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump
    )]
    pub arena: Account<'info, Arena>,
}

pub fn handle_lock_arena(ctx: Context<LockArena>) -> Result<()> {
    require!(
        ctx.accounts.arena.state == ArenaState::Open,
        ArenaError::ArenaNotOpen
    );
    require!(
        Clock::get()?.unix_timestamp >= ctx.accounts.arena.backing_deadline,
        ArenaError::LockTooEarly
    );
    ctx.accounts.arena.state = ArenaState::Locked;
    Ok(())
}

#[derive(Accounts)]
pub struct VerifyTxlineTerminal<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        init,
        payer = payer,
        space = 8 + TerminalProofReceipt::INIT_SPACE,
        seeds = [TERMINAL_PROOF_SEED, arena.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, TerminalProofReceipt>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Fixed TxLINE devnet executable.
    #[account(address = TXLINE_DEVNET_PROGRAM_ID, executable)]
    pub txline_program: UncheckedAccount<'info>,
    /// CHECK: Ownership and canonical PDA are checked before CPI.
    #[account(owner = TXLINE_DEVNET_PROGRAM_ID)]
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_verify_txline_terminal(
    ctx: Context<VerifyTxlineTerminal>,
    payload: StatValidationInput,
) -> Result<()> {
    require!(
        ctx.accounts.arena.state == ArenaState::Locked,
        ArenaError::ArenaNotLocked
    );
    let (home_score, away_score) =
        txline::validate_terminal_payload(&payload, ctx.accounts.arena.fixture_id)?;

    let epoch_day = payload
        .ts
        .checked_div(86_400_000)
        .ok_or(ArenaError::InvalidTerminalProof)?;
    let epoch_day =
        u16::try_from(epoch_day).map_err(|_| error!(ArenaError::InvalidTerminalProof))?;
    let (expected_root, _) = Pubkey::find_program_address(
        &[b"daily_scores_roots", &epoch_day.to_le_bytes()],
        &TXLINE_DEVNET_PROGRAM_ID,
    );
    require_keys_eq!(
        ctx.accounts.daily_scores_merkle_roots.key(),
        expected_root,
        ArenaError::InvalidTerminalProof
    );

    let proof_data = txline::verify(
        &payload,
        ctx.accounts.daily_scores_merkle_roots.to_account_info(),
        ctx.accounts.txline_program.to_account_info(),
    )?;
    let receipt = &mut ctx.accounts.receipt;
    receipt.arena = ctx.accounts.arena.key();
    receipt.fixture_id = ctx.accounts.arena.fixture_id;
    receipt.home_score = home_score;
    receipt.away_score = away_score;
    receipt.proof_data_hash = hash(&proof_data).to_bytes();
    receipt.txline_root = ctx.accounts.daily_scores_merkle_roots.key();
    receipt.verification_slot = Clock::get()?.slot;
    receipt.consumed = false;
    receipt.bump = ctx.bumps.receipt;
    ctx.accounts.arena.terminal_proof = receipt.key();
    Ok(())
}

#[derive(Accounts)]
pub struct SettleArena<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump,
        has_one = resolver,
        has_one = vault,
        has_one = treasury @ ArenaError::TreasuryMismatch,
        has_one = terminal_proof
    )]
    pub arena: Account<'info, Arena>,
    pub resolver: Signer<'info>,
    #[account(
        mut,
        seeds = [TERMINAL_PROOF_SEED, arena.key().as_ref()],
        bump = terminal_proof.bump,
        constraint = terminal_proof.arena == arena.key() @ ArenaError::InvalidTerminalProof
    )]
    pub terminal_proof: Account<'info, TerminalProofReceipt>,
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump = arena.vault_bump
    )]
    pub vault: Account<'info, SupporterVault>,
    /// CHECK: Address is constrained to the configured treasury.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
}

pub fn handle_settle_arena(
    ctx: Context<SettleArena>,
    final_result_hash: [u8; 32],
    alpha_nav: u64,
    beta_nav: u64,
    result: CompetitionResult,
) -> Result<()> {
    require!(
        ctx.accounts.arena.state == ArenaState::Locked,
        ArenaError::ArenaNotLocked
    );
    require!(
        !ctx.accounts.terminal_proof.consumed,
        ArenaError::ProofAlreadyConsumed
    );
    require!(
        final_result_hash != [0; 32],
        ArenaError::InvalidFinalResultHash
    );

    ctx.accounts.arena.result = Some(result);
    let fee = settlement::terms(&ctx.accounts.arena)?.map_or(0, |terms| terms.fee);
    if fee > 0 {
        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            fee,
        )?;
    }

    let arena = &mut ctx.accounts.arena;
    arena.final_result_hash = final_result_hash;
    arena.alpha_nav = alpha_nav;
    arena.beta_nav = beta_nav;
    arena.fee_paid = fee;
    arena.state = ArenaState::Settled;
    arena.settled_at = Clock::get()?.unix_timestamp;
    ctx.accounts.terminal_proof.consumed = true;
    Ok(())
}

#[derive(Accounts)]
pub struct VoidArena<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump,
        has_one = resolver
    )]
    pub arena: Account<'info, Arena>,
    pub resolver: Signer<'info>,
}

pub fn handle_void_arena(ctx: Context<VoidArena>, reason: u16) -> Result<()> {
    require!(reason > 0, ArenaError::InvalidVoidReason);
    require!(
        matches!(
            ctx.accounts.arena.state,
            ArenaState::Open | ArenaState::Locked
        ),
        ArenaError::AlreadyFinalized
    );
    let arena = &mut ctx.accounts.arena;
    arena.state = ArenaState::Void;
    arena.void_reason = reason;
    arena.settled_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED, arena.identity_hash.as_ref()],
        bump = arena.arena_bump,
        has_one = vault
    )]
    pub arena: Account<'info, Arena>,
    #[account(mut)]
    pub supporter: Signer<'info>,
    #[account(
        mut,
        seeds = [POSITION_SEED, arena.key().as_ref(), supporter.key().as_ref()],
        bump = position.bump,
        has_one = arena,
        has_one = owner,
    )]
    pub position: Account<'info, SupporterPosition>,
    /// CHECK: Constrained to the supporter through position.has_one.
    #[account(address = supporter.key())]
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump = arena.vault_bump
    )]
    pub vault: Account<'info, SupporterVault>,
}

pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    require!(
        matches!(
            ctx.accounts.arena.state,
            ArenaState::Settled | ArenaState::Void
        ),
        ArenaError::AlreadyFinalized
    );
    require!(!ctx.accounts.position.claimed, ArenaError::AlreadyClaimed);
    let payout = settlement::payout(&ctx.accounts.arena, &ctx.accounts.position)?;

    transfer_from_vault(
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.supporter.to_account_info(),
        payout,
    )?;

    if ctx.accounts.arena.state == ArenaState::Settled {
        let terms = settlement::terms(&ctx.accounts.arena)?;
        if terms.is_some() {
            ctx.accounts.arena.claimed_winning_stake = ctx
                .accounts
                .arena
                .claimed_winning_stake
                .checked_add(ctx.accounts.position.amount)
                .ok_or(ArenaError::MathOverflow)?;
        }
    }
    ctx.accounts.arena.paid_amount = ctx
        .accounts
        .arena
        .paid_amount
        .checked_add(payout)
        .ok_or(ArenaError::MathOverflow)?;
    ctx.accounts.position.claimed = true;
    Ok(())
}

fn transfer_from_vault(
    vault: &AccountInfo<'_>,
    recipient: &AccountInfo<'_>,
    amount: u64,
) -> Result<()> {
    let rent_reserve = Rent::get()?.minimum_balance(vault.data_len());
    let vault_balance = vault.lamports();
    require!(
        vault_balance >= rent_reserve.saturating_add(amount),
        ArenaError::InsufficientVaultFunds
    );
    **vault.try_borrow_mut_lamports()? = vault_balance
        .checked_sub(amount)
        .ok_or(ArenaError::MathOverflow)?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(ArenaError::MathOverflow)?;
    Ok(())
}
