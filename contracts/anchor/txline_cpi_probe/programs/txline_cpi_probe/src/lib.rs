use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke, set_return_data},
};

declare_id!("7eFCWjKnPVs5ovXhgnEkckby93oEPzbYXM9e6raSoi7b");

pub const TXLINE_DEVNET_PROGRAM_ID: Pubkey =
    pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];
const VALIDATE_STAT_V2_DISCRIMINATOR: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];
const VALIDATE_STAT_V3_DISCRIMINATOR: [u8; 8] = [150, 37, 155, 89, 141, 190, 77, 203];

#[program]
pub mod txline_cpi_probe {
    use super::*;

    pub fn verify_txline_stat(
        ctx: Context<VerifyTxlineStat>,
        instruction_data: Vec<u8>,
    ) -> Result<()> {
        require_supported_instruction(&instruction_data)?;

        // Clear stale return data so success requires TxLINE itself to return a value.
        set_return_data(&[]);

        let txline_program = ctx.accounts.txline_program.to_account_info();
        let daily_scores_merkle_roots = ctx.accounts.daily_scores_merkle_roots.to_account_info();
        let instruction = Instruction {
            program_id: TXLINE_DEVNET_PROGRAM_ID,
            accounts: vec![AccountMeta::new_readonly(
                daily_scores_merkle_roots.key(),
                false,
            )],
            data: instruction_data,
        };

        invoke(&instruction, &[daily_scores_merkle_roots, txline_program])?;

        let (returning_program, return_data) =
            get_return_data().ok_or(error!(ProbeError::MissingReturnData))?;
        require_valid_return(returning_program, &return_data)?;

        emit!(TxlineValidationObserved {
            txline_program: TXLINE_DEVNET_PROGRAM_ID,
            daily_scores_merkle_roots: ctx.accounts.daily_scores_merkle_roots.key(),
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct VerifyTxlineStat<'info> {
    /// CHECK: Fixed to the published TxLINE devnet program and required executable.
    #[account(address = TXLINE_DEVNET_PROGRAM_ID, executable)]
    pub txline_program: UncheckedAccount<'info>,
    /// CHECK: TxLINE owns and validates the daily root account during CPI.
    #[account(owner = TXLINE_DEVNET_PROGRAM_ID)]
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
}

#[event]
pub struct TxlineValidationObserved {
    pub txline_program: Pubkey,
    pub daily_scores_merkle_roots: Pubkey,
}

#[error_code]
pub enum ProbeError {
    #[msg("Instruction is not a supported TxLINE stat validator")]
    UnsupportedInstruction,
    #[msg("TxLINE CPI returned no result")]
    MissingReturnData,
    #[msg("Return data came from an unexpected program")]
    UnexpectedReturnProgram,
    #[msg("TxLINE validation did not return true")]
    ValidationRejected,
}

fn require_supported_instruction(instruction_data: &[u8]) -> Result<()> {
    let discriminator: [u8; 8] = instruction_data
        .get(..8)
        .ok_or(error!(ProbeError::UnsupportedInstruction))?
        .try_into()
        .map_err(|_| error!(ProbeError::UnsupportedInstruction))?;
    require!(
        discriminator == VALIDATE_STAT_DISCRIMINATOR
            || discriminator == VALIDATE_STAT_V2_DISCRIMINATOR
            || discriminator == VALIDATE_STAT_V3_DISCRIMINATOR,
        ProbeError::UnsupportedInstruction
    );
    Ok(())
}

fn require_valid_return(returning_program: Pubkey, return_data: &[u8]) -> Result<()> {
    require_keys_eq!(
        returning_program,
        TXLINE_DEVNET_PROGRAM_ID,
        ProbeError::UnexpectedReturnProgram
    );
    require!(return_data == [1], ProbeError::ValidationRejected);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_all_published_stat_validation_discriminators() {
        for discriminator in [
            VALIDATE_STAT_DISCRIMINATOR,
            VALIDATE_STAT_V2_DISCRIMINATOR,
            VALIDATE_STAT_V3_DISCRIMINATOR,
        ] {
            let mut data = discriminator.to_vec();
            data.push(0);
            assert!(require_supported_instruction(&data).is_ok());
        }
    }

    #[test]
    fn rejects_short_or_unrelated_instruction_data() {
        assert!(require_supported_instruction(&[]).is_err());
        assert!(require_supported_instruction(&[0; 8]).is_err());
    }

    #[test]
    fn accepts_only_true_return_from_txline() {
        assert!(require_valid_return(TXLINE_DEVNET_PROGRAM_ID, &[1]).is_ok());
        assert!(require_valid_return(TXLINE_DEVNET_PROGRAM_ID, &[0]).is_err());
        assert!(require_valid_return(TXLINE_DEVNET_PROGRAM_ID, &[]).is_err());
        assert!(require_valid_return(Pubkey::new_unique(), &[1]).is_err());
    }
}
