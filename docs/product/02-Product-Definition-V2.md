# Arena90 — Product Definition V2

**Status:** Approved
**Related documents:**
- `01-Autonomous-Game-Loop-Decision.md`
- `03-User-Experience-and-Routes.md`

## 1. Purpose & Product Definition

This document defines Arena90 as a product: its category, users, core experience, agent identities, data and Solana roles, principles, and V2 boundaries.

Arena90 is a live autonomous AI strategy arena powered by real football data.

In each arena, two autonomous AI agents receive the same verified football-market information, begin with equal virtual bankrolls, independently manage target portfolios, and compete under deterministic execution and winner rules.

Users may watch without authentication. Before backing closes, a supporter may back the strategy they trust through a Solana Blink. Supporter funds remain separate from agent virtual capital, and agents never control wallets, private keys, supporter funds, or arbitrary on-chain transactions.

Authority is divided as follows:

- `01-Autonomous-Game-Loop-Decision.md` defines competition mechanics, checkpoints, failures, deterministic execution, and winner rules.
- This document defines the product, users, principles, and scope.
- `03-User-Experience-and-Routes.md` defines routes, page responsibilities, identity UX, and public presentation.
- Technical specifications define schemas, formulas, runtime configuration, Anchor accounts, and payout mathematics.

## 2. Product Category & Positioning

Arena90 is an:

> **Autonomous AI strategy arena**

Public positioning:

> **A live autonomous AI strategy arena powered by real football data.**

Technical positioning:

> **Two autonomous agents interpret the same football-market data, independently manage equal virtual portfolios, and compete for the strongest final performance.**

The product layers are:

- football markets as the competition environment;
- TxLINE as the match and market data source;
- autonomous agents as strategy competitors;
- a deterministic system as validator, executor, accountant, and winner resolver;
- Solana Blinks, supporter records, and settlement as the participation layer.

Solana participation is a core Arena90 product layer. Backing is optional for an individual spectator, but Blink participation, on-chain supporter ownership, and settlement are required parts of the product.

Arena90 is not primarily:

- a sportsbook;
- a user-facing football trading terminal;
- a prediction dashboard;
- a copy-trading platform;
- a chatbot;
- a one-pick AI wrapper;
- an AI-controlled wallet.

Users do not directly trade football markets. They watch an autonomous strategy competition and may back one agent before the supporter window closes.

Product messaging should emphasize agent-versus-agent competition, equal information, independent strategy, virtual portfolio performance, visible decisions, and auditable outcomes.

Product messaging must not imply that agents control supporter funds, supporter deposits become agent trading capital, agents are permanently assigned to football outcomes, or mocked and trusted components are fully trustless or production-ready.

## 3. Target Users

| User | Core job | Required product capability |
|---|---|---|
| Spectator | “Show me which AI understands and reacts to the match better.” | Watch without a wallet; understand leader, allocation, latest decision, next round, and result. |
| Supporter | “Let me back the autonomous strategy I trust.” | Choose Alpha or Beta, approve a Solana transaction, track ownership, and claim or refund when eligible. |
| Arena Operator | Deploy and supervise arenas safely. | Configure an allowlisted manifest before deployment, monitor health, and use emergency pause or recovery only. Routine arena execution is automatic. |
| Technical Evaluator | Verify that the competition is real and reproducible. | Inspect shared snapshots, versions, structured outputs, validation, portfolio transitions, failures, and final-result provenance. |

A supporter does not select individual football-market outcomes, control agent decisions, or fund an agent’s virtual portfolio.

Wallet connection is required only for on-chain actions.

The operator must not manually start checkpoints, select agent trades, lock
backing, choose a winner, or rewrite portfolio decisions. An operator may
approve configuration before deployment and intervene for emergency safety or
recovery. Once deployed with a locked manifest, normal TxLINE ingestion,
checkpoint scheduling, agent invocation, reveal, deterministic execution,
accounting, and finalization run without routine human input.

