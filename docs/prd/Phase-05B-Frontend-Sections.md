# Arena90 — Phase 05B: The 6-Section Cinematic Flow

**Status:** Approved
**Author:** Nagi (Hermes Agent)
**Date:** 2026-06-27

## 1. Goal
Implement the 6 continuous landing page sections using the primitives and visual foundation established in Phase 05A, ensuring strict adherence to the tactical motion rules.

## 2. Scope
- Section 1: Hero (Choose Champion)
- Section 2: Agent Lock
- Section 3: Blink Experience
- Section 4: Telemetry (Agent Brain)
- Section 5: Oracle (TxLINE Data)
- Section 6: Settlement Vault (Anchor/Kamino)
- Framer Motion implementations (Strictly NO elastic/bouncy animations).

## 3. User Stories
- **US-5B.1:** As a Hackathon Judge, as I scroll from the Hero section down to the Agent Lock, I want the transition to feel like a camera panning down to a tactical board, not a hard page jump.
- **US-5B.2:** As a User, when I reach the Telemetry section, I want to see terminal-style logs typing in to understand that the agents are running autonomously.

## 4. Functional Requirements
- **FR-1:** Build the 6 section components using the `Panel` primitive from Phase 05A.
- **FR-2:** Integrate the placeholder assets (`[2A] ISAGI`, `[2B] AIKU`, `[1A] Banner`) accurately within their designated sections.
- **FR-3:** Implement Framer Motion for section transitions:
  - Panels must slide in linearly (system lock-in feel).
  - Data rails move horizontally.
  - Agent auras use a slow, continuous pulse.
- **FR-4:** Ensure the "Blink Experience" section accurately mocks a Twitter card interface.

## 5. Definition of Done
- All 6 sections are implemented and render sequentially on `/`.
- Scroll transitions are smooth and tactical (no bounces).
- `npm run lint`, `npm test`, and `npm run build` pass without warnings.