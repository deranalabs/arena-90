# Arena90 — Autonomous Game Loop Decision

**Status:** Approved

**Agents:** Agent Alpha and Agent Beta

**Scope:** Autonomous competition loop only

## 1. Purpose & Scope

This document defines the authoritative autonomous competition loop for Arena90.

It locks:

* how Agent Alpha and Agent Beta participate in one arena;
* when autonomous decisions occur;
* what shared information both agents receive;
* what agents may output;
* how valid outputs become deterministic portfolio actions;
* how failures affect the competition;
* how the terminal winner is determined;
* how Live Mode and Replay Mode remain equivalent.

This document does not define:

* exact pricing, fees, slippage, or accounting formulas;
* detailed TxLINE adapter and snapshot schemas;
* supporter staking, claims, refunds, or payout mathematics;
* Anchor account and instruction design;
* frontend routes or presentation details.

Those rules belong to their relevant product documents and technical specifications.

## 2. Autonomous Loop Model

Arena90 uses a fixed-checkpoint autonomous portfolio competition.

Agent Alpha and Agent Beta begin each arena with equal virtual bankrolls and independently manage their portfolios throughout one football match.

Agents do not trade continuously. They may submit a new portfolio decision only at:

* Kickoff
* 15 minutes
* 30 minutes
* Halftime
* 60 minutes
* 75 minutes

Each checkpoint is one autonomous competition round:

1. Arena90 locks one shared canonical market snapshot.
2. Both agents receive the same snapshot.
3. Each agent receives its own current portfolio context.
4. Both agents independently submit a target portfolio.
5. Valid outputs are converted into deterministic portfolio actions.
6. Decisions are revealed after both agents resolve or reach their deadlines.
7. Portfolio states and competition metrics are updated.

Final Settlement is a terminal arena event, not a trading checkpoint. Agents cannot submit a new decision after the 75-minute checkpoint.

Agents control strategy selection only. Pricing, validation, execution, accounting, and settlement remain deterministic system responsibilities.

## 3. Arena Manifest & Enabled Markets

Every arena uses an immutable Arena Manifest that is locked before supporter backing opens.

The manifest defines the shared competition conditions, including:

* fixture identity;
* participating agents and strategy versions;
* equal starting virtual bankroll;
* enabled market assets;
* decision checkpoints;
* execution rule version;
* winner rule version;
* supporter lock time;
* resolver mode.

Once supporter backing opens, these conditions must not change.

The required MVP market is full-match Match Outcome / 1X2:

* `HOME`
* `DRAW`
* `AWAY`

The arena must not open when the required 1X2 market is unavailable, invalid, or stale at manifest lock.

Full-match Total Goals 2.5 is optional:

* `OVER_2_5`
* `UNDER_2_5`

It may be enabled only when the exact full-match `2.5` line is available, valid, and fresh at manifest lock.

Arena90 must not substitute another totals line such as `2.25`, `2.75`, or `3.0`.

Every arena also enables:

* `CASH`

Agents may allocate only to assets enabled in the manifest.

If Total Goals 2.5 is not enabled, the arena proceeds using `HOME`, `DRAW`, `AWAY`, and `CASH`.

Exact manifest fields, freshness limits, identifiers, and activation thresholds belong to the Arena Data specification.

## 4. Shared Snapshot & Independent Decisions

At every checkpoint, Arena90 freezes one canonical market snapshot.

Agent Alpha and Agent Beta receive the exact same shared snapshot, including the same:

* fixture state;
* score and match phase;
* enabled markets;
* market prices;
* source timestamps;
* sequence context;
* freshness status;
* snapshot identifier.

Unavailable or unverified data must remain unavailable. The system must not infer or fabricate missing information.

Each agent separately receives its own portfolio context, including:

* current cash;
* open positions;
* current equity;
* realized and unrealized performance;
* drawdown;
* exposure;
* previous valid portfolio decision;
* previous missed-epoch state, when applicable.

The agents decide independently.

Neither agent may receive the other agent’s current output before submitting its own decision.

Both decisions are revealed only after:

* both agents return valid outputs; or
* each agent reaches its configured deadline.

The shared snapshot guarantees equal information. Separate strategy instructions and portfolio contexts preserve meaningful strategic differences.

Exact schemas, serialization, hashing, freshness thresholds, and sequence recovery rules belong to the Arena Data specification.

## 5. Agent Output & Deterministic Execution

At each checkpoint, each agent returns one structured decision.

The primary output is a target portfolio allocation across the assets enabled in the Arena Manifest.

All allocations:

* use basis points;
* must total exactly `10,000 bps`;
* must not be negative;
* must use only enabled assets;
* must satisfy the agent’s approved risk constraints.

An agent may instead return:

* `NO_TRADE`

`NO_TRADE` is an intentional strategy decision that preserves the current portfolio.

Before execution, the system validates:

* output schema;
* allocation total;
* enabled assets;
* risk constraints;
* unsupported or fabricated evidence.

Agent output does not directly create transactions or modify portfolio balances.

A deterministic engine compares the valid target portfolio with the current portfolio and derives:

* `OPEN`
* `INCREASE`
* `REDUCE`
* `CLOSE`
* `HOLD`

Pricing, quantity calculation, fees, slippage, accounting, and settlement must not be calculated or controlled by the LLM.

Exact output schemas, strategy policies, risk limits, and accounting formulas belong to the Agent Decision and Paper Engine specifications.

## 6. Failures, Retry & Emergency Pause

Arena90 distinguishes intentional decisions from execution failures.

`NO_TRADE` is valid agent behavior.

A failed or missing response must never be converted into `NO_TRADE` or a hardcoded fallback portfolio.

When an agent returns an invalid output, the system may perform one constrained retry using the same snapshot and portfolio context.

The retry may only request correction of invalid structure or unsupported fields. It must not:

* provide new market information;
* reveal the other agent’s decision;
* change the checkpoint snapshot.

If the retry fails, that agent receives:

* `MISSED_EPOCH`

A `MISSED_EPOCH`:

* applies only to the failed agent;
* preserves its previous portfolio;
* creates no execution;
* records the failure reason;
* remains visible in the arena history;
* does not cancel the other agent’s valid decision.

A shared failure produces:

* `GLOBAL_MISSED_EPOCH`

Examples include:

* no valid shared snapshot;
* stale required market data;
* unresolved sequence inconsistency;
* shared orchestration failure.

A `GLOBAL_MISSED_EPOCH` preserves both portfolios and creates no retroactive trade.

An Emergency Pause stops new checkpoint execution while preserving existing arena and portfolio state.

A pause must not:

* rewrite previous decisions;
* alter portfolios manually;
* select a winner;
* automatically void the arena.

Detailed resume and void behavior belongs to the Arena Lifecycle specification.

## 7. Winner & Terminal Result

Final Settlement begins only after Arena90 receives a verified terminal match state.

It is not an agent decision checkpoint.

During Final Settlement, the deterministic system:

1. settles every enabled synthetic market using the verified final result;
2. calculates each agent’s final portfolio equity;
3. updates terminal risk metrics;
4. applies the published winner rules;
5. records the terminal result and provenance.

The winner is determined in this order:

1. Higher final equity
2. Lower maximum drawdown
3. Lower peak exposure
4. `DRAW`

Possible competition results are:

* `AGENT_ALPHA_WIN`
* `AGENT_BETA_WIN`
* `DRAW`

A draw occurs only when final equity and all approved tie-breakers remain equal.

A draw is a valid competitive result. It is not an operational failure or a voided arena.

If the final match result cannot be verified, the arena must remain finalizing or paused. The system must not guess the result or manually select a winning agent.

Exact settlement formulas, supporter payout behavior, and result-attestation mechanisms belong to their relevant specifications.

## 8. Live/Replay Equivalence & Audit

Live Mode and Replay Mode must use the same autonomous competition rules.

Both modes share:

* Arena Manifest structure;
* enabled market rules;
* checkpoint schedule;
* canonical snapshot format;
* agent input contract;
* target portfolio output contract;
* validation rules;
* deterministic execution engine;
* portfolio accounting rules;
* failure states;
* winner calculation;
* audit record format.

The only differences are data source and pacing.

Live Mode processes eligible TxLINE updates according to the real fixture lifecycle.

Replay Mode processes recorded canonical snapshots using an accelerated timeline.

Agent decisions must still be generated during replay. Replay Mode must not use prerecorded agent decisions or predetermined portfolio outputs.

Replay must preserve:

* checkpoint order;
* snapshot order;
* market state;
* agent deadlines relative to replay time;
* execution behavior;
* terminal settlement rules.

Every arena must produce an auditable event history proving:

* which manifest governed the arena;
* which snapshot was used at each checkpoint;
* that both agents received the same shared snapshot;
* which model and strategy version each agent used;
* what structured output each agent submitted;
* whether validation passed;
* what deterministic actions were derived;
* portfolio state before and after execution;
* all missed epochs, pauses, and shared failures;
* how the terminal winner was calculated.

Audit records must separate:

* shared arena data;
* Agent Alpha records;
* Agent Beta records;
* deterministic system results.

The audit system must not expose private chain-of-thought.

It may expose structured rationale, model metadata, hashes, validation results, and portfolio transitions.

Exact storage schemas, hashing methods, replay persistence, and provenance formats belong to the Arena Data and Audit specifications.
