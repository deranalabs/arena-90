# Arena90 — User Experience & Routes

**Status:** Approved
**Related documents:**
- `01-Autonomous-Game-Loop-Decision.md`
- `02-Product-Definition-V2.md`

**Implementation authority:** Do not implement this document until its status is `Approved`.

This document defines the public user experience, information architecture, routes, and cross-route interaction principles for Arena90 V2.

It does not define:

- autonomous competition rules;
- portfolio formulas;
- TxLINE adapter schemas;
- agent prompts or runtime configuration;
- Anchor account structures;
- settlement mathematics.

Those rules belong to the approved game-loop decision and relevant technical specifications.

## 1. UX Purpose & Experience Model

Arena90 should present a complex autonomous trading system as a clear football spectator experience.

The interface must help users understand:

- which football fixture defines the arena;
- how Agent Alpha and Agent Beta differ;
- which agent is currently leading;
- what changed at the latest decision round;
- why the change matters;
- what happens next;
- which Solana action is currently available.

### 1.1 Experience Model

Arena90 follows a spectator-first and football-first model.

The intended journey is:

```text
Discover the fixture
→ Understand both agents
→ Watch autonomous decision rounds
→ Follow portfolio performance
→ Understand the final result
→ Complete the relevant supporter action
```

The autonomous AI competition is the primary product experience.

Solana participation is a core product layer, but users should understand the arena before being asked to authenticate, connect a wallet, or approve a transaction.

Watching an arena does not require authentication.

### 1.2 Information Priority

Across the product, information should generally appear in this order:

1. arena and football-match state;
2. Agent Alpha versus Agent Beta;
3. current leader and performance;
4. latest autonomous decision;
5. current portfolio allocation;
6. next decision round;
7. supporter and settlement state;
8. proof and technical evidence.

This order may adapt to the arena lifecycle, but football context and agent competition must remain immediately understandable.

### 1.3 Progressive Disclosure

Arena90 should reveal complexity in layers.

The primary experience shows:

- fixture and score;
- arena status;
- both agents;
- leader and performance;
- latest decision;
- next checkpoint;
- primary Solana action.

Expanded surfaces may show:

- full allocations;
- performance history;
- structured rationale;
- community backing;
- supporter records;
- arena timeline.

Proof surfaces may show:

- canonical snapshot identity;
- structured agent output;
- validation results;
- deterministic portfolio transitions;
- runtime and strategy versions;
- transaction and settlement provenance.

Normal users should not need to understand the proof layer to follow the competition.

### 1.4 Experience Boundaries

The public experience must not resemble:

- a conventional sportsbook;
- a user-facing trading terminal;
- a raw AI console;
- an operator dashboard;
- a wallet-gated landing page.

Technical evidence should remain accessible without overwhelming the main spectator journey.

## 2. Information Architecture & Routes

Arena90 uses a small route system built around one featured arena and a clear spectator journey.

Public routes should represent distinct user experiences rather than every internal arena state.

### 2.1 Public Routes

| Route | Purpose |
|---|---|
| `/` | Product-first homepage and featured-arena entry |
| `/arena/[arenaId]` | Canonical arena experience across the full lifecycle |
| `/arena/[arenaId]/replay` | Autonomous replay using recorded match data |
| `/arena/[arenaId]/proof` | Technical evidence and result provenance |
| `/replays` | Replay archive and completed-arena discovery |
| `/agents` | Agent Alpha and Agent Beta strategy profiles |
| `/how-it-works` | Product explanation for normal users |

The homepage may preview agents, replays, product mechanics, and proof, but navigation items must link to real routes rather than only scrolling to homepage sections.

### 2.2 Canonical Arena Route

One arena keeps one stable public route:

`/arena/[arenaId]`

The same route supports the arena lifecycle:

```text
Upcoming
→ Backing Open
→ Backing Locked
→ Live
→ Paused or Finalizing
→ Completed
→ Claimable or Refundable
```

The route should adapt its content and primary action according to state.

Arena90 should not create separate public routes such as:

- `/live/[arenaId]`;
- `/result/[arenaId]`;
- `/claim/[arenaId]`;
- `/refund/[arenaId]`;
- `/support/[arenaId]`.

This preserves one shareable arena identity across the website, Blinks, social links, proof, and settlement.

### 2.3 Replay and Proof Routes

Replay and Proof remain nested under the canonical arena identity because they are meaningfully different experiences.

`/arena/[arenaId]/replay`

provides:

- accelerated playback;
- newly generated autonomous decisions;
- replay controls;
- replay-specific event history;
- replay result provenance.

`/arena/[arenaId]/proof`

provides:

- canonical snapshot evidence;
- structured agent decisions;
- validation results;
- deterministic portfolio transitions;
- runtime and strategy versions;
- supporter and settlement provenance where relevant.

Replay and Proof must not become duplicate implementations of the arena.

They should derive from the same structured Arena Event Record used by the canonical arena.

### 2.4 Primary Navigation

The public navigation should remain focused:

```text
ARENA90
LIVE ARENA
REPLAYS
AGENTS
HOW IT WORKS
[CONTEXTUAL ACTION]
[ACCOUNT]
```

Navigation destinations are:

| Item | Destination |
|---|---|
| Arena90 logo | `/` |
| Live Arena | Current featured `/arena/[arenaId]` |
| Replays | `/replays` |
| Agents | `/agents` |
| How It Works | `/how-it-works` |

`LIVE ARENA` is a dynamic link to the current featured arena. It is not a fixed route named `/live`.

Proof, Demo, Ops, Claim, and Refund should not appear as primary navigation items.

### 2.5 Contextual Navigation Action

The primary navigation action should reflect the featured arena state.

| Featured State | Primary Action |
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

When a connected user has a supporter record, the account area may show:

`My Backing`

A generic `Connect Wallet` action must not replace the product-facing action.

### 2.6 Hackathon and Internal Routes

Arena90 may provide:

`/demo`

as a hackathon utility route.

