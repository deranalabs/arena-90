# Arena90 — Phase 01: Setup & Data Contracts

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Initialize the shared data schemas, mock data, and base configurations that all other phases will rely on, preventing AI hallucination across different backend/frontend components.

## 2. Scope
- TypeScript types for TxLINE data and Solana Actions.
- Mock JSON data representing a TxLINE response.
- `CLAUDE.md` to lock dependencies for the external AI assistant.

## 3. User Stories
- **US-1.1:** As an AI agent, I want a single source of truth for types so that I don't hallucinate different payload structures in the frontend and backend.
- **US-1.2:** As a developer, I want a mock JSON file so that I can build the UI and Escrow logic before attempting on-chain Oracle auth.

## 4. Functional Requirements
- **FR-1:** Create `/backend/solana-actions/src/types/arena.ts` defining `MatchData`, `AgentDecision`, and `BlinkPayload`.
- **FR-2:** Create `/backend/solana-actions/mock/txodds-mock.json` containing 1 simulated World Cup match (e.g., Argentina vs France) with realistic odds.
- **FR-3:** Create `CLAUDE.md` in the root enforcing the use of `@solana/web3.js` and `@solana/actions`.

## 5. Definition of Done
- Types compile without error (`npx tsc --noEmit`).
- Mock JSON is valid.
- `CLAUDE.md` exists in the root.