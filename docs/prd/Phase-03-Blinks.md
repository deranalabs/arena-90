# Arena90 — Phase 03: Solana Actions Backend (Blinks)

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Build the Express.js REST API that serves the Solana Action payload to Twitter, allowing users to stake on ISAGI or AIKU directly from their timeline.

## 2. Scope
- Setup Express server.
- `GET /api/actions/arena` endpoint (returns action metadata, images, and buttons).
- `POST /api/actions/arena` endpoint (returns the serialized Solana transaction for Phantom wallet to sign).

## 3. User Stories
- **US-3.1:** As a Twitter user, I want to see a rich UI card in my timeline showing ISAGI vs AIKU, so that I can click a button to stake 10 USDC.
- **US-3.2:** As a Phantom wallet user, when I click the Blink button, I want my wallet to prompt me to sign a transaction sending 10 USDC.

## 4. Functional Requirements
- **FR-1:** Create `/backend/solana-actions/src/index.ts`.
- **FR-2:** Implement CORS headers strictly according to the `@solana/actions` specification.
- **FR-3:** For the POST endpoint, construct a simple Solana Transfer transaction (mocking the escrow for now) and serialize it to base64.

## 5. Definition of Done
- `npm run dev` starts the server on port 8080.
- `curl http://localhost:8080/api/actions/arena` returns valid Actions JSON metadata.