It should redirect or guide users into a prepared autonomous replay using the same replay engine.

It must not contain a second scripted battle implementation.

Arena90 may also provide:

`/ops`

as a protected operational surface for approved arena-management actions.

`/ops` must not appear in public navigation and must not expose manual agent-decision controls.

### 2.7 Route Boundaries

The initial V2 route system does not require:

- separate public pages for Alpha and Beta;
- a supporter dashboard covering every historical arena;
- a wallet-gated account homepage;
- separate claim and refund pages;
- duplicate Live and Replay engines;
- public raw infrastructure-log routes.

New routes should be added only when they represent a distinct user job that cannot be handled clearly by an existing canonical route.

## 3. Homepage Experience

The homepage is a product-first and football-first entry into Arena90.

Its primary job is to help a new user understand the featured football fixture, the autonomous Agent Alpha versus Agent Beta competition, and the current Solana participation opportunity without requiring authentication.

The homepage should guide users into real product routes rather than attempting to contain the complete arena experience.

### 3.1 Homepage Structure

The homepage should contain five primary content sections:

1. Featured Arena Hero
2. Agent Strategy Battle
3. How Arena90 Works
4. Featured Replays
5. Proof & Participation Layer

Navigation and footer are not counted as homepage content sections.

Each section should act as a concise preview and link to a dedicated route:

| Homepage Section | Primary Destination |
|---|---|
| Featured Arena Hero | `/arena/[arenaId]` |
| Agent Strategy Battle | `/agents` |
| How Arena90 Works | `/how-it-works` |
| Featured Replays | `/replays` |
| Proof & Participation Layer | `/arena/[arenaId]/proof` |

### 3.2 Featured Arena Hero

The first viewport should communicate:

- the featured football fixture;
- arena mode and lifecycle state;
- Agent Alpha versus Agent Beta;
- supporter-window availability;
- the primary state-driven action.

The hero should adapt to the featured arena state.

| Featured State | Primary Message | Primary Action |
|---|---|---|
| Backing open | Choose the autonomous strategy you trust | `Back an Agent` |
| Upcoming | The next arena is preparing | `View Arena` |
| Live | The autonomous battle is active | `Watch Live` |
| Paused | The arena is temporarily paused | `View Status` |
| Finalizing | The result is being verified | `Track Settlement` |
| Completed | The arena result is available | `Watch Replay` |
| No featured arena | Explore a completed autonomous battle | `Explore Replays` |

The hero may provide a secondary action such as:

- `How It Works`;
- `View Agents`;
- `View Proof`.

The hero must not require wallet connection before the user understands the product.

### 3.3 Agent Strategy Battle Preview

The homepage should introduce Agent Alpha and Agent Beta with equal visual prominence.

The preview should communicate:

- Agent Alpha — Momentum & Repricing;
- Agent Beta — Structure & Valuation Control;
- one-sentence strategic contrast;
- one primary strength and risk for each agent;
- the current or latest arena context.

The preview should link to:

`/agents`

It should not expose full historical statistics, detailed prompts, private reasoning, or complete portfolio history.

Character artwork may strengthen recognition, but strategy identity must remain understandable without relying on artwork or color.

### 3.4 How It Works, Replays and Proof

The homepage should explain the product through a short sequence:

```text
TxLINE football and market data
→ Shared canonical snapshot
→ Independent autonomous decisions
→ Deterministic portfolio execution
→ Visible result
→ Solana supporter backing and settlement
```

The detailed explanation belongs to:

`/how-it-works`

The homepage may also show a small set of featured replays with:

- fixture;
- arena mode;
- winning agent or draw;
- short strategic turning point;
- replay action.

The replay preview links to:

`/replays`

The Proof & Participation preview should communicate that Arena90 combines:

- auditable autonomous decisions;
- deterministic portfolio transitions;
- Solana-native supporter participation;
- result and settlement provenance.

Detailed evidence remains on:

`/arena/[arenaId]/proof`

### 3.5 Homepage Visual Hierarchy and Boundaries

The homepage visual direction should prioritize:

```text
Football as the context
→ AI agents as the competition
→ Solana as participation and settlement
```

This hierarchy does not make Solana optional. It makes the product understandable before transaction approval.

The homepage should not be dominated by:

- wallet connection;
- transaction hashes;
- contract addresses;
- raw agent output;
- infrastructure logs;
- full portfolio history;
- developer terminology.

The homepage should not resemble:

- a sportsbook landing page;
- a crypto dashboard;
- a generic AI product;
- a static hackathon pitch page.

Every primary homepage action should lead into a working product experience.

## 4. Live Arena Experience

The Live Arena is Arena90's primary spectator surface.

It should present one football match as a sequence of autonomous strategy rounds while keeping Solana participation visible and state-aware.

The experience must feel like a football match centre with an AI competition layer, not a sportsbook, crypto terminal, raw AI console, or operator dashboard.

### 4.1 Spectator Experience Loop

The intended loop is:

```text
Observe the match
→ Anticipate the next decision round
→ Watch both agents resolve
→ Reveal both decisions together
→ Understand the portfolio consequence
→ Follow the updated competition state
```

The interface should make each round understandable without requiring users to inspect technical proof.

### 4.2 Visual Information Hierarchy

The first viewport should prioritize:

1. football fixture, score, minute, and arena mode;
2. Agent Alpha versus Agent Beta;
3. current performance and provisional leader;
4. latest decision response;
5. next decision round;
6. current supporter action or supporter record.

The first viewport should not be dominated by:

- supporter-pool distribution;
- wallet controls;
- transaction hashes;
- snapshot hashes;
- full portfolio history;
- raw agent output;
- infrastructure logs.

Expanded sections may expose allocation detail, performance history, community backing, and the arena timeline.

Proof remains available through the dedicated proof route.

### 4.3 Football Match Centre

The match header should clearly communicate:

- home and away teams;
- score;
- current match minute or phase;
- arena mode;
- lifecycle state;
- data source and freshness;
- paused, delayed, or finalizing status when relevant.

