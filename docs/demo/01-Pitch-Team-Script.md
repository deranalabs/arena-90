# Arena90 — Five-Minute Pitch Team Script

Status: Recording script. This document explains verified behavior; it does not
change product scope or acceptance status.

## Recording setup

- Record in English, at 1440×900 or larger, with browser zoom at 90–100%.
- Hide bookmarks, notifications, private tabs, wallet files, terminals,
  credentials, and infrastructure logs.
- Open every tab below before recording and confirm it loads without login.
- Keep the recording below five minutes. One narrator should control the mouse
  and speak; avoid hand-offs during the recording.
- The current public Live arena reports `READY`. Describe it as an always-on
  runtime waiting for valid evidence, not as active trading.

## Tabs to prepare

1. Home: <https://arena90.xyz>
2. Replays: <https://arena90.xyz/replays>
3. France–Spain archive:
   <https://arena90.xyz/arena/world-cup-2026-france-spain-semifinal-replay/archive>
4. England–Argentina archive:
   <https://arena90.xyz/arena/world-cup-2026-england-argentina-semifinal-replay/archive>
5. Agents: <https://arena90.xyz/agents>
6. How it works: <https://arena90.xyz/how-it-works>
7. Current Live arena:
   <https://arena90.xyz/arena/world-cup-2026-france-england-third-place-v4>
8. Devnet supporter transaction:
   <https://explorer.solana.com/tx/3t9sqcxu853QwELQ6Nfb3Uf5HbMKjEtp75GZ4vE7hxZQw9NwxLvZdzdDpKZYNKRENJnZvz59BurAz1zRH7K1gF6F?cluster=devnet>
9. Public repository: <https://github.com/deranalabs/arena-90>

## Spoken script and screen direction

### 0:00–0:30 — The idea

**Screen:** Home. Keep the hero, featured arena, and “same snapshot / equal
bankroll / independent decisions” guarantees visible.

**Say:**

> Sports data is fast, but comparing autonomous strategies fairly is difficult.
> Arena90 gives two agents the same verified TxLINE and TxODDS evidence and the
> same virtual bankroll. Alpha and Beta decide independently, while deterministic
> code validates, executes, accounts for every position, and selects the winner.

### 0:30–0:55 — Multiple arenas and evidence source

**Screen:** Open Replays. Point at both World Cup semifinal archives, their
recorded TxLINE source, event count, and different winners.

**Say:**

> These are two World Cup semifinal arenas. Replay is explicitly labelled:
> each completed Replay run used recorded TxLINE evidence and generated fresh
> agent decisions through the same competition engine. France–Spain was won by
> Beta, while England–Argentina was won by Alpha, so neither strategy is
> scripted to win.

### 0:55–2:05 — Show the autonomous competition working

**Screen:** From Replays, press **Play replay** for France–Spain. The completed
run redirects to its archive. Press **PLAY EVENT RECORD** and let at least two
checkpoint events appear. Show the shared score/clock/market state, Alpha and
Beta decisions, target allocations or `NO_TRADE`, NAV, and one simultaneous
reveal. This button plays the immutable public record; it does not invoke the
agents again.

**Say:**

> At kickoff, 15, 30, halftime, 60, and 75 minutes, both agents receive one
> canonical snapshot. Alpha looks for market overreaction and takes a reversion
> position. Beta looks for underreaction and follows evidence that the market has
> not fully priced. Each returns a constrained target allocation or an explicit
> no-trade decision. Invalid output fails closed; it never becomes a fabricated
> trade. The engine—not the model—owns pricing, execution, accounting, and final
> NAV. Decisions are revealed together, and the ordered ledger preserves what
> happened at every checkpoint. This playback is the immutable audit record of
> that autonomous Replay run; pressing play does not rerun the agents.

### 2:05–2:40 — Explain the two strategies

**Screen:** Agents page. Point to Reversion and Continuation, then their policy
questions and risk characteristics.

**Say:**

> Alpha is Reversion: did the market move faster than verified match evidence?
> Beta is Continuation: did verified evidence move faster than the market?
> Neither agent is assigned a football team or guaranteed to trade. Their
> strategic judgment is independent, but the surrounding rules are deterministic
> and equal.

### 2:40–3:15 — Architecture and TxLINE integration

**Screen:** How It Works. Move left to right across the seven stages. Pause at
TxLINE/TxODDS, shared snapshot, fail-closed validation, deterministic engine,
simultaneous reveal, and settlement.

**Say:**

> TxLINE supplies fixture identity, participants, score, match clock, sequence,
> and live score updates. TxODDS supplies the approved full-time 1X2 market. The
> adapter verifies identity, freshness, sequence, suspension state, and complete
> prices before admitting a checkpoint. One validated snapshot then crosses a
> strict boundary: agents choose strategy, while Arena90 controls execution and
> winner resolution.

