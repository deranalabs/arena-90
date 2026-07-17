pub mod constants;
pub mod error;
pub mod instructions;
pub mod settlement;
pub mod state;
pub mod txline;

use anchor_lang::prelude::*;
pub use instructions::*;
pub use state::*;
pub use txline::StatValidationInput;

declare_id!("3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ");

#[program]
pub mod arena_escrow {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_arena(
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
        instructions::handle_initialize_arena(
            ctx,
            identity_hash,
            manifest_hash,
            fixture_id,
            backing_deadline,
            resolver,
            treasury,
            fee_bps,
            mode,
        )
    }

    pub fn back_agent(ctx: Context<BackAgent>, side: AgentSide, amount: u64) -> Result<()> {
        instructions::handle_back_agent(ctx, side, amount)
    }

    pub fn lock_arena(ctx: Context<LockArena>) -> Result<()> {
        instructions::handle_lock_arena(ctx)
    }

    pub fn verify_txline_terminal(
        ctx: Context<VerifyTxlineTerminal>,
        payload: StatValidationInput,
    ) -> Result<()> {
        instructions::handle_verify_txline_terminal(ctx, payload)
    }

    pub fn settle_arena(
        ctx: Context<SettleArena>,
        final_result_hash: [u8; 32],
        alpha_nav: u64,
        beta_nav: u64,
        result: CompetitionResult,
    ) -> Result<()> {
        instructions::handle_settle_arena(ctx, final_result_hash, alpha_nav, beta_nav, result)
    }

    pub fn void_arena(ctx: Context<VoidArena>, reason: u16) -> Result<()> {
        instructions::handle_void_arena(ctx, reason)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::handle_claim(ctx)
    }
}

#[cfg(test)]
mod identity_vector_tests {
    use serde::Deserialize;
    use solana_sha256_hasher::hash;
    use std::fmt::Write;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct IdentityVector {
        manifest: serde_json::Value,
        canonical_manifest_json: String,
        identity_hash: String,
        manifest_hash: String,
    }

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().fold(String::new(), |mut output, byte| {
            write!(&mut output, "{byte:02x}").unwrap();
            output
        })
    }

    #[test]
    fn matches_shared_arena_identity_vector() {
        let vector: IdentityVector = serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../../fixtures/arena-identity-v1.json"
        )))
        .unwrap();
        let arena_id = vector.manifest["arenaId"].as_str().unwrap();

        assert_eq!(
            hex(hash(arena_id.as_bytes()).as_ref()),
            vector.identity_hash
        );
        assert_eq!(
            hex(hash(vector.canonical_manifest_json.as_bytes()).as_ref()),
            vector.manifest_hash
        );
    }
}
