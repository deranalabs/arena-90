# Arena90 — World Cup Track Submission

Internal copy sheet for the Superteam Earn submission form. Replace every
`TBD` before submitting. Keep claims aligned with [`README.md`](README.md) and
the [demo runbook](docs/demo/00-Demo-and-Submission-Runbook.md).

## Link to your Submission

Use the strongest public link available. Recommended after recording:

```text
TBD — public demo video or live MVP
```

Fallback: `https://arena90.xyz`

## Tweet Link

```text
TBD — public Arena90 Live Arena introduction post
```

## Project Title

```text
Arena90 — Autonomous Football Strategy Arena
```

## Briefly explain your Project

```text
Arena90 is an autonomous football strategy arena powered by TxLINE/TxODDS.
Alpha and Beta receive the same verified fixture, score, clock, and market
snapshot, then independently manage equal virtual portfolios at six fixed
checkpoints. Arena90 validates decisions, executes and accounts for them
deterministically, reveals both strategies, and records a verifiable result.
Supporters can back either strategy through a user-signed Solana devnet Action;
supporter funds stay separate from agent capital and never influence strategy.
```

## Link to your live and working MVP

```text
https://arena90.xyz
```

## Link to your live demo video

```text
TBD — public YouTube or Loom URL
```

## Project public repository

```text
TBD — https://github.com/deranalabs/arena-90
```

The repository must be public before submitting. Verify the README, docs, and
all linked routes work without authentication.

## Technical documentation

```text
TBD — https://github.com/deranalabs/arena-90/blob/main/README.md
```

Supporting deep dives:

```text
https://github.com/deranalabs/arena-90/tree/main/docs
```

## Project X profile or post

```text
https://x.com/arena90ai
```

## TxLINE API experience

```text
TxLINE gave Arena90 a structured source for fixture identity, participants,
score, clock, sequence, freshness, and market evidence. We used fixture and
odds snapshots, odds updates, score snapshots, live score SSE, and historical
score replay to build one canonical input for both agents. The strongest part
was the clean separation between provider ingestion and deterministic strategy
execution. The main friction was proving network-consistent terminal evidence
for Solana settlement and rehearsing live checkpoints before scheduled matches.
That led us to keep Replay explicitly labelled as recorded evidence and to fail
closed on stale, malformed, or mismatched data.
```

## Anything Else?

```text
Action/Blink:
https://arena90.xyz/actions/arena/7LHP2afdUPTJErHEy9QNRTusVA7TUyy47agyHsUfFz6y

Solana devnet transaction proof:
https://explorer.solana.com/tx/3t9sqcxu853QwELQ6Nfb3Uf5HbMKjEtp75GZ4vE7hxZQw9NwxLvZdzdDpKZYNKRENJnZvz59BurAz1zRH7K1gF6F?cluster=devnet

Technical docs:
https://github.com/deranalabs/arena-90/blob/main/docs/README.md

Important scope note: semifinal Replay archives demonstrate fresh autonomous
decisions using recorded TxLINE evidence. The deployed Live runtime is ready
for approved checkpoints; the complete World Cup live-input-to-canonical-
settlement path remains explicitly disclosed in the repository roadmap.
```

## Pre-submit checklist

- [ ] Repository visibility is Public.
- [ ] README and `docs/README.md` open without login.
- [ ] Live MVP, Replay archives, proof routes, and Action URL return successfully.
- [ ] Demo video is public/unlisted and viewable without login.
- [ ] Video shows TxLINE evidence, independent Alpha/Beta decisions, Replay
      labels, deterministic ledger, and Solana devnet supporter flow.
- [ ] Tweet introduction links the Live Arena and does not call `READY` state
      active trading.
- [ ] All `TBD` values are replaced.
- [ ] No secrets, private infrastructure logs, wallet files, or raw private
      reasoning appear in the repository or recording.
