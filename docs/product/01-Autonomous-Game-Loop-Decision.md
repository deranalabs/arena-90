# Arena90 — Autonomous Game Loop Decision

**Status:** Approved

## 1. Loop Model & Trading Instrument
**Fixed-Checkpoint Autonomous Trading** is selected over continuous trading and single-position agents. 

**MVP Paper-Trading Instrument:**
- `HOME`, `DRAW`, and `AWAY` are long-only synthetic binary shares for the full-match Match Outcome / 1X2 market.
- `OVER_2_5` and `UNDER_2_5` are long-only synthetic binary shares for the conditionally activated full-match Total Goals 2.5 market.
- Prices are derived from verified demargined implied probabilities in the canonical TxLINE snapshot.
- For Match Outcome / 1X2:
  - the winning outcome share settles to 1 virtual unit;
  - the losing outcome shares settle to 0.
- For Total Goals 2.5:
  - `OVER_2_5` settles to 1 virtual unit when the final total goals are 3 or more;
  - `UNDER_2_5` settles to 1 virtual unit when the final total goals are 2 or fewer;
  - the losing outcome settles to 0.
- `CASH` remains unallocated virtual currency and does not require market settlement.
- No short selling.
- No leverage.
- No negative cash.
- *Exact raw-price normalization remains pending final verification.*


## 2. MVP Market Universe

### Core Market 1 — Full-Match Match Outcome / 1X2

Tradable assets:
- `HOME`
- `DRAW`
- `AWAY`

This market is required for the Arena90 MVP.

The arena must not enter `OPEN_FOR_SUPPORT` if the required Full-Match 1X2 market is unavailable, invalid, or stale when the Arena Manifest is locked.

### Conditional Core Market 2 — Full-Match Total Goals 2.5

Tradable assets:
- `OVER_2_5`
- `UNDER_2_5`

The Total Goals 2.5 market is conditionally activated only when the exact full-match `line=2.5` contract is available, valid, and fresh when the Arena Manifest is locked.

If Total Goals 2.5 does not satisfy the activation requirements, the arena may proceed with Match Outcome / 1X2 and `CASH` only.

The system must not automatically substitute another totals line such as:
- `2.25`;
- `2.75`;
- `3.0`;
- or any other alternate line.

### Shared Cash Asset

- `CASH`

### Stretch Market

First-Half Over/Under 0.5 may be introduced later as a stretch market after its lifecycle, tradability window, and halftime settlement behavior are separately approved.

The following remain outside the core MVP:
- Asian Handicap;
- quarter-line totals;
- dynamic line switching;
- automatic replacement of unavailable contracts;
- unrestricted alternate-market selection by agents.


## 3. Target Allocation & Agent Actions
The primary LLM output is a **target portfolio allocation**.

Each agent proposes allocations in basis points (bps) across the assets enabled in the immutable Arena Manifest.

When both core markets are enabled, the available allocation assets are:
- `HOME`;
- `DRAW`;
- `AWAY`;
- `OVER_2_5`;
- `UNDER_2_5`;
- `CASH`.

When Total Goals 2.5 is disabled, `OVER_2_5` and `UNDER_2_5` must not receive any allocation.

Only manifest-enabled assets may be selected, and all target allocations must total exactly 10,000 bps.

The deterministic paper engine compares the target portfolio with the previous portfolio and derives the exact executions:
- `OPEN`
- `INCREASE`
- `REDUCE`
- `CLOSE`
- `HOLD`

An agent may explicitly select `NO_TRADE` to intentionally retain its existing portfolio without reallocation.

## 4. Scheduled Trading Checkpoints & Final Settlement
**Trading Checkpoints:**
- Kickoff
- 15 minutes
- 30 minutes
- Halftime
- 60 minutes
- 75 minutes

**Final Settlement** is a terminal lifecycle event, not an agent trading epoch. No new agent trade is created during Final Settlement.

## 5. Checkpoint Timing Hierarchy
Scheduled checkpoint targets and lifecycle-aware triggers must follow this hierarchy:
1. Explicit TxLINE lifecycle or period event.
2. Observed and verified match-clock field, if available.
3. Game-state transition and event sequence.
4. Server wall clock (used only as a watchdog or fallback signal).

*Wall-clock time must never be the sole canonical proof of halftime or finalization.*

## 6. Symmetrical Starting Conditions, Canonical Snapshot & Decision Context
Both agents begin with an equal virtual starting bankroll. Unavailable data must not be inferred.

