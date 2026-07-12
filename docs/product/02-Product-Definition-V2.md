# Arena90 — Product Definition V2

**Status:** Approved
**Related document:** `01-Autonomous-Game-Loop-Decision.md`

## 1. Purpose & Product Definition

This document defines Arena90 as a product.

It establishes:

* the product category;
* the primary user experience;
* the target users;
* the roles of autonomous agents, football data, Solana Blinks, and supporter funds;
* the product principles;
* the boundaries of the V2 product.

Arena90 is a live autonomous AI strategy arena powered by real football data.

In each arena, two autonomous AI agents receive the same verified football-market information and independently manage equal virtual portfolios throughout one football match.

Users watch the agents compete and may support the strategy they trust through a Solana Blink before the competition begins.

The agents never control supporter funds, wallet permissions, private keys, or arbitrary on-chain transactions.

The winning agent is determined by the autonomous competition rules defined in:

`01-Autonomous-Game-Loop-Decision.md`

This document does not define:

* detailed checkpoint mechanics;
* agent output schemas;
* pricing or portfolio-accounting formulas;
* TxLINE adapter schemas;
* Anchor account structures;
* payout mathematics;
* frontend routes or page layouts.

Those rules belong to the approved game-loop decision and relevant technical specifications.

---

## 2. Product Category & Positioning

Arena90 is an:

> **Autonomous AI strategy arena**

The core product is the competition between autonomous agents.

Football markets provide the environment in which the agents compete.

TxLINE provides the match and market data used by the arena.

Solana Blinks provide the participation and distribution layer for supporters.

Arena90 should be positioned publicly as:

> **A live autonomous AI strategy arena powered by real football data.**

A more technical description is:

> **Two autonomous agents interpret the same football-market data, independently manage equal virtual portfolios, and compete for the strongest final performance.**

Arena90 is not primarily:

* a sportsbook;
* a user-facing trading terminal;
* a football prediction dashboard;
* a copy-trading platform;
* a chatbot;
* an AI wrapper around one pre-match pick.

Users do not directly trade football markets.

They watch the autonomous competition and may back one agent before the arena begins.

Product messaging must emphasize:

* agent-versus-agent competition;
* equal information;
* independent strategy;
* virtual portfolio performance;
* visible and auditable decisions.

Product messaging must avoid implying that:

* agents control supporter funds;
* supporter deposits become agent trading capital;
* each agent is permanently assigned to one football outcome;
* Arena90 is fully trustless or production-ready while trusted, simulated, or mock components are still used.

---

## 3. Target Users

### 3.1 Primary User — Spectator

The primary user is a football fan, AI-curious user, or hackathon viewer who wants to watch two autonomous strategies compete.

The primary user’s job to be done is:

> “I want to see which AI understands and reacts to the match better.”

A spectator should be able to understand the arena without prior knowledge of:

* trading;
* basis points;
* smart contracts;
* portfolio accounting;
* AI-agent infrastructure.

The product must clearly show:

* which agent is leading;
* what each agent currently holds;
* what changed at the latest checkpoint;
* why the agent changed its portfolio;
* when the next decision occurs;
* how the final winner is determined.

Watching the arena does not require a wallet.

### 3.2 Secondary User — Supporter

A supporter chooses to back one agent before the arena begins.

The supporter’s job to be done is:

> “I want to support the autonomous strategy I trust.”

A supporter:

* chooses Agent Alpha or Agent Beta;
* signs a transaction through a Solana Blink;
* does not control the agent’s decisions;
* does not select individual football-market outcomes;
* does not provide capital to the agent’s virtual portfolio;
* follows the same arena experience as a spectator;
* may claim or receive a refund according to the final arena state.

Wallet connection is required only when the user performs an on-chain action.

### 3.3 Operational User — Arena Operator

The operator manages the safe execution of an arena.

The operator may:

* configure an eligible fixture;
* review the Arena Manifest;
* open and lock supporter backing;
* monitor data and agent health;
* activate an Emergency Pause;
* finalize or attest the result according to the approved resolver mode.

The operator must not manually select agent trades or alter portfolio decisions.

For the MVP, preparation of future arenas may be assisted by an automated Arena Orchestrator, while externally visible publication and safety-critical actions remain behind an operator approval gate.

### 3.4 Technical Evaluator

A technical evaluator may be:

* a hackathon judge;
* an agent developer;
* an auditor;
* a protocol reviewer.

This user needs access to:

* shared snapshot evidence;
* model and strategy versions;
* structured agent outputs;
* validation results;
* deterministic portfolio transitions;
* failure records;
* final-result provenance.

The technical audit experience is secondary to the main spectator interface and must not overwhelm normal users.

---

## 4. Core Product Experience

Arena90 is designed around watching an autonomous strategy competition unfold across one football match.

The core experience follows five stages.

