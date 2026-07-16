# Arena90 — V2 Delivery Roadmap

**Status:** Approved

This document defines V2 delivery order, slice boundaries, and acceptance
gates. It does not override approved product documents or
`specs/01-P0-Arena-Runtime.md`. Those documents remain authoritative for
product behavior and runtime contracts. When a conflict exists, stop and
resolve it before implementation. Within those boundaries, this roadmap is
implementation-authoritative for delivery sequencing and acceptance.

## 1. Completed Baseline

- **Slice 0 — Product and repository guidance:** complete.
- **Slice 1 — Runtime contracts and validation:** complete at commit
  `7ca6ff8`.
- **Slice 2 — Deterministic portfolio engine:** complete at commit `630b819`.
- **Slice 3 — Checkpoint orchestration:** complete at commit `7951465`.
- **Slice 4 — Real ZeroClaw agents:** complete at commit `d2714ab`.
- **Slice 4.1 — Agentic VPS staging deployment and live Alpha/Beta smoke:**
  complete.

## 2. Delivery Guardrails

- The recorded checkpoint fixture remains a mandatory fallback through final
  submission. Live-data availability must not remove or weaken Replay.
- Live data, Replay data, agents, APIs, and the frontend use the same canonical
  runtime contracts. Adapters translate into those contracts; consumers do not
  create competing schemas or accounting rules.
- Live and Replay use the same validation, orchestration, execution,
  accounting, settlement, and winner logic.
- Solana does not execute LLM inference or portfolio accounting. It consumes
  only the approved arena and final-result contracts required for supporter
  participation and settlement proof.
- A slice is complete only when its acceptance gate passes without fallback
  decisions, fabricated states, or claims beyond the verified integration.

## 3. Delivery Order

The critical path is:

`Slice 5 → Slice 6 → Slice 7 → Slice 8 → Slice 10 → Slice 11`

Slice 9 may begin after Slice 6 freezes the final-result contract. It may
proceed in parallel with Slices 7 and 8, but it must pass before Slice 11.

## 4. Slice 5 — TxLINE/TxODDS Live Data Adapter

**Goal:** Convert verified live provider updates into the existing canonical
snapshot contract without changing runtime rules.

**In-scope deliverables:**

- configurable TxLINE/TxODDS client boundary and live data adapter;
- deterministic mapping of fixture state and normalized `1X2` prices;
- provider sequence, duplicate ID, freshness, suspension, checkpoint, arena,
  and snapshot-hash validation;
- explicit provider and data-failure behavior using existing global missed
  round semantics;
- unit tests with recorded provider-shaped inputs;
- an authorized live connectivity smoke using the provisioned project
  credentials;
- provisioned TxLINE/TxODDS credentials kept outside Git and sanitized adapter
  and smoke logs that never expose tokens.

**Non-goals:**

- changing canonical contracts, portfolio formulas, agent behavior, or winner
  rules;
- lifecycle scheduling, persistence, HTTP APIs, frontend work, or Solana;
- removing or bypassing the recorded fixture.

**Acceptance gate:** Identical provider inputs produce identical canonical
snapshots; malformed, stale, suspended, duplicate, or out-of-order data cannot
create a trade; build, tests, diff check, and scope audit pass; the authorized
live connectivity smoke passes using the provisioned project credentials and
produces only sanitized logs; Replay remains fully operational.

## 5. Slice 6 — Arena Lifecycle Runner and Persistence

**Goal:** Run one arena deterministically from creation through final
settlement with restart-safe state.

**In-scope deliverables:**

- one-arena lifecycle state machine for Live and Replay;
- ordered checkpoint scheduling and terminal settlement without a `FINAL`
  agent call;
- persistence for the locked manifest, canonical snapshots, public events,
  portfolios, revealed decisions, failures, and final result;
- idempotent run, checkpoint, resume, and settlement behavior;
- explicit mode selection with the recorded fixture retained as fallback;
- end-to-end lifecycle and restart-recovery tests.

**Non-goals:**

- multi-arena concurrency, distributed scheduling, or high availability;
- public HTTP/SSE surfaces, frontend integration, or Solana settlement;
- changes to deterministic execution or accounting.

**Acceptance gate:** A recorded arena completes every checkpoint and final
settlement after clean start and restart; a live arena follows the same path
when valid data is available; duplicate work is harmless; persisted state and
events reproduce the terminal result; the final-result contract is frozen for
Slice 9.

**Frozen handoff contract:** The nested terminal result is schema V2 with
`FINAL_NAV_ONLY_V1`, provider-bound terminal evidence, completed-event binding,
pre-settlement event-log hash, and final-result hash. Persistence is atomic
JSON with restart recovery. These are breaking consumer changes from the old
schema V1 result.

## 6. Slice 7 — HTTP and SSE API

**Goal:** Expose the lifecycle through stable public state and ordered event
stream contracts.

**In-scope deliverables:**

- health, arena creation, run, state, and event endpoints required by the
  runtime specification;
- an SSE stream using the same ordered public events as persisted history;
- reconnect and resume behavior without duplicate or reordered events;
- request, response, and error validation at the API boundary;
- protection against exposure of prompts, raw model output, secrets, private
  reasoning, hidden decisions, and infrastructure logs;
- API and stream contract tests.

**Non-goals:**

- frontend implementation, wallet authentication, Solana actions, or public
  operator administration;
- new agent, engine, accounting, or lifecycle behavior;
- WebSocket or multi-arena infrastructure.

**Acceptance gate:** API tests prove idempotent run behavior, canonical state,
monotonic resumable SSE events, simultaneous decision reveal, honest failure
states, and absence of private data; build, tests, diff check, scope audit, and
local API smoke pass.

