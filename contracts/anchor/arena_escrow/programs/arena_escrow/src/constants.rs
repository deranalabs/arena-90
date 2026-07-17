use anchor_lang::prelude::*;

pub const ARENA_SEED: &[u8] = b"arena";
pub const VAULT_SEED: &[u8] = b"vault";
pub const POSITION_SEED: &[u8] = b"position";
pub const TERMINAL_PROOF_SEED: &[u8] = b"terminal-proof";
pub const SCHEMA_VERSION: u8 = 2;
pub const MAX_FEE_BPS: u16 = 500;
pub const BPS_DENOMINATOR: u128 = 10_000;

pub const TXLINE_DEVNET_PROGRAM_ID: Pubkey =
    pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
pub const VALIDATE_STAT_V2_DISCRIMINATOR: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];

pub const HOME_SCORE_KEY: u32 = 1;
pub const AWAY_SCORE_KEY: u32 = 2;
pub const FULL_TIME_PERIOD: i32 = 100;
