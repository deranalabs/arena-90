use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
    #[msg("Only Live arenas can accept supporter backing")]
    ReplayUnsupported,
    #[msg("Fixture id must be positive")]
    InvalidFixtureId,
    #[msg("Backing deadline must be in the future")]
    InvalidDeadline,
    #[msg("Protocol fee exceeds the approved maximum")]
    InvalidFee,
    #[msg("Required public key cannot be the default address")]
    InvalidAuthority,
    #[msg("Backing amount must be greater than zero")]
    InvalidAmount,
    #[msg("Arena is not open for backing")]
    ArenaNotOpen,
    #[msg("Backing deadline has passed")]
    BackingClosed,
    #[msg("A supporter cannot switch agent sides")]
    SideChangeForbidden,
    #[msg("Arena cannot be locked before its backing deadline")]
    LockTooEarly,
    #[msg("Arena is not locked")]
    ArenaNotLocked,
    #[msg("Arena is already finalized")]
    AlreadyFinalized,
    #[msg("Only the configured resolver may perform this operation")]
    UnauthorizedResolver,
    #[msg("Terminal proof does not match this arena")]
    InvalidTerminalProof,
    #[msg("TxLINE proof must contain HOME and AWAY full-time score leaves")]
    InvalidTerminalScores,
    #[msg("TxLINE CPI returned no result")]
    MissingReturnData,
    #[msg("TxLINE return data came from an unexpected program")]
    UnexpectedReturnProgram,
    #[msg("TxLINE rejected terminal score validation")]
    TxlineValidationRejected,
    #[msg("Terminal proof receipt has already been consumed")]
    ProofAlreadyConsumed,
    #[msg("Final result hash cannot be zero")]
    InvalidFinalResultHash,
    #[msg("Void reason code must be nonzero")]
    InvalidVoidReason,
    #[msg("Position has already been claimed")]
    AlreadyClaimed,
    #[msg("Losing positions cannot claim a payout")]
    LosingPosition,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Escrow vault does not contain enough supporter funds")]
    InsufficientVaultFunds,
    #[msg("Treasury account does not match arena configuration")]
    TreasuryMismatch,
}
