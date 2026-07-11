import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";
import { expect } from "chai";

import { ArenaEscrow } from "../target/types/arena_escrow";
import { KaminoMock } from "../target/types/kamino_mock";

describe("arena_escrow Kamino CPI", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const arenaProgram = anchor.workspace.ArenaEscrow as Program<ArenaEscrow>;
  const kaminoProgram = anchor.workspace.KaminoMock as Program<KaminoMock>;
  const payer = (provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }).payer;
  const stakeAmount = 10_000_000;
  let matchCounter = 0;

  async function expectAnchorError(promise: Promise<unknown>, code: string) {
    try {
      await promise;
      expect.fail(`Expected Anchor error ${code}`);
    } catch (error) {
      const anchorError = error as {
        error?: { errorCode?: { code?: string } };
      };
      expect(anchorError.error?.errorCode?.code).to.equal(code);
    }
  }

  async function createDepositedArena(extraUsdc = 5_000_000) {
    const matchId = `phase06-${Date.now()}-${matchCounter++}`;
    const usdcMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      6,
    );
    const [arena] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("arena"), Buffer.from(matchId)],
      arenaProgram.programId,
    );
    const [vaultAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault-authority"), arena.toBuffer()],
      arenaProgram.programId,
    );
    const [reserveAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reserve-authority"), usdcMint.toBuffer()],
      kaminoProgram.programId,
    );

    const vaultTokenAccount = anchor.web3.Keypair.generate();
    const kaminoReserveAccount = anchor.web3.Keypair.generate();
    const kTokenReceiptAccount = anchor.web3.Keypair.generate();
    const payerUsdc = await createAccount(
      provider.connection,
      payer,
      usdcMint,
      payer.publicKey,
    );
    const kaminoReserve = await createAccount(
      provider.connection,
      payer,
      usdcMint,
      reserveAuthority,
      kaminoReserveAccount,
    );
    const kTokenMint = await createMint(
      provider.connection,
      payer,
      reserveAuthority,
      null,
      6,
    );
    const kTokenAccount = await createAccount(
      provider.connection,
      payer,
      kTokenMint,
      vaultAuthority,
      kTokenReceiptAccount,
    );
    await mintTo(
      provider.connection,
      payer,
      usdcMint,
      payerUsdc,
      payer,
      stakeAmount + extraUsdc,
    );

    await arenaProgram.methods
      .initializeArena(matchId)
      .accountsPartial({
        payer: payer.publicKey,
        arena,
        usdcMint,
        vaultAuthority,
        vaultTokenAccount: vaultTokenAccount.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([vaultTokenAccount])
      .rpc();

    await arenaProgram.methods
      .stakeAgent({ isagi: {} }, new anchor.BN(stakeAmount))
      .accountsPartial({
        arena,
        bettor: payer.publicKey,
        usdcMint,
        bettorTokenAccount: payerUsdc,
        vaultTokenAccount: vaultTokenAccount.publicKey,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await arenaProgram.methods
      .depositToKamino(new anchor.BN(stakeAmount))
      .accountsPartial({
        arena,
        authority: payer.publicKey,
        usdcMint,
        vaultAuthority,
        vaultTokenAccount: vaultTokenAccount.publicKey,
        kaminoProgram: kaminoProgram.programId,
        kaminoReserveAuthority: reserveAuthority,
        kaminoReserve,
        kTokenMint,
        kTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      arena,
      usdcMint,
      vaultAuthority,
      vaultTokenAccount: vaultTokenAccount.publicKey,
      payerUsdc,
      reserveAuthority,
      kaminoReserve,
      kTokenMint,
      kTokenAccount,
    };
  }

  it("redeems only receipt tokens recorded for the arena", async () => {
    const foreignDepositAmount = 2_000_000;
    const yieldAmount = 500_000;
    const fixture = await createDepositedArena(foreignDepositAmount + yieldAmount);
    const payerKToken = await createAccount(
      provider.connection,
      payer,
      fixture.kTokenMint,
      payer.publicKey,
    );

    await kaminoProgram.methods
      .deposit(new anchor.BN(foreignDepositAmount))
      .accountsPartial({
        depositorAuthority: payer.publicKey,
        liquidityMint: fixture.usdcMint,
        liquiditySource: fixture.payerUsdc,
        reserveAuthority: fixture.reserveAuthority,
        liquidityVault: fixture.kaminoReserve,
        receiptMint: fixture.kTokenMint,
        receiptDestination: payerKToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await transfer(
      provider.connection,
      payer,
      payerKToken,
      fixture.kTokenAccount,
      payer,
      foreignDepositAmount,
    );
    await transfer(
      provider.connection,
      payer,
      fixture.payerUsdc,
      fixture.kaminoReserve,
      payer,
      yieldAmount,
    );

    await arenaProgram.methods
      .resolveArena({ isagi: {} })
      .accountsPartial({
        ...fixture,
        authority: payer.publicKey,
        kaminoProgram: kaminoProgram.programId,
        kaminoReserveAuthority: fixture.reserveAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const arenaState = await arenaProgram.account.arena.fetch(fixture.arena);
    expect(Number((await getAccount(provider.connection, fixture.kTokenAccount)).amount)).to.equal(
      foreignDepositAmount,
    );
    expect(Number((await getAccount(provider.connection, fixture.vaultTokenAccount)).amount)).to.equal(
      10_416_666,
    );
    expect(arenaState.kaminoWithdrawnAmount.toNumber()).to.equal(10_416_666);
    expect(arenaState.yieldEarned.toNumber()).to.equal(416_666);
    expect(arenaState.winningSide).to.deep.equal({ isagi: {} });
    expect(arenaState.isResolved).to.equal(true);
  });

  it("rejects a non-authority deposit and resolution", async () => {
    const fixture = await createDepositedArena();
    const attacker = anchor.web3.Keypair.generate();

    await expectAnchorError(
      arenaProgram.methods
        .depositToKamino(new anchor.BN(1))
        .accountsPartial({
          ...fixture,
          authority: attacker.publicKey,
          kaminoProgram: kaminoProgram.programId,
          kaminoReserveAuthority: fixture.reserveAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc(),
      "ConstraintHasOne",
    );
    await expectAnchorError(
      arenaProgram.methods
        .resolveArena({ isagi: {} })
        .accountsPartial({
          ...fixture,
          authority: attacker.publicKey,
          kaminoProgram: kaminoProgram.programId,
          kaminoReserveAuthority: fixture.reserveAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc(),
      "ConstraintHasOne",
    );
  });

  it("rejects a different reserve after the first deposit", async () => {
    const fixture = await createDepositedArena();
    const otherReserve = await createAccount(
      provider.connection,
      payer,
      fixture.usdcMint,
      fixture.reserveAuthority,
      anchor.web3.Keypair.generate(),
    );

    await expectAnchorError(
      arenaProgram.methods
        .depositToKamino(new anchor.BN(1_000_000))
        .accountsPartial({
          ...fixture,
          authority: payer.publicKey,
          kaminoProgram: kaminoProgram.programId,
          kaminoReserveAuthority: fixture.reserveAuthority,
          kaminoReserve: otherReserve,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "KaminoAccountMismatch",
    );
  });

  it("rejects a second resolution and staking after resolution", async () => {
    const fixture = await createDepositedArena();

    await arenaProgram.methods
      .resolveArena({ aiku: {} })
      .accountsPartial({
        ...fixture,
        authority: payer.publicKey,
        kaminoProgram: kaminoProgram.programId,
        kaminoReserveAuthority: fixture.reserveAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await expectAnchorError(
      arenaProgram.methods
        .resolveArena({ isagi: {} })
        .accountsPartial({
          ...fixture,
          authority: payer.publicKey,
          kaminoProgram: kaminoProgram.programId,
          kaminoReserveAuthority: fixture.reserveAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "ArenaResolved",
    );
    await expectAnchorError(
      arenaProgram.methods
        .stakeAgent({ isagi: {} }, new anchor.BN(1))
        .accountsPartial({
          arena: fixture.arena,
          bettor: payer.publicKey,
          usdcMint: fixture.usdcMint,
          bettorTokenAccount: fixture.payerUsdc,
          vaultTokenAccount: fixture.vaultTokenAccount,
          vaultAuthority: fixture.vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "ArenaResolved",
    );
  });

  it("rolls back resolution when the reserve cannot return principal", async () => {
    const principalLoss = 1_000_000;
    const fixture = await createDepositedArena();
    const lossDestination = await createAccount(
      provider.connection,
      payer,
      fixture.usdcMint,
      payer.publicKey,
      anchor.web3.Keypair.generate(),
    );

    await kaminoProgram.methods
      .realizeLoss(new anchor.BN(principalLoss))
      .accountsPartial({
        lossAuthority: payer.publicKey,
        liquidityMint: fixture.usdcMint,
        reserveAuthority: fixture.reserveAuthority,
        liquidityVault: fixture.kaminoReserve,
        lossDestination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await expectAnchorError(
      arenaProgram.methods
        .resolveArena({ isagi: {} })
        .accountsPartial({
          ...fixture,
          authority: payer.publicKey,
          kaminoProgram: kaminoProgram.programId,
          kaminoReserveAuthority: fixture.reserveAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      "PrincipalLoss",
    );

    const arenaState = await arenaProgram.account.arena.fetch(fixture.arena);
    expect(arenaState.isResolved).to.equal(false);
    expect(Number((await getAccount(provider.connection, fixture.kTokenAccount)).amount)).to.equal(
      stakeAmount,
    );
    expect(Number((await getAccount(provider.connection, fixture.vaultTokenAccount)).amount)).to.equal(0);
  });
});
