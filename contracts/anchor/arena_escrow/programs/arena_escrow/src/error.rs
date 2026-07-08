use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Match id is empty or exceeds the maximum length")]
    InvalidMatchId,
    #[msg("Stake amount must be greater than zero")]
    InvalidStakeAmount,
    #[msg("Stake total overflowed u64")]
    StakeOverflow,
}
