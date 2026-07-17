# Arena90 — User Experience & Routes

**Status:** Approved
**Related documents:**
- `01-Autonomous-Game-Loop-Decision.md`
- `02-Product-Definition-V2.md`

This document defines Arena90 V2 public routes, page responsibilities, public states, identity and wallet flows, and cross-route UX rules.

It does not redefine competition mechanics, portfolio accounting, TxLINE schemas, agent prompts, Anchor accounts, or settlement mathematics. Those belong to the approved game-loop decision and relevant technical specifications.

## 1. UX Purpose & Experience Model

Arena90 should present a complex autonomous strategy system as a clear football spectator experience.

The user should quickly understand:

- which fixture defines the arena;
- how Agent Alpha and Agent Beta differ;
- which agent is leading;
- what changed at the latest decision round;
- what happens next;
- which Solana action is currently available.

Watching does not require authentication.

### 1.1 Experience Model

Arena90 follows a spectator-first and football-first journey:

```text
Discover fixture
→ Understand both agents
→ Watch autonomous decision rounds
→ Follow portfolio performance
→ Understand the result
→ Complete the relevant supporter action
```

The autonomous AI competition is the primary experience. Solana is a core participation and settlement layer, but users should understand the arena before authentication or transaction approval.

### 1.2 Information Priority and Disclosure

Default information priority:

1. fixture and arena state;
2. Agent Alpha versus Agent Beta;
3. current leader and performance;
4. latest autonomous decision;
5. current portfolio allocation;
6. next decision round;
7. supporter and settlement state;
8. proof and technical evidence.

Primary surfaces show only the information needed to follow the competition. Expanded surfaces may show full allocations, rationale, performance history, supporter records, and timeline details. Proof surfaces may show snapshot identity, structured outputs, validation, deterministic transitions, versions, and transaction provenance.

### 1.3 Experience Boundaries

The public experience must not resemble:

- a conventional sportsbook;
- a user-facing trading terminal;
- a raw AI console;
- an operator dashboard;
- a wallet-gated landing page.

Proof must remain accessible without overwhelming the spectator journey.

## 2. Information Architecture & Routes

Arena90 uses a small route system centered on one stable arena identity.

### 2.1 Public Routes

| Route | Purpose |
|---|---|
| `/` | Product-first homepage and featured-arena entry |
| `/arena/[arenaId]` | Canonical arena experience across its lifecycle |
| `/arena/[arenaId]/replay` | Autonomous replay using recorded match data |
| `/arena/[arenaId]/proof` | Technical evidence and provenance |
| `/replays` | Replay archive and completed-arena discovery |
| `/agents` | Agent strategy profiles and evidence |
| `/how-it-works` | Product explanation for normal users |

Homepage previews should link to real routes rather than replace them.

### 2.2 Canonical Arena Lifecycle

One arena keeps one canonical public route:

`/arena/[arenaId]`

The same route supports:

```text
Upcoming
→ Backing Open
→ Backing Locked
→ Live
→ Paused or Finalizing
→ Completed
→ Claimable or Refundable
```

Do not create separate public routes for live, result, claim, refund, or support. Replay and Proof remain nested because they are distinct experiences, but both must derive from the same structured Arena Event Record as the canonical arena.

### 2.3 Primary Navigation and Contextual Action

Primary navigation:

```text
ARENA90
LIVE ARENA
REPLAYS
AGENTS
HOW IT WORKS
[CONTEXTUAL ACTION]
[ACCOUNT]
```

| Item | Destination |
|---|---|
| Arena90 logo | `/` |
| Live Arena | Current featured `/arena/[arenaId]` |
| Replays | `/replays` |
| Agents | `/agents` |
| How It Works | `/how-it-works` |

`LIVE ARENA` is dynamic, not a fixed `/live` route.

The main product action reflects featured-arena state:

| State | Action |
|---|---|
| Backing open | `Back an Agent` |
| Upcoming | `View Arena` |
| Live | `Watch Live` |
| Paused | `View Status` |
| Finalizing | `Track Settlement` |
| Claimable | `Claim` |
| Refundable | `Refund` |
| Completed | `Watch Replay` |
| No featured arena | `Explore Replays` |

A generic `Connect Wallet` must not replace the product-facing action.

### 2.4 Utility and Internal Routes

