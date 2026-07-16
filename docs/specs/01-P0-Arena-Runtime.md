# Arena90 — P0 Arena Runtime Specification

**Status:** Approved

This specification turns the approved Arena90 V2 product decisions into the minimum implementation contract for the hackathon runtime. Approved product documents remain authoritative when conflicts exist.

## 1. P0 Goal

Deliver one deployable runtime that completes:

`recorded TxLINE-compatible data → canonical snapshots → Alpha and Beta decisions → validation → simultaneous reveal → deterministic execution → portfolio accounting → final winner`

P0 must prove:

- Alpha and Beta receive the same canonical snapshot at every checkpoint;
- both agents are called independently;
- valid structured decisions affect equal virtual portfolios;
- invalid, timed-out, or missing decisions never become fallback trades;
- execution, accounting, and winner calculation are deterministic;
- Live and Replay can share the same engine;
- agents never control supporter funds, wallets, private keys, or transactions.

## 2. Scope

Included:

- one arena at a time;
- recorded TxLINE-compatible fixture data;
- full-match `1X2` assets;
- Agent Alpha and Agent Beta;
- approved checkpoints and equal starting bankrolls;
- target allocations and `NO_TRADE`;
- one constrained repair attempt;
- missed-round behavior and simultaneous reveal;
- virtual execution, mark-to-market accounting, settlement, and winner;
- HTTP state/event APIs and automated tests.

Excluded:

- Solana Actions, Blinks, Anchor, backing, claim, refund, and payout;
- production TxLINE streaming or authentication;
- multiple arenas, user-created agents, Kamino, or real-money trading;
- production frontend integration.

Do not add excluded work without explicit authorization.

Production TxLINE authentication and live-data integration were excluded from
the original P0 baseline. They are explicitly authorized for Slice 5 by
`specs/03-TxLINE-Live-Data-Adapter.md`, which extends this specification without
changing the historical P0 scope.

## 3. Module Ownership

Create:

```text
backend/arena-runtime/
  src/
    api/
    contracts/
    adapters/agents/
    adapters/data/
    engine/
    services/
  fixtures/
  tests/
```

Ownership:

- `contracts/`: schemas, enums, validation.
- `adapters/data/`: provider data to canonical snapshots.
- `adapters/agents/`: Alpha/Beta invocation and raw output.
- `engine/`: deterministic execution, accounting, settlement, events.
- `services/`: checkpoint orchestration; no competition math.
- `api/`: public runtime state and events.
- `fixtures/`: recorded provider-compatible data.
- `tests/`: contracts, failures, determinism, end-to-end run.

`agents/zeroclaw/` may contain portable configuration and wrappers only. It must not own accounting, settlement, or fallback decisions.

Do not restore V1 names or contracts such as ISAGI, AIKU, `clash-state.json`, deterministic strategy scripts, or machine-specific paths.

## 4. Arena Manifest

```ts
type ArenaMode = "LIVE" | "REPLAY";
type ArenaAgentId = "alpha" | "beta";
type ArenaAssetId = "HOME" | "DRAW" | "AWAY";
type CheckpointId =
  | "KICKOFF" | "M15" | "M30" | "HALFTIME"
  | "M60" | "M75" | "FINAL";

interface ArenaManifest {
  schemaVersion: 1;
  arenaId: string;
  mode: ArenaMode;
  competition: string;
  fixtureId: string;
  homeTeam: { name: string; code: string };
  awayTeam: { name: string; code: string };
  kickoffUtc: string;
  startingBankrollMicros: string;
  currency: "VIRTUAL_USD_MICROS";
  assets: Array<{
    id: ArenaAssetId;
    market: "FULL_TIME_1X2";
    label: string;
  }>;
  checkpoints: CheckpointId[];
  createdAtUtc: string;
}
```

Rules:

- all three `1X2` assets are required;
- both agents use the same locked manifest;
- agents cannot add assets or checkpoints;
- `FINAL` settles the arena and does not request a new decision.

## 5. Canonical Snapshot

```ts
interface CanonicalSnapshot {
  schemaVersion: 1;
  providerSequence: number;
  snapshotId: string;
  snapshotHash: string;
  arenaId: string;
  fixtureId: string;
  checkpointId: Exclude<CheckpointId, "FINAL">;
  observedAtUtc: string;
  sourceEventId: string;
  source: "TXLINE_RECORDED" | "TXLINE_LIVE";
  match: {
    status: "SCHEDULED" | "LIVE" | "HALFTIME" | "FINISHED";
    minute: number;
    addedTime: number;
    homeScore: number;
    awayScore: number;
  };
  priceMicros: Record<ArenaAssetId, number>;
  freshness: {
    marketUpdatedAtUtc: string;
    delayed: boolean;
    suspended: boolean;
  };
}
```

Rules:

