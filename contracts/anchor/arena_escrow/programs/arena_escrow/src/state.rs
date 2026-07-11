use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Arena {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub kamino_program: Pubkey,
    pub kamino_reserve: Pubkey,
    pub k_token_mint: Pubkey,
    pub k_token_account: Pubkey,
    pub arena_bump: u8,
    pub vault_authority_bump: u8,
    pub isagi_stake: u64,
    pub aiku_stake: u64,
    pub kamino_deposited_amount: u64,
    pub kamino_k_tokens_received: u64,
    pub kamino_withdrawn_amount: u64,
    pub yield_earned: u64,
    pub winning_side: Option<AgentSide>,
    pub is_resolved: bool,
    #[max_len(64)]
    pub match_id: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum AgentSide {
    Isagi,
    Aiku,
}