## 7. Slice 8 — Frontend Live Arena Integration

**Goal:** Connect the approved spectator experience to the canonical runtime
API without mocked competition progress.

**In-scope deliverables:**

- Live Arena state loading and SSE subscription;
- match state, checkpoint progress, portfolios, NAV, returns, leader, revealed
  decisions, failures, final result, and source-mode presentation;
- reconnect, delayed, suspended, missed-round, finalizing, completed, and
  unavailable states;
- explicit Live and Replay labeling with Replay fallback access;
- responsive and accessible integration tests for the critical spectator
  flow.

**Slice 8 handoff:** Update frontend state, history, and SSE consumers to parse
the nested final-result schema V2 and render terminal evidence safely. Do not
infer legacy tie-breakers or accept the removed schema V1 final result.

**Non-goals:**

- redesigning unrelated routes or restoring V1 battle concepts;
- direct market trading, editable prompts, manual agent control, or fabricated
  reasoning streams;
- wallet, backing, claim, refund, or other Solana UX.

**Acceptance gate:** A spectator can follow one arena from ready state through
completion using real API/SSE state; decisions remain hidden until reveal;
failure and reconnect states are honest; Live and Replay render from the same
contracts; frontend build, tests, scope audit, and browser smoke pass.

## 8. Slice 9 — Minimal Solana Devnet Settlement Proof

**Goal:** Prove that one canonical arena settlement can be recorded on devnet
from the frozen runtime result.

**In-scope deliverables:**

- initialize or record an arena settlement;
- store the canonical final snapshot hash;
- store a deterministic final-result or event-log hash;
- record the winning agent and Alpha/Beta final NAV;
- reject duplicate or unauthorized settlement;
- return transaction evidence usable by the frontend.

**Non-goals:**

- participation, escrow, claim, refund, tokenomics, custody, or supporter-fund
  handling;
- mainnet deployment, broad wallet UX, or unrestricted transaction
  construction;
- allowing agents to access wallets, keys, or settlement authority;
- LLM inference, portfolio execution, portfolio accounting, or winner
  calculation on Solana.

**Acceptance gate:** One authorized devnet transaction records the final
snapshot hash, deterministic final-result or event-log hash, winning agent, and
both final NAV values; duplicate and unauthorized settlement attempts fail;
the frontend can consume the returned transaction evidence; required tests,
builds, diff check, scope audit, and devnet smoke pass.

## 9. Slice 10 — Deployment Hardening

**Goal:** Make the critical-path backend/runtime repeatably deployable on the
current agentic VPS and the frontend repeatably deployable to an approved
separate hosting target.

**In-scope deliverables:**

- reproducible backend/runtime and frontend release builds on Mac or CI;
- versioned backend/runtime and frontend artifacts with deployment and rollback
  steps;
- backend/runtime environment validation, secret handling, process supervision,
  health checks, restart policy, bounded logs, and release diagnostics on the
  agentic VPS;
- backend reverse-proxy and transport configuration required for HTTP and SSE;
- frontend deployment to an approved separate static or application hosting
  target with explicit backend connectivity configuration;
- recorded end-to-end smoke plus safe live provider and agent connectivity
  checks.

**Non-goals:**

- building source on the VPS;
- hosting the frontend on the agentic VPS;
- multiple active arenas, horizontal scaling, Kubernetes, or high availability;
- replacing the recorded fallback or weakening runtime validation for uptime.

**Acceptance gate:** A clean backend/runtime release artifact deploys to the
agentic VPS, starts, survives process restart, and serves API/SSE health checks;
a clean frontend artifact deploys to the approved separate hosting target and
connects to that backend; rollback steps work; the recorded end-to-end smoke
and live provider and agent connectivity smokes pass without VPS source builds
or secret exposure.

## 10. Slice 11 — Final Demo and Submission

**Goal:** Deliver a truthful, reproducible demonstration and complete submission
package.

**In-scope deliverables:**

- final Live-preferred demo flow with mandatory recorded Replay fallback;
- operator runbook covering startup, arena execution, failure recovery,
  settlement proof, and fallback activation;
- verified evidence for shared snapshots, independent Alpha/Beta calls,
  reveal, deterministic accounting, final result, public API/frontend state,
  and any devnet proof;
- final validation report, architecture summary, limitations, and submission
  assets.

**Non-goals:**

- new product features, late contract changes, unsupported production claims,
  or removal of fallback paths;
- presenting recorded, mocked, trusted, partial, or devnet components as live,
  autonomous, trustless, mainnet, or production-ready.

**Acceptance gate:** The release completes the critical spectator flow and
final settlement, the recorded fallback works from a clean start, the required
builds, tests, diff checks, scope audits, browser/API/runtime smokes, and devnet
proof pass, and all submission claims match verified behavior.

## 11. Branch Policy

- `v2/integration` is the integration baseline.
- Use one short-lived branch per slice.
- Merge only after build, tests, `git diff --check`, scope audit, and required
  smoke tests pass for that slice.
- Do not create all future branches in advance.
- A parallel Slice 9 branch starts only after Slice 6 freezes the final-result
  contract.

## 12. Agentic VPS Deployment Constraints

- Run one active arena.
- Allow two parallel agent calls, one for Alpha and one for Beta.
- Host the backend/runtime release only on the agentic VPS.
- Build the backend/runtime and frontend on Mac or CI.
- Deploy the frontend to an approved separate static or application hosting
  target.
- Run backend/runtime release artifacts only on the agentic VPS.
- Do not expand these limits until the current critical path and final demo are
  accepted.