`/demo` may guide users into a prepared replay using the same replay engine. It must not contain a second scripted battle.

`/ops` may exist as a protected operational surface. It must not appear in public navigation or expose manual agent-decision controls.

### 2.5 Route Boundaries

The initial V2 route system does not require separate public Alpha/Beta pages, a full historical supporter dashboard, separate claim/refund pages, duplicate Live and Replay engines, or public infrastructure-log routes.

## 3. Homepage Experience

The homepage introduces the featured fixture, the Agent Alpha versus Agent Beta competition, and the current participation opportunity without requiring authentication.

### 3.1 Homepage Structure

The homepage contains five concise previews:

1. Featured Arena Hero
2. Agent Strategy Battle
3. How Arena90 Works
4. Featured Replays
5. Proof & Participation Layer

| Section | Destination |
|---|---|
| Featured Arena Hero | `/arena/[arenaId]` |
| Agent Strategy Battle | `/agents` |
| How Arena90 Works | `/how-it-works` |
| Featured Replays | `/replays` |
| Proof & Participation | `/arena/[arenaId]/proof` |

### 3.2 Featured Arena Hero

The first viewport communicates:

- featured fixture;
- arena mode and lifecycle state;
- Agent Alpha versus Agent Beta;
- supporter-window availability;
- state-driven primary action.

| State | Message | Action |
|---|---|---|
| Backing open | Choose the strategy you trust | `Back an Agent` |
| Upcoming | The next arena is preparing | `View Arena` |
| Live | The autonomous battle is active | `Watch Live` |
| Paused | The arena is temporarily paused | `View Status` |
| Finalizing | The result is being verified | `Track Settlement` |
| Completed | The result is available | `Watch Replay` |
| No featured arena | Explore a completed battle | `Explore Replays` |

The hero may include secondary links to How It Works, Agents, or Proof.

### 3.3 Agent, Replay, and Proof Previews

Alpha and Beta receive equal prominence. Each preview shows strategy identity, one-sentence contrast, one strength, one primary risk, and current or latest arena context.

The product sequence should be explained as:

```text
TxLINE football and market data
→ Shared canonical snapshot
→ Independent autonomous decisions
→ Deterministic portfolio execution
→ Visible result
→ Solana supporter backing and settlement
```

Featured replays show fixture, mode, result, a short turning point, and replay action.

Proof & Participation communicates auditable decisions, deterministic transitions, Solana-native supporter participation, and settlement provenance.

### 3.4 Homepage Visual Boundaries

Visual priority:

```text
Football as context
→ AI agents as competition
→ Solana as participation and settlement
```

The homepage must not be dominated by wallet controls, transaction hashes, contract addresses, raw outputs, infrastructure logs, or developer language. Every primary action should lead to a working product experience.

## 4. Live Arena Experience

The Live Arena is Arena90's primary spectator surface: a football match centre with an autonomous strategy-competition layer and visible, state-aware Solana participation.

### 4.1 Core Composition

The first viewport prioritizes:

1. fixture, score, minute, mode, and lifecycle state;
2. Agent Alpha versus Agent Beta;
3. current performance and provisional leader;
4. latest decision response;
5. next decision round;
6. current supporter action or record.

Expanded areas contain allocations, performance history, community backing, timeline, and proof access.

The match header must disclose data source and freshness. Public labels include `LIVE`, `REPLAY`, `SIMULATED`, `PAUSED`, `FINALIZING`, and `COMPLETED`. Recorded, delayed, or simulated data must never be presented as live.

### 4.2 Data Freshness and Degraded States

Allowed labels include:

- `DATA LIVE`;
- `DATA DELAYED`;
- `SNAPSHOT LOCKED`;
- `MARKET DATA UNAVAILABLE`;
- `WAITING FOR VERIFIED UPDATE`.

Later events must not alter a locked checkpoint snapshot. Missing scores, prices, timestamps, or market states must not be invented. Preserve the latest verified state and explain degraded conditions.

### 4.3 Agent Battle Board and Public Language

Both agents use the same card structure:

- agent and strategy identity;
- current equity or return;
- current allocation summary;
- latest decision;
- concise structured rationale;
- primary risk;
- current decision state.

Use team names and percentages rather than internal asset codes and basis points. Similar agent decisions are valid and must not be forced into theatrical disagreement.

Public explanation follows:

