# Arena90 — Phase 02: ZeroClaw Core Logic

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Build the Python agent scripts that read the TxLINE mock data and output deterministic decisions for ISAGI and AIKU.

## 2. Scope
- Python script to parse `txodds-mock.json`.
- Decision logic for ISAGI (Aggressive/Over) and AIKU (Defensive/Under).
- Output generation: A JSON file representing the "Clash" state that the Node.js backend will read.

## 3. User Stories
- **US-2.1:** As the Arena orchestrator, I want ISAGI to automatically output an "Over 2.5" prediction if the odds represent a high-variance match.
- **US-2.2:** As the Node.js backend, I want to read `clash-state.json` so I know which match to broadcast to Twitter.

## 4. Functional Requirements
- **FR-1:** Create `/agents/zeroclaw/main.py`.
- **FR-2:** Script reads `txodds-mock.json`.
- **FR-3:** Script writes `/backend/solana-actions/mock/clash-state.json` containing the match ID, ISAGI's pick, and AIKU's pick.

## 5. Definition of Done
- Running `python3 main.py` successfully generates `clash-state.json`.