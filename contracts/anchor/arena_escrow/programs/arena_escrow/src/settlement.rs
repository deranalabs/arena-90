use crate::{constants::BPS_DENOMINATOR, error::ArenaError, state::*};
use anchor_lang::prelude::*;

pub struct SettlementTerms {
    pub winning_pool: u64,
    pub losing_pool: u64,
    pub fee: u64,
    pub distributable: u64,
}

pub fn terms(arena: &Arena) -> Result<Option<SettlementTerms>> {
    let result = arena.result.ok_or(error!(ArenaError::AlreadyFinalized))?;
    let (winning_pool, losing_pool) = match result {
        CompetitionResult::Alpha => (arena.alpha_pool, arena.beta_pool),
        CompetitionResult::Beta => (arena.beta_pool, arena.alpha_pool),
        CompetitionResult::Draw => return Ok(None),
    };
    if winning_pool == 0 {
        return Ok(None);
    }
    let fee = u64::try_from(
        u128::from(losing_pool)
            .checked_mul(u128::from(arena.fee_bps))
            .ok_or(ArenaError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(ArenaError::MathOverflow)?,
    )
    .map_err(|_| error!(ArenaError::MathOverflow))?;
    let distributable = arena
        .alpha_pool
        .checked_add(arena.beta_pool)
        .and_then(|pool| pool.checked_sub(fee))
        .ok_or(ArenaError::MathOverflow)?;
    Ok(Some(SettlementTerms {
        winning_pool,
        losing_pool,
        fee,
        distributable,
    }))
}

pub fn payout(arena: &Arena, position: &SupporterPosition) -> Result<u64> {
    if arena.state == ArenaState::Void || arena.result == Some(CompetitionResult::Draw) {
        return Ok(position.amount);
    }

    let Some(settlement) = terms(arena)? else {
        return Ok(position.amount);
    };

    let winning_side = match arena.result {
        Some(CompetitionResult::Alpha) => AgentSide::Alpha,
        Some(CompetitionResult::Beta) => AgentSide::Beta,
        _ => return Err(error!(ArenaError::AlreadyFinalized)),
    };
    require!(position.side == winning_side, ArenaError::LosingPosition);

    let claimed_after = arena
        .claimed_winning_stake
        .checked_add(position.amount)
        .ok_or(ArenaError::MathOverflow)?;
    if claimed_after == settlement.winning_pool {
        return settlement
            .distributable
            .checked_sub(arena.paid_amount)
            .ok_or_else(|| error!(ArenaError::MathOverflow));
    }

    u64::try_from(
        u128::from(position.amount)
            .checked_mul(u128::from(settlement.distributable))
            .ok_or(ArenaError::MathOverflow)?
            .checked_div(u128::from(settlement.winning_pool))
            .ok_or(ArenaError::MathOverflow)?,
    )
    .map_err(|_| error!(ArenaError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arena(result: CompetitionResult, alpha_pool: u64, beta_pool: u64, fee_bps: u16) -> Arena {
        Arena {
            schema_version: 2,
            identity_hash: [1; 32],
            manifest_hash: [2; 32],
            fixture_id: 42,
            operator: Pubkey::new_unique(),
            resolver: Pubkey::new_unique(),
            treasury: Pubkey::new_unique(),
            vault: Pubkey::new_unique(),
            backing_deadline: 1,
            state: ArenaState::Settled,
            alpha_pool,
            beta_pool,
            fee_bps,
            terminal_proof: Pubkey::new_unique(),
            final_result_hash: [3; 32],
            alpha_nav: 1,
            beta_nav: 1,
            result: Some(result),
            void_reason: 0,
            fee_paid: 0,
            claimed_winning_stake: 0,
            paid_amount: 0,
            settled_at: 1,
            arena_bump: 1,
            vault_bump: 1,
        }
    }

    fn position(side: AgentSide, amount: u64) -> SupporterPosition {
        SupporterPosition {
            arena: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            side,
            amount,
            claimed: false,
            bump: 1,
        }
    }

    #[test]
    fn winner_receives_proportional_pool_and_fee_only_touches_losing_pool() {
        let arena = arena(CompetitionResult::Alpha, 300, 200, 500);
        let settlement = terms(&arena).unwrap().unwrap();
        assert_eq!(settlement.fee, 10);
        assert_eq!(settlement.distributable, 490);
        assert_eq!(
            payout(&arena, &position(AgentSide::Alpha, 100)).unwrap(),
            163
        );
        assert!(payout(&arena, &position(AgentSide::Beta, 100)).is_err());
    }

    #[test]
    fn last_winner_receives_rounding_remainder() {
        let mut arena = arena(CompetitionResult::Alpha, 3, 7, 0);
        assert_eq!(payout(&arena, &position(AgentSide::Alpha, 1)).unwrap(), 3);
        arena.claimed_winning_stake = 1;
        arena.paid_amount = 3;
        assert_eq!(payout(&arena, &position(AgentSide::Alpha, 2)).unwrap(), 7);
    }

    #[test]
    fn draw_void_and_empty_winning_side_refund_principal() {
        let draw = arena(CompetitionResult::Draw, 100, 200, 500);
        assert_eq!(payout(&draw, &position(AgentSide::Beta, 20)).unwrap(), 20);

        let mut void = draw;
        void.state = ArenaState::Void;
        void.result = None;
        assert_eq!(payout(&void, &position(AgentSide::Alpha, 30)).unwrap(), 30);

        let empty = arena(CompetitionResult::Alpha, 0, 200, 500);
        assert!(terms(&empty).unwrap().is_none());
        assert_eq!(payout(&empty, &position(AgentSide::Beta, 20)).unwrap(), 20);
    }
}