Technical proof is secondary to the spectator experience and must not overwhelm normal users.

## 4. Core Product Experience

Arena90 follows one product lifecycle:

1. **Discover the arena.** Show the featured fixture, competing agents, arena state, start timing, backing availability, and whether the experience is Live or Replay.
2. **Understand the competitors.** Explain each agent through strategy lens, reaction style, portfolio behavior, use of cash, and primary risk. Agent identity describes strategy, not a fixed football outcome.
3. **Optionally back an agent.** Before the window closes, a supporter may back Alpha or Beta through Solana. This supports a strategy; it does not direct trades, add agent capital, or grant wallet control to AI.
4. **Watch the autonomous battle.** Present visible decision rounds, current match state, equity, leader, allocations, latest change, structured rationale, risk, and the next competition event.
5. **Understand the result.** Show the final football result, final portfolios, equity, relevant risk metrics, winner or draw, result provenance, and the available claim or refund action.

The product must distinguish a valid win, valid draw, paused state, finalizing state, void, claimable state, and refundable state.

Replay Mode provides the same core competition using recorded match data and newly generated autonomous decisions. It is not a scripted substitute.

Detailed page composition and route behavior belong to `03-User-Experience-and-Routes.md`.

## 5. Agent Roles & Strategic Identity

Agent Alpha and Agent Beta are autonomous strategy competitors operating under equivalent conditions:

- the same canonical snapshot;
- equal starting virtual bankrolls;
- the same enabled assets;
- the same checkpoints;
- the same deterministic execution engine;
- the same winner rules.

They are not permanently assigned to opposite outcomes, scripted to disagree, supporter-controlled, wallets, custodians, or simple aggressive-versus-conservative presets.

### 5.1 Agent Alpha — Overreaction Hunter

Alpha asks:

> **Did the market move faster than the verified match evidence?**

Alpha hunts market overreaction and dislocation. It gives more weight to the
pre-match anchor, movement since the previous checkpoint, consistency between
price and verified match evidence, reversal potential, and whether price moved
farther than the evidence supports.

Alpha may take directional exposure, reallocate, concentrate, reduce exposure,
hold cash, or select `NO_TRADE`. Alpha is not the aggressive agent; it acts
only when supplied evidence supports an overreaction thesis.

V2 primary signal: no new goal appears in `matchDeltaFromPrevious`, but an
outcome price moves by at least `150000` micros within at most 15 elapsed match
minutes. This is treated as an overshoot; Alpha allocates away from that
overpriced outcome toward supported alternatives or cash.

Primary risk: fading a real regime change that deserves its new price.

### 5.2 Agent Beta — Underreaction Hunter

Beta asks:

> **Did verified match evidence move faster than the market?**

Beta hunts market underreaction. It gives more weight to verified match-state
change, movement since the previous checkpoint, acceleration or reversal in
probabilities, and evidence that may not yet be fully reflected by price.

Beta may follow a continuation, reallocate, concentrate, reduce exposure,
hold cash, or select `NO_TRADE`. Beta is not the defensive agent; it acts only
when supplied evidence supports an underreaction thesis.

V2 primary signal: a new goal appears in `matchDeltaFromPrevious` while the
scoring side's normalized price rises by less than `80000` micros from the
previous checkpoint. This is treated as incomplete repricing.

Primary risk: overreacting to short-term movement or chasing information already priced.

### 5.3 Strategic Contrast

| Dimension | Agent Alpha | Agent Beta |
|---|---|---|
| Core lens | Market overreaction | Market underreaction |
| Central question | Price moved; was evidence too weak? | Evidence moved; was price too slow? |
| Evidence preference | Dislocation and reversal | Continuation and incomplete repricing |
| Valid posture | Directional, diversified, reduced, or cash | Directional, diversified, reduced, or cash |
| Primary weakness | Fading a real regime change | Chasing a completed repricing |

Both agents may select the same asset, take opposing positions, use different sizes, preserve portfolios, close exposure, hold cash, or change views. The system must not force disagreement.

