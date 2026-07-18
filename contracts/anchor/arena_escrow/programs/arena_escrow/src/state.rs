use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Arena {
    pub schema_version: u8,
    pub identity_hash: [u8; 32],
    pub manifest_hash: [u8; 32],
    pub fixture_id: i64,
    pub operator: Pubkey,
    pub resolver: Pubkey,
    pub treasury: Pubkey,
    pub vault: Pubkey,
    pub backing_deadline: i64,
    pub state: ArenaState,
    pub alpha_pool: u64,
    pub beta_pool: u64,
    pub fee_bps: u16,
    pub terminal_proof: Pubkey,
    pub final_result_hash: [u8; 32],
    pub alpha_nav: u64,
    pub beta_nav: u64,
    pub result: Option<CompetitionResult>,
    pub void_reason: u16,
    pub fee_paid: u64,
    pub claimed_winning_stake: u64,
    pub paid_amount: u64,
    pub settled_at: i64,
    pub arena_bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SupporterVault {
    pub arena: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SupporterPosition {
    pub arena: Pubkey,
    pub owner: Pubkey,
    pub side: AgentSide,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TerminalProofReceipt {
    pub arena: Pubkey,
    pub fixture_id: i64,
    pub home_score: i32,
    pub away_score: i32,
    pub proof_data_hash: [u8; 32],
    pub txline_root: Pubkey,
    pub verification_slot: u64,
    pub consumed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum ArenaMode {
    Live,
    Replay,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum ArenaState {
    Open,
    Locked,
    Settled,
    Void,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum AgentSide {
    Alpha,
    Beta,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum CompetitionResult {
    Alpha,
    Beta,
    Draw,
}
