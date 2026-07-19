# Arena90 Documentation

Arena90 has one delivery workflow:

```text
TxLINE + TxODDS
        |
        v
Arena Runtime
  |-- same verified evidence --> Alpha + Beta
  |-- deterministic validation, execution, accounting, winner
  |-- public state + SSE ------> Frontend
  `-- final result evidence ---> Solana settlement

Frontend -- user-signed Blink --> Solana supporter escrow
```

The Arena Runtime is the deep module. Its public state, ordered events, and
final result are the interfaces used by the frontend and Solana modules.
Provider payloads, prompts, raw model output, private reasoning, and wallet
authority stay behind their respective seams.

## Start Here

- **What must be built next and what proves completion:**
  `specs/02-V2-Delivery-Roadmap.md`.
- **How deployment activation and rollback work:**
  `../ops/deployment/README.md`.
- **How to record an evidence-backed submission demo:**
  `demo/00-Demo-and-Submission-Runbook.md`.
- **What the pitching team should show and say in five minutes:**
  `demo/01-Pitch-Team-Script.md`.
- **What Arena90 is and what it must never become:**
  `product/02-Product-Definition-V2.md`.
- **How one autonomous competition works:**
  `product/01-Autonomous-Game-Loop-Decision.md`.
- **What users see on each route:**
  `product/03-User-Experience-and-Routes.md`.
- **Runtime and provider implementation contracts:**
  `specs/01-P0-Arena-Runtime.md` and
  `specs/03-TxLINE-Live-Data-Adapter.md`.

Read only the documents relevant to the current task.

Do not infer current delivery priority from document length or section order.
The Delivery Roadmap is the only owner of current work order and acceptance
status. Product documents define enduring behavior, not current completion.

## Approved Product Documents

- `product/00-Product-Index.md`
- `product/01-Autonomous-Game-Loop-Decision.md`
- `product/02-Product-Definition-V2.md`
- `product/03-User-Experience-and-Routes.md`

Product documents own product behavior, scope, competition rules, and UX
requirements.

## Approved Technical Specifications

- `specs/01-P0-Arena-Runtime.md`
  - canonical snapshot and manifest contracts;
  - Alpha and Beta decision contracts;
  - validation, repair, timeout, and failure behavior;
  - deterministic execution, accounting, settlement, and winner calculation;
  - runtime events, HTTP API, recorded fixture, tests, and P0 acceptance.
- `specs/02-V2-Delivery-Roadmap.md`
  - verified current state and remaining gaps;
  - one vertical delivery workflow and acceptance gates;
  - branch, deployment, rehearsal, and submission progression.
- `specs/03-TxLINE-Live-Data-Adapter.md`
  - TxLINE client and asynchronous refresh boundaries;
  - fixture, score, market, sequence, and canonical identity rules;
  - deterministic price normalization and freshness policy;
  - live-data retry, suspension, failure, and acceptance behavior.
- `specs/04-Supporter-Escrow-and-Blink-Settlement.md`
  - native devnet SOL supporter positions and lifecycle;
  - TxLINE terminal-proof receipts and runtime-result binding;
  - settlement, payout, claim, refund, fee, and Action interfaces.
- `specs/05-TxLINE-Recovery-Replay.md`
  - evidence-preserving fallback for an incomplete Live run;
  - historical score/odds ordering, clock, finality, and tombstone rules;
  - honest Replay disclosure and isolation from supporter settlement.

Technical specifications translate approved product decisions into
implementation contracts. They must not override approved product decisions.

Documents marked `Draft`, `In Review`, `Deprecated`, or `Archived` are not
implementation-authoritative unless explicitly authorized.

## References

Technical research and protocol notes are stored in `references/`.

- `references/txline-world-cup-hackathon.md` records the verified track,
  submission, and TxLINE integration facts that shape the delivery gates.

References provide supporting context only. They do not define Arena90 product
behavior or override approved product documents and specifications.

## Source-of-Truth Priority

When material conflicts, use this order:

1. Approved product documents under `product/`
2. Approved implementation specifications under `specs/`
3. Current implementation and automated tests
4. Supporting material under `references/`

When an approved specification conflicts with an approved product decision,
stop and report the conflict instead of inventing behavior.