### 3:15–3:55 — Solana supporter participation

**Screen:** On the Live arena, scroll to the supporter section and show that it
is Solana devnet and backing is closed after kickoff. Open the successful devnet
transaction in Solana Explorer.

**Say:**

> Supporters can back the strategy they trust before kickoff using devnet SOL.
> The Action backend constructs only a constrained unsigned transaction; the
> supporter signs with their own wallet. Supporter funds are isolated from agent
> capital and can never influence a decision. Backing closes deterministically
> at kickoff, and settlement, claim, or refund is publicly verifiable on Solana.

### 3:55–4:25 — Always-on Live behavior, stated honestly

**Screen:** Return to the top of the current Live arena. Show its actual `READY`
state and next checkpoint. Do not call it actively trading.

**Say:**

> The Live runtime is deployed, supervised, persistent, and has no public start
> button. This arena currently remains READY because no valid checkpoint was
> admitted. That is intentional fail-closed behavior: stale or mismatched data
> cannot create a decision. The complete real-match Live checkpoint through
> canonical Solana settlement remains our disclosed acceptance gap.

### 4:25–4:55 — Repository, production discipline, and close

**Screen:** GitHub README. Briefly show the architecture, TxLINE endpoint table,
tests, public documentation, MIT license, and Security policy.

**Say:**

> Arena90 is a running MVP with a public repository, deployed spectator UX,
> recorded autonomous competition evidence, an always-on Live integration, and
> a tested Solana devnet supporter lifecycle. Recovery is persistent and
> idempotent, public APIs are read-only, secrets stay outside Git, and every
> incomplete acceptance item is documented. Arena90 turns one verified match
> feed into a fair, auditable competition between autonomous strategies.

Stop recording before five minutes.

## What the pitching team must understand

The presenter does not need to explain source files or implementation syntax.
They must be able to explain these seven facts without notes:

1. **Input fairness:** Alpha and Beta receive the same canonical TxLINE/TxODDS
   snapshot and equal virtual bankrolls.
2. **Distinct strategy:** Alpha is Reversion/overreaction; Beta is
   Continuation/underreaction.
3. **Autonomy:** approved checkpoints run without a public human start or
   approval step.
4. **Deterministic boundary:** agents propose structured allocations; code owns
   validation, pricing, execution, accounting, reveal, and winner calculation.
5. **Replay honesty:** Replay uses recorded TxLINE evidence with fresh agent
   decisions. It is not presented as live input.
6. **Solana isolation:** supporters sign their own transactions; supporter SOL
   never becomes agent capital or strategy input.
7. **Current limitation:** no World Cup fixture has yet proven the complete
   Live-checkpoint-to-canonical-Solana-settlement path.

## Fast answers for judge questions

**Are these agents just scripted bots?**

No. Alpha and Beta are independent ZeroClaw agent invocations with different
evidence-based strategy policies. Their output is constrained; deterministic
code—not an LLM—controls execution and accounting.

**Do agents control real money or supporter wallets?**

No. Agent portfolios use virtual USD micros. Supporter devnet SOL is isolated
in the Solana program, and every supporter transaction is wallet-signed.

**What market is currently supported?**

The approved MVP market is full-time `1X2`: HOME, DRAW, and AWAY. Do not claim
full multi-market support.

**Is Replay fake or hard-coded?**

No. It uses immutable recorded TxLINE match and odds evidence. The same runtime
generates fresh Alpha/Beta decisions and deterministic portfolio consequences.
It is labelled Replay because its input is recorded.

**What proves autonomy?**

The runtime supervisor starts and resumes without a public run control,
checkpoint orchestration invokes both agents, and the ordered event ledger
records validation, simultaneous reveal, execution, and terminal state.

**Is Arena90 production-ready?**

It is a deployed, test-backed MVP with persistence, restart recovery,
idempotency, bounded inputs, secret isolation, and fail-closed validation. It is
not fully production-verified until one real World Cup fixture completes the
entire Live-to-Solana settlement path.

## Judging-criteria coverage

| Criterion | Evidence shown in the video |
| --- | --- |
| Core functionality and ingestion | Recorded TxLINE Replay, canonical snapshot, agent decisions, TxLINE endpoint explanation |
| Autonomous operation | Checkpoint playback, independent decisions, ordered ledger, always-on Live state |
| Logic and architecture | Reversion vs Continuation, fail-closed validation, deterministic engine |
| Innovation and novelty | Same evidence, opposite strategies, simultaneous reveal, multi-arena results |
| Production readiness | Public deployment, persistence, read-only APIs, security policy, Solana proof, disclosed gap |
