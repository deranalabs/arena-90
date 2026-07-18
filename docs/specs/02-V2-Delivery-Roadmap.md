# Arena90 — V2 Delivery Roadmap

**Status:** Approved
**Last verified:** 2026-07-18

This document is the single source of truth for current work order, delivery
status, and acceptance evidence. Product documents own enduring behavior.
Technical specifications own module interfaces. This roadmap does not copy
their details.

## 1. Demo Outcome

Arena90 is complete for submission only when one vertical workflow is proven:

```text
TxLINE + TxODDS live fixture
        |
        v
same verified strategy evidence
        |
        +-- Agent Alpha: hunts market overreaction
        `-- Agent Beta: hunts market underreaction
        |
        v
deterministic validation, simultaneous reveal, execution, accounting
        |
        +-- public state + ordered SSE events --> frontend
        `-- canonical final result -----------> Solana settlement

supporter -- user-signed Blink --> Solana escrow --> claim or refund
```

This workflow is the delivery interface. A layer is not complete merely
because its unit tests or isolated smoke pass. Completion requires its output
to cross the next seam and remain visible in the final demo.

### 1.1 Hackathon Acceptance Lens

The official track rewards a working agent over a polished but inactive demo.
Arena90 must demonstrate all five judging dimensions:

| Criterion | Arena90 proof |
| --- | --- |
| Core Functionality & Data Ingestion | Real TxLINE fixture, odds, and score input reaches canonical snapshots and produces decisions. |
| Autonomous Operation | A deployed supervisor runs ingestion, checkpoints, both agents, reveal, execution, and finalization without routine human calls. |
| Logic & Code Architecture | Shared evidence, distinct threshold policies, structured output, fail-closed validation, and deterministic integer accounting are documented and tested. |
| Innovation & Novelty | Two agents compete on the same verified feed using overreaction versus underreaction strategies with auditable portfolio consequences. |
| Production Readiness | Restart recovery, idempotency, bounded inputs/logs, secret isolation, health checks, read-only public APIs, and rollback are demonstrated. |

Submission acceptance also requires a public repository, working deployed URL
or API/devnet endpoint, brief technical documentation naming the TxLINE
endpoints used, integration feedback, and a demo video no longer than five
minutes. Submission closes **2026-07-19 23:59 UTC**. The video must capture
real live-input behavior before the match opportunity disappears; Replay is
fallback evidence, not a substitute for the required live integration.

## 2. Non-Negotiable Invariants

- Alpha and Beta receive the same verified evidence and equal virtual
  bankrolls.
- Agents decide only at approved checkpoints. They do not trade continuously.
- Agent output is structured. Invalid or missing output never becomes a fake
  fallback trade.
- Validation, execution, accounting, and winner resolution are deterministic.
- Public explanations claim only evidence supplied to the agent invocation.
- Live and Replay use the same runtime. Replay remains the mandatory fallback,
  but it is not the primary submission proof.
- Supporter funds never become agent capital or strategy input.
- Wallets sign supporter transactions. Agents never receive wallet authority,
  keys, funds, or settlement authority.
- Public UI may expose verified events, not private reasoning or raw
  infrastructure logs.

## 3. Verified Current State

### 3.0 Gate Status

| Gate | Status | Next acceptance evidence |
| --- | --- | --- |
| 1. Strategy Integrity | Complete locally | Deploy strategy v4 and preserve smoke evidence |
| 2. Always-On World Cup Live | In progress | Supervisor clean-boot and restart proof |
| 3. Spectator & Technical Proof | In progress | World Cup API/SSE through browser |
| 4. Solana Supporter Slice | In progress | Runtime resolver seam, public Blink, and frontend proof |
| 5. Release & Demo | Not started | Rehearsal, security audit, deploy, and recording |

Update this table only from captured acceptance evidence. Local implementation
or an isolated unit test does not close a gate.

### 3.1 Proven

- Runtime contracts, deterministic portfolio engine, checkpoint orchestration,
  simultaneous reveal, persistence, final result, and Replay lifecycle exist.
- Alpha and Beta run as independent ZeroClaw invocations.
- TxLINE/TxODDS adapter implements fixture binding, score state, approved `1X2`
  selection, deterministic normalization, freshness, suspension, sequence, and
  fail-closed behavior.
- Authorized TxLINE connectivity smoke passes against the deployed provider.
- HTTP state and ordered resumable SSE contracts exist.
- A local strategy-evidence module now derives kickoff anchor, previous
  checkpoint state, exact price movement, and match movement. Both invocation
  paths receive the same evidence object, including schema repair attempts.
- Local strategy identities are now Alpha Overreaction Hunter and Beta
  Underreaction Hunter with deterministic policy metadata version `4`. Runtime
  build and all 439 tests pass.