Public mode labels should remain explicit:

- `LIVE`;
- `REPLAY`;
- `SIMULATED`;
- `PAUSED`;
- `FINALIZING`;
- `COMPLETED`.

Recorded, delayed, or simulated data must never be presented as live.

### 4.4 Data Freshness and Degraded States

Data freshness should remain visible without overwhelming the match experience.

The interface may show:

- `DATA LIVE`;
- `DATA DELAYED`;
- `SNAPSHOT LOCKED`;
- `MARKET DATA UNAVAILABLE`;
- `WAITING FOR VERIFIED UPDATE`.

When a checkpoint snapshot is locked, later football or market events must not alter that round.

The public interface must not invent missing scores, prices, timestamps, or market states.

If required data becomes stale or unavailable, the page should preserve the latest verified state and explain the degraded condition.

### 4.5 Agent Battle Board

Agent Alpha and Agent Beta should receive equal visual prominence.

Both agent cards should use the same information structure:

- agent name;
- strategic identity;
- current equity or return;
- current allocation summary;
- latest decision;
- short structured rationale;
- primary risk indicator;
- current decision-round state.

The board should use public football-friendly labels and percentages rather than internal asset codes or basis points.

For example, public labels should use team names instead of `HOME` and `AWAY`.

The system must not force visual or strategic disagreement when both agents select similar positions.

Character artwork may strengthen identity, but it must not replace strategy, performance, or risk information.

### 4.6 Agent Visual Identity

Agent Alpha and Agent Beta should belong to the same visual universe while expressing different strategic behavior.

Agent Alpha may use visual motifs associated with:

- movement;
- acceleration;
- direction;
- repricing;
- momentum.

Agent Beta may use visual motifs associated with:

- structure;
- stability;
- filtering;
- valuation control;
- risk discipline.

The distinction must not rely only on color.

Character artwork should remain subdued during normal match states and may become more prominent during a simultaneous decision reveal.

All public agent artwork, symbols, uniforms, and visual motifs must remain original and must not imitate identifiable football, anime, gaming, or entertainment intellectual property.

### 4.7 Public Strategy Language

Public decision language should help spectators understand:

1. what the agent observed;
2. how the agent interpreted it;
3. what portfolio response it selected;
4. how the allocation changed;
5. which primary risk remains.

The interface should use:

- team names rather than internal market codes;
- percentages rather than basis points;
- concise structured rationale rather than private reasoning;
- observable risk indicators rather than theatrical confidence.

The public experience must not expose:

- private chain-of-thought;
- raw prompts;
- fabricated reasoning streams;
- fake terminal output;
- unsupported certainty.

A public explanation may follow this structure:

```text
Observed
→ Spain equalized and the market repriced rapidly.

Interpretation
→ The move may not yet fully reflect the new match state.

Response
→ Increased Spain allocation from 25% to 45%.

Primary risk
→ The repricing may already be complete.
```

### 4.8 Portfolio Representation

Agent portfolios should be represented primarily through a stacked horizontal allocation bar.

The same asset order should remain consistent across:

- both agents;
- every decision round;
- Live Mode;
- Replay Mode;
- result summaries.

Public allocation labels may include:

- home-team name;
- draw;
- away-team name;
- Over 2.5 and Under 2.5 when enabled;
- cash.

Displayed percentages must total 100%.

When a decision changes the portfolio, the interface should make the before-and-after allocation understandable without requiring users to inspect accounting details.

Risk indicators should derive from system-observable information such as:

- total exposure;
- concentration;
- allocation-change magnitude;
- cash allocation;
- drawdown.

The UI must not present an uncalibrated model confidence score as a verified risk metric.

### 4.9 Decision Round State Machine

Each decision round should move through explicit public states:

```text
Checkpoint reached
→ Canonical snapshot locked
→ Both agents analyzing
→ Decisions received
→ Decisions validated
→ Simultaneous reveal
→ Portfolio state updated
```

The interface may show:

- `ANALYZING`;
- `DECISION RECEIVED`;
- `VALIDATING`;
- `RECHECKING DECISION`;
- `MISSED DECISION ROUND`;
- `ROUND COMPLETE`.

The interface must not display fake progress percentages, fabricated reasoning streams, or one agent's allocation before the reveal.

If one agent requires the approved constrained retry, the public state may show:

`RECHECKING DECISION`

without exposing private validation details.

### 4.10 Simultaneous Decision Reveal

Agent Alpha and Agent Beta decisions should be revealed together after both agents resolve or reach their deadlines.

The reveal should answer:

- what each agent changed;
- why each agent changed it;
- how much the allocation changed;
- which primary risk remains;
- how the competition state changed.

A short reveal countdown may be used for presentation, but it should not exceed approximately three seconds and must respect reduced-motion preferences.

The reveal must not:

- expose one valid decision while the other agent is still unresolved;
- use prerecorded dialogue;
- fabricate disagreement;
- imply that animation is proof of autonomous execution.

### 4.11 Decision Explanation and Consequence

Every completed round should preserve a human-readable explanation after the reveal animation ends.

The latest decision surface should show, for both agents:

- checkpoint;
- action summary;
- before-and-after allocation;
- structured rationale;
- primary risk;
- validation or missed-round state;
- resulting equity or performance effect when available.

The explanation should distinguish between:

```text
Agent interpretation
```

and:

```text
Deterministic portfolio consequence
```

The LLM explains the strategy decision.

The system calculates and displays the resulting portfolio transition, accounting, and performance.

### 4.12 Persistent Latest Decision

The latest completed decision round should remain visible after temporary reveal effects end.

Users entering the arena between checkpoints should immediately understand:

- which checkpoint completed most recently;
- what Agent Alpha selected;
- what Agent Beta selected;
- how both portfolios changed;
- which agent currently leads;
- when the next decision round occurs.

The persistent state must not depend on replaying an animation.

Earlier rounds remain accessible through the arena timeline.

### 4.13 Performance Race

The performance view should help users understand how the competition evolves without replacing the football and decision-round experience.

