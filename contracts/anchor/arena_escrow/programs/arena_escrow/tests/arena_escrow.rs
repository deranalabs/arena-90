use {
    anchor_lang::{
        prelude::rent,
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_option::COption,
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_interface::{
        state::{Account as TokenAccount, AccountState, Mint},
        ID as TOKEN_PROGRAM_ID,
    },
};

fn send_transaction(svm: &mut LiteSVM, instructions: &[Instruction], signers: &[&Keypair]) {
    let payer = signers[0].pubkey();
    let blockhash = svm.latest_blockhash();
    let message = Message::new_with_blockhash(instructions, Some(&payer), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), signers).unwrap();
    svm.send_transaction(transaction).unwrap();
}

fn set_mint(svm: &mut LiteSVM, mint: Pubkey, mint_authority: Pubkey, supply: u64) {
    let mint_state = Mint {
        mint_authority: COption::Some(mint_authority),
        supply,
        decimals: 6,
        is_initialized: true,
        freeze_authority: COption::None,
    };
    let mut data = vec![0; Mint::LEN];
    Mint::pack(mint_state, &mut data).unwrap();
    svm.set_account(
        mint,
        Account {
            lamports: 1_000_000_000,
            data,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn set_token_account(
    svm: &mut LiteSVM,
    address: Pubkey,
    mint: Pubkey,
    owner: Pubkey,
    amount: u64,
) {
    let token_state = TokenAccount {
        mint,
        owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    };
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(token_state, &mut data).unwrap();
    svm.set_account(
        address,
        Account {
            lamports: 1_000_000_000,
            data,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn token_amount(svm: &LiteSVM, address: Pubkey) -> u64 {
    let account = svm.get_account(&address).unwrap();
    TokenAccount::unpack(&account.data).unwrap().amount
}

#[test]
fn initializes_arena_and_stakes_agent() {
    let program_id = arena_escrow::id();
    let payer = Keypair::new();
    let vault_token_account = Keypair::new();
    let bettor = Keypair::new();
    let bettor_token_account = Pubkey::new_unique();
    let usdc_mint = Pubkey::new_unique();
    let match_id = "wc2026-arg-fra-group-001".to_string();
    let stake_amount = 10_000_000;

    let (arena, _) = Pubkey::find_program_address(
        &[arena_escrow::constants::ARENA_SEED, match_id.as_bytes()],
        &program_id,
    );
    let (vault_authority, _) = Pubkey::find_program_address(
        &[
            arena_escrow::constants::VAULT_AUTHORITY_SEED,
            arena.as_ref(),
        ],
        &program_id,
    );

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/arena_escrow.so"
    ));
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&bettor.pubkey(), 1_000_000_000).unwrap();
    set_mint(&mut svm, usdc_mint, payer.pubkey(), stake_amount);
    set_token_account(
        &mut svm,
        bettor_token_account,
        usdc_mint,
        bettor.pubkey(),
        stake_amount,
    );

    let initialize_instruction = Instruction::new_with_bytes(
        program_id,
        &arena_escrow::instruction::InitializeArena {
            match_id: match_id.clone(),
        }
        .data(),
        arena_escrow::accounts::InitializeArena {
            payer: payer.pubkey(),
            arena,
            usdc_mint,
            vault_authority,
            vault_token_account: vault_token_account.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
            rent: rent::ID,
        }
        .to_account_metas(None),
    );
    send_transaction(
        &mut svm,
        &[initialize_instruction],
        &[&payer, &vault_token_account],
    );

    let arena_account = svm.get_account(&arena).unwrap();
    let mut arena_data: &[u8] = &arena_account.data;
    let arena_state = arena_escrow::state::Arena::try_deserialize(&mut arena_data).unwrap();
    assert_eq!(arena_state.authority, payer.pubkey());
    assert_eq!(arena_state.usdc_mint, usdc_mint);
    assert_eq!(arena_state.vault_token_account, vault_token_account.pubkey());
    assert_eq!(arena_state.match_id, match_id);
    assert_eq!(arena_state.isagi_stake, 0);
    assert_eq!(token_amount(&svm, vault_token_account.pubkey()), 0);

    let stake_instruction = Instruction::new_with_bytes(
        program_id,
        &arena_escrow::instruction::StakeAgent {
            agent: arena_escrow::state::AgentSide::Isagi,
            amount: stake_amount,
        }
        .data(),
        arena_escrow::accounts::StakeAgent {
            arena,
            bettor: bettor.pubkey(),
            usdc_mint,
            bettor_token_account,
            vault_token_account: vault_token_account.pubkey(),
            vault_authority,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
    );
    send_transaction(&mut svm, &[stake_instruction], &[&bettor]);

    let arena_account = svm.get_account(&arena).unwrap();
    let mut arena_data: &[u8] = &arena_account.data;
    let arena_state = arena_escrow::state::Arena::try_deserialize(&mut arena_data).unwrap();
    assert_eq!(arena_state.isagi_stake, stake_amount);
    assert_eq!(arena_state.aiku_stake, 0);
    assert_eq!(token_amount(&svm, bettor_token_account), 0);
    assert_eq!(token_amount(&svm, vault_token_account.pubkey()), stake_amount);
}