- both agents receive the exact same snapshot ID and payload;
- `providerSequence` is a positive integer preserving provider event order;
- `snapshotHash` is the lowercase SHA-256 hash of the canonical snapshot payload
  excluding `snapshotHash`;
- prices must be finite and greater than zero;
- missing or malformed required fields are rejected;
- suspended snapshots are not silently replaced;
- recorded data preserves event order and checkpoint identity;
- provider-specific fields do not leak into agent or engine contracts;
- `priceMicros` represents normalized full-match `1X2` probability prices;
- each price is an integer from `1` to `999999`;
- `HOME`, `DRAW`, and `AWAY` prices sum to exactly `1000000`;
- raw bookmaker decimal odds never enter agent or engine contracts;
- the data adapter owns normalization and deterministic remainder allocation;
- recorded fixtures store canonical `priceMicros` values directly.

## 6. Agent Decision

```ts
interface AgentDecision {
  schemaVersion: 1;
  arenaId: string;
  snapshotId: string;
  checkpointId: Exclude<CheckpointId, "FINAL">;
  agentId: ArenaAgentId;
  action: "TARGET_ALLOCATION" | "NO_TRADE";
  targetAllocationBps: {
    cash: number;
    HOME: number;
    DRAW: number;
    AWAY: number;
  };
  publicExplanation: string;
}
```

Validation:

- output is one JSON object with no surrounding prose;
- identity fields match the request;
- allocation values are integers from `0` to `10000`;
- all values sum to exactly `10000`;
- unknown assets are invalid;
- `NO_TRADE` preserves the current portfolio;
- public explanation is concise and claims only supplied data;
- private chain-of-thought is never requested or published.

Raw model output may be retained for restricted debugging. Public APIs expose only validated decisions and public explanations.

## 7. Invocation and Reveal

At each decision checkpoint:

1. build one canonical snapshot;
2. create separate Alpha and Beta requests;
3. invoke both without sharing the other decision;
4. collect results privately;
5. validate each result;
6. allow at most one schema-repair attempt;
7. close at the configured deadline;
8. reveal validated outcomes simultaneously.

The repair request may describe validation errors but must not inject a trade.

Configuration:

```text
ARENA90_AGENT_TIMEOUT_MS
ARENA90_MAX_REPAIR_ATTEMPTS=1
ZEROCLAW_BIN
ZEROCLAW_CONFIG_DIR
```

Tests may use fake adapters. The integration path must call ZeroClaw and must not substitute scripted decisions when it fails.

## 8. Failure Behavior

Per-agent invalid output, timeout, process failure, or missing output:

- emit `MISSED_DECISION_ROUND`;
- preserve that portfolio;
- execute the other valid decision;
- never generate a fallback allocation.

Shared data or orchestration failure:

- emit `GLOBAL_MISSED_DECISION_ROUND`;
- preserve both portfolios;
- do not fabricate snapshots or decisions.

Failures remain visible in public state and events.

## 9. Execution and Accounting

```ts
type MoneyMicros = string;
type UnitMicros = string;

interface PortfolioState {
  agentId: ArenaAgentId;
  cashMicros: MoneyMicros;
  unitMicros: Record<ArenaAssetId, UnitMicros>;
  navMicros: MoneyMicros;
  returnBps: number;
  updatedAtCheckpoint: CheckpointId;
}
```

Fixed-point policy:

- one virtual USD equals `1000000` money micros;
- one whole asset unit equals `1000000` unit micros;
- JSON serializes money and unit quantities as base-10 integer strings;
- engine arithmetic uses integers or `bigint`, never floating-point values;
- `priceMicros` uses the same `1000000` scale;
- integer division truncates toward zero.

Rebalance rules:

- decisions express target weights, not orders or supporter stakes;
- all four allocation values must sum to `10000` basis points;
- rebalance using the canonical checkpoint `priceMicros`;
- for each non-cash asset:
  - `targetValueMicros = navMicros * allocationBps / 10000`;
  - `targetUnitMicros = targetValueMicros * 1000000 / priceMicros`;
  - both divisions use integer truncation;
- mark-to-market asset value is
  `unitMicros * priceMicros / 1000000`;
- `cashMicros` is the previous NAV minus the marked value of all target units;
- rounding residue therefore remains in cash;
- P0 uses zero fees and zero slippage;
- execution is atomic per agent;
- invalid decisions never partially execute;
- identical inputs produce identical portfolios and results;
- mark portfolios to the latest canonical prices after each round.

Final settlement:

- the asset matching the full-time result settles at `1000000`;
- the other two assets settle at `0`;
- `finalNavMicros = cashMicros + winningAssetUnitMicros`;
- `returnBps = (finalNavMicros - startingBankrollMicros) * 10000
  / startingBankrollMicros`, using integer truncation;