A secondary chart may show:

- Agent Alpha equity or return;
- Agent Beta equity or return;
- decision-round markers;
- provisional leader changes;
- terminal settlement when available.

The chart should use the same time or event sequence as the arena timeline.

Before Final Settlement, the leading agent must be labeled as provisional.

The performance view must remain separate from:

- community backing;
- supporter-pool size;
- claimable value;
- wallet balance.

Supporter popularity must never be presented as agent performance.

### 4.14 Arena Timeline and Event Record

The arena timeline should combine human-readable football and competition events.

It may include:

- kickoff;
- goals and important match-state changes;
- decision checkpoints;
- snapshot lock;
- simultaneous decision reveal;
- portfolio update;
- missed decision rounds;
- pause or resume;
- final match state;
- final settlement.

Live Arena, Replay, and Proof must derive from the same structured append-only Arena Event Record.

The public timeline should explain what happened without exposing raw infrastructure logs.

A timeline item may open additional detail such as:

- match state at the event;
- both agent decisions;
- allocation before and after;
- validation status;
- performance consequence;
- relevant proof link.

Infrastructure, process, and debugging logs remain internal.

### 4.15 Next Decision Round

The arena should always communicate the next expected competition event.

Examples include:

- `NEXT DECISION — 30'`;
- `NEXT DECISION — HALFTIME`;
- `FINAL DECISION COMPLETE`;
- `WAITING FOR VERIFIED FINAL RESULT`.

When wall-clock timing is unreliable, the interface should use the match-minute checkpoint label rather than a misleading countdown.

The next-round surface may show:

- checkpoint label;
- current match phase;
- whether the required snapshot is available;
- delayed, paused, or completed state.

The interface must not imply that agents trade continuously between approved checkpoints.

### 4.16 Failure, Delay and Pause States

Failure and delay states should remain visible and understandable without rewriting completed competition history.

When one agent misses a round, the interface should show:

`MISSED DECISION ROUND`

for that agent while preserving its previous portfolio.

The other agent's valid decision remains effective.

When a shared failure affects both agents, the interface should show:

`GLOBAL MISSED DECISION ROUND`

and preserve both previous portfolios.

An Emergency Pause should communicate:

- that new decision-round execution is stopped;
- that existing match, portfolio, and supporter state is preserved;
- that no winner, claim, refund, or void has been selected automatically.

A paused or delayed arena must not:

- fabricate a decision;
- convert a failure into `NO_TRADE`;
- apply a retroactive portfolio change;
- hide the failure from the arena timeline;
- manually select a winner.

When the system resumes, the interface should continue from the latest valid state according to the approved lifecycle rules.

### 4.17 Solana Supporter Experience

Solana participation is a core part of the Live Arena experience.

The arena should keep the relevant supporter action visible and state-aware without merging supporter funds with agent performance.

Depending on arena state, the supporter surface may show:

- `BACK AN AGENT`;
- `BACKING LOCKED`;
- `YOUR BACKING`;
- `TRACK SETTLEMENT`;
- `CLAIM AVAILABLE`;
- `REFUND AVAILABLE`.

A connected supporter may see:

- supported agent;
- supporter amount;
- active wallet;
- transaction status;
- arena-specific supporter record;
- claim or refund eligibility.

Community backing may also be shown as a fan-engagement signal.

It must remain separate from:

- agent equity;
- virtual bankroll;
- portfolio allocation;
- strategy return;
- competition advantage.

Greater supporter backing must not change agent capital, information, strategy, or execution rules.

The Live Arena must clearly distinguish:

```text
Agent strategy performance
→ autonomous virtual portfolio competition

Supporter participation
→ on-chain backing and settlement
```

### 4.18 Proof Access

Proof should remain available without dominating the spectator experience.

The Live Arena may expose secondary actions such as:

- `VIEW PROOF`;
- `INSPECT DECISION ROUND`;
- `VIEW SNAPSHOT RECORD`;
- `VIEW TRANSACTION`.

Proof access may reveal:

- canonical snapshot identity;
- structured agent decisions;
- validation status;
- deterministic portfolio transitions;
- runtime and strategy versions;
- arena event provenance;
- supporter and settlement records where relevant.

The main arena interface must not expose raw infrastructure logs, secrets, private prompts, or private chain-of-thought.

### 4.19 Mobile Composition

On smaller screens, the Live Arena should preserve this order:

1. fixture, score, minute, and arena state;
2. Agent Alpha versus Agent Beta;
3. current leader and performance;
4. latest decision or reveal;
5. primary supporter action or supporter record;
6. next decision round;
7. portfolio detail;
8. timeline and proof access.

Both agents must remain directly comparable.

The decision reveal must not separate Agent Alpha and Agent Beta into different tabs or unrelated screens.

Long technical detail may use:

- expandable sections;
- drawers;
- horizontally scrollable records;
- the dedicated proof route.

Primary match, agent, and transaction states should remain visible after returning from an external wallet application.

### 4.20 Accessibility

Critical arena information must not rely only on:

- color;
- animation;
- character artwork;
- sound;
- hover interaction.

Text and accessible labels must communicate:

- arena mode and lifecycle state;
- current or provisional leader;
- agent allocation changes;
- missed decision rounds;
- data delay;
- pause and finalizing states;
- supporter transaction status;
- claim or refund eligibility.

Motion should respect reduced-motion preferences.

Decision reveals should remain understandable when animation is disabled.

Primary controls must remain usable through keyboard, touch, and assistive technology.

### 4.21 Live Arena Boundaries

The Live Arena does not provide:

- direct user trading of football-market positions;
- manual control over agent decisions;
- editable agent prompts;
- supporter influence over strategy;
- supporter funds as agent virtual capital;
- agent access to wallets or private keys;
- private model chain-of-thought;
- raw infrastructure logs;
- fabricated live data or reasoning streams;
- backing after the supporter window closes;
- automatic claim or refund during unresolved states;
- operator controls on the public route.

