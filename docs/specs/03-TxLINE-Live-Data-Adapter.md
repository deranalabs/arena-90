# Arena90 — TxLINE Live Data Adapter Specification

**Status:** Approved

This specification defines the Slice 5 TxLINE/TxODDS live-data integration. It
extends, but does not replace, `specs/01-P0-Arena-Runtime.md`.

The recorded adapter remains the mandatory Replay and final-submission
fallback. Slice 5 does not change canonical runtime contracts, deterministic
engine formulas, agents, or the checkpoint orchestrator.

## 1. Scope

Slice 5 converts verified provider data into the existing
`CanonicalSnapshot` contract and exposes the existing deterministic final
result.

In scope:

- configurable TxLINE/TxODDS provider access;
- fixture, score, phase, clock, market, sequence, freshness, and suspension
  validation;
- deterministic full-match `1X2` mapping and price normalization;
- prepared live snapshots and final results;
- provider-shaped tests, resynchronization coverage, and an authorized live
  connectivity smoke.

Not in scope:

- canonical contract changes;
- engine, agent, decision, winner, or settlement changes;
- asynchronous checkpoint orchestration;
- lifecycle scheduling, persistence, HTTP APIs, frontend work, or Solana;
- removing, weakening, or silently substituting the recorded adapter.

## 2. Architecture

The live adapter uses a two-stage boundary:

```ts
interface TxlineLiveDataAdapter {
  refreshCheckpoint(
    checkpointId: DecisionCheckpointId,
    signal: AbortSignal,
  ): Promise<void>;

  getSnapshot(checkpointId: DecisionCheckpointId): CanonicalSnapshot;
  getFinalResult(): ArenaAssetId;
}
```

`refreshCheckpoint()` performs asynchronous provider access, validation, and
state preparation. The existing synchronous `getSnapshot()` and
`getFinalResult()` methods read only prepared state.

Slice 6 must call `refreshCheckpoint()` before invoking checkpoint
orchestration. Slice 5 must not make the current checkpoint orchestrator
asynchronous.

If refresh or validation fails, the adapter must not expose a new snapshot.
The existing orchestrator then applies its global missed-round behavior and
preserves both portfolios.

## 3. Provider Client

The provider client owns these operations:

```text
GET /api/fixtures/snapshot
GET /api/odds/snapshot/{fixtureId}
GET /api/odds/updates/{fixtureId}
GET /api/scores/snapshot/{fixtureId}
GET /api/scores/stream?fixtureId={fixtureId}
GET /api/scores/historical/{fixtureId}
```

The score stream and historical score replay are SSE. Historical replay is
used only for tests and provider resynchronization.

Slice 5 must not define or call a per-fixture scores-updates endpoint. Provider
access must accept `AbortSignal`, use bounded timeouts, and keep authentication
credentials outside Git.

## 4. Raw Provider Boundary

Raw schemas may pass through unrelated provider fields. After alias resolution,
all normalized internal schemas must be strict.

Only explicitly supported PascalCase and camelCase field variants may be
accepted. Relevant variants are:

```text
FixtureId / fixtureId
Participant1Id / participant1Id
Participant2Id / participant2Id
Participant1IsHome / participant1IsHome
StartTime / startTime
Seq / seq
Id / id
Ts / ts
Action / action
GameState / gameState
StatusId / statusId
StatusSoccerId / statusSoccerId
Clock / clock
Running / running
Seconds / seconds
Stats / stats
Data / data / DataSoccer / dataSoccer
Minutes / minutes
Reliable / reliable
Locked / locked
```

Odds market fields use the provider's documented PascalCase names. Unknown
casing variants are invalid. If multiple accepted aliases are present with
different values, the record is invalid.

Endpoint failure, invalid JSON or SSE, a non-array JSON response where an array
is required, or a malformed endpoint payload is a provider failure. None is
equivalent to a valid empty array.

## 5. Fixture Binding

The adapter configuration locks:

- `FixtureId`;
- Participant 1 and Participant 2 IDs;
- `Participant1IsHome`;
- fixture start time.

Every fixture and dependent score or odds record must match the configured
fixture. Participant identity, home/away designation, or start-time mismatch is
invalid provider data.

These checks remain adapter configuration. Slice 5 must not expand the
canonical arena manifest.

## 6. Score State

`Stats["1"]` is the Participant 1 total score. `Stats["2"]` is the Participant
2 total score. Both must be known nonnegative integers before a snapshot is
prepared. `Participant1IsHome` maps the participant scores to canonical HOME
and AWAY scores.

The supported regulation phases are:

| Status | Meaning | Canonical status |
| --- | --- | --- |
| `2` | First half | `LIVE` |
| `3` | Halftime | `HALFTIME` |
| `4` | Second half | `LIVE` |
| `5` | Regulation finished | `FINISHED` |

`halftime_finalised` is the authoritative HALFTIME marker.
`game_finalised` is the authoritative FINAL marker. Status `5` or `100` may be
accepted as final only when paired with `game_finalised`.

The adapter must not use `GameState` or the final replay event to determine
finality. It must locate `game_finalised` explicitly. A `kickoff` action alone
cannot create a checkpoint.

### Match clock

`Clock.Seconds` is seconds remaining in the current 45-minute period.

```text
H1 minute = floor((2700 - seconds) / 60), clamped to 0..45
H2 minute = 45 + floor((2700 - seconds) / 60), clamped to 45..90
```

`Data.Minutes` is added time only. It must not replace elapsed match minute.
A `clock_adjustment` event replaces the current clock with its corrected clock
before subsequent state is derived.

Missing or invalid score, phase, or required clock data prevents snapshot
preparation.

## 7. Provider Sequence

For a checkpoint source score event:

```text
providerSequence = raw Seq + 1
```

Raw `Seq` must be a nonnegative integer. The offset maps provider sequence zero
to the positive canonical sequence one without changing provider order.

Bootstrap score snapshots may be sparse. Validate each record independently,
select the highest accepted `Seq`, and establish it as the high-water mark.

After bootstrap:

- streamed events must be monotonic;
- an exact duplicate is idempotent;
- the same `Seq` with different material content is invalid;
- a lower unseen `Seq` is invalid;
- a stream gap requires provider resynchronization;
- input must never be silently sorted to conceal ordering errors.

No snapshot may reuse a consumed score sequence for a different checkpoint.

## 8. Full-Match 1X2 Market

An approved market row must satisfy all of:

```text
FixtureId        = configured FixtureId
BookmakerId      = 10021
Bookmaker        = TXLineStablePriceDemargined
SuperOddsType    = 1X2_PARTICIPANT_RESULT
MarketPeriod     = null or absent
MarketParameters = null or absent
```

`PriceNames` must be exactly a permutation of `part1`, `draw`, and `part2`, with
one value for each outcome. `Participant1IsHome` controls whether `part1` maps
to HOME or AWAY. `draw` always maps to DRAW.

Merge valid odds snapshot and odds updates payloads. A valid empty odds
snapshot may use valid updates. A failed or malformed snapshot request is not
an empty snapshot and invalidates the refresh.

Deduplicate merged rows by `MessageId`:

- an identical duplicate is idempotent;
- the same `MessageId` with different material content is invalid.

Select the row with the greatest `Ts`. When rows have equal `Ts`, select the
lexicographically greatest `MessageId`.

Validate the selected newest envelope and its complete market payload. If that
row is malformed, unavailable, or invalid, do not fall back to an older row.

## 9. Price Normalization

Each `Pct` value is an exact three-decimal percentage. Parse it as an integer
without floating point.

Reject a selected market when any outcome is:

- `NA`;
- malformed, missing, or duplicated;
- nonpositive;
- greater than `100.000` percent.

The three raw percentages must total from `99.000` through `101.000` percent,
inclusive.

Map outcomes to HOME, DRAW, and AWAY before normalization. Let each parsed
percentage be an integer in thousandths of one percent and let `S` be their
sum. Using bigint arithmetic:

```text
floor_i     = pct_i * 1000000 / S
remainder_i = pct_i * 1000000 % S
remaining   = 1000000 - sum(floor_i)
```

Assign remaining micros by descending remainder. Equal remainders use HOME,
then DRAW, then AWAY order.

The canonical result must total exactly `1000000`, and every individual price
must remain an integer from `1` through `999999`.

## 10. Freshness

`marketUpdatedAtUtc` is derived from the selected odds `Ts`. Freshness uses an
injected, testable clock.

```text
Maximum market age:       300000 ms
Future timestamp allowance: 30000 ms
```

A market older than the maximum age or farther in the future than the allowed
clock skew is invalid and fails closed.

`freshness.delayed` is mandatory trusted adapter configuration. It must not be
inferred from market age. The current realtime subscription configuration uses
`delayed=false`.

## 11. Suspension

Any of these marks provider state suspended:

- a `suspend` action;
- status `18`;
- a mid-match `disconnected` state;
- `Data.Reliable=false`, when present;
- `Data.Locked=true`, when present.

A later valid `connected` event or valid status `2`, `3`, `4`, or `5` may clear
suspension after normal sequence, fixture, score, phase, and clock validation.

Missing odds, `NA` odds, or another invalid market is market invalidity. It
must not automatically be represented as provider suspension.

Suspended state cannot create a trade and must follow the existing global
missed-round behavior.

## 12. HTTP Retry and Security

Each provider operation permits at most two attempts total.

Retry only:

- network failures;
- HTTP `408`;
- HTTP `429`;
- HTTP `5xx`.

Do not retry HTTP `401`, HTTP `403`, or malformed provider payloads. The retry
delay is `250 ms` and must be injected and testable. Abort cancels the current
request and any pending retry delay.

Errors, diagnostics, and smoke output must use sanitized categories. They must
never expose credentials, authorization headers, API tokens, response bodies
that may contain secrets, environment contents, configuration paths, or raw
provider infrastructure output.

## 13. Canonical Identity

The provider source identity is:

```text
sourceEventId = txline-score:<fixtureId>:<Seq>
```

`snapshotId` is deterministic from exactly:

- `arenaId`;
- `checkpointId`;
- `sourceEventId`;
- selected odds `MessageId`.

Equivalent inputs must produce the same snapshot ID. Different source score or
odds identities must produce a different snapshot ID.

An SSE `id` is only a transport resume cursor. It must not become the canonical
`sourceEventId`.

After identity, state, and price construction, the adapter calculates the
existing deterministic canonical `snapshotHash` and validates the complete
snapshot through the existing contract.

## 14. Failure Behavior

No fixture, fixture mismatch, missing approved market, malformed provider data,
stale or future-invalid market data, suspended coverage, duplicate conflicts,
sequence errors, exhausted provider requests, or resynchronization failure
must prevent a new snapshot from being exposed.

These failures use the existing shared-data failure path:

- emit `GLOBAL_MISSED_DECISION_ROUND` through current orchestration;
- preserve both portfolios;
- do not call agents with a fabricated snapshot;
- do not fabricate decisions or fall back to an older market row;
- do not silently switch a Live arena to Replay.

Replay remains an explicit available fallback using the recorded adapter.

## 15. Acceptance

Slice 5 is accepted only when:

- runtime build and full tests pass;
- recorded Replay remains unchanged and fully operational;
- identical provider inputs produce identical canonical snapshots;
- invalid, stale, suspended, duplicate, or out-of-order data cannot trade;
- sequence bootstrap, stream gaps, resynchronization, retry, timeout, abort,
  normalization, and failure behavior are covered by automated tests;
- the authorized live connectivity smoke passes using project credentials kept
  outside Git;
- smoke and adapter output is sanitized and exposes no credentials or secret
  response bodies;
- no canonical contract, engine, agent, recorded adapter, or checkpoint
  orchestrator behavior changes.