Differences should emerge from strategy policy, evidence weighting, portfolio context, risk envelope, and autonomous interpretation.

Both agents must receive the same strategy evidence. A strategy may claim only
evidence present in the invocation. If movement, an anchor, or a baseline is
part of a strategy, the invocation must supply current and prior verified
market state or deterministic derived evidence. An agent must not invent
historical probability, movement, baseline value, or match evidence.

`NO_TRADE` remains valid. The system must not force action or disagreement.
However, strategy acceptance must include deterministic underreaction and
overreaction scenarios proving that each policy can produce a valid target
allocation when its own evidence exists.

`Agent Alpha` and `Agent Beta` are public placeholders that may change without altering their product roles. Exact prompts, models, evidence weights, risk limits, output schemas, and validation rules belong to the Agent Decision specification.

## 6. TxLINE, Competition, Solana & Supporter Funds

Arena90 separates external evidence, autonomous strategy, deterministic execution, and supporter participation.

| Layer | Responsibility | Must not do |
|---|---|---|
| TxLINE | Provide fixture, lifecycle, and market evidence used to construct canonical snapshots. | Decide allocations, select the winner, control funds, or replace Arena90 validation. |
| Autonomous agents | Interpret the approved snapshot and choose target virtual portfolio allocations. | Construct market data, calculate accounting, sign transactions, or control settlement. |
| Deterministic system | Validate outputs; derive execution; calculate pricing, accounting, risk, and winner state. | Invent strategy decisions or rewrite valid agent output. |
| Solana Blinks and programs | Provide supporter participation, ownership records, distribution, claim, refund, and settlement surfaces. | Act as a football trading terminal or agent command interface. |
| Supporter funds | Represent confidence in an agent through user-signed on-chain participation. | Increase agent bankroll, affect strategy, create competitive advantage, or become accessible to an LLM. |

Both agents receive the same approved snapshot derived from TxLINE-compatible data.

Arena90 must disclose whether data is:

- live TxLINE data;
- recorded TxLINE-compatible Replay data;
- simulated or mock data.

Simulated or recorded data must not be presented as live.

Before backing closes, a Blink may offer Alpha, Beta, and View Arena actions. After locking, it must stop offering new backing and instead expose the relevant watch, result, claim, or refund action.

Capital separation is authoritative:

```text
Agent virtual bankroll
→ deterministic strategy competition only

Supporter funds
→ user-signed Solana participation and settlement only
```

The amount or popularity of supporter backing must never change agent capital, information, strategy, timing, execution, or winner determination.

Preferred language:

| Use | Avoid |
|---|---|
| `Back Agent Alpha` | `Fund the agent portfolio` |
| `Back Agent Beta` | `Inject trading liquidity` |
| `Support the strategy you trust` | `Trade through the agent` |
| `Watch the autonomous battle` | `Let the AI control your funds` |

Exact Blink states, ownership records, Anchor instructions, claims, refunds, fees, and payout mathematics belong to the Supporter Escrow and Blink Settlement specification.

## 7. Product Principles

1. **AI competition comes first.** Football data, virtual markets, Solana participation, and optional integrations must strengthen the autonomous competition rather than turn Arena90 into conventional wagering with AI decoration.

2. **Fair competition.** Both agents receive equal information, bankrolls, enabled assets, checkpoints, validation, execution, and winner rules. Strategy differences must come from policy and interpretation.

3. **Autonomous but constrained.** Agents choose target portfolios without human approval at each checkpoint, while data construction, pricing, execution, accounting, wallets, settlement, and winner selection remain outside agent control. Operators may pause for safety but may not rewrite decisions.

4. **Spectator-first clarity.** Users should understand the leader, equity, allocations, latest change, structured rationale, risk, and next event without needing trading, blockchain, or AI-infrastructure expertise.

5. **Capital separation.** Agent bankrolls and supporter funds remain operationally, visually, and linguistically separate.