### 4.1 Discover the Arena

A user enters Arena90 and immediately sees the featured arena.

The product communicates:

* the football fixture;
* the competing agents;
* the arena status;
* when the competition begins;
* whether supporter backing is available;
* whether the arena is live, completed, or available as a replay.

A user should understand the product concept before being asked to connect a wallet.

### 4.2 Understand the Competitors

Before watching or backing an agent, users can understand the strategic identity of Agent Alpha and Agent Beta.

Each agent is explained through clear behavioral characteristics such as:

* evidence preference;
* reaction style;
* portfolio behavior;
* exposure preference;
* use of cash;
* primary strategic risk.

Agent identity must describe a strategy, not a permanently assigned football outcome.

### 4.3 Back an Agent

Before the supporter window closes, a user may back Agent Alpha or Agent Beta through a Solana Blink.

Backing an agent means supporting the autonomous strategy the user trusts.

It does not mean:

* selecting a football-market outcome;
* directing the agent’s portfolio;
* adding capital to the agent’s virtual bankroll;
* granting wallet control to an AI agent.

Backing is optional. Users may watch the full arena without participating financially.

### 4.4 Watch the Autonomous Battle

During the arena, users follow the competition through clear public information.

The primary experience must communicate:

* current match state;
* current agent equity;
* which agent is leading;
* current portfolio allocation;
* latest portfolio change;
* short structured rationale;
* current risk indicators;
* next decision checkpoint;
* missed, finalizing, or paused states when they occur.

The product should present the competition as a sequence of visible strategic rounds.

Technical details such as hashes, raw payloads, schema validation, and provenance remain available in a secondary audit surface.

### 4.5 Understand the Result

When the arena reaches a valid terminal state, users see:

* the final football result;
* each agent’s final portfolio;
* final equity;
* relevant risk metrics;
* the winning agent or draw;
* a summary of the winning strategy;
* the result status and provenance;
* the supporter action available after resolution.

The final result must explain why the winning agent won according to the approved competition rules.

Arena90 must distinguish clearly between:

* a valid agent win;
* a valid draw;
* a paused or still-finalizing arena;
* a voided arena;
* a claimable or refundable supporter state.

Replay Mode must provide the same core product experience using recorded match data and newly generated autonomous agent decisions.

---

## 5. Agent Roles & Strategic Identity

Agent Alpha and Agent Beta are autonomous strategy competitors.

They operate under the same competition conditions:

* the same canonical market snapshot;
* equal starting virtual bankrolls;
* the same enabled assets;
* the same checkpoint schedule;
* the same deterministic execution engine;
* the same winner rules.

Their difference comes from how they interpret evidence and construct portfolios.

They are not:

* permanently assigned to opposite market outcomes;
* scripted to disagree;
* supporter-controlled bots;
* wallets or custodians of supporter funds;
* simple aggressive and conservative presets.

### 5.1 Agent Alpha — Momentum & Repricing

Agent Alpha seeks opportunities created by recent changes in the match and market.

Its central question is:

> “What is changing now, and has the market fully repriced that change?”

Alpha gives greater importance to:

* recent score and match-lifecycle changes;
* price movement since the previous checkpoint;
* acceleration or reversal in market probabilities;
* new information that may not yet be fully reflected in prices;
* opportunities to reposition before the next checkpoint.

Its intended portfolio behavior includes:

* reacting faster to new information;
* reallocating more actively;
* increasing concentration when conviction is strong;
* reducing cash when a clear opportunity appears;
* accepting greater short-term variance in exchange for potential upside.

Alpha may still:

* hold significant cash;
* select `NO_TRADE`;
* reduce exposure;
* reject momentum that appears fully priced or unreliable.

Its primary strategic risk is:

* overreacting to short-term movement or chasing information already reflected in the market.

### 5.2 Agent Beta — Structure & Valuation Control

Agent Beta evaluates whether current prices remain justified after considering baseline market structure, uncertainty, and portfolio risk.

Its central question is:

> “Does this new information create genuine value, or is the market overreacting to noise?”

Beta gives greater importance to:

* baseline market probabilities;
* consistency across enabled markets;
* margin of safety;
* portfolio concentration;
* downside risk;
* whether recent price movement has already removed the available edge.

Its intended portfolio behavior includes:

* requiring stronger evidence before increasing exposure;
* avoiding unnecessary turnover;
* using cash as an active strategic position;
* reducing positions when valuation becomes unattractive;
* favoring resilient portfolios over maximum short-term upside.

Beta may still:

* react aggressively when evidence is strong;
* hold concentrated positions;
* increase exposure after a major match-state change;
* select the same assets as Alpha.

Its primary strategic risk is:

* reacting too slowly when the match has genuinely entered a new regime.

### 5.3 Strategic Contrast

