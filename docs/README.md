# Arena90 Documentation

This directory separates approved V2 product decisions, implementation
specifications, external references, and archived V1 material.

## Start Here

- `product/00-Product-Index.md` routes product questions to the document that
  owns each decision.
- `specs/01-P0-Arena-Runtime.md` defines the approved implementation contract
  for the hackathon runtime vertical slice.
- `specs/02-V2-Delivery-Roadmap.md` defines delivery order, slice boundaries,
  acceptance gates, and branch and deployment progression.
- `specs/03-TxLINE-Live-Data-Adapter.md` defines the approved TxLINE client
  boundaries, normalization, freshness, sequencing, and live-data failure
  behavior for Slice 5.

Read only the documents relevant to the current task.

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
  - completed and remaining delivery slices;
  - critical path, slice boundaries, and acceptance gates;
  - branch policy and deployment progression through final submission.
- `specs/03-TxLINE-Live-Data-Adapter.md`
  - TxLINE client and asynchronous refresh boundaries;
  - fixture, score, market, sequence, and canonical identity rules;
  - deterministic price normalization and freshness policy;
  - live-data retry, suspension, failure, and acceptance behavior.

Technical specifications translate approved product decisions into
implementation contracts. They must not override approved product decisions.

Documents marked `Draft`, `In Review`, `Deprecated`, or `Archived` are not
implementation-authoritative unless explicitly authorized.

## References

Technical research and protocol notes are stored in `references/`.

References provide supporting context only. They do not define Arena90 product
behavior or override approved product documents and specifications.

## Legacy Documentation

V1 documentation is stored in `archive/v1/`.

Files under `archive/` are historical context only. Do not restore legacy names,
contracts, or architecture unless an approved V2 document explicitly requires
them.

## Source-of-Truth Priority

When material conflicts, use this order:

1. Approved product documents under `product/`
2. Approved implementation specifications under `specs/`
3. Current implementation and automated tests
4. Supporting material under `references/`
5. Historical material under `archive/`

When an approved specification conflicts with an approved product decision,
stop and report the conflict instead of inventing behavior.
