# Arena90 — Product Documentation Index

**Status:** Approved

This file is the routing map for Arena90 V2 product documentation. It does not
define product behavior by itself.

## 1. Authority Rules

Only documents explicitly marked `Approved` are implementation-authoritative.

Read only the documents relevant to the current task. A document marked `Draft`,
`In Review`, `Deprecated`, or `Archived` must not be implemented unless the user
explicitly authorizes it.

Approved V2 documents override conflicting V1 code, mocks, comments, names, and
legacy documentation.

When approved documents conflict, or a required decision is missing, stop and
report the issue instead of inventing behavior.

## 2. Approved Product Documents

### `01-Autonomous-Game-Loop-Decision.md`

**Owns:** competition behavior.

Use it for:

- canonical snapshots and decision checkpoints;
- structured agent outputs and `NO_TRADE`;
- deterministic validation, pricing, execution, and accounting;
- failure handling;
- final settlement and winner calculation;
- Live and Replay engine equivalence.

Read this document for agent runtime, competition-engine, accounting, or
settlement work.

### `02-Product-Definition-V2.md`

**Owns:** product definition and scope.

Use it for:

- product category and positioning;
- target users;
- Agent Alpha and Agent Beta identities;
- TxLINE, Solana, Blinks, and supporter-fund separation;
- product principles;
- included and excluded V2 scope;
- market and autonomy boundaries.

Read this document for product, positioning, scope, integration, or expansion
decisions.

### `03-User-Experience-and-Routes.md`

**Owns:** public experience and route behavior.

Use it for:

- information architecture and canonical routes;
- homepage, Live Arena, Replay, and Agents experiences;
- public state language;
- simultaneous reveal and failure-state UX;
- Solana participation, wallet identity, claim, and refund UX;
- responsive, accessible, and cross-route continuity rules.

Read this document for frontend, public API state, navigation, identity, wallet,
or transaction-experience work.

## 3. Reading Order by Task

- **Competition or agent runtime:** read `01`, then relevant boundaries in `02`.
- **Product or scope:** read `02`, then consult `01` or `03` only when affected.
- **Routes or UI/UX:** read `03` and the relevant product constraints in `02`.
- **Solana or Blink participation:** read Sections 6 and 8 of `02`, Sections 7
  and 8 of `03`, and settlement rules in `01` when competition results matter.
- **Cross-layer work:** read every owning document affected by the change and
  the nearest applicable `AGENTS.md`.

## 4. Documentation Discipline

Keep each decision in its owning document:

- competition mechanics belong in `01`;
- product definition and boundaries belong in `02`;
- route and experience behavior belong in `03`.

Use references instead of copying long rules across documents.

When changing an approved decision:

1. identify the owning document;
2. update all directly affected contracts, consumers, tests, and docs;
3. check for contradictions across `01`, `02`, and `03`;
4. keep document status explicit;
5. preserve the previous approved baseline in Git history.

Do not create a new product document when an existing owner can contain the
decision clearly.