### Shared Canonical Market Snapshot
The exact same immutable market snapshot and snapshot hash are provided to both agents. It includes (where observed and available):
- fixture ID
- epoch ID
- lifecycle state
- score context
- raw odds records
- normalized prices
- market identifiers
- market family
- market period
- exact market line, where applicable
- synthetic contract identifier
- contract activation status
- enabled allocation assets
- settlement-rule identifier
- market availability
- source timestamps
- sequence numbers
- freshness status

**Snapshot Hashing:**
The canonical snapshot payload is serialized deterministically. The `snapshotHash` is excluded from the hashed payload used to calculate itself. The resulting hash is then attached to the snapshot record. Both agents receive the exact same canonical payload and resulting snapshot hash.

The shared market snapshot hash must not include agent-specific portfolio state.

### Agent-Specific Decision Context
Each agent separately receives its own current portfolio context:
- virtual cash
- open positions
- average entry prices
- realized PnL
- marked position value
- current equity
- maximum drawdown
- peak exposure
- previous valid action
- previous missed-epoch state, if applicable

## 7. Halftime, Resume, and Sequence Recovery
**Halftime Execution:**
Triggered by an observed TxLINE halftime lifecycle event (e.g., `halftime_finalised`) or equivalent phase transition. When received:
1. Verify the fixture ID.
2. Verify that the event sequence is newer than the previously processed sequence.
3. Record the halftime event timestamp and sequence.
4. Wait within a bounded freshness window for the latest valid odds snapshot.
5. Verify that the market is available and not stale.
6. Freeze one canonical Halftime snapshot.
7. Give the exact same snapshot and snapshot hash to both agents.
8. Execute the Halftime epoch.
*(If no valid odds snapshot becomes available inside the configured window, record a `GLOBAL_MISSED_EPOCH`.)*

**Second-Half Resume:**
Triggered by an explicit second-half resume lifecycle event, or a newer score event returning to an in-progress state. The 60-minute and 75-minute targets must be calculated relative to verified second-half progression or observed match clock, not solely from kickoff wall-clock time.

**Missed-Event and Sequence Recovery:**
If score-event sequences show a gap:
- Pause checkpoint processing.
- Retrieve available historical or current score records.
- Replay the missing sequence range.
- Recover any missed halftime, resume, or finalization events.
- Resume normal processing only after state consistency is restored.

## 8. Agent Failures, Missed Epochs, and Suspensions
**Failures (`MISSED_EPOCH` and `GLOBAL_MISSED_EPOCH`):**
If an agent fails (provider timeout, invalid JSON, fabricated evidence) it is allowed **one constrained retry**. A second failure results in a `MISSED_EPOCH` for that specific agent.

`MISSED_EPOCH` is recorded **per agent**. If ISAGI fails but AIKU produces a valid decision, AIKU's epoch execution may still proceed. One agent's failure does not automatically cancel the other agent's execution unless a global feed or market failure affects both.

A `MISSED_EPOCH`:
- preserves the previous portfolio;
- creates no transaction;
- records the failure reason;
- must not be presented as an agent decision;
- must never trigger a hardcoded fallback position.

A `GLOBAL_MISSED_EPOCH` is used for a shared feed, market, snapshot, or orchestration failure that prevents both agents from executing.
A `GLOBAL_MISSED_EPOCH`:
- preserves both portfolios;
- creates no execution for either agent;
- records the global failure reason;
- does not execute a retroactive trade;
- continues to the next valid checkpoint unless the configurable consecutive-failure threshold triggers Emergency Pause.

**Suspensions:**
A score-feed `suspend` event must not automatically be interpreted as an odds-market suspension. When a fixture is suspended:
- Pause new epoch execution.
- Preserve all portfolios.
- Do not execute retroactive trades.
- Wait for a verified resume, finalization, abandonment, or cancellation event.
- A temporary suspension must not automatically void the arena.

## 9. Portfolio Accounting & Execution Provenance
At normal trading epochs, the engine calculates and records:
- Cash
- Open positions, keyed by synthetic market contract and including:
  - market family
  - market period
  - exact line, where applicable
  - outcome
  - quantity
  - average entry price
  - latest marked price
  - settlement state
- Realized PnL
- Marked position value
- Current equity
- Maximum drawdown
- Peak exposure

`Final Settlement Value` is calculated only during the terminal Final Settlement event.

**Execution Provenance Requirements (per epoch):**

Each epoch ledger record must store shared metadata and agent-specific execution paths separately.