```text
Observed
→ Interpretation
→ Response
→ Allocation change
→ Primary risk
```

Do not expose private chain-of-thought, raw prompts, fabricated reasoning streams, fake terminal output, or unsupported certainty.

### 4.4 Portfolio and Performance

Use a stacked horizontal allocation bar with the same asset order across agents, rounds, Live, Replay, and result views.

Public assets may include home team, draw, away team, exact O/U 2.5 when enabled, and cash. Percentages must total 100%.

Show before-and-after allocation after a change. Risk indicators should derive from observable data such as exposure, concentration, change magnitude, cash, and drawdown.

A secondary performance chart may show both agents, checkpoint markers, provisional leader changes, and terminal settlement. Before Final Settlement, the leader must be labeled provisional.

Agent performance must remain separate from community backing, supporter-pool size, claimable value, and wallet balance.

### 4.5 Decision-Round Lifecycle

Visible round sequence:

```text
Checkpoint reached
→ Canonical snapshot locked
→ Both agents analyzing
→ Decisions received
→ Decisions validated
→ Simultaneous reveal
→ Portfolio state updated
```

Allowed states include `ANALYZING`, `DECISION RECEIVED`, `VALIDATING`, `RECHECKING DECISION`, `MISSED DECISION ROUND`, and `ROUND COMPLETE`.

Do not show fake progress percentages, fabricated reasoning, or one allocation before the simultaneous reveal. A constrained retry may display `RECHECKING DECISION` without exposing private validation details.

The reveal should answer what changed, why, how much, which risk remains, and how the competition changed. A brief countdown is optional and must respect reduced-motion preferences.

After reveal, persist a human-readable record containing checkpoint, both actions, before/after allocations, rationale, risk, validation state, and resulting performance effect.

Distinguish:

```text
Agent interpretation
→ strategy explanation

Deterministic portfolio consequence
→ system-computed transition, accounting, and performance
```

### 4.6 Timeline, Next Round, and Failure States

The append-only arena timeline combines football events, checkpoint snapshots, reveals, portfolio updates, retries, missed rounds, pause/resume, final match state, and Final Settlement.

Timeline details may show event match state, both decisions, before/after allocation, validation, consequence, and proof link. Raw process and debugging logs remain internal.

Always show the next expected competition event using checkpoint labels such as `NEXT DECISION — 30'` or `NEXT DECISION — HALFTIME`. Do not use misleading wall-clock countdowns or imply continuous trading. After 75', communicate that the final decision is complete and the system is waiting for verified Final Settlement.

Failure behavior:

- one failed agent: `MISSED DECISION ROUND`, preserve its portfolio, other valid decision remains effective;
- shared failure: `GLOBAL MISSED DECISION ROUND`, preserve both portfolios;
- Emergency Pause: stop new rounds while preserving existing arena, portfolio, and supporter state.

Do not fabricate decisions, convert failures into `NO_TRADE`, apply retroactive changes, hide failures, or manually select a winner.

### 4.7 Supporter and Proof Surfaces

The arena keeps a state-aware supporter surface:

- `BACK AN AGENT`;
- `BACKING LOCKED`;
- `YOUR BACKING`;
- `TRACK SETTLEMENT`;
- `CLAIM AVAILABLE`;
- `REFUND AVAILABLE`.

A connected supporter may see selected agent, amount, active wallet, transaction status, arena-specific record, and claim/refund eligibility.

Community backing is a fan-engagement signal only. It must not affect agent capital, information, strategy, execution, or winner determination.

Secondary proof actions may include `VIEW PROOF`, `INSPECT DECISION ROUND`, `VIEW SNAPSHOT RECORD`, and `VIEW TRANSACTION`.

Proof may show snapshot identity, structured decisions, validation, deterministic transitions, versions, event provenance, and relevant supporter/settlement records.

### 4.8 Mobile, Accessibility, and Boundaries

Mobile order:

1. fixture and arena state;
2. Alpha versus Beta;
3. current leader;
4. latest decision or reveal;
5. supporter action or record;
6. next decision round;
7. portfolio detail;
8. timeline and proof.

Both agents remain directly comparable; reveal must not split them into unrelated tabs.

Critical information must not rely only on color, animation, artwork, sound, hover, or desktop layout. Motion must respect reduced-motion preferences; controls must remain keyboard-, touch-, and assistive-technology accessible.

