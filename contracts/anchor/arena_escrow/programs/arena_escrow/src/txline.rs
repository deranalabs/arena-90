use crate::{constants::*, error::ArenaError};
use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::{get_return_data, invoke, set_return_data},
    },
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct StatValidationInput {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct GeometricTarget {
    stat_index: u8,
    prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct TraderPredicate {
    threshold: i32,
    comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
enum StatPredicate {
    Single {
        index: u8,
        predicate: TraderPredicate,
    },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize)]
struct NDimensionalStrategy {
    geometric_targets: Vec<GeometricTarget>,
    distance_predicate: Option<TraderPredicate>,
    discrete_predicates: Vec<StatPredicate>,
}

pub fn validate_terminal_payload(
    payload: &StatValidationInput,
    fixture_id: i64,
) -> Result<(i32, i32)> {
    require!(
        payload.fixture_summary.fixture_id == fixture_id,
        ArenaError::InvalidTerminalProof
    );
    require!(payload.stats.len() == 2, ArenaError::InvalidTerminalScores);

    let home = &payload.stats[0].stat;
    let away = &payload.stats[1].stat;
    require!(
        home.key == HOME_SCORE_KEY
            && away.key == AWAY_SCORE_KEY
            && home.period == FULL_TIME_PERIOD
            && away.period == FULL_TIME_PERIOD
            && home.value >= 0
            && away.value >= 0,
        ArenaError::InvalidTerminalScores
    );
    Ok((home.value, away.value))
}

pub fn instruction_data(payload: &StatValidationInput) -> Result<Vec<u8>> {
    let (home_score, away_score) =
        validate_terminal_payload(payload, payload.fixture_summary.fixture_id)?;
    let strategy = NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates: vec![
            StatPredicate::Single {
                index: 0,
                predicate: TraderPredicate {
                    threshold: home_score,
                    comparison: Comparison::EqualTo,
                },
            },
            StatPredicate::Single {
                index: 1,
                predicate: TraderPredicate {
                    threshold: away_score,
                    comparison: Comparison::EqualTo,
                },
            },
        ],
    };

    let mut data = VALIDATE_STAT_V2_DISCRIMINATOR.to_vec();
    payload.serialize(&mut data)?;
    strategy.serialize(&mut data)?;
    Ok(data)
}

pub fn verify<'info>(
    payload: &StatValidationInput,
    root: AccountInfo<'info>,
    txline_program: AccountInfo<'info>,
) -> Result<Vec<u8>> {
    let data = instruction_data(payload)?;
    set_return_data(&[]);
    let instruction = Instruction {
        program_id: TXLINE_DEVNET_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(root.key(), false)],
        data: data.clone(),
    };
    invoke(&instruction, &[root, txline_program])?;

    let (returning_program, return_data) =
        get_return_data().ok_or(error!(ArenaError::MissingReturnData))?;
    require_keys_eq!(
        returning_program,
        TXLINE_DEVNET_PROGRAM_ID,
        ArenaError::UnexpectedReturnProgram
    );
    require!(return_data == [1], ArenaError::TxlineValidationRejected);
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(home: i32, away: i32) -> StatValidationInput {
        StatValidationInput {
            ts: 1,
            fixture_summary: ScoresBatchSummary {
                fixture_id: 42,
                update_stats: ScoresUpdateStats {
                    update_count: 1,
                    min_timestamp: 1,
                    max_timestamp: 1,
                },
                events_sub_tree_root: [0; 32],
            },
            fixture_proof: vec![],
            main_tree_proof: vec![],
            event_stat_root: [0; 32],
            stats: vec![
                StatLeaf {
                    stat: ScoreStat {
                        key: HOME_SCORE_KEY,
                        value: home,
                        period: FULL_TIME_PERIOD,
                    },
                    stat_proof: vec![],
                },
                StatLeaf {
                    stat: ScoreStat {
                        key: AWAY_SCORE_KEY,
                        value: away,
                        period: FULL_TIME_PERIOD,
                    },
                    stat_proof: vec![],
                },
            ],
        }
    }

    #[test]
    fn accepts_only_canonical_terminal_score_pair() {
        assert_eq!(
            validate_terminal_payload(&payload(2, 1), 42).unwrap(),
            (2, 1)
        );
        assert!(validate_terminal_payload(&payload(-1, 1), 42).is_err());
        assert!(validate_terminal_payload(&payload(2, 1), 43).is_err());

        let mut wrong_period = payload(2, 1);
        wrong_period.stats[1].stat.period = 2;
        assert!(validate_terminal_payload(&wrong_period, 42).is_err());

        let mut wrong_key = payload(2, 1);
        wrong_key.stats[0].stat.key = 3;
        assert!(validate_terminal_payload(&wrong_key, 42).is_err());
    }

    #[test]
    fn builds_only_validate_stat_v2_with_internal_equal_predicates() {
        let data = instruction_data(&payload(3, 0)).unwrap();
        assert_eq!(&data[..8], &VALIDATE_STAT_V2_DISCRIMINATOR);
        assert!(data.len() > 8);
    }
}
