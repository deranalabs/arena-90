# Arena90 Demo and Submission Runbook

Status: Operational checklist. This document records evidence; it does not
change product behavior.

## Honest Demo Position

Arena90 has a deployed, always-on Live runtime waiting for approved World Cup
checkpoint evidence. Completed semifinal Replays use recorded TxLINE evidence
and the same canonical competition engine to generate fresh autonomous agent
decisions. Supporter backing and lifecycle operations have been demonstrated
separately on Solana devnet.

Do not claim that one World Cup fixture has already completed the entire live
TxLINE-to-canonical-Solana-settlement path. That acceptance gap remains open in
the Delivery Roadmap.

## Recording Preflight

1. Open `https://arena90.xyz` in a clean browser window.
2. Confirm the featured arena loads without authentication.
3. Confirm the Live arena reports its real phase and freshness; never call
   `READY` or stale data `LIVE`.
4. Open both semifinal entries under `/replays` and confirm their archive and
   proof routes load.
5. Open the public Solana Action and one successful devnet transaction proof.
6. Keep `docs/specs/02-V2-Delivery-Roadmap.md` available for the architecture
   and limitation disclosure.
7. Record at desktop width, hide private tabs, notifications, terminals,
   credentials, wallet files, and infrastructure logs.

## Five-Minute Demo Script

### 0:00–0:35 — Concept

Show the homepage. Say: “Arena90 gives Alpha and Beta the same verified
football and market snapshot and equal virtual bankrolls. They independently
manage portfolios; deterministic code validates, executes, accounts, and
selects the winner.”

### 0:35–1:10 — Always-on Live readiness

Open the featured Live arena. Show its actual phase, fixture, source,
freshness, and next checkpoint. Explain that the deployed runtime polls
TxLINE/TxODDS and resumes from persisted state without a public start control.
If it is waiting, say “waiting for valid checkpoint evidence,” not “currently
trading.”

### 1:10–2:40 — Autonomous competition evidence

Open a semifinal Replay and press Play. State clearly that this is recorded
TxLINE evidence producing fresh agent decisions through the canonical engine.
Show one simultaneous checkpoint reveal, Alpha and Beta’s distinct policy
outputs, deterministic portfolio changes, NAV, and the compact event ledger.
Open the second semifinal briefly to prove multi-arena discovery.

### 2:40–3:25 — Logic and architecture

Open Agents and How It Works. Explain Alpha as the Reversion/overreaction
policy and Beta as the Continuation/underreaction policy. Show that invalid
output fails closed, decisions reveal together, supporter funds stay isolated,
and agents never control wallets.

### 3:25–4:20 — Solana participation

Open the public Action/Blink. Explain that the backend constructs a constrained
unsigned devnet transaction and the supporter signs it. Show a successful
devnet transaction proof. If backing is closed, do not alter time or state for
the recording; show the closed lifecycle honestly and use the recorded proof.

### 4:20–5:00 — Proof and limitation

Open the arena Proof route and repository documentation. Say: “The replay,
always-on Live runtime, browser event ledger, and Solana lifecycle are working
surfaces. The remaining acceptance item is one real World Cup fixture crossing
the complete Live checkpoint-to-canonical-settlement path.”

## Claims to Avoid

- “Production-ready” or “fully production verified.”
- “A World Cup fixture completed the full end-to-end path,” until it does.
- Calling Replay input live.
- Calling a `READY`, paused, stale, simulated, or recorded arena live.
- Claiming agents control funds, wallets, settlement, or arbitrary trades.
- Showing private chain-of-thought, provider prompts, secrets, or raw
  infrastructure logs.

## Submission Links

- Live MVP: `https://arena90.xyz`
- Public repository: set after repository visibility and history review
- Technical documentation: repository link to `docs/README.md`
- Project profile: `https://x.com/arena90ai`
- Demo video: add the public YouTube or Loom URL after upload
- Submission tweet: add the public X URL after posting

## TxLINE Experience Draft

TxLINE gave Arena90 a structured source for football state, match clock,
sequence, freshness, and market evidence, allowing both agents to consume one
canonical snapshot. The strongest part was the ability to separate provider
ingestion from deterministic strategy execution. The main friction was proving
network-consistent on-chain evidence and rehearsing live checkpoints before the
scheduled matches, so Arena90 retains explicit Replay labels and fail-closed
freshness rules.