- Two immutable World Cup semifinal Replay recordings now preserve historical
  TxLINE provenance and prevent future-odds leakage. Fresh ZeroClaw strategy-v4
  runs completed all six checkpoints with no failures: Beta won France–Spain,
  and Alpha won England–Argentina. Both agents took data-conditioned exposure,
  and the public artifacts preserve 39 ordered runtime events per arena.
- Real ZeroClaw acceptance smoke passes Alpha overreaction allocation, Beta
  underreaction allocation, and Alpha/Beta no-edge `NO_TRADE` scenarios. The
  smoke also rejects unsupported historical/baseline claims in public output.
- A replacement immutable runtime artifact,
  `arena90-runtime-20260717-strategy-v3.tar.gz`, builds locally and its SHA-256
  checksum verifies. It has not been uploaded or activated on the VPS.
- Local runtime now has an operator-owned autostart supervisor. LIVE fails
  closed if autostart is disabled; supervised runtimes hide public create/run
  mutations; graceful shutdown aborts the managed run. Build and all 401 tests
  pass.
- Deployment preflight now validates both Replay and Live configurations and
  rejects `ARENA90_AUTOSTART=false`. Replay-pass, Live-pass, and manual-start
  rejection are covered by automated tests.
- World Cup third-place and final fixture bindings were revalidated from the
  provider. Both full connectivity smokes pass with a bounded 10 MB provider
  response cap; their score streams were correctly idle before kickoff.
- Local runtime now distinguishes pending checkpoint evidence from a verified
  missed window and from current-window shared-data failure. Pre-kickoff idle
  or timed-out streams retry the same checkpoint without durable events;
  verified passed windows create one explicit global miss. Runtime build and
  all 422 tests pass serially.
- TxLINE credentials may now be loaded from one owner-only JSON file outside
  Git and immutable releases. The VPS release artifact and credential file are
  staged, but the active Replay service has not been switched to Live.
- Frontend now resolves one approved catalog preset across home, header,
  footer, agent CTA, and proof links. Replay and World Cup Live builds pass;
  Replay-default code is deployed to `arena-90.vercel.app`.
- Frontend now includes a read-only public Event Ledger derived from the same
  SSE event stream as the arena view. It supports agent/type filtering,
  display pause, recorded-event playback, and copying public proof identity
  without exposing prompts, private reasoning, raw model output, or
  infrastructure logs. Frontend lint, all 117 tests, and production build pass
  locally.
- Replay runtime is deployed on the agentic VPS; frontend is deployed on
  Vercel through a same-origin read-only gateway.
- Replay spectator flow and public proof are available as fallback evidence.
- The legacy Isagi/Aiku USDC and Kamino-mock contract has been replaced by the
  approved native-SOL V2 supporter program. Rust tests pass and the SBF binary
  plus IDL build successfully.
- The V2 program is deployed on Solana devnet at
  `3eaE8RrpNK3Fo9YNj8bSK8VKZ49uWNVceGntzUSgDLsZ`. A real devnet smoke completed
  initialize, Alpha backing, permissionless deadline lock, resolver void, and
  user-signed refund claim for arena
  `8vn2j5AzDHmz8LgEfkfYxTFno9a8jb8mwBVQeiQpg2SU`.
- The Solana Action service now returns only unsigned Back Alpha, Back Beta,
  and Claim transactions after program-owner, origin, wallet, amount, and rate
  validation. Build and all seven HTTP/encoding tests pass; production
  dependency audit reports zero known vulnerabilities.
- A separate Solana resolver release is deployed on the VPS with isolated
  owner-only credentials. Its systemd service is active and idempotently waits
  for canonical final Live runtime persistence; it has not created the World
  Cup final arena or submitted a settlement.
- A second real devnet smoke used TxLINE fixture `17926686`, provider sequence
  `880`, and HOME/AWAY terminal leaves `1-1`. Two wallets backed opposite
  agents, the deadline locked, TxLINE returned true through CPI, the receipt
  was consumed exactly once, Alpha settled, the losing claim failed, and the
  winning position claimed the complete zero-fee pool. The terminal-proof
  transaction is
  `4AresX6YhituNL9AKuhanWSX15sfddi27f9fU4wzFdTasGhniEknftTjFXs3Mj9R7vKxWR9nVBMnPu8rfFTRTDA5`.

### 3.2 Not Proven

- The deployed smoke fixture is not the World Cup fixture used by the demo.
- No World Cup arena has completed TxLINE/TxODDS input through autonomous
  decisions, deterministic execution, API/SSE, and frontend end to end.
- The first third-place Live activation incorrectly converted pre-kickoff idle
  score-stream timeouts into six `DATA_FAILURE` rounds. Service was stopped and
  that immutable persistence was preserved. The local pending-window fix has
  not yet been released or re-smoked against a fresh rehearsal arena identity.
