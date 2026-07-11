# Arena90 Documentation

This directory separates active V2 requirements, technical specifications, external references, and legacy V1 documentation.

## Active Product Documents

Authoritative product decisions are stored in `product/`.

Current documents:

- `product/01-Autonomous-Game-Loop-Decision.md`

Planned documents:

- `product/02-Product-Definition-V2.md`
- `product/03-User-Experience-and-Routes.md`
- `product/04-MVP-Scope-and-Acceptance.md`

## Technical Specifications

Module-specific implementation rules are stored in `specs/`.

Specifications should be created only when the related product decision has been approved.

## References

Technical research and protocol notes are stored in `references/`.

Reference files provide supporting context only. They are not authoritative product requirements.

## Legacy Documentation

V1 documentation is stored in `archive/v1/`.

Files under `archive/` are historical context only and must not be treated as active requirements.

When legacy documentation conflicts with files under `product/` or `specs/`, the active V2 documents take precedence.

## Source-of-Truth Priority

When documents conflict, use this order:

1. Approved documents under `product/`
2. Approved module specifications under `specs/`
3. Current implementation and tests
4. Files under `references/`
5. Files under `archive/`