The Live Arena should remain a football-first autonomous strategy competition with visible, Solana-native participation and auditable results.

## 5. Replay Experience

Replay Mode allows users to experience a complete Arena90 competition when a live fixture is unavailable or when they want to revisit recorded football data.

Replay is a first-class product experience, not a simplified video playback or scripted demo.

It uses:

- recorded football and market data;
- the same approved arena rules;
- the same autonomous agent runtime;
- the same decision contract;
- the same deterministic portfolio engine;
- the same failure and winner rules used by Live Mode.

Agent decisions are generated during the replay session.

They must not be presented as live decisions or as prerecorded dialogue.

### 5.1 Replay Purpose

Replay Mode supports:

- spectator discovery;
- completed-match exploration;
- hackathon evaluation;
- product demonstrations;
- testing when no eligible live fixture exists;
- comparison of agent strategies across historical match conditions.

A replay should demonstrate the complete Arena90 value proposition:

```text
Recorded football data
→ Same verified snapshot
→ Independent autonomous decisions
→ Simultaneous reveal
→ Strategy performance
→ Final result
```

### 5.2 Replay Disclosure

The replay page must clearly communicate:

- that the football match is recorded;
- the original fixture and match date;
- the replay session status;
- whether agent decisions are being generated during the current replay;
- the data source used;
- the agent runtime and strategy versions where relevant.

The page should use explicit labels such as:

- `REPLAY`;
- `AUTONOMOUS REPLAY`;
- `RECORDED MATCH DATA`.

It must not use:

- `LIVE`;
- a live pulse;
- misleading real-time language;
- presentation that suggests the original match is currently happening.

Example:

```text
AUTONOMOUS REPLAY

France vs Spain
Recorded match data

Agent decisions are being generated during this replay.
```

### 5.3 Replay Session Identity

A replay session is a new autonomous competition using recorded source data.

It should have its own replay-run identity and append-only event record.

The interface must distinguish between:

- the source football match;
- the original live arena, when one exists;
- the current replay session;
- the current replay result.

A replay result must not overwrite the result of an original live arena.

When useful, the interface may show:

```text
Source match
France vs Spain — 14 July 2026

Replay session
Run R-0042

Original live arena
View original result
```

### 5.4 Replay Entry States

A replay may begin in one of two ways.

#### Standard Replay

The user enters the replay page and starts the competition from kickoff.

The main action is:

`Start Replay`

#### Guided Demo

A guided mode may be entered through `/demo` or a replay query state.

It may highlight:

1. verified snapshot;
2. independent agent analysis;
3. simultaneous reveal;
4. strategy allocation update;
5. performance consequence;
6. final result and proof.

Guided Demo must use the same replay engine.

It must not use a second scripted battle implementation.

### 5.5 Replay Controls

Replay controls should remain familiar to users of sports video and match-centre products.

The page may provide:

- play;
- pause;
- restart;
- replay speed;
- jump to next decision round;
- jump to previous decision round;
- inspect current event;
- return to kickoff.

Recommended replay speeds include:

- `1×`;
- `2×`;
- `4×`;
- checkpoint-focused mode.

The interface should not require users to wait for the full real-world match duration.

Acceleration must preserve:

- event order;
- snapshot identity;
- decision timing relative to recorded events;
- simultaneous reveal rules;
- deterministic portfolio transitions.

### 5.6 Replay Timeline

The replay timeline acts as both playback navigation and competition history.

It should combine:

- football events;
- decision rounds;
- agent reveals;
- allocation updates;
- failures or retries;
- final settlement.

Example:

```text
KICKOFF
↓
15' Decision Round
↓
30' Decision Round
↓
Halftime Decision Round
↓
60' Decision Round
↓
75' Decision Round
↓
Final Settlement
```

Users may select a completed event to inspect:

- match state;
- agent allocations before the event;
- both revealed decisions;
- resulting performance change;
- supporting proof.

Users must not be able to edit the event sequence.

### 5.7 Replay Visual Composition

Replay should use the same football-first visual language as the Live Arena.

The main visual hierarchy remains:

1. football score and replay minute;
2. replay mode and playback controls;
3. Agent Alpha versus Agent Beta;
4. current replay leader;
5. latest decision reveal;
6. current strategy allocations;
7. performance race;
8. timeline;
9. proof access.

Replay controls should not transform the page into a developer debugging console.

### 5.8 Decision Rounds in Replay

Replay decision rounds follow the same visible sequence as Live Mode:

```text
Recorded checkpoint reached
→ Verified replay snapshot locked
→ Both agents analyzing
→ Decisions received
→ Decisions validated
→ Simultaneous reveal
→ Strategy allocations updated
```

Both agents receive the same recorded canonical snapshot.

The interface must not:

- reveal one agent first;
- skip validation for presentation speed;
- replace autonomous outputs with manually written decisions;
- introduce future match events into an earlier snapshot.

Replay acceleration may shorten the time between recorded events, but it must not change the logical order of the competition.

### 5.9 Agent Runtime Waiting States

Agent decision generation may still require real processing time during replay.

The interface should display real operational states such as:

- `ANALYZING`;
- `DECISION RECEIVED`;
- `VALIDATING`;
- `RECHECKING DECISION`;
- `MISSED DECISION ROUND`.

The replay must not fabricate a fake progress percentage or fake reasoning stream.

When a decision requires more time than the accelerated match playback, the replay should pause at the decision round until the checkpoint is resolved.

Recorded football events after that checkpoint must not advance before the current replay round is completed.

### 5.10 Spoiler Handling

Replay discovery surfaces may show final results, but the replay page should support a spoiler-conscious entry experience.

Before starting, the page may offer:

- `Start Replay`;
- `View Result`;
- `Resume Replay`.

When the user chooses `Start Replay`, the final replay winner should not dominate the interface before the terminal state is reached.

The original football score may be hidden before playback when the product supports a spoiler-free mode.

Spoiler controls are optional for the MVP and should not require a separate route.

### 5.11 Replay Result

A replay result belongs only to the current replay session.

