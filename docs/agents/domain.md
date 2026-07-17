# Domain Docs

Arena90 uses a single domain-documentation context.

## Before exploring

- Read root `CONTEXT.md` when it exists.
- Read relevant system-wide ADRs under `docs/adr/` when they exist.
- Read `docs/README.md` and the approved Arena90 product/specification
  documents routed from it.
- Read the nearest subsystem `AGENTS.md` before modifying that subsystem.

Missing `CONTEXT.md` or ADR directories are not setup failures. Domain
modeling creates them lazily when terminology or durable decisions are
actually resolved.

## Source-of-truth boundary

`CONTEXT.md` provides shared vocabulary. ADRs record durable architectural
decisions. Neither may override approved Arena90 product documents,
specifications, repository instructions, or the delivery roadmap.

Use canonical glossary terms in issue titles, specs, hypotheses, tests, and
implementation. Surface conflicts with existing ADRs or approved documents
instead of silently replacing them.