**Epoch Hashing:**
The final `epochHash` must commit to the complete epoch result, proving both the shared market input and the complete execution outcome of both agents. It includes:
- shared epoch metadata;
- canonical snapshot hash;
- ISAGI agent-specific execution record;
- AIKU agent-specific execution record;
- portfolio state after execution for both agents;
- global epoch status;
- previous epoch hash.

**Shared Epoch Record:**
- arena ID
- epoch ID
- fixture ID
- canonical snapshot hash
- source timestamps and sequences
- previous epoch hash
- epoch hash

**Agent-Specific Execution (Stored separately for ISAGI and AIKU):**
- provider
- model
- prompt version
- strategy version
- raw agent-response hash
- validation result
- final target allocation or NO_TRADE
- derived executions
- portfolio before execution
- portfolio after execution
- per-agent MISSED_EPOCH reason

## 10. Winner Calculation & Terminal Draw
**Winner Metric:**
1. Highest final equity.
2. *First tie-breaker:* Lower maximum drawdown.
3. *Second tie-breaker:* Lower peak exposure.
4. *Final tie-breaker:* Draw.

**Terminal Draw Behavior:**
If final equity and all tie-breakers remain equal, the Arena Result becomes `DRAW`.
The Settlement Path for a `DRAW` is:
- Refund supporter principal 1:1.
- Distribute accrued yield pro-rata based on total supporter principal.
- No funds or yield may remain indefinitely trapped.
*(Note: A technical `VOIDED` status remains strictly reserved for cancellation, abandonment, unrecoverable system failure, or explicit administrative void).*

## 11. Live Mode & Replay Mode
- **Live Mode** and **Replay Mode** use the exact same engine and rules.
- Replay Mode accelerates recorded TxLINE data for demos.
- Agent decisions must be generated during the replay and are not prerecorded.

## 12. Separation of Capital & Optional Yield
- **Virtual Agent Bankroll:** Simulated funds used purely for agent accounting and performance metrics.
- **Supporter Escrow:** An SPL-token supporter vault controlled by the Anchor program’s PDA authority. The LLM agents must never control supporter funds, private keys, or arbitrary transaction execution.
- **Kamino Yield:** Optional and strictly outside the critical autonomous-agent path.

## 13. Supporter Lifecycle
- Before kickoff, users back ISAGI or AIKU through a supported Solana Blink.
- The Blink transaction must call the Anchor `stake_agent` instruction and transfer the configured SPL settlement token into the program-controlled supporter vault.
- Supporter staking locks on-chain before autonomous agent trading begins. No in-play staking window is permitted for the MVP.
- After the supporter lock time, the Blink must no longer offer an active staking transaction and should expose a closed or read-only arena state.
- Winning-agent supporters share the distributable pool upon resolution.

## 14. Emergency Pause vs. Void Arena
- **Emergency Pause:** Stops new agent epochs and paper executions while preserving state. Invoked automatically on consecutive failure thresholds, or manually by Admin.
- **Void Arena:** An explicit Admin Action (after review) that results in supporter refunds. Do not automatically void an arena because of a single provider timeout, invalid LLM response, missing epoch, or temporary feed outage.

## 15. Immutable Arena Manifest
The following parameters are immutable before the arena begins (prior to supporter staking):
- Agents and strategy versions
- Starting virtual bankroll
- Market universe
- Full-Match 1X2 activation status
- Full-Match Total Goals 2.5 activation status
- Exact enabled market periods and lines
- Synthetic contract identifiers
- Settlement-rule identifiers
- Prohibition on automatic market-line substitution
- Epoch rules
- Risk limits
- Execution rule
- Fee rule
- Winner metric
- Supporter lock timestamp
- Resolver mode

## 16. Open Product Questions / Pending Paper Exchange Rules
Exact numeric parameters are kept unresolved in this document and will be frozen in a separate `Paper Exchange Rules` document committed to the Arena Manifest:
- Exact numeric exposure limits and per-epoch allocation limits.
- Freshness limits / snapshot waiting windows.
- Retry duration limits.
- Exact simulated fees or slippage formulas.
- Maximum consecutive failure thresholds.
- Exact activation requirements for Full-Match Total Goals 2.5.
- Behavior when an enabled market disappears or becomes stale after the Arena Manifest is locked.
- Mark-to-market behavior when an existing position has no fresh market price.
- Canonical settlement source for final total goals.
- Whether a conditionally disabled market may remain visible as unavailable in the user interface.
- Whether an agent may simultaneously allocate to opposing outcomes within the same market family, such as both `OVER_2_5` and `UNDER_2_5`.
