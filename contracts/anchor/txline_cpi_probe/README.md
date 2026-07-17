# TxLINE CPI Probe

Experimental Arena90 feasibility harness for the published TxLINE devnet
program. It does not implement supporter escrow, settlement, or V2 product
behavior.

The probe accepts serialized `validate_stat`, `validate_stat_v2`, or
`validate_stat_v3` instruction data, invokes the fixed TxLINE devnet program
against a TxLINE-owned daily score-root account, and succeeds only when Solana
return data comes from TxLINE and encodes `true`.

This proves only CPI and return-data compatibility. A production settlement
instruction must additionally construct or decode the validated predicate,
bind the expected fixture and terminal score evidence, enforce arena lifecycle
and replay exclusion, and follow an approved Supporter Escrow and Blink
Settlement specification.

No keypair or deployed binary belongs in Git. The development program keypair
is kept outside the repository.

## Devnet feasibility result

Verified on 2026-07-17 against the published TxLINE devnet program
`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`.

- Probe program: `7eFCWjKnPVs5ovXhgnEkckby93oEPzbYXM9e6raSoi7b`
- Historical proof fixture/sequence: `17926686` / `880`
- TxLINE instruction size: `802` bytes
- Complete transaction size: `1090` bytes
- Confirmed compute use: `300040` units
- Confirmed CPI transaction:
  `5jCBQPNY5g7Nq2AqAWMf973AUZJw2LzViMoEdgBEHqCk2Ewt6kFbv174Mu5XqJtTufbNg9BXW7bECnUuMz1Kcu9P`
- Negative simulation: changing one proof byte was rejected.

The confirmed logs show TxLINE `ValidateStatV2`, TxLINE return data `AQ==`
(`true`), and successful completion of the probe wrapper. This establishes that
direct CPI and return-data verification are feasible on devnet. It does not
yet establish terminal-match binding or supporter settlement correctness.
