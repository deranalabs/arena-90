# Arena90 Repository Instructions

This file defines the global rules for AI coding agents working in the Arena90 repository.

Keep this file focused. Product behavior belongs in approved product documents.
Subsystem-specific commands and conventions belong in the nearest subsystem
`AGENTS.md`.

## 1. Product Mission

Arena90 is an autonomous AI strategy arena powered by football and market data.

Two autonomous strategy agents receive the same verified arena snapshot,
independently manage equal virtual portfolios, and compete through deterministic
execution and winner rules.

Spectators may watch without authentication.

Supporters may back an agent through Solana, but supporter funds remain separate
from agent virtual capital and must never influence agent decisions.

Do not describe Arena90 as:

- a conventional sportsbook;
- a user-facing prediction-market trading terminal;
- a copy-trading product;
- an AI-controlled wallet;
- a scripted agent battle.

## 2. Authoritative Documentation

Only documents explicitly marked `Approved` are implementation-authoritative.

Primary product documents:

- `docs/product/01-Autonomous-Game-Loop-Decision.md`
  - checkpoints;
  - agent decisions;
  - deterministic execution;
  - failures;
  - winner rules;
  - Live and Replay equivalence.

- `docs/product/02-Product-Definition-V2.md`
  - product definition;
  - target users;
  - agent roles;
  - supporter separation;
  - V2 scope and boundaries.

- `docs/product/03-User-Experience-and-Routes.md`
  - routes;
  - page responsibilities;
  - Live and Replay UX;
  - identity and wallet UX;
  - public states;
  - accessibility and cross-route continuity.

Read only the documents relevant to the current task.

Do not implement documents marked `Draft`, `In Review`, `Deprecated`, or
`Archived` unless the user explicitly authorizes it.

Existing V1 code, mocks, comments, names, or documentation do not override an
approved V2 decision.

When requirements conflict or a required specification is missing, stop and
report the conflict instead of inventing behavior.

## 3. Repository Areas

Current implementation areas:

- `frontend/web/`
  - Next.js spectator, arena, replay, proof, agent, and participation UX.

- `backend/solana-actions/`
  - Express API and Solana Action or Blink surfaces.

- `contracts/anchor/arena_escrow/`
  - Rust and Anchor programs, tests, and local contract tooling.

- `agents/zeroclaw/`
  - autonomous agent runtime, strategies, and supporting tools.

- `docs/`
  - product decisions, specifications, plans, and references.

Some files still represent V1 or experimental implementation.

Names such as ISAGI, AIKU, `clash-state.json`, Kamino mocks, and legacy runner
behavior are not V2 requirements unless an approved current specification
explicitly retains them.

## 4. Scope and Layer Boundaries

Modify only files required by the authorized task.

Before making a cross-layer change:

1. identify every affected layer;
2. explain why the change crosses boundaries;
3. obtain explicit authorization when those layers were not already included;
4. update affected contracts, consumers, tests, and documentation together.

The following are global changes:

- root instruction files;
- root documentation;
- `docs/`;
- shared schemas;
- CI workflows;
- toolchain or dependency-version changes.

A nearer subsystem `AGENTS.md` may add local rules, but it must not override
approved product invariants or repository safety rules.

## 5. Required Workflow

Use this sequence:

`inspect → requirements → plan → implement → validate → inspect diff → report`

Before editing:

- inspect existing code;
- inspect uncommitted changes;
- read the nearest applicable instructions;
- read relevant approved documents;
- verify commands in the current package manifest.

Do not build the entire product when the task requests one vertical slice.

Do not overwrite unrelated local changes.

## 6. Product Invariants

Unless an approved decision changes them:

- Agent Alpha and Agent Beta receive the same canonical shared snapshot.
- Both agents begin with equal virtual bankrolls.
- Agents decide independently.
- Decisions occur only at approved checkpoints.
- Outputs are structured target allocations or `NO_TRADE`.
- Validation, pricing, execution, accounting, and settlement are deterministic.
- Invalid output must not become a fabricated fallback trade.
- Live and Replay use the same competition rules and engine.
- Replay uses recorded data but generates new autonomous decisions.
- Supporter funds never become agent virtual portfolio capital.
- Supporter popularity never becomes agent performance.
- Agents never control wallets, private keys, or supporter transactions.
- Watching remains wallet-free.
- Public UX must label Live, Replay, Simulated, Delayed, Paused, Finalizing,
  Completed, Claimable, and Refundable states honestly.
- Private chain-of-thought, secrets, and raw infrastructure logs are not public
  product output.

## 7. Implementation and Security Rules

Use repository-relative paths or environment configuration in source code.

Never hardcode:

- local machine paths;
- API secrets;
- private keys;
- seed phrases;
- RPC credentials;
- production credentials.

Secrets must come from environment variables.

When adding an environment variable:

- update the relevant `.env.example`;
- document whether it is required;
- provide safe local behavior when appropriate.

Use mocks before live integrations unless the task explicitly authorizes live
TxLINE, wallet, RPC, or protocol access.

Do not leave:

- empty function stubs;
- fake production data;
- placeholder API keys;
- silent fallback behavior;
- fabricated transaction states;
- fabricated autonomous decisions;
- misleading production-readiness claims.

Schema changes must update impacted producers, consumers, validators, fixtures,
tests, and documentation.

## 8. Validation

Use commands declared by the current package or tool configuration.

### Frontend

Working directory: `frontend/web/`

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`

### Solana Actions Backend

Working directory: `backend/solana-actions/`

- `npm run build`
- `npm test -- --runInBand`

### Anchor Contracts

Working directory: `contracts/anchor/arena_escrow/`

- `anchor build`
- `npm test`
- `cargo test`

Run contract commands only when the required Solana and Anchor tooling is
available.

### ZeroClaw Agents

Working directory: `agents/zeroclaw/`

Inspect the current runner and configuration before execution.

The current `run_clash.sh` contains legacy absolute-path assumptions and must
not be treated as portable until those assumptions are removed.

Do not claim a command passed when it was skipped, unavailable, or failed.

For documentation-only changes, run at minimum:

- `git diff --check`

## 9. Git Safety

Do not perform destructive Git operations without explicit permission.

Prohibited without authorization:

- `git reset --hard`;
- force-push;
- deleting branches;
- rewriting history;
- discarding uncommitted user changes;
- mass deletion outside task scope.

Do not commit secrets, `.env` files, private keys, wallet files, build output,
or local ledgers.

Inspect the final diff before reporting completion.

## 10. Definition of Done

A task is complete only when:

- authorized behavior is implemented;
- changes remain within authorized scope;
- relevant validation commands were run;
- behavioral changes have test coverage where practical;
- interfaces and configuration documentation are updated;
- no secret, placeholder, fabricated state, or machine-specific path was added;
- approved product invariants remain intact;
- remaining blockers are reported honestly.

## 11. Completion Report

Every completion report must state:

- scope;
- files changed;
- behavior implemented;
- commands run;
- validation results;
- known gaps or blockers.

Do not describe mocked, trusted, untested, or incomplete behavior as verified,
autonomous, decentralized, live, or production-ready.