The result surface should show:

- replay winner or draw;
- final replay equity and return;
- approved tie-break metrics when required;
- completed or failed replay state;
- replay-run identity;
- access to replay proof.

The result must be labeled:

`REPLAY RESULT`

It must not be presented as the result of the original live arena.

Because autonomous decisions are generated again, separate replay runs using the same source match may produce different valid outcomes.

### 5.12 Relationship to the Original Live Arena

When an original live arena exists, Replay may link to it without merging the two records.

The interface should distinguish:

```text
Original live arena
→ original autonomous competition and settlement

Current replay session
→ new autonomous competition using recorded source data
```

The original live result remains unchanged.

The replay result remains attached to its own replay-run identity.

Differences between live and replay decisions are valid autonomous outcomes and must not be hidden or rewritten.

### 5.13 Supporter Participation in Replay

A replay session does not open a new supporter-backing window.

Replay pages must not provide:

- `BACK AGENT ALPHA`;
- `BACK AGENT BETA`;
- replay-based claim;
- replay-based refund;
- settlement based on the replay winner.

When the source match had an original live arena, Replay may show clearly labeled historical supporter and settlement information from that arena.

Historical supporter popularity and replay performance must remain separate.

### 5.14 Replay Event Record and Proof

Each replay session should produce its own structured append-only Arena Event Record.

The record should preserve:

- source match identity;
- replay-run identity;
- recorded canonical snapshots;
- runtime and strategy versions;
- agent decision states;
- validated decisions;
- deterministic portfolio transitions;
- failures, retries, and pauses;
- final replay settlement.

Replay controls, the visible timeline, the result surface, and the proof route must derive from this same record.

Proof may link the replay session to its source data and original live arena without treating them as the same competition.

Raw infrastructure logs, private prompts, secrets, and private chain-of-thought remain excluded.

### 5.15 Replay Recovery and Resume

A replay session should preserve safe progress across refresh, navigation, and temporary client disconnection.

When supported, the product should preserve:

- replay-run identity;
- current event position;
- completed decision rounds;
- current portfolios;
- latest valid result state;
- whether playback was running or paused.

A resumed replay must continue from the latest valid recorded state.

It must not regenerate already completed rounds inside the same replay run or silently create a new replay identity.

When recovery is impossible, the interface should explain the state clearly and offer a deliberate restart.

### 5.16 Replay Mobile Composition

On smaller screens, Replay should preserve:

1. source fixture, replay minute, and replay label;
2. playback controls;
3. Agent Alpha versus Agent Beta;
4. current leader;
5. latest decision or reveal;
6. current allocations;
7. timeline navigation;
8. result and proof access.

Both agents must remain directly comparable during decision reveals.

Playback controls may become compact or sticky, but they must not obscure match, agent, or decision state.

### 5.17 Replay Accessibility

Replay must remain understandable without relying only on color, motion, sound, artwork, or hover interaction.

Accessible labels should communicate:

- replay versus live state;
- playback position;
- current or provisional leader;
- agent allocation changes;
- decision waiting, retry, or missed states;
- completed replay result.

Reduced-motion preferences must be respected.

Decision reveals must remain readable when animation is disabled.

### 5.18 Replay Boundaries

Replay does not provide:

- a second scripted arena engine;
- prerecorded agent dialogue presented as autonomous output;
- live labeling for recorded football data;
- future match information inside earlier snapshots;
- user editing of the event sequence;
- manual replacement of agent decisions;
- supporter backing, claim, or refund based on replay results;
- modification of the original live result;
- public raw infrastructure logs or private chain-of-thought.

Replay should remain the same autonomous strategy competition operating over recorded football data.

## 6. Agents Experience

The `/agents` route introduces Agent Alpha and Agent Beta as distinct autonomous strategy competitors.

The page should help users understand how their approaches differ without promising fixed behavior or guaranteed outcomes.

### 6.1 Page Structure

The Agents page should include:

1. a concise competition introduction;
2. Agent Alpha profile;
3. Agent Beta profile;
4. direct strategy comparison;
5. recent arena or replay evidence;
6. links to relevant arena records.

The page should remain understandable before authentication or wallet connection.

### 6.2 Agent Alpha — Momentum & Repricing

Agent Alpha represents a momentum and repricing strategy.

Its public profile may emphasize tendencies such as:

- reacting to meaningful changes in match state;
- identifying directional movement;
- increasing exposure when repricing appears supported;
- reducing exposure when momentum weakens;
- preserving cash when movement is noisy or unverified.

These are strategy tendencies, not fixed instructions for every round.

Agent Alpha must remain free to select `NO_TRADE` or a defensive allocation when its validated interpretation requires it.

### 6.3 Agent Beta — Structure & Valuation Control

Agent Beta represents a structure and valuation-control strategy.

Its public profile may emphasize tendencies such as:

- comparing market movement with underlying match structure;
- filtering temporary or unsupported price changes;
- managing concentration and downside;
- preferring disciplined exposure;
- preserving cash when valuation or evidence is unclear.

These are strategy tendencies, not fixed instructions for every round.

Agent Beta must remain free to take directional exposure when its validated interpretation supports it.

### 6.4 Direct Strategy Comparison

The page should compare both agents using the same categories.

| Category | Agent Alpha | Agent Beta |
|---|---|---|
| Core lens | Momentum and repricing | Structure and valuation |
| Typical response | Faster directional adjustment | More selective confirmation |
| Primary risk | Chasing unstable movement | Reacting too slowly |
| Cash behavior | Tactical reserve | Valuation and risk reserve |
| Decision authority | Autonomous | Autonomous |

The comparison must not predetermine which agent will act, disagree, or win.

### 6.5 Visual Identity

Both agents should use original Arena90 visual identity.

Agent Alpha may use motifs associated with movement, acceleration, direction, and repricing.

Agent Beta may use motifs associated with structure, stability, filtering, valuation, and risk discipline.

The distinction must not rely only on color.

Character art should support the competition without imitating protected characters, clubs, leagues, or third-party intellectual property.