- The VPS runtime service is currently stopped after the invalid third-place
  activation. A fresh rehearsal activation, restart-resume proof, deliberate
  Replay fallback decision, and frontend consumer switch remain pending.
- The VPS runtime release symlink now targets the supervisor and strategy-v3
  build, but stopped service and invalid rehearsal persistence are not
  acceptance evidence.
- Production Replay evidence shows Alpha allocating once in six rounds and
  Beta returning `NO_TRADE` in all six. Alpha's allocating explanation also
  cites historical probability absent from its invocation.
- Current public navigation and featured arena are Replay-first.
- The latest external same-origin API smoke did not finish before the local
  tool network/usage limit. Gateway health remains unproven despite successful
  Vercel build and homepage response.
- The Event Ledger changes have not yet been deployed or matched against a
  persisted production World Cup SSE sequence in a browser.
- The successful winner-settlement smoke used an isolated deterministic test
  result hash. The deployed runtime has not yet submitted its persisted
  canonical `finalResultHash` through the restricted resolver seam.
- The Action service has not been deployed publicly or exercised through a
  Blink client. Frontend wallet signing and transaction proof remain absent.
- Demo-critical frontend routes still contain competing CSS foundations and
  inconsistent information hierarchy.

No incomplete item above may be described as live, autonomous end to end,
production-ready, or Solana-complete.

## 4. Current Demo Targets

Provider discovery on 2026-07-17 identified these World Cup fixtures:

- France vs England, fixture `18257865`, third-place match. Use as Live
  rehearsal and capture opportunity.
- Spain vs Argentina, fixture `18257739`, final. Use as primary featured arena.

Fixture identity, participants, start time, approved market availability, and
freshness must be revalidated from TxLINE/TxODDS before locking a manifest.
These identifiers are operational targets, not permanent product constants.

The runtime may execute one active arena. The frontend may list multiple
eligible or completed fixtures, but listing a fixture must not imply that an
Arena90 run exists. Every item must disclose `UPCOMING`, `LIVE`, `COMPLETED`,
`REPLAY`, or `UNAVAILABLE` honestly.

## 5. Work Order

Work strictly in this order. Do not start broad redesign, social automation,
or multi-arena infrastructure while an earlier gate is open.

### Gate 1 — Strategy Integrity

**Goal:** Both agents receive sufficient, identical evidence and express two
active, defensible policies.

Required:

- add one strategy-evidence module at the agent invocation seam;
- derive evidence deterministically from current and prior canonical snapshots;
- include pre-match anchor, previous checkpoint state, price movement, score
  movement, and elapsed match state without floating point;
- define Alpha as the overreaction policy and Beta as the underreaction policy;
- prohibit unsupported historical probability, baseline, movement, or event
  claims;
- keep `NO_TRADE` valid and never force action or disagreement;
- add scenario tests for underreaction, overreaction, no edge, stale data, and
  suspended data.

Acceptance evidence:

- both agents receive byte-equivalent shared strategy evidence;
- Alpha can allocate in a deterministic overreaction scenario;
- Beta can allocate in a deterministic underreaction scenario;
- both can return `NO_TRADE` in a no-edge scenario;
- explanations reference only supplied evidence;
- runtime build and focused tests pass.

### Gate 2 — Always-On World Cup Live Arena

**Goal:** One approved World Cup arena stays ready, starts without a public
manual trigger, survives restart, and consumes live provider data.

Required:

- prepare a locked Live manifest from revalidated TxLINE fixture identity;
- add an arena supervisor that starts with the VPS runtime;
- resume incomplete persisted state after restart;
- wait safely for valid kickoff/checkpoint evidence;
- invoke Alpha and Beta in parallel only at approved checkpoints;
- expose explicit waiting, delayed, suspended, missed-round, finalizing, and
  completed states;
- keep create/run controls private to the operator seam.
- require zero routine operator calls after service start; browser traffic must
  never trigger arena execution;

Acceptance evidence:

- clean boot reaches an honest Upcoming/Ready state without browser traffic;
- valid TxLINE input opens the correct checkpoint automatically;
- both agents resolve and reveal simultaneously;
- restart resumes without duplicate checkpoint or event;
- state and SSE show `TXLINE_LIVE` provenance;
- Replay still completes from a clean start.
- captured process and event evidence shows the complete run was supervisor-
  driven rather than manually advanced.

### Gate 3 — Spectator and Technical Proof

**Goal:** Normal users understand the competition; evaluators can verify it.

Required:

- make the current featured Live arena the primary action;
- show eligible World Cup fixtures without fabricating arena availability;
- show fixture, source, freshness, score, checkpoint, equal conditions,
  allocations, NAV, leader, next event, and final result;