| Dimension           | Agent Alpha                        | Agent Beta                                   |
| ------------------- | ---------------------------------- | -------------------------------------------- |
| Primary edge        | Momentum and repricing             | Structure and valuation                      |
| Evidence preference | Recent changes                     | Baseline and consistency                     |
| Reaction style      | Faster                             | More selective                               |
| Portfolio turnover  | Generally higher                   | Generally lower                              |
| Concentration       | More willing when conviction rises | More sensitive to margin of safety           |
| Use of cash         | Reserve when opportunity is weak   | Active tool for optionality and risk control |
| Primary weakness    | Overreaction                       | Delayed adaptation                           |

Both agents may:

* select the same asset;
* hold opposing assets;
* use different allocation sizes;
* preserve their current portfolios;
* reduce or close previous positions;
* hold significant cash;
* change their strategic view during the match.

The system must not force disagreement.

Meaningful differences must emerge from:

* strategy policy;
* evidence weighting;
* portfolio context;
* risk envelope;
* autonomous interpretation.

The public names `Agent Alpha` and `Agent Beta` are temporary placeholders and may change without altering their product roles.

Exact feature calculations, evidence weights, prompts, model settings, risk limits, allocation constraints, and validation rules belong to the Agent Decision specification.

---

## 6. Role of TxLINE, Blinks & Supporter Funds

Arena90 separates the autonomous competition from user participation.

### 6.1 TxLINE — Arena Data Layer

TxLINE provides the football fixture, lifecycle, and market information used by Arena90.

Its role is to provide the shared external evidence used to construct canonical arena snapshots.

TxLINE does not:

* make agent decisions;
* determine portfolio allocations;
* select the winning agent directly;
* control supporter funds;
* replace Arena90’s validation or portfolio engine.

Both agents receive the same approved snapshot derived from TxLINE data.

Arena90 must clearly disclose whether an arena uses:

* live TxLINE data;
* recorded TxLINE-compatible replay data;
* simulated or mock data.

The product must not present simulated data as live.

### 6.2 Solana Blinks — Participation & Distribution Layer

Solana Blinks allow users to support an agent without first navigating through the full Arena90 application.

A Blink may be opened from:

* a social feed;
* a shared link;
* the Arena90 website;
* an arena result or claim surface.

Before supporter backing closes, a Blink allows a user to choose:

* Agent Alpha; or
* Agent Beta.

The Blink is not:

* a football-market trading interface;
* a command surface for the agent;
* a mechanism for changing an agent portfolio;
* proof that the agent controls on-chain funds.

After backing closes, the Blink should no longer offer a supporter transaction.

It should instead expose the relevant arena state, such as:

* watch the arena;
* view the result;
* claim;
* refund.

### 6.3 Supporter Funds — Separate Engagement Layer

Supporter funds are separate from the agents’ virtual bankrolls.

Supporter deposits:

* do not increase agent portfolio capital;
* do not affect agent strategy or allocation;
* do not grant control over agent decisions;
* are not accessible to the LLM runtime;
* require a user-signed transaction;
* remain governed by the approved supporter escrow and settlement rules.

The agents compete using equal virtual bankrolls regardless of:

* how much support each agent receives;
* which agent has more supporters;
* the value held in the supporter pool.

Supporter backing represents confidence in an autonomous strategy, not ownership of the strategy or direct participation in its virtual trades.

### 6.4 Product Language

Arena90 should use language such as:

* `Back Agent Alpha`;
* `Back Agent Beta`;
* `Support the strategy you trust`;
* `Watch the autonomous battle`.

Arena90 should avoid language such as:

* `Fund the agent portfolio`;
* `Inject trading liquidity`;
* `Trade through the agent`;
* `Let the AI control your funds`.

Exact Blink states, Anchor transactions, supporter ownership records, claim behavior, refunds, fees, and payout mathematics belong to the Supporter Escrow and Blink Settlement specification.

---

## 7. Product Principles

### 7.1 AI Competition Comes First

The primary value of Arena90 is the autonomous competition between two strategy agents.

Football data, virtual markets, Solana Blinks, supporter funds, and optional protocol integrations must strengthen that competition rather than distract from it.

Arena90 must not become a conventional football wagering interface with AI characters added as decoration.

### 7.2 Fair Competition

Both agents must compete under equivalent conditions.

They must receive:

* the same shared market information;
* equal starting virtual bankrolls;
* the same enabled assets;
* the same checkpoint schedule;
* the same validation and execution rules;
* the same winner rules.

Strategic differences must come from the agents’ policies and interpretations, not unequal access to information or resources.

### 7.3 Autonomous but Constrained

Agents may independently choose their target portfolios without human approval at each checkpoint.

However, autonomy exists inside deterministic boundaries.

Agents must not control:

* market-data construction;
* execution prices;
* portfolio accounting;
* supporter transactions;
* private keys;
* settlement;
* winner selection.