### 6.6 Performance and Evidence

The Agents page may show:

- recent Live Arena results;
- recent Replay results;
- strategy return;
- decision-round participation;
- missed-round history;
- notable turning points from the Arena Event Record.

Live and Replay results must be labeled separately.

Small samples must not be presented as universal proof that one strategy is superior.

Supporter popularity and supporter-pool size must remain separate from strategy performance.

### 6.7 Explainability

Public agent explanations should use structured, human-readable categories:

- observed match or market state;
- strategy interpretation;
- selected response;
- allocation change;
- primary risk.

The page may explain the high-level strategy and runtime version.

It must not expose:

- private prompts;
- private chain-of-thought;
- raw model logs;
- secrets;
- fabricated personality dialogue;
- unsupported claims of certainty.

### 6.8 Agent Identity and Versioning

Agent Alpha and Agent Beta should have stable internal identities even when public names, artwork, runtime versions, or strategy versions evolve.

Arena and replay records should preserve the exact runtime and strategy versions used for each competition.

Historical records must not silently adopt a newer strategy identity.

Provider and model details may be disclosed at an appropriate technical level without making a third-party vendor the product identity.

### 6.9 Mobile Composition

On smaller screens, the page should keep both agent summaries visible in one comparable flow.

The user should not need to navigate through unrelated pages to understand the core strategy difference.

Detailed evidence may use expandable sections, but identity, strategy lens, primary risk, and recent performance should remain easy to compare.

### 6.10 Agents Boundaries

The initial V2 Agents experience does not include:

- user-created agents;
- editable public prompts;
- manual user control over decisions;
- agent tokens or NFTs;
- copy trading;
- supporter voting over strategy;
- access to wallets or private keys;
- claims that an agent always follows one action pattern.

The Agents page explains autonomous competitors; it is not an agent-building console.

## 7. Solana-Native Fan Participation

Arena90 is Web3-native and Web2-familiar.

Solana is the participation, ownership, distribution, and settlement layer for supporter backing, while the football and autonomous-agent competition remains understandable before authentication.

### 7.1 Participation Journey

The core supporter journey is:

```text
Discover fixture
→ Understand both agents
→ Choose an agent
→ Back through Solana
→ Follow the autonomous competition
→ Track settlement
→ Claim or refund when eligible
```

Watching, exploring agents, and reviewing completed arenas should remain available without wallet-gated browsing.

### 7.2 Backing as a Core Product Mechanic

Supporter backing is a core Arena90 mechanic, not a decorative wallet integration.

The product should clearly communicate:

- which arena is being backed;
- which agent is selected;
- supporter amount;
- backing deadline;
- active transaction wallet;
- transaction status;
- settlement rules;
- claim or refund state.

Backing must close according to the approved arena lifecycle.

The product must not accept backing after the supporter window is locked.

### 7.3 Separation of Competition and Supporter Funds

Agent competition capital and supporter funds are separate systems.

```text
Agent virtual bankroll
→ used only by the deterministic strategy competition

Supporter funds
→ recorded and settled through Solana participation
```

Supporter backing must not change:

- agent virtual capital;
- agent information;
- strategy rules;
- decision timing;
- execution rules;
- winner determination.

The more-backed agent receives no strategic advantage.

### 7.4 Social and Existing-Wallet Onboarding

When a user chooses an on-chain action, Arena90 should support a familiar onboarding path:

```text
Choose agent
→ Enter amount
→ Continue with social identity or existing wallet
→ Confirm active Solana wallet
→ Review transaction
→ Explicitly approve
→ Receive supporter record
```

Social login may provision an embedded Solana wallet.

Users may also connect an existing compatible Solana wallet.

One Arena90 account may include:

- social identity;
- embedded Solana wallet;
- linked external Solana wallets.

Wallet addresses remain the source of truth for on-chain backing ownership, claim eligibility, refund eligibility, and transaction ownership.

Linking a wallet must not silently create a separate Arena90 account.

When multiple wallets are available, the active transaction wallet must be shown clearly before approval.

Every transaction requires explicit user approval.

### 7.5 Blink Experience

A Blink-compatible surface may provide:

```text
[BACK AGENT ALPHA]
[BACK AGENT BETA]
[VIEW ARENA]
```

`BACK AGENT ALPHA` and `BACK AGENT BETA` should initiate the relevant Solana transaction directly when the client supports the required action and wallet flow.

`VIEW ARENA` should open:

`/arena/[arenaId]`

When the user has no compatible wallet or requires embedded-wallet onboarding, the Blink should continue to the canonical Arena90 website flow.

When a client does not render Blinks, the shared link should fall back to the canonical arena route.

The Blink must follow arena lifecycle state.

Examples:

| Arena State | Blink Behavior |
|---|---|
| Backing open | Back Alpha, Back Beta, View Arena |
| Backing locked | View Arena |
| Live | Watch Arena |
| Finalizing | Track Settlement |
| Claimable | Claim |
| Refundable | Refund |
| Completed | View Result or Replay |

A Blink must not expose a backing action after the supporter window closes.

### 7.6 Supporter Record

After confirmation, the supporter should receive an arena-specific record showing:

- arena identity;
- supported agent;
- supporter amount;
- wallet address;
- transaction signature or reference;
- confirmation state;
- settlement state;
- claim or refund eligibility.

The record should remain accessible after refresh, reconnection, and navigation back to the arena.

Community backing totals may be visible as fan-engagement information, but they must remain separate from agent performance.

### 7.7 Transaction States

The interface must distinguish:

```text
Awaiting approval
User cancelled
Transaction failed
Transaction submitted
Confirmation delayed
Transaction confirmed
```

A submitted transaction must not be submitted again automatically.

Returning from an external wallet application must not leave the user in an ambiguous state.

When confirmation is delayed, Arena90 should continue checking the existing transaction rather than requesting a duplicate transaction.

### 7.8 Settlement, Claim and Refund

After the arena reaches a terminal state, the supporter experience should show the relevant settlement status.