The Live Arena does not provide direct user trading, manual agent control, editable prompts, supporter influence over strategy, agent access to wallets or private keys, private chain-of-thought, raw infrastructure logs, fabricated live data, post-lock backing, unresolved automatic claim/refund, or public operator controls.

## 5. Replay Experience

Replay is a first-class autonomous competition over recorded football data, not video playback or a scripted demo.

It uses the same approved rules, runtime, decision contract, deterministic engine, failure behavior, and winner rules as Live Mode. Decisions are newly generated during each replay session.

### 5.1 Disclosure and Session Identity

Replay must show:

- `REPLAY`, `AUTONOMOUS REPLAY`, or `RECORDED MATCH DATA`;
- source fixture and match date;
- replay session status and run identity;
- source data;
- runtime and strategy versions where relevant;
- that decisions are being generated during the current replay.

Do not use `LIVE`, live pulses, or misleading real-time language.

A replay has its own append-only event record and result. It must not overwrite an original live arena. Separate runs over the same source match may produce different valid outcomes.

### 5.2 Entry and Controls

Standard Replay starts from kickoff.

`/demo` or a guided replay state may highlight snapshot, independent analysis, simultaneous reveal, portfolio consequence, final result, and proof, but must use the same replay engine.

Controls may include play, pause, restart, speed, jump to next/previous decision round, inspect event, and return to kickoff.

Recommended speeds: `1×`, `2×`, `4×`, and checkpoint-focused mode.

Before playback, the page may offer `Start Replay`, `View Result`, or `Resume Replay`. A spoiler-free entry may hide the original score and must not let the final replay winner dominate before the terminal state. Spoiler controls are optional for the MVP and do not require a separate route.

Acceleration must preserve event order, snapshot identity, decision timing relative to recorded events, simultaneous reveal, and deterministic transitions.

### 5.3 Timeline and Decision Rounds

Replay timeline acts as playback navigation and competition history.

It combines football events, decision rounds, reveals, allocation changes, failures/retries, and Final Settlement. Users may inspect completed events but may not edit the sequence.

Replay rounds use the same lifecycle as Live Mode. Both agents receive the same recorded canonical snapshot. Do not reveal one agent first, skip validation, replace outputs with manually written decisions, or introduce future events into earlier snapshots.

When real agent processing takes longer than accelerated playback, pause replay at the checkpoint until resolution. Do not advance later recorded events first.

### 5.4 Result and Original Arena Relationship

The result surface shows replay winner/draw, final replay equity/return, tie-break metrics when needed, run identity, completion/failure state, and proof access. Label it `REPLAY RESULT`.

When an original live arena exists, link the records but keep them separate:

```text
Original live arena
→ original competition and settlement

Current replay session
→ new competition over recorded source data
```

Differences are valid autonomous outcomes.

### 5.5 Supporter, Proof, and Recovery Rules

Replay does not open new backing, claim, refund, or settlement based on the replay winner. It may display clearly labeled historical supporter and settlement information from the original arena.

Each replay creates its own Arena Event Record containing source identity, run identity, snapshots, versions, decisions, transitions, failures, pauses, and final replay result.

Replay should preserve run identity, current position, completed rounds, portfolios, and result state across refresh or temporary disconnection. Resume from the latest valid state; do not regenerate completed rounds within the same run.

### 5.6 Mobile, Accessibility, and Boundaries

Mobile preserves source fixture and replay label, controls, Alpha versus Beta, leader, latest reveal, allocations, timeline, result, and proof.

Replay must remain understandable without color, motion, sound, artwork, or hover. Respect reduced motion.

Replay does not provide a second scripted engine, prerecorded dialogue presented as autonomous output, live labeling for recorded data, future information leakage, user editing, manual decision replacement, replay-based supporter settlement, modification of original live results, private chain-of-thought, or public raw infrastructure logs.

## 6. Agents Experience

The `/agents` route explains Agent Alpha and Agent Beta as autonomous strategy competitors without promising fixed actions or outcomes.

### 6.1 Profiles and Comparison

The page contains a concise introduction, both agent profiles, a direct comparison, recent evidence, and links to relevant arenas.

