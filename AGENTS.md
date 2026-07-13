# Arena90 Repository Instructions

Global rules for AI coding agents in this repository.

Keep this file as a routing and safety layer. Product behavior belongs in
approved product documents. Subsystem rules belong in the nearest `AGENTS.md`.

## 1. Product Mission

Arena90 is an autonomous AI strategy arena powered by football and market data.

Two autonomous agents receive the same verified snapshot, independently manage
equal virtual portfolios, and compete through deterministic execution and
winner rules.

Watching is authentication-free. Supporters may back an agent through Solana,
but supporter funds remain separate from agent capital and decisions.

Do not describe Arena90 as a sportsbook, user-facing prediction-market trading
terminal, copy-trading product, AI-controlled wallet, or scripted battle.

## 2. Authoritative Documentation

Start with `docs/product/00-Product-Index.md`. It routes each task to the
approved document that owns the relevant decision.

Only documents marked `Approved` are implementation-authoritative. Read only
the documents relevant to the task. Do not implement `Draft`, `In Review`,
`Deprecated`, or `Archived` material unless explicitly authorized.

V1 code, mocks, names, comments, and docs do not override approved V2 decisions.
When requirements conflict or a required specification is missing, stop and
report it instead of inventing behavior.

## 3. Repository Map

- `frontend/web/` — Next.js product UX.
- `backend/solana-actions/` — Express API and Solana Action/Blink surfaces.
- `contracts/anchor/arena_escrow/` — Rust/Anchor programs and tests.
- `agents/zeroclaw/` — autonomous runtime, strategies, and tools.
- `docs/` — decisions, specifications, plans, and references.

Some files remain V1 or experimental. ISAGI, AIKU, `clash-state.json`, Kamino
mocks, and legacy runner behavior are not V2 requirements unless an approved
current document retains them.

## 4. Scope and Workflow

Modify only files required by the authorized task.

For cross-layer work, identify all affected layers and update contracts,
producers, consumers, validators, tests, and docs together. Obtain explicit
authorization before expanding into layers not already in scope.

Root instructions, root docs, `docs/`, shared schemas, CI, toolchain changes,
and dependency-version changes are global changes.

A nearer `AGENTS.md` may add local rules but cannot override approved product
decisions or repository safety rules.

Use:

`inspect → requirements → plan → implement → validate → inspect diff → report`

Before editing:

- inspect code and uncommitted changes;
- read the nearest instructions;
- read relevant approved docs;
- verify commands in the package manifest or tool configuration.

Do not build the whole product for a vertical-slice task or overwrite unrelated
local changes.

## 5. Critical Product Guardrails

Unless an approved decision changes them:

- Alpha and Beta receive the same canonical snapshot and equal bankrolls, then
  decide independently.
- Decisions occur only at approved checkpoints and return structured target
  allocations or `NO_TRADE`.
- Validation, pricing, execution, accounting, settlement, and winner
  calculation are deterministic.
- Invalid output never becomes a fabricated fallback trade.
- Live and Replay use the same rules and engine; Replay uses recorded data but
  generates new autonomous decisions.
- Supporter funds never become agent capital, performance, or strategy input.
- Agents never control wallets, private keys, supporter funds, or arbitrary
  transactions.
- Watching remains wallet-free.
- Public states must be honest; never fabricate progress, reasoning,
  transactions, decisions, or production readiness.
- Private chain-of-thought, secrets, and raw infrastructure logs are not public
  product output.

## 6. Implementation and Security

Use repository-relative paths or environment configuration. Never hardcode
machine paths, secrets, private keys, seed phrases, RPC credentials, or
production credentials.

Secrets come from environment variables. When adding one, update the relevant
`.env.example`, state whether it is required, and provide safe local behavior
where appropriate.

Use mocks before live integrations unless live TxLINE, wallet, RPC, or protocol
access is explicitly authorized.

Do not leave empty stubs, fake production data, placeholder keys, silent
fallbacks, fabricated states or decisions, or misleading claims.

Schema changes must update impacted producers, consumers, validators, fixtures,
tests, and docs.

## 7. Validation

Use commands declared by the current package or tool configuration.

- `frontend/web/`: `npm run lint`, `npm test -- --runInBand`, `npm run build`
- `backend/solana-actions/`: `npm run build`, `npm test -- --runInBand`
- `contracts/anchor/arena_escrow/`: `anchor build`, `npm test`, `cargo test`
- `agents/zeroclaw/`: inspect the runner and configuration before execution;
  do not treat `run_clash.sh` as portable while it contains absolute paths.

Run only commands supported by available tooling. Never claim a command passed
when it was skipped, unavailable, or failed.

For documentation-only changes, run at minimum `git diff --check`.

## 8. Git Safety and Completion

Do not perform destructive Git operations without explicit permission,
including hard resets, force-pushes, branch deletion, history rewriting,
discarding uncommitted changes, or mass deletion outside task scope.

Do not commit secrets, `.env` files, private keys, wallet files, build output,
or local ledgers.

Before completion, inspect the final diff, run relevant validation, confirm
scope, update tests/docs where required, and report remaining gaps honestly.

The completion report must state scope, files changed, behavior implemented,
commands run, validation results, and known blockers.

Do not describe mocked, trusted, untested, incomplete, or local-only behavior as
verified, autonomous, decentralized, live, portable, or production-ready.