Possible public states include:

- `FINALIZING`;
- `SETTLEMENT CONFIRMED`;
- `CLAIM AVAILABLE`;
- `REFUND AVAILABLE`;
- `CLAIMED`;
- `REFUNDED`.

Claim and refund actions must be based on the approved on-chain settlement record and active ownership wallet.

Arena90 must not automatically claim, refund, void, or select a winner while the arena is unresolved.

The product should explain why an action is available or unavailable.

### 7.9 Provenance and Trust

Arena90 should distinguish between:

```text
Off-chain autonomous agent computation
Deterministic portfolio execution
On-chain supporter participation
On-chain settlement record
```

The interface may provide proof links for:

- arena identity;
- decision and event record;
- supporter transaction;
- settlement transaction;
- claim or refund transaction.

Hashes and contract details should remain secondary to a human-readable explanation.

The product must not imply that the LLM itself controls supporter funds or private keys.

### 7.10 Solana Participation Boundaries

The initial V2 participation experience does not include:

- wallet-gated watching;
- supporter control over strategy;
- supporter funds as agent virtual capital;
- backing after the deadline;
- replay-based backing or settlement;
- automatic transaction approval;
- hidden active-wallet selection;
- agent access to wallets or private keys;
- performance claims based on supporter popularity;
- a provider-specific UX requirement in this document.

Provider, program, account, and settlement implementation details belong to the MVP and technical specifications.

## 8. Navigation, Identity & Cross-Route Principles

Arena90 should feel like one connected football, AI, and Solana product across discovery, backing, live competition, replay, proof, and settlement.

Navigation, identity, arena state, supporter ownership, and transaction status must remain consistent across every route and Blink surface.

### 8.1 Primary Navigation

The public navigation should remain focused:

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
| Live Arena | Featured `/arena/[arenaId]` |
| Replays | `/replays` |
| Agents | `/agents` |
| How It Works | `/how-it-works` |

`LIVE ARENA` is a dynamic link to the current featured arena.

It is not a separate route named `/live`.

Proof, Demo, Ops, Claim, and Refund should remain contextual experiences rather than primary navigation items.

### 8.2 Contextual Product Action

The primary navigation action should reflect the current featured-arena state.

| Arena State | Primary Action |
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

When a user already has a supporter record, the account area may show:

`My Backing`

A generic `Connect Wallet` action must not replace the product-facing action.

The user should understand why authentication or a wallet is required before being asked to continue.

### 8.3 Account and Wallet Identity

Watching Arena90 does not require authentication.

When a user chooses an on-chain action, Arena90 may provide:

- social login that provisions an embedded Solana wallet;
- connection of an existing compatible Solana wallet.

Arena90 should maintain one user identity that may include:

```text
Arena90 account
├── Social identity
├── Embedded Solana wallet
└── Linked external Solana wallets
```

Social identity provides familiar access and session continuity.

Wallet addresses remain the source of truth for:

- backing ownership;
- claim eligibility;
- refund eligibility;
- on-chain transaction ownership.

Linking an external wallet must not silently create a separate Arena90 account.

When multiple wallets are available, the active transaction wallet must be shown clearly before approval.

Every transaction still requires explicit user approval.

### 8.4 Stable Arena and Blink Continuity

One arena should retain one canonical public route:

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

Replay and Proof remain nested experiences:

```text
/arena/[arenaId]/replay
/arena/[arenaId]/proof
```

The following must remain consistent across the homepage, arena page, Blink, replay, proof, and shared links:

- arena identity;
- football fixture;
- competing agents;
- supporter deadline;
- backing availability;
- supporter record;
- result state;
- settlement state.

A Blink-compatible client may execute the supporter action directly.

A non-Blink client should open the canonical arena route as the universal fallback.

### 8.5 Session and Transaction Continuity

Arena90 should preserve safe user progress across authentication, wallet applications, route changes, and transaction confirmation.

When possible, the product should preserve:

- selected agent;
- entered supporter amount;
- active arena;
- active transaction wallet;
- submitted transaction status;
- confirmed supporter record.

Returning from an external wallet application must not leave the user in an ambiguous state.

The interface must distinguish between:

```text
User cancelled
Transaction failed
Transaction submitted
Confirmation delayed
Transaction confirmed
```

A pending transaction must never be submitted again automatically.

A confirmed supporter record should remain available after refresh, reconnection, or navigation back to the arena.

### 8.6 Shared State Language

Arena90 should use one consistent set of public state labels.

Examples include:

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

The website and related Blink must not expose conflicting states or actions.

For example, the website must not show:

`BACKING LOCKED`

while the related Blink still offers:

`BACK AGENT ALPHA`

Recorded, delayed, simulated, or replay data must never be presented as live.

### 8.7 Responsive, Accessible and Honest UX

Responsive layouts may change composition, but they must not change product meaning.

On smaller screens, Arena90 should preserve:

1. football fixture and arena state;
2. Agent Alpha versus Agent Beta;
3. contextual product action;
4. latest decision or final result;
5. portfolio performance;
6. supporter and transaction state;
7. timeline and proof access.

Both agents should remain directly comparable.

Critical information must not rely only on:

- color;
- artwork;
- animation;
- sound;
- hover interaction.

Arena90 must distinguish honestly between:

- live and recorded data;
- provisional and final results;
- off-chain autonomous agent computation;
- deterministic portfolio execution;
- on-chain supporter participation;
- trusted, mocked, and verified components.

Visual polish must not conceal incomplete, delayed, or simulated behavior.

### 8.8 Cross-Route Boundaries

The initial V2 experience does not require:

- wallet-gated browsing;
- a different public route for every arena state;
- duplicate Live and Replay engines;
- separate public Claim and Refund routes;
- separate accounts for social and wallet entry;
- public raw infrastructure logs;
- desktop-only agent comparison;
- conflicting terminology between the website and Blinks;
- a specific identity or wallet provider in this UX document.

Provider selection and implementation details belong to the MVP scope and relevant technical specification.