| Category | Agent Alpha | Agent Beta |
|---|---|---|
| Public identity | Overreaction Hunter | Underreaction Hunter |
| Core lens | Price moved faster than evidence | Evidence moved faster than price |
| Primary question | “Is this move a dislocation?” | “Is repricing incomplete?” |
| Typical opportunity | Reversal after unsupported movement | Continuation after verified change |
| Primary risk | Fading a real regime change | Chasing completed repricing |
| Cash behavior | No supported overreaction edge | No supported underreaction edge |
| Decision authority | Autonomous | Autonomous |

Both agents may take directional exposure, diversify, reduce exposure, hold
cash, or select `NO_TRADE`. The comparison must not frame Alpha as aggressive
and Beta as defensive, or predetermine disagreement, action frequency, or
winners.

### 6.2 Identity and Visual Language

Both agents belong to one original Arena90 visual universe.

Alpha may use dislocation, overshoot, reversal, and market-distortion motifs.
Beta may use continuation, lag, velocity, and incomplete-repricing motifs.
Both identities must feel active and equally capable of finding an edge.

Identity must not rely only on color or imitate protected characters, clubs, leagues, or third-party IP.

Stable internal identities must survive changes to public names, artwork, runtime, or strategy versions. Historical records preserve the exact versions used.

### 6.3 Performance and Explainability

The page may show recent Live results, Replay results, strategy return, round participation, missed rounds, and turning points derived from the Arena Event Record.

Live and Replay must be labeled separately. Small samples must not be presented as universal proof. Supporter popularity remains separate from performance.

Public explanations use observed state, interpretation, response, allocation change, and primary risk. Do not expose private prompts, private chain-of-thought, raw model logs, secrets, fabricated dialogue, or unsupported certainty.

### 6.4 Mobile and Boundaries

Keep both agent summaries comparable in one flow. Detailed evidence may be expandable, but strategy lens, primary risk, and recent performance remain easy to compare.

The initial V2 Agents experience does not include user-created agents, editable public prompts, manual decisions, agent tokens/NFTs, copy trading, supporter voting over strategy, wallet/private-key access, or claims that an agent always follows one action pattern.

## 7. Solana-Native Fan Participation

Arena90 is Web3-native and Web2-familiar. Solana provides participation, ownership, distribution, and settlement while the arena remains understandable before authentication.

### 7.1 Participation and Backing

Core journey:

```text
Discover fixture
→ Understand agents
→ Choose an agent
→ Back through Solana
→ Follow the competition
→ Track settlement
→ Claim or refund when eligible
```

Backing is a core mechanic, not decorative wallet integration. Show arena, selected agent, amount, deadline, active wallet, transaction status, settlement rule, and claim/refund state.

Backing closes according to arena lifecycle. Do not accept backing after lock.

Agent virtual bankroll and supporter funds remain separate. Greater backing must not change agent capital, information, timing, rules, or winner determination.

### 7.2 Social and Existing-Wallet Onboarding

On-chain journey:

```text
Choose agent
→ Enter amount
→ Continue with social identity or existing wallet
→ Confirm active Solana wallet
→ Review
→ Explicitly approve
→ Receive supporter record
```

Social login may provision an embedded wallet. Users may also connect compatible existing wallets.

One Arena90 account may include social identity, an embedded wallet, and linked external wallets. Wallet addresses remain the source of truth for backing ownership, claim/refund eligibility, and transaction ownership.

Linking a wallet must not silently create a separate account. When multiple wallets exist, show the active transaction wallet clearly. Every transaction requires explicit approval.

### 7.3 Blink Experience

A compatible Blink may provide:

```text
[BACK AGENT ALPHA]
[BACK AGENT BETA]
[VIEW ARENA]
```

Back actions initiate the relevant transaction directly when supported. `VIEW ARENA` opens `/arena/[arenaId]`.

Without a compatible wallet or embedded-wallet support, continue to the canonical website flow. Non-Blink clients fall back to the canonical arena route.

| Arena State | Blink Behavior |
|---|---|
| Backing open | Back Alpha, Back Beta, View Arena |
| Backing locked | View Arena |
| Live | Watch Arena |
| Finalizing | Track Settlement |
| Claimable | Claim |
| Refundable | Refund |
| Completed | View Result or Replay |

A Blink must never offer backing after lock.

### 7.4 Supporter Record and Transaction States

After confirmation, show arena, supported agent, amount, wallet, transaction reference, confirmation state, settlement state, and claim/refund eligibility.

The record remains available after refresh, reconnection, or returning to the arena.