- add a read-only Live Agent Activity/Event Ledger backed only by public SSE;
- allow filter, pause, inspect, and copy-proof actions, but no commands,
  prompts, manual decisions, or raw logs;
- show structured evidence and simultaneous reveal on the proof surface;
- retain Replay as a clearly labeled fallback.

Acceptance evidence:

- browser follows one Live arena from Upcoming/Ready through at least one
  checkpoint using real API/SSE state;
- Event Ledger entries match persisted public event sequence and hashes;
- loading, reconnect, delayed, suspended, and unavailable states are honest;
- desktop and mobile critical flows pass;
- frontend lint, tests, and build pass.

### Gate 4 — Solana Supporter Vertical Slice

**Goal:** A supporter backs one agent through a Blink and receives a verifiable
devnet outcome derived from the canonical arena result.

The approved `04-Supporter-Escrow-and-Blink-Settlement.md` specification owns
the accepted devnet token, supporter-position account model, backing deadline,
lock authority, TxLINE proof receipt, payout and fee mathematics, draw/void
refunds, canonical final-result binding, settlement authority, and Replay
exclusion. Legacy code is not a default.

Required:

- replace legacy names and Kamino-mock coupling with a V2 supporter program;
- initialize an arena from canonical arena identity and backing deadline;
- accept a user-signed Alpha or Beta backing transaction before lock;
- store supporter ownership separately from agent virtual capital;
- lock new backing at the approved deadline;
- settle once from authorized canonical final-result evidence;
- reject duplicate and unauthorized settlement;
- allow claim for an eligible terminal outcome and refund for draw/void;
- automatically lock from manifest time and submit deterministic settlement
  from canonical final-result evidence through a restricted resolver service;
- expose Solana Action/Blink metadata and transaction construction without
  custody or server-side user signing;
- display devnet transaction evidence in frontend and proof.

Acceptance evidence:

- initialize, back, lock, settle, claim, and refund paths pass program tests;
- Action GET/POST contracts pass;
- one wallet completes a devnet Blink transaction;
- duplicate/late backing and unauthorized/duplicate settlement fail;
- final result hash and transaction signature match frontend proof;
- no agent or LLM process can access wallet keys or supporter funds.

### Gate 5 — Release and Demo

**Goal:** A truthful demo can be repeated under live-match and fallback
conditions by the pitching team.

Required:

- harden VPS firewall, rate limits, process supervision, bounded logs, secret
  handling, health checks, release, rollback, and restart behavior;
- remove competing frontend foundations only where demo-critical;
- write one operator runbook and one timed demo script;
- rehearse Live using the earliest eligible World Cup fixture;
- record Live-preferred evidence and a clean Replay fallback;
- publish public repository, architecture summary, limitations, and demo video.

Acceptance evidence:

- clean release deploys without building source on VPS;
- backend/runtime and frontend survive restart and reconnect;
- Live rehearsal, Solana devnet flow, and Replay fallback each pass;
- all required builds, tests, diff checks, browser smokes, API smokes, provider
  smokes, security checks, and program tests pass;
- every submission claim matches recorded evidence.

## 6. Explicit Deferrals

Not required before demo acceptance:

- mainnet funds or mainnet deployment;
- Kamino or yield integration;
- multiple simultaneously running arenas;
- autonomous fixture selection without operator approval;
- autonomous X posting or social scheduler;
- public terminal commands, editable prompts, or user-controlled agents;
- direct user football-market trading;
- advanced markets beyond approved full-match `1X2`;
- broad redesign of non-demo-critical pages.

## 7. Branch and Completion Policy

- `v2/integration` remains the integration baseline.
- Current `v2/frontend-rebuild` is a deploy candidate, not an accepted final
  integration branch.
- Use one short-lived branch per open gate when work can be isolated. Cross-layer
  vertical changes may share one branch only when one acceptance test exercises
  the entire workflow.
- Merge only after the gate's commands, smoke, diff check, and scope audit pass.
- Never mark a gate complete from isolated tests when its downstream handoff is
  missing.
- Preserve unrelated user changes and never commit credentials, environment
  files, wallets, local ledgers, generated output, or private logs.

## 8. Demo Narrative

The pitching team should be able to say and show:

1. Arena90 receives live football and market evidence from TxLINE/TxODDS.
2. Alpha and Beta receive the same evidence and equal virtual bankrolls.
3. Alpha hunts overreaction; Beta hunts underreaction.
4. Both decide autonomously at fixed checkpoints.
5. Arena90 validates, reveals, executes, accounts, and selects the winner
   deterministically.
6. Spectators watch without a wallet and inspect verified public events.
7. Supporters may back an agent through a user-signed Solana Blink.
8. Canonical final-result evidence settles the supporter record on devnet.

If any sentence cannot be shown with current evidence, the corresponding gate
remains open.