- higher final NAV wins;
- equal final NAV is a draw;
- `FINAL_NAV_ONLY_V1` is the complete winner rule; no drawdown, exposure,
  trade-count, or earlier-leader tie-breaker is permitted;
- agents cannot choose settlement behavior.

The terminal result is schema V2 and must bind:

- the literal winner rule `FINAL_NAV_ONLY_V1`;
- both final NAV values and the winning `1X2` asset;
- verified terminal evidence containing the final score, source mode, provider
  sequence, provider event identity, observation time, and evidence hash;
- the single `COMPLETED` event sequence;
- a hash of the complete pre-settlement event log;
- a deterministic final-result hash over all fields above.

Lifecycle persistence must use atomic replacement of a strict JSON record and
must fsync the file before rename. Restart recovery resumes durable pending
work and must not duplicate checkpoint ranges, event IDs/sequences, agent
settlement, or the terminal `COMPLETED` event.

These formulas must be implemented once in the deterministic engine and covered
by automated tests.

## 10. Events and State

Minimum events:

```text
ARENA_READY
CHECKPOINT_OPENED
AGENTS_ANALYZING
DECISION_RECEIVED
RECHECKING_DECISION
MISSED_DECISION_ROUND
GLOBAL_MISSED_DECISION_ROUND
ROUND_REVEALED
ROUND_COMPLETE
FINALIZING
COMPLETED
```

```ts
interface ArenaEvent {
  eventId: string;
  arenaId: string;
  sequence: number;
  type: string;
  occurredAtUtc: string;
  checkpointId?: CheckpointId;
  agentId?: ArenaAgentId;
  publicPayload: unknown;
}
```

Rules:

- sequence is monotonic and history is append-only during a run;
- decisions remain private until `ROUND_REVEALED`;
- public payloads exclude prompts, secrets, raw logs, and hidden decisions;
- current public state is derivable from persisted runtime state and events.

## 11. Live and Replay

Live and Replay share the manifest, snapshots, decision contract, validation, engine, accounting, failures, and winner calculation.

Only data source and scheduling differ:

- Live consumes current provider updates;
- Replay consumes recorded provider-compatible events and generates new decisions.

Replay must not load old agent decisions as current decisions.

## 12. Minimal HTTP API

```text
GET  /health
POST /api/arenas
POST /api/arenas/:arenaId/run
GET  /api/arenas/:arenaId
GET  /api/arenas/:arenaId/events
```

Rules:

- creation validates and locks the manifest;
- `run` is idempotent for an already-running arena;
- state exposes manifest, phase, snapshot metadata, portfolios, revealed decisions, failures, and result;
- events are ordered by sequence;
- raw model output and secrets are never returned.

P0 may keep one arena in one process. Persistence expansion is outside P0 unless required for deployment.

## 13. Recorded Fixture

The initial fixture must contain ordered data for:

`KICKOFF`, `M15`, `M30`, `HALFTIME`, `M60`, `M75`, and `FINAL`.

Each record includes:

- stable provider event ID and timestamp;
- score and match clock;
- valid `1X2` prices;
- freshness or suspension state;
- final result at settlement.

One scheduled pre-match odds object is not a valid P0 fixture.

## 14. Required Tests

Minimum coverage:

- manifest rejects missing `1X2` assets;
- malformed snapshots are rejected;
- both agents receive the same snapshot ID;
- agent calls are independent;
- valid allocations sum to `10000`;
- invalid output gets no more than one repair;
- failed agent preserves its portfolio;
- shared failure preserves both portfolios;
- decisions remain private before simultaneous reveal;
- identical inputs produce identical portfolios and winner;
- `NO_TRADE` preserves the portfolio;
- settlement covers home, draw, and away results;
- Replay uses the same engine and makes new agent calls;
- APIs never expose prompts, private reasoning, or secrets.

## 15. P0 Acceptance

P0 is accepted only when:

- one recorded arena runs through final settlement;
- every approved checkpoint executes in order;
- Alpha and Beta use independent ZeroClaw calls in the integration path;
- both receive identical canonical snapshots;
- validation and repair are observable;
- no scripted fallback trade exists;
- simultaneous reveal is enforced;
- portfolios update deterministically;
- final NAV and winner are produced;
- state and event APIs expose the public run;
- tests pass;
- paths are repository-relative and environment variables are documented;
- the runtime starts outside the original developer machine.

## 16. Implementation Order

1. scaffold package and folders;
2. implement contracts and validators;
3. add recorded fixture and data adapter;
4. build deterministic portfolio engine and tests;
5. test orchestration with fake agents;
6. add ZeroClaw Alpha/Beta adapter;
7. expose state and event APIs;
8. prove one end-to-end recorded run;
9. integrate frontend;
10. add TxLINE live adapter;
11. add Solana participation.