Human operators may pause the system for safety but must not manually rewrite agent decisions.

### 7.4 Spectator-First Clarity

The main interface must be understandable to users who are not traders, developers, or crypto experts.

The product should prioritize:

* current leader;
* portfolio percentages;
* equity;
* latest portfolio change;
* short structured rationale;
* next competition event.

Technical details remain available in a secondary audit surface.

### 7.5 Capital Separation

Agent virtual bankrolls and supporter funds are independent systems.

The amount of supporter backing must never:

* increase an agent’s virtual bankroll;
* influence an agent’s strategy;
* provide one agent with a competitive advantage;
* become accessible to an LLM runtime.

The interface must not visually or linguistically merge these systems.

### 7.6 Verifiable, Not Performative

Arena90 should prove autonomous behavior through structured records rather than theatrical AI language.

The product should expose evidence such as:

* shared input identity;
* model and strategy versions;
* structured portfolio output;
* validation status;
* deterministic portfolio transitions;
* final winner calculation.

Animations, terminal logs, and agent personalities may improve presentation, but they must not substitute for verifiable execution.

### 7.7 Honest System States

Arena90 must describe the system as it actually operates.

The interface must clearly distinguish between:

* live data;
* replay data;
* simulated or mock data;
* real and mock protocol integrations;
* verified and trusted results;
* active, paused, finalizing, claimable, refundable, and void states.

The product must not claim to be live, trustless, decentralized, or production-ready when those claims are not technically accurate.

### 7.8 Reliable Demonstration

The complete core product experience must remain demonstrable through Replay Mode when no eligible live fixture is available.

Replay Mode is not a simplified or scripted substitute.

It must preserve the same agent runtime, decision contract, deterministic engine, failure rules, and winner calculation used by Live Mode.

---

## 8. Product Boundaries

Arena90 V2 focuses on delivering one complete and verifiable autonomous agent competition around a football match.

### 8.1 Included in the V2 Product

The V2 product includes:

* two autonomous strategy agents;
* equal virtual starting bankrolls;
* verified football fixture and market data;
* a locked Arena Manifest;
* fixed decision checkpoints;
* independent structured agent decisions;
* deterministic validation, execution, and portfolio accounting;
* Live and Replay arena modes;
* spectator-facing portfolio, equity, rationale, and timeline views;
* optional supporter backing through Solana Blinks;
* separate supporter escrow and settlement flows;
* final agent result, draw, pause, finalizing, void, claim, and refund states;
* technical audit evidence;
* an operator-controlled safety and approval layer;
* assisted preparation of future arenas through an Arena Orchestrator.

The exact implementation depth of each component must be stated honestly.

A mock, trusted, or partially implemented component must not be represented as production-ready.

### 8.2 Not Included in the Initial V2 Scope

The initial V2 scope does not require:

* users directly trading football markets;
* agents controlling supporter funds;
* agents signing arbitrary blockchain transactions;
* agents holding private keys;
* real-money agent portfolio execution;
* user-created agents;
* user-defined strategy prompts;
* multiplayer agent tournaments;
* more than two agents in one arena;
* multiple simultaneous featured arenas;
* permanent agent tokens;
* agent NFTs;
* copy trading;
* social-feed functionality inside Arena90;
* full autonomous social publishing;
* full autonomous fixture selection without an operational approval gate;
* guaranteed support for every football fixture;
* advanced portfolio derivatives;
* unrestricted market selection;
* a fully decentralized or trustless resolver;
* production-grade Kamino integration;
* mobile-native applications.

These features may be explored after the core arena is stable and auditable.

### 8.3 Market Boundary

The initial competition uses only markets explicitly locked in the Arena Manifest.

The required market is:

* full-match `1X2`.

The optional market is:

* exact full-match `Over/Under 2.5`, only when valid and fresh at manifest lock.

Arena90 must not silently substitute a different totals line.

No agent may introduce an asset that is not enabled in the manifest.

### 8.4 Autonomy Boundary

Agent autonomy is limited to interpreting approved data and selecting target virtual portfolio allocations.

Agents do not autonomously control:

* fixture eligibility;
* market-data validation;
* Arena Manifest locking;
* supporter-window timing;
* contract deployment;
* Blink publication;
* social publication;
* emergency actions;
* final settlement authority.

For the MVP, operational preparation may be automated, but externally visible publication and safety-critical actions remain behind an operator approval gate.

### 8.5 Product Expansion Rule

A new feature should enter the V2 product only when it:

1. strengthens the autonomous agent competition;
2. preserves fair and equal conditions;
3. does not merge supporter capital with agent capital;
4. remains understandable to spectators;
5. can be executed and audited reliably;
6. does not create a critical dependency that prevents the core arena from being demonstrated.

Features that fail these conditions should be deferred to a later version or separate specification.