6. **Verifiable, not performative.** Structured snapshots, versions, outputs, validation, portfolio transitions, failures, and winner calculations provide evidence. Animation, personality, and terminal styling do not substitute for proof.

7. **Honest system states.** Arena90 must distinguish Live, Replay, Simulated, Delayed, Paused, Finalizing, Completed, Claimable, Refundable, and Void states, and must identify trusted, mocked, or partial integrations accurately.

8. **Reliable demonstration.** Replay must preserve the same runtime, decision contract, deterministic engine, failure rules, and winner rules as Live Mode so the core product remains demonstrable without an eligible live fixture.

## 8. Product Boundaries

Arena90 V2 focuses on one complete, verifiable autonomous strategy competition around one football match.

### 8.1 Included in V2

V2 includes:

- two autonomous strategy agents;
- equal virtual starting bankrolls;
- verified fixture and market data;
- a locked Arena Manifest;
- fixed decision checkpoints;
- independent structured decisions;
- deterministic validation, execution, accounting, and winner calculation;
- Live and Replay modes using the same competition engine;
- spectator-facing portfolio, equity, rationale, risk, result, and timeline views;
- Solana-native supporter backing through Blinks with wallet-free watching;
- on-chain supporter ownership records and separate escrow and settlement flows;
- win, draw, pause, finalizing, void, claim, and refund states;
- technical audit evidence;
- zero-touch normal operation after deployment, with operator-controlled
  emergency safety and recovery;
- assisted future-arena preparation through an Arena Orchestrator.

Implementation depth must be described honestly. Mocked, trusted, partial, or experimental components must not be represented as production-ready.

### 8.2 Excluded from the Initial V2 Scope

Initial V2 does not require:

- direct user trading of football markets;
- agents controlling supporter funds, signing arbitrary transactions, or holding private keys;
- real-money agent portfolio execution;
- user-created agents or user-defined prompts;
- multiplayer tournaments or more than two agents per arena;
- multiple simultaneous featured arenas;
- permanent agent tokens or NFTs;
- copy trading;
- an internal social feed;
- fully autonomous social publishing;
- fully autonomous fixture selection without an approval gate;
- guaranteed support for every football fixture;
- advanced derivatives or unrestricted market selection;
- a fully decentralized or trustless resolver;
- production-grade Kamino integration;
- mobile-native applications.

These may be considered only after the core arena is stable and auditable.

### 8.3 Market Boundary

The Arena Manifest defines every enabled asset.

Required:

- full-match `1X2`.

Optional:

- exact full-match `Over/Under 2.5`, only when valid and fresh at manifest lock.

Arena90 must not silently substitute a different totals line, and agents may not introduce assets absent from the manifest.

### 8.4 Autonomy Boundary

Agent autonomy is limited to interpreting approved data and selecting target virtual portfolio allocations.

Agents do not autonomously control:

- fixture eligibility;
- market-data validation;
- Arena Manifest locking;
- contract deployment;
- Blink or social publication;
- emergency actions;
- final settlement authority.

The deterministic runtime does control normal supporter-window timing and
competition finalization from the locked manifest and verified terminal
evidence. A restricted resolver service may automatically submit an on-chain
settlement derived from the canonical final-result hash; neither agent nor an
LLM receives resolver authority.

For the MVP, fixture eligibility, manifest content, deployment, contract
deployment, public Blink publication, and emergency actions remain operator
configuration or safety responsibilities. After deployment, normal arena
operation must require no manual create, run, checkpoint, trade, lock, winner,
or settlement-selection action. Wallet owners still explicitly approve their
own backing, claim, or refund transactions.

### 8.5 Product Expansion Rule

A new feature enters V2 only when it:

1. strengthens the autonomous competition;
2. preserves fair and equal conditions;
3. keeps supporter capital separate from agent capital;
4. remains understandable to spectators;
5. can be executed and audited reliably;
6. does not create a critical dependency that prevents the core arena from being demonstrated.

Features that fail these conditions belong in a later version or separate specification.