Public transaction states:

```text
Awaiting approval
User cancelled
Transaction failed
Transaction submitted
Confirmation delayed
Transaction confirmed
```

Do not automatically resubmit a pending transaction. When confirmation is delayed, keep checking the existing transaction instead of requesting a duplicate.

### 7.5 Settlement and Provenance

Terminal supporter states may include:

- `FINALIZING`;
- `SETTLEMENT CONFIRMED`;
- `CLAIM AVAILABLE`;
- `REFUND AVAILABLE`;
- `CLAIMED`;
- `REFUNDED`.

Claim/refund is based on the approved on-chain settlement record and ownership wallet. Do not automatically claim, refund, void, or select a winner while unresolved.

Distinguish:

```text
Off-chain autonomous agent computation
Deterministic portfolio execution
On-chain supporter participation
On-chain settlement record
```

Proof links may expose arena, decision/event, supporter, settlement, and claim/refund transactions. Human-readable explanation comes before hashes or contract detail.

### 7.6 Participation Boundaries

Initial V2 does not include wallet-gated watching, supporter control over strategy, supporter funds as agent capital, post-deadline backing, replay-based backing/settlement, automatic approval, hidden active-wallet selection, agent wallet/private-key access, performance claims based on popularity, or provider-specific UX requirements.

Provider, program, account, and settlement implementation details belong to technical specifications.

## 8. Navigation, Identity & Cross-Route Principles

Arena90 should feel like one connected football, AI, and Solana product across discovery, backing, Live, Replay, Proof, and settlement.

### 8.1 Navigation and Product Action

Use the navigation and contextual action rules defined in Section 2 consistently across desktop, mobile, website, and Blink surfaces.

Proof, Demo, Ops, Claim, and Refund remain contextual rather than primary navigation destinations.

When a user has a supporter record, the account area may show `My Backing`.

### 8.2 Identity Model

Watching does not require authentication.

For on-chain actions, support social identity with an embedded Solana wallet and connection of compatible external wallets.

```text
Arena90 account
├── Social identity
├── Embedded Solana wallet
└── Linked external Solana wallets
```

Social identity provides familiar access and session continuity. Wallet addresses remain the source of truth for on-chain ownership.

The active transaction wallet must always be visible before approval.

### 8.3 Arena, Blink, and Session Continuity

The canonical arena identity, fixture, agents, deadline, backing state, supporter record, result, and settlement state must remain consistent across homepage, arena, Blink, Replay, Proof, and shared links.

Preserve safe progress across authentication, wallet applications, route changes, and transaction confirmation when possible:

- selected agent;
- entered amount;
- active arena;
- active transaction wallet;
- submitted transaction;
- confirmed supporter record.

Returning from a wallet application must not leave ambiguous state. Pending transactions must not be auto-submitted again. Confirmed supporter records remain available after refresh or reconnection.

### 8.4 Shared State Language

Use one consistent public vocabulary, including:

- `BACKING OPEN`;
- `BACKING LOCKED`;
- `LIVE`;
- `DATA DELAYED`;
- `AI DECISION ROUND`;
- `PAUSED`;
- `FINALIZING`;
- `COMPLETED`;
- `DRAW`;
- `CLAIM AVAILABLE`;
- `REFUND AVAILABLE`;
- `REPLAY`;
- `SIMULATED`.

Website and Blink must not expose conflicting actions or states. Recorded, delayed, simulated, or replay data must never be presented as live.

### 8.5 Responsive, Accessible, and Honest UX

Responsive layout may change composition but not meaning.

Preserve fixture/arena state, Alpha versus Beta, contextual action, latest decision/result, performance, supporter/transaction state, timeline, and proof access.

Both agents remain directly comparable. Critical meaning must not rely only on color, art, animation, sound, hover, or desktop layout.

Distinguish honestly between live and recorded data, provisional and final results, off-chain agent computation, deterministic execution, on-chain participation, and trusted/mocked/verified components.

### 8.6 Cross-Route Boundaries

The initial V2 experience does not require wallet-gated browsing, different public routes for every arena state, duplicate engines, separate public claim/refund routes, separate accounts for social and wallet entry, public raw logs, desktop-only comparison, conflicting website/Blink terminology, or a provider-specific identity requirement.

Provider choice and implementation details belong to MVP and technical specifications.
