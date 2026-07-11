use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Match id is empty or exceeds the maximum length")]
    InvalidMatchId,
    #[msg("Stake amount must be greater than zero")]
    InvalidStakeAmount,
    #[msg("Stake total overflowed u64")]
    StakeOverflow,
    #[msg("Arena has already been resolved")]
    ArenaResolved,
    #[msg("Kamino deposit amount must be greater than zero")]
    InvalidKaminoDepositAmount,
    #[msg("Kamino tracking total overflowed u64")]
    KaminoTrackingOverflow,
    #[msg("Kamino accounts do not match the arena's recorded integration")]
    KaminoAccountMismatch,
    #[msg("Arena has no Kamino receipt tokens to redeem")]
    NothingToWithdraw,
    #[msg("Kamino redemption returned less than the deposited principal")]
    PrincipalLoss,
}
